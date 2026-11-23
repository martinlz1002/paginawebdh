
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

import { db, auth } from "./firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// ======================================================
// AUTENTICACIÓN PARA INSCRIPCIONES NORMALES
// ======================================================

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

// ======================================================
// TIPOS
// ======================================================

export type PaymentProvider = "stripe" | "mercadopago";

export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;

  categoria: string;
  distancia?: string;

  paymentProvider: PaymentProvider;

  // Stripe
  sessionId?: string | null;

  // Mercado Pago
  paymentId?: string | null;
  preferenceId?: string | null;
  paymentAttemptId?: string | null;

  // Datos del competidor
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

// ======================================================
// INSCRIPCIÓN NORMAL
// STRIPE / MERCADO PAGO
// ======================================================

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

  // Mercado Pago requiere paymentAttemptId.
  if (
    paymentProvider === "mercadopago" &&
    !data.paymentAttemptId
  ) {
    throw new Error("Falta el ID del intento de pago.");
  }

  // Stripe requiere sessionId.
  if (
    paymentProvider === "stripe" &&
    !data.sessionId
  ) {
    throw new Error("Falta el ID de la sesión de Stripe.");
  }

  // Mercado Pago requiere preferenceId.
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

      // Datos deportivos
      categoria: data.categoria,
      distancia: data.distancia || null,
      ruta: data.ruta || data.distancia || null,

      // Información del pago
      paymentProvider,

      paymentAttemptId:
        data.paymentAttemptId ?? null,

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

      // El backend asignará el número al confirmar el pago.
      competitorNumber: null,
      ficha: null,
      bib: null,

      // Nombre
      nombre: data.nombre || null,
      paterno: data.paterno || null,
      materno: data.materno || null,
      nombres: data.nombres || null,

      // Datos adicionales
      rama: data.rama || null,

      pais: data.pais || null,
      estado: data.estado || null,
      ciudad: data.ciudad || null,
      celular: data.celular || null,
      club: data.club || null,

      tallaPlayera: data.tallaPlayera || null,
      telefonoEmergencia:
        data.telefonoEmergencia || null,

      fechaNacimiento: Timestamp.fromDate(
        data.fechaNacimiento
      ),

      email: data.email || null,

      timestamp: serverTimestamp(),
    }
  );

  return inscripcionRef.id;
}

// ======================================================
// INSCRIPCIÓN MANUAL
// SIN FIREBASE AUTH PARA EL ORGANIZADOR
// ======================================================

export interface ManualInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  manualAdminId?: string;

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

// ======================================================
// REGISTRAR INSCRIPCIÓN MANUAL
// AHORA UTILIZA API + FIREBASE ADMIN
// ======================================================

export async function registrarInscripcionManual(
  data: ManualInscripcionData
): Promise<string> {

  // ----------------------------------------------------
  // 1. Validaciones iniciales
  // ----------------------------------------------------

  const numero = Number(data.competitorNumber);

  if (!data.carreraId?.trim()) {
    throw new Error(
      "No se especificó la carrera de la inscripción."
    );
  }

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    throw new Error(
      "El número de competidor no es válido."
    );
  }

  if (!data.manualAdminId) {
    throw new Error(
      "No se encontró la identificación del acceso temporal."
    );
  }

  if (
    !(data.fechaNacimiento instanceof Date) ||
    !Number.isFinite(data.fechaNacimiento.getTime())
  ) {
    throw new Error(
      "La fecha de nacimiento no es válida."
    );
  }

  // ----------------------------------------------------
  // 2. Recuperar sesión temporal
  // ----------------------------------------------------

  let tempUser: {
    id?: string;
    username?: string;
    password?: string;
    carreraId?: string;
    expiresAtMs?: number;
  } | null = null;

  try {
    const storedUser = localStorage.getItem("tempUser");

    if (storedUser) {
      tempUser = JSON.parse(storedUser);
    }
  } catch {
    throw new Error(
      "No se pudo recuperar la sesión temporal. Inicia sesión nuevamente."
    );
  }

  if (
    !tempUser ||
    tempUser.id !== data.manualAdminId ||
    !tempUser.username ||
    !tempUser.password
  ) {
    throw new Error(
      "La sesión temporal no es válida. Inicia sesión nuevamente."
    );
  }

  // ----------------------------------------------------
  // 3. Verificar que corresponda a la carrera
  // ----------------------------------------------------

  if (tempUser.carreraId !== data.carreraId) {
    throw new Error(
      "El acceso temporal no corresponde a esta carrera."
    );
  }

  // ----------------------------------------------------
  // 4. Comprobar expiración local
  // ----------------------------------------------------

  if (
    typeof tempUser.expiresAtMs !== "number" ||
    !Number.isFinite(tempUser.expiresAtMs) ||
    tempUser.expiresAtMs <= Date.now()
  ) {
    localStorage.removeItem("tempUser");

    throw new Error(
      "El acceso temporal ha expirado. Solicita un nuevo enlace."
    );
  }

  // ----------------------------------------------------
  // 5. Formatear fecha sin desfases de zona horaria
  // ----------------------------------------------------

  const fecha = data.fechaNacimiento;

  const fechaNacimiento = [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, "0"),
    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");

  // ----------------------------------------------------
  // 6. Enviar inscripción al servidor
  // ----------------------------------------------------

  const response = await fetch(
    "/api/registrar-inscripcion-manual",
    {
      method: "POST",
      cache: "no-store",

      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },

      body: JSON.stringify({
        credentials: {
          username: tempUser.username,
          password: tempUser.password,
        },

        tempId: tempUser.id,

        carreraTitulo: data.carreraTitulo,

        competitorNumber: numero,

        fechaNacimiento,

        // Datos personales
        nombre: data.nombre,
        paterno: data.paterno,
        materno: data.materno,
        nombres: data.nombres,

        // Datos deportivos
        rama: data.rama || "",
        ruta: data.ruta,
        categoria: data.categoria,

        // Ubicación
        pais: data.pais,
        estado: data.estado,
        ciudad: data.ciudad,

        // Contacto
        celular: data.celular,
        email: data.email,
        club: data.club || "",

        // Datos adicionales
        tallaPlayera: data.tallaPlayera || "",
        telefonoEmergencia:
          data.telefonoEmergencia || "",
      }),
    }
  );

  // ----------------------------------------------------
  // 7. Procesar respuesta del servidor
  // ----------------------------------------------------

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok || !result?.id) {

    const mensaje =
      result?.error ||
      "No se pudo registrar al competidor.";

    if (response.status === 410) {
      localStorage.removeItem("tempUser");
    }

    throw new Error(mensaje);
  }

  // ----------------------------------------------------
  // 8. Devolver ID de inscripción
  // ----------------------------------------------------

  return result.id;
}
