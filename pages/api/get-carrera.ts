import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!, "base64").toString("utf8");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const { id } = req.query;

  if (req.method !== "GET" || typeof id !== "string") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const snap = await firestore.collection("carreras").doc(id).get();
  if (!snap.exists) return res.status(404).json({ error: "Carrera no encontrada" });

  return res.status(200).json({ id: snap.id, ...(snap.data() as any) });
}