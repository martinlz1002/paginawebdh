// lib/registrarUsuario.ts
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "./firebase";

const db = getFirestore(app);

interface Usuario {
  uid: string;
  nombre: string;
  apPaterno: string;
  apMaterno: string;
  fechaNacimiento: string;
  email: string;
  celular: string;
  pais: string;
  estado: string;
  ciudad: string;
  club?: string;
}

export async function registrarUsuario(usuario: Usuario) {
  await setDoc(doc(db, "usuarios", usuario.uid), usuario);
}