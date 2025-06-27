import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface InscripcionData {
  carreraId: string;
  carreraTitulo: string;     // ← nuevo campo
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,   // ← lo guardamos también
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    timestamp: serverTimestamp(),
    paymentStatus: "pending",
    sessionId: data.sessionId,
  });
}