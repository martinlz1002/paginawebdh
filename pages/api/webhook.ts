import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK solo una vez
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
  console.log(`🔍 Buscando inscripciones con sessionId=${sessionId}`);
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) {
    console.warn(
      `⚠️ No se encontró ninguna inscripción con sessionId=${sessionId}`
    );
    return;
  }

  const batch = firestore.batch();
  snap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, { paymentStatus: status });
  });
  await batch.commit();
  console.log(
    `✅ Actualizado paymentStatus="${status}" en ${snap.size} documento(s).`
  );
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
    console.error("⚠️ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📩 Evento webhook recibido: ${event.type}`);

  try {
    switch (event.type) {
      // Pago completado (cartão)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentStatus(session.id, session.payment_status);
        break;
      }
      // Para OXXO u otros medios asíncronos
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentStatus(session.id, "paid");
        break;
      }
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentStatus(session.id, "unpaid");
        break;
      }
      // Intent de pago exitoso
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
      // Intent de pago fallido
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
        // Ignoramos el resto
        console.log(`ℹ️ Evento no manejado: ${event.type}`);
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
    // Respondemos 200 para que Stripe no reintente
  }

  res.status(200).json({ received: true });
}