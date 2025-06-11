// lib/getCarreras.ts
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

export async function getCarreras() {
  try {
    const carrerasRef = collection(db, "carreras");
    const snapshot = await getDocs(carrerasRef);
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log("Carreras cargadas:", data);
    return data;
  } catch (error) {
    console.error("Error cargando carreras:", error);
    return [];
  }
}