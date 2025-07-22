import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";
import type { TempUsuario } from "@/types/tempusuario";

export interface InscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

/**
 * Registra una inscripción a través de Stripe, asignando automáticamente el primer número libre.
 */
export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Leer el cupo máximo de la carrera
  const carreraRef = doc(db, "carreras", data.carreraId);
  const carreraSnap = await getDoc(carreraRef);
  const maxCupo = carreraSnap.exists()
    ? (carreraSnap.data() as any).maxCompetitors || 0
    : 0;

  // Encontrar números ya asignados
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const used = usedSnap.docs.map(d => d.data().competitorNumber as number);

  // Calcular el primer número libre
  let assigned = 1;
  while (used.includes(assigned) && assigned <= maxCupo) {
    assigned++;
  }
  if (assigned > maxCupo) {
    throw new Error("Cupo lleno, no se puede inscribir");
  }

  console.log(
    "[registrarInscripcion] sessionId a guardar →",
    data.sessionId,
    "→ competitorNumber:",
    assigned
  );

  // Crear la inscripción con número asignado
  const docRef = await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    sessionId: data.sessionId,
    competitorNumber: assigned,
    paymentStatus: "pending",
    timestamp: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Registra una inscripción manual usando un usuario temporal (TempUsuario).
 * Valida rango, expiración y disponibilidad, descuenta un slot y crea la inscripción.
 */
export async function registrarInscripcionManual(
  adminId: string,
  carreraId: string,
  competitorNumber: number,
  perfilData: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email: string;
    celular: string;
    ciudad: string;
    estado: string;
    pais: string;
    club?: string;
  }
) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Leer el usuario temporal
  const tuRef = doc(db, "tempusuarios", adminId);
  const tuSnap = await getDoc(tuRef);
  if (!tuSnap.exists()) throw new Error("Usuario temporal no encontrado");
  const tu = tuSnap.data() as TempUsuario;

  // Validar expiración
  const now = Date.now();
  // Validar expiración sólo como Date
  const expires = tu.expiresAt.getTime();
  if (expires < now) {
    throw new Error("Cuenta temporal expirada");
  }

  // Validar rango
  if (competitorNumber < tu.startNumber || competitorNumber > tu.endNumber) {
    throw new Error("Número fuera del rango permitido");
  }

  // Verificar disponibilidad
  const ocupSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carreraId),
      where("competitorNumber", "==", competitorNumber)
    )
  );
  if (!ocupSnap.empty) {
    throw new Error("Número ya asignado");
  }

  // Descontar slot disponible
  await updateDoc(tuRef, {
    remainingSlots: tu.remainingSlots - 1
  });

  // Crear la inscripción manual
  const inscRef = await addDoc(collection(db, "inscripciones"), {
    carreraId,
    carreraTitulo: perfilData.nombre,
    perfilId: user.uid,
    perfilOwner: user.uid,
    categoria: "manual",
    sessionId: "",
    competitorNumber,
    paymentStatus: "paid",
    isManualEntry: true,
    manualAdminId: adminId,
    timestamp: serverTimestamp(),
    ...perfilData
  });

  return inscRef.id;
}
