import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

export const config = { api: { bodyParser: false } };
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Mapea cada tipo relevante a un estado de Firestore
  const statusMap: Record<string, string> = {
    "checkout.session.completed": "paid",               // tarjetas
    "payment_intent.succeeded":       "paid",           // redundante
    "checkout.session.async_payment_succeeded": "paid", // OXXO
    "checkout.session.async_payment_failed":    "unpaid" // OXXO expirado/fallido
  };

  const newStatus = statusMap[event.type];
  if (newStatus) {
    // Obtén el sessionId según el tipo de evento
    const session = (event.data.object as any);
    const sessionId = session.id || session.session_id;
    if (sessionId) {
      // Busca la inscripción por sessionId
      const inscQuery = query(
        collection(db, "inscripciones"),
        where("sessionId", "==", sessionId)
      );
      const snap = await getDocs(inscQuery);
      await Promise.all(
        snap.docs.map(d =>
          updateDoc(doc(db, "inscripciones", d.id), { paymentStatus: newStatus })
        )
      );
      console.log(`✔️  Actualizado ${snap.docs.length} inscripción(es) a "${newStatus}" para sesión ${sessionId}`);
    }
  }

  res.status(200).json({ received: true });
}