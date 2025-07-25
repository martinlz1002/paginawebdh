export interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}

export interface DistanciaConCategorias {
  distancia: string; // Ej. "5K", "10K", "300m"
  categorias: Categoria[];
}

export type AgeBasis = 'endOfYear' | 'eventDate';

export interface CarreraData {
  titulo: string;
  descripcion: string;
  lugar: string;
  fecha: string;        // ISO date YYYY-MM-DD
  horaSalida: string;   // HH:MM
  imagenUrl?: string;
  bannerUrl?: string;
  distancias: DistanciaConCategorias[];
  maxCompetitors: number;
  ageBasis: AgeBasis;
  kitFecha?: string;     // opcional
  kitLugar?: string;     // opcional
  kitHorario?: string;   // opcional
}

export interface Carrera extends CarreraData {
  id: string;
  ubicacion?: string;    // si lo usas en otro lado, sigue opcional
}