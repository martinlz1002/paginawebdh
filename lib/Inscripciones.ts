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

  // calcular siguiente número libre (manuales + pagos)
  const usedSnap = await getDocs(
    query(
      collection(db, "inscripciones"),
      where("carreraId", "==", data.carreraId),
      where("competitorNumber", ">", 0)
    )
  );
  const used = usedSnap.docs.map(d => d.data().competitorNumber as number);
  let assigned = 1;
  while (used.includes(assigned)) assigned++;

  // guardar la inscripción de pago
  await addDoc(collection(db, "inscripciones"), {
    carreraId:       data.carreraId,
    carreraTitulo:   data.carreraTitulo,
    perfilId:        data.perfilId,
    perfilOwner:     user.uid,
    categoria:       data.categoria,
    sessionId:       data.sessionId,
    paymentStatus:   "pending",
    competitorNumber: assigned,
    timestamp:       serverTimestamp(),
  });
}

//
// 2) Función para registrar la inscripción manual (sin pago)
//    ahora **sin** hacer ninguna lectura local, solo escribe.
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
  // simplemente registra; las validaciones de número libre
  // llegan del endpoint /api/temp-avail, así evitamos permisos de lectura
  await addDoc(collection(db, "inscripciones"), {
    carreraId:       data.carreraId,
    perfilNombre:    data.perfilNombre,
    perfilApPaterno: data.perfilApPaterno,
    perfilApMaterno: data.perfilApMaterno,
    birthDate:       Timestamp.fromDate(data.birthDate),
    categoria:       data.categoria,
    email:           data.email,
    celular:         data.celular,
    ciudad:          data.ciudad,
    estado:          data.estado,
    pais:            data.pais,
    club:            data.club || null,
    competitorNumber:data.competitorNumber,
    paymentStatus:   "manual",
    perfilOwner:     "manual",   // clave para que tu regla lo permita
    sessionId:       null,
    timestamp:       serverTimestamp(),
  });
}