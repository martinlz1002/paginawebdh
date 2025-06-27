import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "./firebase";

export interface InscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // Antes: collection(db, "inscripciones")
  // Ahora: sub-colección "docs" bajo cada carrera
  const docsCol = collection(
    db,
    "inscripciones",
    data.carreraId,
    "docs"
  );

  await addDoc(docsCol, {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    timestamp: serverTimestamp(),
    paymentStatus: "pending",
    sessionId: data.sessionId,
  });
}