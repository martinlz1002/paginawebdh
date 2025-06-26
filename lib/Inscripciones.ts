import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface InscripcionData {
  carreraId: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: InscripcionData, sessionId?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // 1) Creamos el documento (sin sessionId aún)
  const ref = await addDoc(
    collection(db, 'inscripciones'),
    {
      carreraId: data.carreraId,
      perfilId: data.perfilId,
      perfilOwner: user.uid,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
      paymentStatus: 'pending',
      sessionId: data.sessionId,
    }
  );

  // 2) Si ya tienes sessionId, actualiza el documento para inyectarlo
  if (sessionId) {
    await updateDoc(doc(db, 'inscripciones', ref.id), { sessionId });
  }

  return ref.id;
}