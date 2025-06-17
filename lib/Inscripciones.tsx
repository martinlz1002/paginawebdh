import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface InscripcionData {
  carreraId: string;
  perfilId: string;
  categoria: string;
}

export async function registrarInscripcion(data: InscripcionData) {
  await addDoc(
    collection(db, 'inscripciones'),
    {
      perfilId: data.perfilId,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
    }
  );
}