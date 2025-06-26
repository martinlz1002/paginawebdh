import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';

export interface InscripcionData {
  carreraId: string;
  perfilId: string;
  categoria: string;
  // NO incluimos sessionId aquí: lo pasamos opcionalmente después
}

/**
 * Crea una nueva inscripción con estado "pending".
 * Si recibes el sessionId justo después de crear la sesión de Stripe,
 * pásalo como segundo parámetro para actualizar el doc.
 */
export async function registrarInscripcion(
  data: InscripcionData,
  sessionId?: string
) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // 1) Creamos el documento con paymentStatus: 'pending'
  const docRef = await addDoc(
    collection(db, 'inscripciones'),
    {
      carreraId: data.carreraId,
      perfilId: data.perfilId,
      perfilOwner: user.uid,
      categoria: data.categoria,
      timestamp: serverTimestamp(),
      paymentStatus: 'pending'
    }
  );

  // 2) Si ya tienes sessionId (p. ej. tras crear la sesión Stripe),
  //    lo inyectas aquí.
  if (sessionId) {
    await updateDoc(doc(db, 'inscripciones', docRef.id), { sessionId });
  }

  return docRef.id;
}