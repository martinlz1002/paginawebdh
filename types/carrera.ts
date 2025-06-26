export interface Carrera {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  imagenUrl: string;
}
// types/carrera.ts
export interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

export interface CarreraData {
  titulo: string;
  descripcion: string;
  lugar: string;
  fecha: string;        // ISO date YYYY-MM-DD
  horaSalida: string;   // HH:MM
  imagenUrl?: string;
  categorias: Categoria[];
  price: number;  // <-- ahora es Categoria[]
}