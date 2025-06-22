import { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { carreraId, perfilId, categoria, precio } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "mxn",
          product_data: { name: `Inscripción ${categoria}` },
          unit_amount: Math.round(precio * 100),
        },
        quantity: 1,
      }],
      metadata: { carreraId, perfilId, categoria },
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/inscripcion-exitosa?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/inscripcion-cancelada`,
    });
    res.status(200).json({ sessionId: session.id });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}