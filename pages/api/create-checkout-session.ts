import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Método no permitido");

  const { userId, carreraId } = req.body;

  try {
    const carreraSnap = await getDoc(doc(db, "carreras", carreraId));
    if (!carreraSnap.exists()) return res.status(404).json({ error: "Carrera no encontrada" });

    const carrera = carreraSnap.data();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: {
            name: `Inscripción: ${carrera.nombre}`,
          },
          unit_amount: carrera.precio * 100, // precio en centavos
        },
        quantity: 1,
      }],
      metadata: {
        userId,
        carreraId,
      },
      success_url: `${process.env.NEXT_PUBLIC_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/carreras`,
    });

    return res.status(200).json({ id: session.id });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
