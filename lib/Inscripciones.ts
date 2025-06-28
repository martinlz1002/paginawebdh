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
   console.log('[registrarInscripcion] sessionId a guardar →', data.sessionId);
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  await addDoc(collection(db, "inscripciones"), {
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