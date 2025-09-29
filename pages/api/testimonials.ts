import type { NextApiRequest, NextApiResponse } from "next";
import admin from "firebase-admin";

type Testimonial = {
  id: string;
  author: string;
  text: string;
  avatarUrl?: string | null;
  timestamp?: FirebaseFirestore.Timestamp;
};

if (!admin.apps.length) {
  // Decodifica la cuenta de servicio desde base64
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;
  if (!serviceAccountJson) {
    console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY_B64 no está definido");
  } else {
    try {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountJson, "base64").toString()
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (e) {
      console.error("❌ Error parseando FIREBASE_SERVICE_ACCOUNT_KEY_B64:", e);
    }
  }
}

const db = admin.firestore();
const COL = "testimonios";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Testimonial[] | { error: string }>
) {
  try {
    if (req.method === "GET") {
      const snap = await db
        .collection(COL)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get();

      const items: Testimonial[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          author: data.author,
          text: data.text,
          avatarUrl: data.avatarUrl || null,
          timestamp: data.timestamp,
        };
      });
      return res.status(200).json(items);
    }

    if (req.method === "POST") {
      const { author, text, avatarUrl } = req.body;
      if (
        typeof author !== "string" ||
        typeof text !== "string" ||
        !author.trim() ||
        !text.trim()
      ) {
        return res
          .status(400)
          .json({ error: "Debe enviar author y text no vacíos." });
      }
      const docRef = await db.collection(COL).add({
        author: author.trim(),
        text: text.trim(),
        avatarUrl: avatarUrl || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newDoc = await docRef.get();
      return res
        .status(201)
        .json([{ id: newDoc.id, ...(newDoc.data() as any) }]);
    }
    
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ error: `Método ${req.method} no permitido.` });
  } catch (err: any) {
    console.error("❌ Error en /api/testimonials:", err);
    return res
      .status(500)
      .json({ error: err.message || "Error interno del servidor" });
  }
}