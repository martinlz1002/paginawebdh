import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";

//
// 1) Función para registrar la inscripción desde Stripe (pago)
// (queda igual que antes)
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

  // asigna siguiente número libre (manuales + pagos)
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const used = usedSnap.docs.map(d => d.data().competitorNumber as number);
  let assigned = 1;
  while (used.includes(assigned)) assigned++;

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
//   ahora incluyendo birthDate y categoria
//
export interface ManualInscripcionData {
  carreraId: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  birthDate: Date;           // <--- nueva
  categoria: string;         // <--- nueva
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club?: string;
  competitorNumber: number;
  paymentStatus: "manual";
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

  // 2️⃣ Guardar la inscripción manual con birthDate & categoria
  await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    perfilNombre: data.perfilNombre,
    perfilApPaterno: data.perfilApPaterno,
    perfilApMaterno: data.perfilApMaterno,
    birthDate: Timestamp.fromDate(data.birthDate),  // guardamos timestamp
    categoria: data.categoria,
    email: data.email,
    celular: data.celular,
    ciudad: data.ciudad,
    estado: data.estado,
    pais: data.pais,
    club: data.club,
    competitorNumber: data.competitorNumber,
    paymentStatus: data.paymentStatus,
    perfilOwner: "manual",
    sessionId: null,
    timestamp: serverTimestamp(),
  });
}