// lib/getCarreras.ts
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

export async function getCarreras() {
  const carrerasRef = collection(db, "carreras");
  const snapshot = await getDocs(carrerasRef);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}