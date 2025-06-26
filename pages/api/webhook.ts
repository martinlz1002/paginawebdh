import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// 1) Inicializa Admin SDK sólo una vez
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY!
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const firestore = admin.firestore();

// 2) Instancia de Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export const config = {
  api: {
    bodyParser: false, // necesario para webhooks
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

  // Stripe exige el raw body
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status; // 'paid' | 'unpaid', etc.

    try {
      const snap = await firestore
        .collection("inscripciones")
        .where("sessionId", "==", sessionId)
        .get();

      const batch = firestore.batch();
      snap.docs.forEach((d) => {
        batch.update(d.ref, { paymentStatus });
      });
      await batch.commit();

      console.log(
        `✅ Actualizado paymentStatus="${paymentStatus}" en ${snap.size} inscripciones.`
      );
    } catch (dbErr) {
      console.error("🔴 Error al actualizar Firestore:", dbErr);
      // respondemos 200 para no reintentar el webhook
    }
  }

  // Responde siempre 200 para que Stripe no reenvíe
  res.status(200).json({ received: true });
}