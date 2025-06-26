import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { query, collection, where, getDocs, doc, updateDoc } from "firebase/firestore";

export const config = {
  api: {
    bodyParser: false,
  },
};

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // interesado en cuando cambia el pago
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed"
  ) {
    const session = event.data.object as any;
    const status = session.payment_status; // 'paid', 'unpaid', 'no_payment_required', 'pending'
    const sessionId = session.id;

    // 1) busca la inscripción con este sessionId
    const inscQ = query(
      collection(db, "inscripciones"),
      where("sessionId", "==", sessionId)
    );
    const snap = await getDocs(inscQ);

    // 2) si la encuentra, actualiza paymentStatus
    await Promise.all(
      snap.docs.map(docSnap =>
        updateDoc(doc(db, "inscripciones", docSnap.id), {
          paymentStatus: status,
        })
      )
    );
  }

  res.status(200).json({ received: true });
}