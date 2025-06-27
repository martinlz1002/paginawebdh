import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface InscripcionData {
  carreraId: string;
  carreraSlug: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Colección anidada: inscripciones/{slug}/
  const colRef = collection(db, "inscripciones", data.carreraSlug, "docs");
  await addDoc(colRef, {
    carreraId: data.carreraId,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    timestamp: serverTimestamp(),
    paymentStatus: "pending",
    sessionId: data.sessionId,
  });
}