import type StripeType from "stripe";
import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";      // tu instancia de Stripe
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
    bodyParser: false,    // must keep raw body
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

  // 1) Leer raw body
  const buf = await buffer(req);

  // 2) Validar cabecera
  const sig = req.headers["stripe-signature"];
  if (!sig || Array.isArray(sig)) {
    console.error("❌ Missing stripe-signature header");
    return res.status(400).send("Missing stripe-signature header");
  }

  let event: StripeType.Event;
  try {
    // 3) Construir evento a partir del raw body + secreto
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 4) Manejar sólo el checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as StripeType.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status; // 'paid' | 'unpaid' | 'no_payment_required'

    // 5) Buscar inscripciones con ese sessionId
    const inscQ = query(
      collection(db, "inscripciones"),
      where("sessionId", "==", sessionId)
    );
    const snap = await getDocs(inscQ);

    // 6) Actualizar el campo paymentStatus en cada doc
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, "inscripciones", d.id), { paymentStatus })
      )
    );
  }

  // 7) Responder 200 para que Stripe no reintente
  res.status(200).json({ received: true });
}