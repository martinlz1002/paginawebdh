import { Timestamp } from "firebase/firestore";

export type PaymentStatus =
  | "paid"
  | "pending"
  | "unpaid"
  | "expired"
  | "manual"
  | "failed"; // ✅ si lo usas en UI

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

  // Snapshot perfil (para Excel/PDF/admin)
  nombre?: string | null;
  paterno?: string | null;
  materno?: string | null;
  nombres?: string | null;

  rama?: "Femenil" | "Varonil" | string | null;

  // ✅ Distancia principal (source of truth)
  ruta?: string | null;

  // compat (docs viejos)
  distancia?: string | null;

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
  paymentStatus?: PaymentStatus;
  isManualEntry?: boolean;
  manualAdminId?: string | null;

  // Meta
  timestamp?: Timestamp; // createdAt de la inscripción
  createdAt?: Timestamp; // ✅ por compat si existe en algunos docs
  updatedAt?: Timestamp; // ✅ porque retry_checkout lo escribe
}
