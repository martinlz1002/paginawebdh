
import { auth, db } from "@/lib/firebase";
import { signInAnonymously } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

export type MesaRange = {
  id: string;
  nombre: string;
  desde: number;
  hasta: number;
  totalCompetidores?: number;
};

export type EstadoEntregaSession =
  | "preparando"
  | "activa"
  | "finalizada";

export type EntregaSession = {
  id: string;
  tituloEvento?: string;
  carreraId?: string | null;
  estado: EstadoEntregaSession;
  totalCompetidores: number;
  ranges?: MesaRange[];
  pinSalt?: string;
  pinHash?: string;
  pinVersion?: number;
  createdAt?: any;
  finalizedAt?: any;
  updatedAt?: any;
  [key: string]: any;
};

const COLLECTION_SESIONES = "entregasKits";
const COLLECTION_CONTROL = "entregasKitsControl";
const CONTROL_ACTIVA_ID = "active";

const COLLECTION_BUSQUEDA = "busquedaCompetidor";
const DOCUMENTO_BUSQUEDA_ACTIVA = "active";
const SUBCOLECCION_PUBLICOS = "publicCompetidores";

const MAX_BATCH_WRITES = 400;

let anonymousSignIn: Promise<void> | null = null;

/**
 * Las estaciones se abren mediante enlace.
 * Si el navegador no tiene sesión Firebase, crea una sesión anónima.
 */
export async function ensureEntregaAuth(): Promise<void> {
  if (typeof window === "undefined" || auth.currentUser) return;

  if (!anonymousSignIn) {
    anonymousSignIn = signInAnonymously(auth)
      .then(() => undefined)
      .finally(() => {
        anonymousSignIn = null;
      });
  }

  await anonymousSignIn;
}

export function normalizeBib(value: unknown): number {
  const text = String(value ?? "").trim();

  if (!/^\d+$/.test(text)) return NaN;

  const number = Number(text);

  return Number.isSafeInteger(number) && number > 0
    ? number
    : NaN;
}

export function validateMesaRanges(ranges: MesaRange[]): string | null {
  if (!ranges.length) return "Agrega al menos una mesa.";

  const ids = new Set<string>();
  const names = new Set<string>();
  const sorted = [...ranges].sort((a, b) => a.desde - b.desde);

  for (const range of sorted) {
    if (!range.id.trim() || !range.nombre.trim()) {
      return "Todas las mesas necesitan identificador y nombre.";
    }

    if (ids.has(range.id)) {
      return "Los identificadores de mesa deben ser únicos.";
    }

    if (names.has(range.nombre.trim().toLowerCase())) {
      return "No repitas nombres de mesa.";
    }

    if (
      !Number.isSafeInteger(range.desde) ||
      !Number.isSafeInteger(range.hasta) ||
      range.desde < 1 ||
      range.hasta < range.desde
    ) {
      return `El rango de ${range.nombre} no es válido.`;
    }

    ids.add(range.id);
    names.add(range.nombre.trim().toLowerCase());
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].desde <= sorted[i - 1].hasta) {
      return `Los rangos de ${sorted[i - 1].nombre} y ${sorted[i].nombre} se enciman.`;
    }
  }

  return null;
}

export function getMesaForBib(
  ranges: MesaRange[],
  bib: number
): MesaRange | undefined {
  return ranges.find(
    (range) => bib >= range.desde && bib <= range.hasta
  );
}

export async function hashEntregaPin(
  pin: string,
  salt: string
): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

export function createEntregaSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(
    bytes,
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}

export async function verifyEntregaPin(
  pin: string,
  config?: Record<string, any> | null
): Promise<boolean> {
  if (
    !/^\d{4,8}$/.test(pin) ||
    !config?.pinSalt ||
    !config?.pinHash
  ) {
    return false;
  }

  const candidate = await hashEntregaPin(
    pin,
    String(config.pinSalt)
  );

  return candidate === String(config.pinHash);
}

/**
 * Obtiene la referencia de la sesión activa.
 */
export async function loadActiveEntregaSession(): Promise<EntregaSession | null> {
  const controlRef = doc(
    db,
    COLLECTION_CONTROL,
    CONTROL_ACTIVA_ID
  );

  const controlSnapshot = await getDoc(controlRef);

  if (!controlSnapshot.exists()) return null;

  const sessionId = controlSnapshot.data()?.sessionId;

  if (typeof sessionId !== "string" || !sessionId.trim()) {
    return null;
  }

  const sessionRef = doc(db, COLLECTION_SESIONES, sessionId);
  const sessionSnapshot = await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) return null;

  const data = sessionSnapshot.data();

  if (data.estado !== "activa") return null;

  return {
    id: sessionSnapshot.id,
    ...data,
  } as EntregaSession;
}

/**
 * Mantiene compatibilidad con los componentes que anteriormente
 * utilizaban loadEntregaConfig().
 *
 * Ahora devuelve la configuración de la sesión activa.
 */
export async function loadEntregaConfig(): Promise<Record<string, any> | null> {
  return await loadActiveEntregaSession();
}

/**
 * Crea una sesión nueva utilizando los competidores publicados
 * actualmente en Buscar Competidor.
 *
 * Cada competidor se copia a la sesión y su estado comienza en pendiente.
 * Los documentos originales nunca se modifican.
 */
export async function createEntregaSession(): Promise<string> {
  const activeSession = await loadActiveEntregaSession();

  if (activeSession) {
    throw new Error(
      "Ya existe una sesión de entrega activa. Finalízala antes de crear otra."
    );
  }

  const busquedaRef = doc(
    db,
    COLLECTION_BUSQUEDA,
    DOCUMENTO_BUSQUEDA_ACTIVA
  );

  const busquedaSnapshot = await getDoc(busquedaRef);

  if (!busquedaSnapshot.exists()) {
    throw new Error(
      "No hay una lista de competidores publicada."
    );
  }

  const busquedaData = busquedaSnapshot.data();

  const publicCompetitorsRef = collection(
    db,
    COLLECTION_BUSQUEDA,
    DOCUMENTO_BUSQUEDA_ACTIVA,
    SUBCOLECCION_PUBLICOS
  );

  const competitorsSnapshot = await getDocs(publicCompetitorsRef);

  if (competitorsSnapshot.empty) {
    throw new Error(
      "La lista publicada no contiene competidores."
    );
  }

  const sessionRef = doc(collection(db, COLLECTION_SESIONES));

  const sessionId = sessionRef.id;

  const tituloEvento =
    busquedaData.nombreEvento ||
    busquedaData.nombreCarrera ||
    busquedaData.evento ||
    "Entrega de kits";

  // Primera escritura: registrar la sesión como preparación.
  const initialBatch = writeBatch(db);

  initialBatch.set(sessionRef, {
    tituloEvento,
    carreraId: busquedaData.carreraId || null,
    estado: "preparando",
    totalCompetidores: competitorsSnapshot.size,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await initialBatch.commit();

  // Copiar participantes en bloques para respetar el límite de Firestore.
  const participants = competitorsSnapshot.docs;

  for (
    let start = 0;
    start < participants.length;
    start += MAX_BATCH_WRITES
  ) {
    const batch = writeBatch(db);

    const chunk = participants.slice(
      start,
      start + MAX_BATCH_WRITES
    );

    for (const competitorDoc of chunk) {
      const original = competitorDoc.data();

      const participantRef = doc(
        db,
        COLLECTION_SESIONES,
        sessionId,
        "participantes",
        competitorDoc.id
      );

      batch.set(participantRef, {
        ...original,
        competitorId: competitorDoc.id,
        estadoEntrega: "pendiente",
        mesaId: null,
        mesaNombre: null,
        encontradoAt: null,
        entregadoAt: null,
      });
    }

    await batch.commit();
  }

  // La sesión sólo se activa después de copiar todos los participantes.
  const finalBatch = writeBatch(db);

  finalBatch.update(sessionRef, {
    estado: "activa",
    updatedAt: serverTimestamp(),
  });

  finalBatch.set(
    doc(db, COLLECTION_CONTROL, CONTROL_ACTIVA_ID),
    {
      sessionId,
      updatedAt: serverTimestamp(),
    }
  );

  await finalBatch.commit();

  return sessionId;
}

/**
 * Finaliza la sesión activa y libera el indicador de sesión actual.
 * La sesión y sus participantes permanecen guardados como historial.
 */
export async function finalizeEntregaSession(
  sessionId: string
): Promise<void> {
  const sessionRef = doc(db, COLLECTION_SESIONES, sessionId);
  const controlRef = doc(
    db,
    COLLECTION_CONTROL,
    CONTROL_ACTIVA_ID
  );

  const [sessionSnapshot, controlSnapshot] = await Promise.all([
    getDoc(sessionRef),
    getDoc(controlRef),
  ]);

  if (!sessionSnapshot.exists()) {
    throw new Error("La sesión no existe.");
  }

  if (sessionSnapshot.data().estado !== "activa") {
    throw new Error("La sesión no está activa.");
  }

  if (
    !controlSnapshot.exists() ||
    controlSnapshot.data().sessionId !== sessionId
  ) {
    throw new Error(
      "La sesión no coincide con el indicador de sesión activa."
    );
  }

  const batch = writeBatch(db);

  batch.update(controlRef, {
    sessionId: null,
    updatedAt: serverTimestamp(),
  });

  batch.update(sessionRef, {
    estado: "finalizada",
    finalizedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Elimina una sesión finalizada y todos sus participantes.
 * No elimina ni modifica la lista original de Buscar Competidor.
 */
export async function deleteEntregaSession(
  sessionId: string
): Promise<void> {
  const sessionRef = doc(db, COLLECTION_SESIONES, sessionId);
  const controlRef = doc(
    db,
    COLLECTION_CONTROL,
    CONTROL_ACTIVA_ID
  );

  const [sessionSnapshot, controlSnapshot] = await Promise.all([
    getDoc(sessionRef),
    getDoc(controlRef),
  ]);

  if (!sessionSnapshot.exists()) {
    throw new Error("La sesión que intentas eliminar no existe.");
  }

  if (sessionSnapshot.data().estado !== "finalizada") {
    throw new Error(
      "Solo puedes eliminar sesiones que ya estén finalizadas."
    );
  }

  if (
    controlSnapshot.exists() &&
    controlSnapshot.data().sessionId === sessionId
  ) {
    throw new Error(
      "No puedes eliminar la sesión que está marcada como activa."
    );
  }

  const participantsRef = collection(
    db,
    COLLECTION_SESIONES,
    sessionId,
    "participantes"
  );

  const participantsSnapshot = await getDocs(participantsRef);
  const participants = participantsSnapshot.docs;

  // Firestore no elimina automáticamente las subcolecciones.
  for (
    let start = 0;
    start < participants.length;
    start += MAX_BATCH_WRITES
  ) {
    const batch = writeBatch(db);

    const chunk = participants.slice(
      start,
      start + MAX_BATCH_WRITES
    );

    for (const participantDoc of chunk) {
      batch.delete(participantDoc.ref);
    }

    await batch.commit();
  }

  await deleteDoc(sessionRef);
}
