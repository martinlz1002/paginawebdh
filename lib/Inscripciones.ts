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
import { onAuthStateChanged, User } from "firebase/auth";

// Función para asegurar que auth.currentUser esté disponible
async function getAuthenticatedUser(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        unsubscribe();
        resolve(user);
      } else {
        reject(new Error("No estás autenticado"));
      }
    });
  });
}

//
// 1) Función para registrar la inscripción desde Stripe (pago)
//
export interface StripeInscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  categoria: string;
  sessionId: string;
  distancia?: string;
}

export async function registrarInscripcion(data: StripeInscripcionData) {
  const user = await getAuthenticatedUser();

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

  // 🔔 Alert de debug con el payload real
  const payload = {
    carreraId: data.carreraId,
    carreraTitulo: data.carreraTitulo,
    perfilId: data.perfilId,
    perfilOwner: user.uid,
    categoria: data.categoria,
    sessionId: data.sessionId,
    paymentStatus: "pending" as const,
    competitorNumber: assigned
  };
  alert("Firestore payload:\n" + JSON.stringify(payload, null, 2));

  // 4️⃣ Guardar la inscripción de pago
  await addDoc(collection(db, "inscripciones"), {
    ...payload,
    timestamp: serverTimestamp(),
  });
}

//
// 2) Función para registrar la inscripción manual (sin pago)
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
    paymentStatus:    "manual" as const,
    perfilOwner:      "manual",
    sessionId:        null,
    timestamp:        serverTimestamp(),
  });
}
