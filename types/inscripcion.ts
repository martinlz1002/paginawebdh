export interface InscripcionData {
  carreraId: string;
  carreraTitulo: string;
  perfilId: string;
  perfilOwner: string;
  categoria: string;
  sessionId: string;
  competitorNumber?: number;
  paymentStatus?: 'paid' | 'pending' | 'unpaid' | 'expired';
  createdAt?: FirebaseFirestore.Timestamp;
}