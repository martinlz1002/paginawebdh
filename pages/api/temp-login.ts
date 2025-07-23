import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { TempUsuario } from "@/types/tempusuario";

type Resp =
  | { ok: true; user: Omit<TempUsuario, "password" | "expiresAt"> & { id: string; expiresAt: string } }
  | { ok: false; error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Resp>) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Faltan credenciales" });
  }

  const q = query(
    collection(db, "tempusuarios"),
    where("username", "==", username),
    where("password", "==", password)
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    return res.status(401).json({ ok: false, error: "Credenciales inválidas" });
  }

  const docSnap = snap.docs[0];
  const data = docSnap.data() as TempUsuario;
  const expires: Date = data.expiresAt;
  if (expires.getTime() < Date.now()) {
    return res.status(403).json({ ok: false, error: "Enlace expirado" });
  }

  // 👍 todo ok: devolvemos el user (sin password) y expiresAt como ISO
  const { password: _, expiresAt: __, ...rest } = data;
  return res.status(200).json({
    ok: true,
    user: {
      id: docSnap.id,
      ...rest,
      expiresAt: expires.toISOString(),
    },
  });
}