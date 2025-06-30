import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface Usuario {
  uid: string;
  nombre: string;
  apPaterno: string;
  apMaterno: string;
  email: string;
  celular: string;
  pais: string;
  estado: string;
  ciudad: string;
  club?: string;
  fechaNacimiento: string;
  edad: number;
  pago?: boolean;
}

/**
 * Registra o actualiza un usuario en Firestore bajo la colección 'usuarios'.
 */
export async function registrarUsuario(usuario: Usuario) {
  // Copiamos datos y limpiamos campos opcionales undefined o vacíos
  const data: Partial<Usuario> = { ...usuario };
  if (!data.club) {
    delete data.club;
  }
  await setDoc(doc(db, 'usuarios', usuario.uid), data);
}