import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const raw = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!,
    "base64"
  ).toString("utf8");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;

  if (req.method !== "GET" || typeof id !== "string") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const tmp = await firestore.collection("tempusuarios").doc(id).get();
  if (!tmp.exists) return res.status(404).json({ error: "Enlace no encontrado" });

  const data = tmp.data()!;
  const { carreraId, range, expiresAt } = data;

  // ✅ Validar expiración aquí también (consistencia)
  const expDate =
    expiresAt?.toDate ? (expiresAt as admin.firestore.Timestamp).toDate() : new Date(expiresAt);
  const expMs = expDate.getTime();

  if (!Number.isFinite(expMs) || expMs < Date.now()) {
    return res.status(410).json({ error: "Enlace expirado" });
  }

  // ✅ Validación de rango
  if (
    !range ||
    typeof range.start !== "number" ||
    typeof range.end !== "number" ||
    range.start <= 0 ||
    range.end < range.start
  ) {
    return res.status(400).json({ error: "Rango inválido en tempusuario" });
  }

  const usedSnap = await firestore
    .collection("inscripciones")
    .where("carreraId", "==", carreraId)
    .where("competitorNumber", ">=", range.start)
    .where("competitorNumber", "<=", range.end)
    .get();

  const usedSet = new Set<number>(
    usedSnap.docs.map(d => Number(d.data().competitorNumber)).filter(n => Number.isFinite(n))
  );

  const total = range.end - range.start + 1;
  const available: number[] = [];
  for (let i = 0; i < total; i++) {
    const n = range.start + i;
    if (!usedSet.has(n)) available.push(n);
  }

  return res.status(200).json({
    available,
    expiresAt: expDate.toISOString(),
    expiresAtMs: expMs,
  });
}