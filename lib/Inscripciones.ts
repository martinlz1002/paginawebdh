import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  doc,
  getDoc
} from "firebase/firestore";
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

  // 1️⃣ Leer el cupo máximo de la carrera
  const carreraRef = doc(db, "carreras", data.carreraId);
  const carreraSnap = await getDoc(carreraRef);
  const maxCupo = carreraSnap.exists()
    ? (carreraSnap.data() as any).maxCompetitors || 0
    : 0;

  // 2️⃣ Encontrar números ya asignados (cualquier inscripción con competitorNumber)
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const used = usedSnap.docs.map(d => d.data().competitorNumber as number);

  // 3️⃣ Calcular el primer número libre
  let assigned = 1;
  while (used.includes(assigned) && assigned <= maxCupo) {
    assigned++;
  }
  if (assigned > maxCupo) {
    throw new Error("Cupo lleno, no se puede inscribir");
  }

  console.log(
    "[registrarInscripcion] sessionId a guardar →",
    data.sessionId,
    "→ competitorNumber:",
    assigned
  );

  // 4️⃣ Crear la inscripción ya con número asignado
  const docRef = await addDoc(collection(db, "inscripciones"), {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    sessionId: data.sessionId,
    competitorNumber: assigned,
    paymentStatus: "pending",
    timestamp: serverTimestamp(),
  });

  return docRef.id;
}