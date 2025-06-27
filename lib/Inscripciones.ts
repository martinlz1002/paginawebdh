import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface InscripcionData {
  carreraId: string;     // ahora usamos carreraId como padre
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Guarda en inscripciones/{carreraId}/docs
  await addDoc(
    collection(db, "inscripciones", data.carreraId, "docs"),
    {
      carreraId: data.carreraId,
      perfilId: data.perfilId,
      perfilOwner: user.uid,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
      paymentStatus: "pending",
      sessionId: data.sessionId,
    }
  );
}