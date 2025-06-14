import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export async function getCarreras() {
  try {
    const snapshot = await getDocs(collection(db, 'carreras'));
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error cargando carreras:', error);
    return [];
  }
}