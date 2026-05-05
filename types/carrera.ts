import type { Timestamp } from "firebase/firestore";

export interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}

export interface DistanciaConCategorias {
  distancia: string; // "5K", "10K", "300m"
  categorias: Categoria[];
}

export type AgeBasis = "endOfYear" | "eventDate";

/**
 * Fecha en Firestore a veces es Timestamp y a veces string "YYYY-MM-DD"
 * (según cómo la creaste / migraciones viejas).
 */
export type CarreraFecha = string | Timestamp | Date;

export interface CarreraData {
  titulo: string;

  // ✅ en docs viejos puede faltar o estar vacío
  descripcion?: string;

  // ✅ normaliza: algunas pantallas usan lugar y otras ubicacion
  lugar?: string;
  ubicacion?: string;

  // ✅ soporta Timestamp/string
  fecha: CarreraFecha;

  // ✅ opcionales porque a veces no los tienes
  horaSalida?: string;

  imagenUrl?: string;
  bannerUrl?: string;

  // ✅ si aún existen carreras viejas sin distancias, no revientes
  distancias?: DistanciaConCategorias[];

  // ✅ cupo/pool (compat)
  maxCompetitors?: number; // 0 o undefined = sin límite
  nextNumber?: number;     // usado por el pool

  // ✅ base de edad (default endOfYear si falta)
  ageBasis?: AgeBasis;

  // ✅ kit opcional
  kitFecha?: string;
  kitLugar?: string;
  kitHorario?: string;

  linkExterno?: string;

  // ✅ pausar inscripciones
  inscripcionesAbiertas?: boolean; // false = pausadas
  inscripcionesMensaje?: string;   // mensaje cuando está pausado
}

export interface Carrera extends CarreraData {
  id: string;
}
