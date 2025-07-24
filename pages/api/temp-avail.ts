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
  const { id } = req.query;
  if (req.method !== "GET" || typeof id !== "string") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const tmp = await firestore.collection("tempusuarios").doc(id).get();
  if (!tmp.exists) return res.status(404).json({ error: "Enlace no encontrado" });
  const { carreraId, range } = tmp.data()!;

  const usedSnap = await firestore
    .collection("inscripciones")
    .where("carreraId", "==", carreraId)
    .where("competitorNumber", ">=", range.start)
    .where("competitorNumber", "<=", range.end)
    .get();
  const used = usedSnap.docs.map(d => d.data().competitorNumber as number);

  const all = Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i);
  const available = all.filter(n => !used.includes(n));

  return res.status(200).json({ available });
}