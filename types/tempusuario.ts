import type { Timestamp } from "firebase/firestore";

export type TempRange = { start: number; end: number };

/**
 * Forma guardada en Firestore (cliente/server):
 * - expiresAt/createdAt normalmente son Timestamp (Firestore) o Date (si ya lo convertiste)
 */
export interface TempUsuario {
  carreraId: string;
  range: TempRange;
  username: string;
  password: string;
  expiresAt: Timestamp | Date;
  createdAt: Timestamp | Date;
}

/**
 * Forma que regresan tus endpoints (/api/get-tempusuario y /api/temp-login)
 * Lista para usar en el front sin broncas de timezone/parseo.
 */
export interface TempUsuarioAPI {
  id: string;
  carreraId: string;
  range: TempRange;
  username: string;
  expiresAt: string;   // ISO
  expiresAtMs: number; // epoch ms (la buena)
}