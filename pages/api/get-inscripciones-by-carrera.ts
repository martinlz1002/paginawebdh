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
    const q = query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carreraId),
      where("paymentStatus", "in", ["paid", "manual"])
    );

    const snap = await getDocs(q);

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: "Error obteniendo inscripciones" });
  }
}