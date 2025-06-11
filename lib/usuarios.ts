// lib/usuarios.ts
import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";

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
}

export async function registrarUsuario(user: Usuario) {
  const usuarioRef = doc(db, "usuarios", user.uid);
  await setDoc(usuarioRef, user);
}