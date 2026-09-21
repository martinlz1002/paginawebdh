import {
  collection,
  addDoc,
  serverTimestamp,
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

// 1) Función para registrar la inscripción desde 

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

  fechaNacimiento: Date;
  email: string;
}

export async function registrarInscripcion(
  data: StripeInscripcionData
) {
  const user = await getAuthenticatedUser();

  const paymentProvider = data.paymentProvider;

if (!paymentProvider) {
  throw new Error(
    "No se especificó el proveedor de pago de la inscripción."
  );
}

if (!data.paymentAttemptId) {
  throw new Error(
    "Falta el ID del intento de pago."
  );
}

  // Validar que exista la referencia correspondiente
  if (paymentProvider === "stripe" && !data.sessionId) {
    throw new Error(
      "Falta el ID de la sesión de Stripe."
    );
  }

  if (
    paymentProvider === "mercadopago" &&
    !data.preferenceId
  ) {
    throw new Error(
      "Falta el ID de preferencia de Mercado Pago."
    );
  }

  const inscripcionRef = await addDoc(
    collection(db, "inscripciones"),
    {
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

      paymentAttemptId: data.paymentAttemptId,

      sessionId:
        paymentProvider === "stripe"
          ? data.sessionId || null
          : null,

      paymentId: data.paymentId || null,

      preferenceId:
        paymentProvider === "mercadopago"
          ? data.preferenceId || null
          : null,

      paymentStatus: "pending",

      // El backend asignará el número al confirmar el pago
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

      fechaNacimiento: Timestamp.fromDate(
        data.fechaNacimiento
      ),

      email: data.email || null,

      timestamp: serverTimestamp(),
    }
  );

  // Devolvemos el ID para relacionarlo con el pago
  return inscripcionRef.id;
}

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

    // Número (manual sí lo define)
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
