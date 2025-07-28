import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

// Inicializa admin SDK solo una vez
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const COLLECTION = "testimonios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === "GET") {
      const snap = await db
        .collection(COLLECTION)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return res.status(200).json(items);
    }

    if (req.method === "POST") {
      const { author, text, avatarUrl } = req.body;
      if (!author || !text) {
        return res.status(400).json({ error: "Faltan author o text" });
      }
      const docRef = await db.collection(COLLECTION).add({
        author,
        text,
        avatarUrl: avatarUrl || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newDoc = await docRef.get();
      return res.status(201).json({ id: newDoc.id, ...newDoc.data() });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Método ${req.method} no permitido`);
  } catch (err: any) {
    console.error("Error en /api/testimonials:", err);
    return res.status(500).json({ error: err.message || err.toString() });
  }
}