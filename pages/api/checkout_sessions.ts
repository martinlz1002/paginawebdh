import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Método ${req.method} No Permitido`);
  }

  const { carreraId, perfilId, categoria, price } = req.body as {
    carreraId: string;
    perfilId: string;
    categoria: string;
    price: number;
  };

  try {
    const origin = req.headers.origin ?? "";
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: `Inscripción: ${categoria}` },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/mis-inscripciones?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/inscribirse?carreraId=${carreraId}`,
      metadata: { carreraId, perfilId, categoria },
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
}