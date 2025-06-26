import Stripe from "stripe";
import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe"; // tu instancia exportada de Stripe
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc
} from "firebase/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig as string,
      webhookSecret
    ) as Stripe.Event;
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status; // 'paid', 'unpaid', etc.

    // 1) Encuentra la(s) inscripción(es) con este sessionId
    const inscQ = query(
      collection(db, "inscripciones"),
      where("sessionId", "==", sessionId)
    );
    const snap = await getDocs(inscQ);

    // 2) Actualiza el campo paymentStatus en cada documento
    const updates = snap.docs.map(d =>
      updateDoc(doc(db, "inscripciones", d.id), { paymentStatus })
    );
    await Promise.all(updates);
  }

  // Siempre responder 200 para que Stripe no reintente el webhook
  res.status(200).json({ received: true });
}