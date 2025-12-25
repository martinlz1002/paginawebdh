import { Timestamp } from "firebase/firestore";

export interface InscripcionData {
  // IDs
  carreraId: string;
  carreraTitulo: string; // Evento
  perfilId: string | null;
  perfilOwner: string; // uid o "manual"

  // Número
  competitorNumber?: number | null;

  // Campos “Excel”
  ficha?: number | null;
  bib?: number | null;

  nombre?: string | null;
  paterno?: string | null;
  materno?: string | null;
  nombres?: string | null;

  rama?: "Femenil" | "Varonil" | string | null;
  ruta?: string | null; // distancia
  distancia?: string | null; // lo dejo por compat con docs viejos
  categoria: string;

  pais?: string | null;
  estado?: string | null;
  ciudad?: string | null;
  celular?: string | null;
  club?: string | null;

  fechaNacimiento?: Timestamp | null;
  email?: string | null;

  // Pago
  sessionId?: string | null;
  paymentStatus?: "paid" | "pending" | "unpaid" | "expired" | "manual";
  isManualEntry?: boolean;
  manualAdminId?: string | null;

  // Meta
  timestamp?: Timestamp;
}