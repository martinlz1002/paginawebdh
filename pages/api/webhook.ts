import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

export const config = { api: { bodyParser: false } };

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Cuando la sesión se completa con éxito...
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as any;
    const sessionId = session.id;
    const paymentStatus = session.payment_status; // e.g. "paid"

    // Buscamos el documento en "inscripciones" que tenga este sessionId
    const inscQ = query(
      collection(db, "inscripciones"),
      where("sessionId", "==", sessionId)
    );
    const snap = await getDocs(inscQ);

    // Actualizamos cada uno (por si hay más de uno, pero normalmente uno solo)
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, "inscripciones", d.id), { paymentStatus })
    ));
  }

  res.status(200).json({ received: true });
}