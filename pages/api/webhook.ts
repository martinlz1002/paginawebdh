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
  doc,
  updateDoc,
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
    return res.status(405).end("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"]!;
  const buf = await buffer(req);

  let event: Stripe.Event;
  try {
    event = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' })
      .webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status;

    // Actualizar inscripciones con este sessionId
    const inscQ = query(
      collection(db, "inscripciones"),
      where("sessionId", "==", sessionId)
    );
    const inscSnap = await getDocs(inscQ);
    await Promise.all(
      inscSnap.docs.map(d =>
        updateDoc(doc(db, "inscripciones", d.id), { paymentStatus })
      )
    );
  }

  res.status(200).json({ received: true });
}