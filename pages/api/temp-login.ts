import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { TempUsuario } from "@/types/tempusuario";

type Data =
  | {
      ok: true;
      user: Omit<TempUsuario, "password" | "expiresAt" | "id"> & {
        id: string;
        expiresAt: string;
      };
    }
  | { ok: false; error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  const { username, password } =
    (req.body as { username?: string; password?: string }) || {};
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

  // Aquí forzamos a TS a ver sólo los campos GUARDADOS en Firestore (no incluye 'id')
  const raw = snap.docs[0].data() as Omit<TempUsuario, "id">;
  const expiresAt: Date = raw.expiresAt;
  if (expiresAt.getTime() < Date.now()) {
    return res.status(403).json({ ok: false, error: "Cuenta temporal expirada" });
  }

  // Sacamos password y expiresAt, el resto lo devolvemos
  const { password: _pw, expiresAt: _exp, ...rest } = raw;
  return res.status(200).json({
    ok: true,
    user: {
      id: snap.docs[0].id,
      ...rest,
      expiresAt: expiresAt.toISOString(),
    },
  });
}