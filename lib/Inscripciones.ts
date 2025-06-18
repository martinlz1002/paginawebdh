import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface InscripcionData {
  carreraId: string;
  perfilId: string;
  categoria: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  // 1) Asegurarnos de que el usuario está autenticado
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No estás autenticado");
  }

  // 2) Hacer la inscripción, incluyendo perfilOwner
  await addDoc(
    collection(db, 'inscripciones'),
    {
      carreraId: data.carreraId,
      perfilId: data.perfilId,
      perfilOwner: user.uid,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
    }
  );
}