import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { TempUsuario } from "@/types/tempusuario";

type SafeUser = Omit<TempUsuario, "password" | "expiresAt"> & {
  id: string;
  expiresAt: string;
  expiresAtMs: number;
};

type Data =
  | { ok: true; user: SafeUser }
  | { ok: false; error: string };

export default async function handler(

  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
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

  const expDate: Date =
    (data.expiresAt as any)?.toDate
      ? (data.expiresAt as any).toDate()
      : (data.expiresAt as any);

  const expiresAtMs = expDate.getTime();

  if (expiresAtMs < Date.now()) {
    return res.status(403).json({ ok: false, error: "Cuenta temporal expirada" });
  }

  // quitamos password, serializamos expiresAt + ms
  const { password: _pw, expiresAt: _exp, ...rest } = data as any;

  return res.status(200).json({
    ok: true,
    user: {
      id: docSnap.id,
      ...rest,
      expiresAt: expDate.toISOString(),
      expiresAtMs,
    },
  });
}