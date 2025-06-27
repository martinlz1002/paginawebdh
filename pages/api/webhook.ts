import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK solo una vez
if (!admin.apps.length) {
  const raw = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!, "base64").toString("utf8");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const firestore = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export const config = { api: { bodyParser: false } };
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Actualiza paymentStatus en la colección raíz "inscripciones"
  async function markPaymentStatus(sessionId: string, status: string) {
    const snap = await firestore
      .collection("inscripciones")
      .where("sessionId", "==", sessionId)
      .get();

    if (snap.empty) {
      console.warn(`⚠️ No se encontró inscripciones con sessionId=${sessionId}`);
      return;
    }

    const batch = firestore.batch();
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { paymentStatus: status });
    });
    await batch.commit();
    console.log(`✅ Actualizado paymentStatus="${status}" en ${snap.size} documento(s).`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // session.payment_status viene como "paid" o "unpaid"
        await markPaymentStatus(session.id, session.payment_status);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // Buscamos la sesión asociada al intent
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          // En este caso forzamos "paid"
          await markPaymentStatus(session.id, "paid");
        } else {
          console.warn(`⚠️ No se encontró session para payment_intent ${intent.id}`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // Si quieres marcar 'unpaid' en fallo de pago
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          await markPaymentStatus(session.id, "unpaid");
        }
        break;
      }

      // Otros eventos que necesites...
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
    // Respondemos 200 para no reintentar
  }

  res.status(200).json({ received: true });
}