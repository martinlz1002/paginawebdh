import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type Rama = "Femenil" | "Varonil";

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
  fechaNacimiento: string; // YYYY-MM-DD
  edad: number;
  rama: Rama; // ✅ NUEVO (obligatorio para evitar “Pendiente”)
  pago?: boolean;
}

function normalizeRama(v: any): Rama {
  const raw = (v ?? "").toString().trim().toLowerCase();
  if (raw === "f" || raw === "femenil" || raw === "mujer" || raw === "female") return "Femenil";
  if (raw === "m" || raw === "varonil" || raw === "hombre" || raw === "male") return "Varonil";
  // si llega algo raro, mejor forzar (así no guardas “Pendiente” camuflado)
  throw new Error("Rama inválida. Debe ser 'Femenil' o 'Varonil'.");
}

/**
 * Registra o actualiza un usuario en Firestore bajo la colección 'usuarios'.
 */
export async function registrarUsuario(usuario: Usuario) {
  const data: Partial<Usuario> = { ...usuario };

  // ✅ normaliza rama para garantizar consistencia en Firestore
  data.rama = normalizeRama((usuario as any).rama);

  // limpiamos campos opcionales undefined o vacíos
  if (!data.club) delete data.club;

  await setDoc(doc(db, "usuarios", usuario.uid), data);
}