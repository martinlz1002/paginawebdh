import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "firebase/firestore";
import { db, auth } from "./firebase";

//
// 1) Función para registrar la inscripción desde Stripe (pago)
//
export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: StripeInscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // 1️⃣ Calcular el siguiente número de competidor libre (incluye manuales y pagos)
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const usedNumbers = usedSnap.docs.map(d => d.data().competitorNumber as number);
  let assigned = 1;
  while (usedNumbers.includes(assigned)) {
    assigned++;
  }

  console.log(
    "[registrarInscripcion] asignando competitorNumber →",
    assigned
  );

  // 2️⃣ Guardar la inscripción con número asignado
  await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    sessionId: data.sessionId,
    paymentStatus: "pending",
    competitorNumber: assigned,
    timestamp: serverTimestamp(),
  });
}

//
// 2) Función para registrar la inscripción manual (sin pago)
//
export interface ManualInscripcionData {
  carreraId: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club?: string;
  competitorNumber: number;
  paymentStatus: "manual";
  timestamp?: any;
}

export async function registrarInscripcionManual(data: ManualInscripcionData) {
  // 1️⃣ Verificar que número no esté ya usado
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", "==", data.competitorNumber)
    )
  );
  if (!usedSnap.empty) {
    throw new Error("Número de competidor ya registrado");
  }

  // 2️⃣ Guardar la inscripción manual
  await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    perfilNombre: data.perfilNombre,
    perfilApPaterno: data.perfilApPaterno,
    perfilApMaterno: data.perfilApMaterno,
    email: data.email,
    celular: data.celular,
    ciudad: data.ciudad,
    estado: data.estado,
    pais: data.pais,
    club: data.club,
    competitorNumber: data.competitorNumber,
    paymentStatus: data.paymentStatus,
    perfilOwner: "manual",    // distinguir manual
    sessionId: null,
    timestamp: serverTimestamp(),
  });
}