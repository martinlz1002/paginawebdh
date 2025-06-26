import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { doc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";

export const config = { api: { bodyParser: false } };
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Cuando el pago se completa o succeed async
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as any;
    const sessionId = session.id;

    // Actualizar todas las inscripciones con ese sessionId a paid
    const q = query(
      collection(db, 'inscripciones'),
      where('sessionId', '==', sessionId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'inscripciones', d.id), { paymentStatus: 'paid' });
    }
  }

  // Si falla un pago asíncrono
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as any;
    const sessionId = session.id;
    const q = query(
      collection(db, 'inscripciones'),
      where('sessionId', '==', sessionId)
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      await updateDoc(doc(db, 'inscripciones', d.id), { paymentStatus: 'failed' });
    }
  }

  res.status(200).json({ received: true });
}
