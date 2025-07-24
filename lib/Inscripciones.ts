import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  where,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";

//
// 1) Función para registrar la inscripción desde Stripe (pago)
//
export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
}

export async function registrarInscripcion(data: StripeInscripcionData) {
  const user = auth.currentUser;
  if (!user) throw new Error("No estás autenticado");

  // 1️⃣ Obtener todos los números ya asignados (pagos + manuales ya guardadas)
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const usedNumbers = usedSnap.docs.map(d => d.data().competitorNumber as number);

  // 2️⃣ Obtener rangos activos de inscripciones manuales (no expirados)
  const now = new Date();
  const tempSnap = await getDocs(
    query(
      collection(db, "tempusuarios"),
      where("expiresAt", ">", now)
    )
  );
  const reservedNumbers: number[] = [];
  tempSnap.docs.forEach(doc => {
    const rng = doc.data().range as { start: number; end: number };
    // Validar que start y end sean numbers
    if (typeof rng.start === "number" && typeof rng.end === "number") {
      for (let n = rng.start; n <= rng.end; n++) {
        reservedNumbers.push(n);
      }
    }
  });

  // 3️⃣ Combinar y buscar el primer número libre
  const blocked = new Set<number>([...usedNumbers, ...reservedNumbers]);
  let assigned = 1;
  while (blocked.has(assigned)) {
    assigned++;
  }

  // 4️⃣ Guardar la inscripción de pago
  await addDoc(collection(db, "inscripciones"), {
    carreraId:        data.carreraId,
    carreraTitulo:    data.carreraTitulo,
    perfilId:         data.perfilId,
    perfilOwner:      user.uid,
    categoria:        data.categoria,
    sessionId:        data.sessionId,
    paymentStatus:    "pending",
    competitorNumber: assigned,
    timestamp:        serverTimestamp(),
  });
}

//
// 2) Función para registrar la inscripción manual (sin pago)
//    Sólo escribe; la validación de disponibilidad viene del endpoint /api/temp-avail
//
export interface ManualInscripcionData {
  carreraId: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  birthDate: Date;
  categoria: string;
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club?: string;
  competitorNumber: number;
}

export async function registrarInscripcionManual(data: ManualInscripcionData) {
  await addDoc(collection(db, "inscripciones"), {
    carreraId:        data.carreraId,
    perfilNombre:     data.perfilNombre,
    perfilApPaterno:  data.perfilApPaterno,
    perfilApMaterno:  data.perfilApMaterno,
    birthDate:        Timestamp.fromDate(data.birthDate),
    categoria:        data.categoria,
    email:            data.email,
    celular:          data.celular,
    ciudad:           data.ciudad,
    estado:           data.estado,
    pais:             data.pais,
    club:             data.club || null,
    competitorNumber: data.competitorNumber,
    paymentStatus:    "manual",
    perfilOwner:      "manual",   // esencial para las reglas de seguridad
    sessionId:        null,
    timestamp:        serverTimestamp(),
  });
}