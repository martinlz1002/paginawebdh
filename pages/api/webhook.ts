import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK sólo una vez
if (!admin.apps.length) {
  const raw = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!,
    "base64"
  ).toString("utf8");
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

// Marca el paymentStatus en la colección raíz “inscripciones”
async function markPaymentStatus(sessionId: string, status: string) {
  console.log(`🔍 [webhook] markPaymentStatus → buscando sessionId=${sessionId}`);
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) {
    console.warn(`⚠️ [webhook] No inscritos encontrados para sessionId=${sessionId}`);
    return;
  }

  console.log(`🔄 [webhook] Actualizando ${snap.size} doc(s) a "${status}"`);
  const batch = firestore.batch();
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { paymentStatus: status });
  });
  await batch.commit();
  console.log(`✅ [webhook] paymentStatus actualizado a "${status}" en ${snap.size} doc(s)`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    console.error("⚠️ [webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 [webhook] evento recibido: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("▶️ checkout.session.completed:", session.id, session.payment_status);
        await markPaymentStatus(session.id, session.payment_status);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("▶️ async_payment_succeeded:", session.id);
        await markPaymentStatus(session.id, "paid");
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("▶️ async_payment_failed:", session.id);
        await markPaymentStatus(session.id, "unpaid");
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log("▶️ payment_intent.succeeded:", intent.id);
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        if (sessions.data.length) {
          console.log("   ↳ sesion asociada:", sessions.data[0].id);
          await markPaymentStatus(sessions.data[0].id, "paid");
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.log("▶️ payment_intent.payment_failed:", intent.id);
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        if (sessions.data.length) {
          console.log("   ↳ sesion asociada:", sessions.data[0].id);
          await markPaymentStatus(sessions.data[0].id, "unpaid");
        }
        break;
      }
      default:
        console.log(`ℹ️ [webhook] evento no manejado: ${event.type}`);
    }
  } catch (err) {
    console.error("🔴 [webhook] Error procesando evento:", err);
  }

  // Siempre devolvemos 200 para que Stripe no reintente
  res.status(200).json({ received: true });
}