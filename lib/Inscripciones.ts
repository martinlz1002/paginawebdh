import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// Función para asegurar que auth.currentUser esté disponible
async function getAuthenticatedUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        reject(new Error("No estás autenticado"));
      }
    });
  });
}

// 1) Función para registrar la inscripción desde Stripe (pago)
export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string; // Evento
  perfilId: string;

  categoria: string;
  distancia?: string;

  sessionId: string;

  // snapshot persona
  nombre: string;
  paterno: string;
  materno: string;
  nombres: string;

  rama?: string;

  // 👇 OJO: ruta opcional (si no la mandas, se usa distancia)
  ruta?: string;

  pais?: string;
  estado?: string;
  ciudad?: string;
  celular?: string;
  club?: string;

  fechaNacimiento: Date;
  email: string;
}

export async function registrarInscripcion(data: StripeInscripcionData) {
  const user = await getAuthenticatedUser();

  // 1️⃣ Números ya usados
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const usedNumbers = usedSnap.docs.map(
    (d) => d.data().competitorNumber as number
  );

  // 2️⃣ Rangos de inscripciones manuales (links activos)
  const now = new Date();
  const tempSnap = await getDocs(
    query(collection(db, "tempusuarios"), where("expiresAt", ">", now))
  );

  const reservedNumbers: number[] = [];
  tempSnap.docs.forEach((docu) => {
    const rng = docu.data().range as { start: number; end: number };
    if (typeof rng?.start === "number" && typeof rng?.end === "number") {
      for (let n = rng.start; n <= rng.end; n++) reservedNumbers.push(n);
    }
  });

  // 3️⃣ Combinar y asignar primer número libre
  const blocked = new Set<number>([...usedNumbers, ...reservedNumbers]);
  let assigned = 1;
  while (blocked.has(assigned)) assigned++;

  // 4️⃣ Guardar la inscripción de pago (schema completo)
  await addDoc(collection(db, "inscripciones"), {
    // IDs
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,

    // Deportivos
    categoria: data.categoria,
    distancia: data.distancia || null,
    ruta: data.ruta || data.distancia || null,

    // Pago
    sessionId: data.sessionId,
    paymentStatus: "pending",

    // Número (bib/ficha)
    competitorNumber: assigned,
    ficha: assigned,
    bib: assigned,

    // Snapshot nombre
    nombre: data.nombre || null,
    paterno: data.paterno || null,
    materno: data.materno || null,
    nombres: data.nombres || null,

    // Snapshot extra
    rama: data.rama || null,

    pais: data.pais || null,
    estado: data.estado || null,
    ciudad: data.ciudad || null,
    celular: data.celular || null,
    club: data.club || null,

    fechaNacimiento: Timestamp.fromDate(data.fechaNacimiento),
    email: data.email || null,

    timestamp: serverTimestamp(),
  });
} // ✅ esta llave es clave, aquí te faltaba

// 2) Función para registrar la inscripción manual (sin pago)
export interface ManualInscripcionData {
  carreraId: string;
  carreraTitulo: string; // Evento
  manualAdminId?: string; // tempusuario.id

  competitorNumber: number;

  nombre: string;
  paterno: string;
  materno: string;
  nombres: string;

  rama?: string;
  ruta: string;
  categoria: string;

  pais: string;
  estado: string;
  ciudad: string;
  celular: string;
  club?: string;

  fechaNacimiento: Date;
  email: string;
}

export async function registrarInscripcionManual(data: ManualInscripcionData) {
  await addDoc(collection(db, "inscripciones"), {
    // IDs
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: null,
    perfilOwner: "manual",

    // Número
    competitorNumber: data.competitorNumber,
    ficha: data.competitorNumber,
    bib: data.competitorNumber,

    // Snapshot nombre
    nombre: data.nombre || null,
    paterno: data.paterno || null,
    materno: data.materno || null,
    nombres: data.nombres || null,

    // Deportivos
    rama: data.rama || null,
    ruta: data.ruta || null,
    categoria: data.categoria,

    // Lugar / contacto
    pais: data.pais || null,
    estado: data.estado || null,
    ciudad: data.ciudad || null,
    celular: data.celular || null,
    club: data.club || null,

    fechaNacimiento: Timestamp.fromDate(data.fechaNacimiento),
    email: data.email || null,

    // Estado pago
    paymentStatus: "manual",
    sessionId: null,

    isManualEntry: true,
    manualAdminId: data.manualAdminId || null,

    timestamp: serverTimestamp(),
  });
}