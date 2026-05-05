import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
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
    // 🔥 Query SIN filtro de paymentStatus (para evitar perder datos)
    const q = query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carreraId)
    );

    const snap = await getDocs(q);

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // 🧠 Debug útil (puedes quitarlo después)
    console.log("CarreraId:", carreraId);
    console.log("Inscripciones encontradas:", data.length);

    res.status(200).json(data);
  } catch (e) {
    console.error("Error en API:", e);
    res.status(500).json({ error: "Error obteniendo inscripciones" });
  }
}