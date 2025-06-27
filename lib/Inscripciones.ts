import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface InscripcionData {
  carreraId: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Ahora guardamos dentro de la subcolección "docs" bajo el doc = carreraId
  await addDoc(
    collection(db, "inscripciones", data.carreraId, "docs"),
    {
      perfilOwner: user.uid,
      perfilId: data.perfilId,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
      paymentStatus: "pending",
      sessionId: data.sessionId,
    }
  );
}