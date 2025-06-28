import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK una sola vez
if (!admin.apps.length) {
  const raw = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!,
    "base64"
  ).toString("utf8");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  });
}
const firestore = admin.firestore();

// @ts-ignore TypeScript no conoce "2025-05-28.basil"
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

export const config = { api: { bodyParser: false } };

const webhookSecret =
  process.env.NODE_ENV === "development"
    ? process.env.STRIPE_CLI_WEBHOOK_SECRET!
    : process.env.STRIPE_DASHBOARD_WEBHOOK_SECRET!;

async function markPaymentStatus(sessionId: string, status: string) {
  console.log(`🔍 [webhook] Buscando sessionId=${sessionId}`);
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) {
    console.warn(`⚠️ [webhook] Ningún doc con sessionId=${sessionId}`);
    return;
  }

  console.log(`🔄 [webhook] Actualizando ${snap.size} docs a "${status}"`);
  const batch = firestore.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { paymentStatus: status }));
  await batch.commit();
  console.log(`✅ [webhook] paymentStatus → "${status}"`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️ [webhook] Invalid signature:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 [webhook] evento recibido: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentStatus(session.id, session.payment_status);
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        if (sessions.data.length) {
          await markPaymentStatus(sessions.data[0].id, "paid");
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        if (sessions.data.length) {
          await markPaymentStatus(sessions.data[0].id, "unpaid");
        }
        break;
      }
      default:
        console.log(`ℹ️ [webhook] evento no manejado: ${event.type}`);
    }
  } catch (err) {
    console.error("🔴 [webhook] error procesando evento:", err);
  }

  res.status(200).json({ received: true });
}