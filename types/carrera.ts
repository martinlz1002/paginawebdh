export interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
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
  categorias: Categoria[];
  maxCompetitors: number;
  ageBasis: AgeBasis;
}

export interface Carrera {
  id: string;
  titulo: string;
  descripcion: string;
  lugar: string;         // coincida con tu formulario
  ubicacion?: string;    // si sigues usando este campo en algunos sitios
  fecha: string;         // ISO date YYYY-MM-DD
  horaSalida: string;    // HH:MM
  imagenUrl?: string;
  bannerUrl?: string;
  categorias: Categoria[];
  maxCompetitors: number;
  ageBasis: AgeBasis;
}