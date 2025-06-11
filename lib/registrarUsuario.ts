import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";

const auth = getAuth(app);
const db = getFirestore(app);

export async function registrarUsuario(data: {
  email: string;
  password: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  celular: string;
  pais: string;
  estado: string;
  ciudad: string;
  club?: string;
  fechaNacimiento: string; // formato YYYY-MM-DD
}) {
  const edad = calcularEdad(data.fechaNacimiento);
  const credenciales = await createUserWithEmailAndPassword(auth, data.email, data.password);

  const uid = credenciales.user.uid;

  await setDoc(doc(db, "usuarios", uid), {
    nombre: data.nombre,
    apellidoPaterno: data.apellidoPaterno,
    apellidoMaterno: data.apellidoMaterno,
    email: data.email,
    celular: data.celular,
    pais: data.pais,
    estado: data.estado,
    ciudad: data.ciudad,
    club: data.club ?? "",
    edad,
    pago: false,
    esAdmin: false,
  });

  return uid;
}

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return edad;
}
