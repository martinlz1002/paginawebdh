import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  WithFieldValue,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Interfaz del documento que queda en Firestore.
 * El campo `timestamp` siempre estará presente y será un Timestamp de Firestore.
 */
export interface Inscripcion {
  carreraId: string;
  perfilId: string;
  categoria: string;
  timestamp: Timestamp;
}

/**
 * Tipo de los datos que la UI debe pasar para crear la inscripción.
 * Aquí NO incluimos `timestamp` porque lo genera el servidor.
 */
export type InscripcionInput = Omit<Inscripcion, "timestamp">;

/**
 * Agrega una inscripción a Firestore. `timestamp` se añade con serverTimestamp().
 */
export async function registrarInscripcion(
  datos: InscripcionInput
): Promise<void> {
  // Con WithFieldValue<Inscripcion> le decimos a TS que este objeto,
  // una vez incluya serverTimestamp(), cumple Inscripcion.
  const nuevo: WithFieldValue<Inscripcion> = {
    ...datos,
    timestamp: serverTimestamp(),
  };

  await addDoc(collection(db, "inscripciones"), nuevo);
}