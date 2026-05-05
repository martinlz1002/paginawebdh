import { adminDb } from "@/lib/firebaseAdmin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const carreraId = Array.isArray(req.query.carreraId)
    ? req.query.carreraId[0]
    : req.query.carreraId;

  if (!carreraId) {
    return res.status(400).json({ error: "Falta carreraId" });
  }

  try {
    // 🔥 Query usando Firebase Admin (SIN restricciones de rules)
    const snap = await adminDb
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .get();

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    console.log("CarreraId:", carreraId);
    console.log("Inscripciones encontradas:", data.length);

    return res.status(200).json(data);
  } catch (e) {
    console.error("Error en API:", e);
    return res.status(500).json({ error: "Error obteniendo inscripciones" });
  }
}