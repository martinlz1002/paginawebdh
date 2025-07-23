import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

// Inicializa Admin SDK si no está ya
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Missing id" });
  }

  // 1️⃣ Leer el tempUser
  const snap = await firestore.collection("tempusuarios").doc(id).get();
  if (!snap.exists) {
    return res.status(404).json({ error: "Enlace no encontrado" });
  }
  const data = snap.data() as any;
  const { carreraId, range } = data;

  // 2️⃣ Buscar los ya usados en inscripciones
  const usedSnap = await firestore
    .collection("inscripciones")
    .where("carreraId", "==", carreraId)
    .where("competitorNumber", ">=", range.start)
    .where("competitorNumber", "<=", range.end)
    .get();
  const used = usedSnap.docs.map((d) => d.data().competitorNumber as number);

  // 3️⃣ Calcular disponibles
  const all = Array.from(
    { length: range.end - range.start + 1 },
    (_, i) => range.start + i
  );
  const available = all.filter((n) => !used.includes(n));

  return res.status(200).json({ available });
}