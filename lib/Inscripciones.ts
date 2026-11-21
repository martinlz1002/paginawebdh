import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// Función para asegurar que auth.currentUser esté disponible
async function getAuthenticatedUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;

  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();

      if (user) {
        resolve(user);
      } else {
        reject(new Error("No estás autenticado"));
      }
    });
  });
}

export type PaymentProvider = "stripe" | "mercadopago";

export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;

  categoria: string;
  distancia?: string;

  // Proveedor de pago
  paymentProvider: PaymentProvider;

  // Stripe
  sessionId?: string | null;

  // Mercado Pago
  paymentId?: string | null;
  preferenceId?: string | null;
  paymentAttemptId?: string | null;

  // Snapshot persona
  nombre: string;
  paterno: string;
  materno: string;
  nombres: string;

  rama?: string;
  ruta?: string;

  pais?: string;
  estado?: string;
  ciudad?: string;
  celular?: string;
  club?: string;

  tallaPlayera?: string;
  telefonoEmergencia?: string;

  fechaNacimiento: Date;
  email: string;
}

export async function registrarInscripcion(data: StripeInscripcionData) {
  const user = await getAuthenticatedUser();
  const paymentProvider = data.paymentProvider;

  if (!paymentProvider) {
    throw new Error(
      "No se especificó el proveedor de pago de la inscripción."
    );
  }

  // Mercado Pago requiere paymentAttemptId.
  // Stripe relaciona la inscripción mediante sessionId.
  if (paymentProvider === "mercadopago" && !data.paymentAttemptId) {
    throw new Error("Falta el ID del intento de pago.");
  }

  // Validar que exista la referencia correspondiente.
  if (paymentProvider === "stripe" && !data.sessionId) {
    throw new Error("Falta el ID de la sesión de Stripe.");
  }

  if (paymentProvider === "mercadopago" && !data.preferenceId) {
    throw new Error("Falta el ID de preferencia de Mercado Pago.");
  }

  const inscripcionRef = await addDoc(collection(db, "inscripciones"), {
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
    paymentProvider,
    paymentAttemptId: data.paymentAttemptId ?? null,

    sessionId:
      paymentProvider === "stripe" ? data.sessionId || null : null,

    paymentId: data.paymentId || null,

    preferenceId:
      paymentProvider === "mercadopago" ? data.preferenceId || null : null,

    paymentStatus: "pending",

    // El backend asignará el número al confirmar el pago.
    competitorNumber: null,
    ficha: null,
    bib: null,

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

    tallaPlayera: data.tallaPlayera || null,
    telefonoEmergencia: data.telefonoEmergencia || null,

    fechaNacimiento: Timestamp.fromDate(data.fechaNacimiento),
    email: data.email || null,

    timestamp: serverTimestamp(),
  });

  // Devolvemos el ID para relacionarlo con el pago.
  return inscripcionRef.id;
}

// 2) Función para registrar la inscripción manual (sin pago).
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

  tallaPlayera?: string;
  telefonoEmergencia?: string;

  fechaNacimiento: Date;
  email: string;
}

export async function registrarInscripcionManual(
  data: ManualInscripcionData
) {
  const numero = Number(data.competitorNumber);

  if (!data.carreraId?.trim()) {
    throw new Error("No se especificó la carrera de la inscripción.");
  }

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error("El número de competidor no es válido.");
  }

  /*
   * Firestore Web SDK no permite transaction.get(query). Por eso primero
   * obtenemos una fotografía de las inscripciones y de la revisión del
   * asignador. Después, dentro de la transacción, comprobamos que la revisión
   * siga siendo la misma antes de guardar.
   *
   * Si Stripe, Mercado Pago u otra inscripción manual modifica el documento
   * numberAllocators/{carreraId} durante este proceso, la transacción se
   * cancela y el usuario debe actualizar la disponibilidad.
   */
  const inscripcionRef = doc(collection(db, "inscripciones"));
  const allocatorRef = doc(db, "numberAllocators", data.carreraId);
  const inscripcionesCarreraQuery = query(
    collection(db, "inscripciones"),
    where("carreraId", "==", data.carreraId)
  );

  // Lecturas compatibles con Firebase Web SDK, fuera de la transacción.
  // El orden importa: primero capturamos la revisión y después consultamos
  // las inscripciones. Si hay una asignación entre ambas lecturas, la revisión
  // volverá a cambiar y la transacción detectará el desfase.
  const allocatorInicialSnap = await getDoc(allocatorRef);
  const inscripcionesSnap = await getDocs(inscripcionesCarreraQuery);

  const revisionInicial = Number(
    allocatorInicialSnap.exists()
      ? allocatorInicialSnap.data().revision ?? 0
      : 0
  );

  if (!Number.isSafeInteger(revisionInicial) || revisionInicial < 0) {
    throw new Error(
      "El control de asignación de números tiene una revisión inválida. Contacta al administrador."
    );
  }

  // No permitir un número que ya aparezca en alguna inscripción de la carrera.
  const numeroOcupado = inscripcionesSnap.docs.some((inscripcionDoc) => {
    const inscripcion = inscripcionDoc.data();
    const numerosExistentes = [
      inscripcion.competitorNumber,
      inscripcion.ficha,
      inscripcion.bib,
    ]
      .map((valor) => Number(valor))
      .filter((valor) => Number.isSafeInteger(valor) && valor > 0);

    return numerosExistentes.includes(numero);
  });

  if (numeroOcupado) {
    throw new Error(
      `El número ${numero} ya está asignado a otro competidor. Actualiza la disponibilidad e intenta con otro número.`
    );
  }

  await runTransaction(db, async (transaction) => {
    // El SDK Web sí permite leer documentos individuales dentro de la transacción.
    const allocatorSnap = await transaction.get(allocatorRef);

    const revisionActual = Number(
      allocatorSnap.exists() ? allocatorSnap.data().revision ?? 0 : 0
    );

    /*
     * Si cambió el asignador desde que consultamos las inscripciones,
     * la fotografía de ocupación ya no es confiable. Abortamos en lugar
     * de arriesgarnos a registrar un número duplicado.
     */
    if (revisionActual !== revisionInicial) {
      throw new Error(
        "La disponibilidad de números cambió mientras realizabas la inscripción. Actualiza la página y selecciona nuevamente el número."
      );
    }

    transaction.set(
      allocatorRef,
      {
        revision: revisionActual + 1,
        updatedAt: Date.now(),
      },
      { merge: true }
    );

    transaction.set(inscripcionRef, {
      // IDs
      carreraId: data.carreraId,
      carreraTitulo: data.carreraTitulo,
      perfilId: null,
      perfilOwner: "manual",

      // Número (manual sí lo define)
      competitorNumber: numero,
      ficha: numero,
      bib: numero,

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

      tallaPlayera: data.tallaPlayera || null,
      telefonoEmergencia: data.telefonoEmergencia || null,

      fechaNacimiento: Timestamp.fromDate(data.fechaNacimiento),
      email: data.email || null,

      // Estado pago
      paymentStatus: "manual",
      sessionId: null,

      isManualEntry: true,
      manualAdminId: data.manualAdminId || null,

      timestamp: serverTimestamp(),
    });
  });

  return inscripcionRef.id;
}
