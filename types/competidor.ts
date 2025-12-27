import { Timestamp } from "firebase/firestore";

export interface Competidor {
  // Identidad
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres?: string; // cache opcional

  // Contacto
  email: string;
  celular: string;

  // Ubicación
  ciudad: string;
  estado: string;
  pais: string;

  // Extra
  club?: string | null;

  // Datos personales
  fechaNacimiento?: Timestamp | null;
  edad?: number; // calculada, no siempre persistida

  // Meta
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
