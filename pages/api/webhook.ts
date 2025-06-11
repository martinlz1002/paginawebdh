import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const { userId, carreraId } = session.metadata;

    // Actualizar el estado de pago del usuario en la colección 'usuarios'
    const userRef = doc(db, "usuarios", userId);
    await updateDoc(userRef, { pago: true });
  }

  res.status(200).json({ received: true });
}
