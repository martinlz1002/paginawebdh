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

export interface InscripcionData {
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
  paymentStatus: string; // "manual"
  timestamp?: any;
}

export async function registrarInscripcionManual(data: InscripcionData) {
  // No auth, pues vienen por tempUser
  // 1) Verificar que número no esté ya usado
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
  // 2) Guardar
  await addDoc(collection(db, "inscripciones"), {
    ...data,
    perfilOwner: "manual",        // marca para distinguir
    sessionId: null,
    createdAt: serverTimestamp()
  });
}