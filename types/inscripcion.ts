import { Timestamp } from 'firebase/firestore';

export interface InscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  perfilOwner: string;
  distancia?: string; 
  categoria: string;
  sessionId: string;
  competitorNumber?: number;
  paymentStatus?: 'paid' | 'pending' | 'unpaid' | 'expired';
  timestamp?: Timestamp;      // <-- lo añades aquí
  isManualEntry?: boolean;
  manualAdminId?: string;  // referencia (tempusuario.id)
}