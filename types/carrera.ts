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
  nombre: string
  minAge: number
  maxAge: number
}

export interface CarreraData {
  titulo: string
  descripcion: string
  ubicacion: string
  fecha: string       // "YYYY-MM-DD"
  horaSalida: string         // "HH:mm"
  categorias: Categoria[]
  imagenBase64?: string
  nombreArchivo?: string
}