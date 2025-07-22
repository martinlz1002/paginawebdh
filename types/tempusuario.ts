export interface TempUsuario {
  id?: string;              // Firestore auto‑ID
  username: string;
  password: string;         // (en claro o con hash, según prefieras)
  carreraId: string;        // la carrera sobre la que inscribe
  startNumber: number;      // inicio del rango
  endNumber: number;        // fin del rango
  remainingSlots: number;   // contador (end–start+1 inicialmente)
  expiresAt: Date;          // fecha de expiración
}