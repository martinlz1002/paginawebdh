import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// 1️⃣ Desactivar el body parser de Next.js
export const config = { api: { bodyParser: false } };

// 2️⃣ Inicializar Firebase Admin SDK sólo una vez
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

// 3️⃣ Instanciar Stripe con la misma versión que usas en CLI / Dashboard
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

// 4️⃣ Usa siempre el mismo secret en producción
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
console.log("🔑 STRIPE_WEBHOOK_SECRET:", webhookSecret);

// 5️⃣ Función para actualizar el paymentStatus
async function markPaymentStatus(sessionId: string, status: string) {
  console.log(`🔍 [webhook] buscando sessionId=${sessionId}`);
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) {
    console.warn(`⚠️ [webhook] no encontrado sessionId=${sessionId}`);
    return;
  }

  const batch = firestore.batch();
  snap.docs.forEach((docSnap) =>
    batch.update(docSnap.ref, { paymentStatus: status })
  );
  await batch.commit();
  console.log(`✅ [webhook] paymentStatus actualizado a "${status}"`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 👇 logging para depurar en Vercel
  console.log("➡️ Método entrante:", req.method);

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  // 6️⃣ obtener raw body y firma
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;
  console.log("📦 payload length:", buf.length, " stripe-signature:", sig);

  // 7️⃣ verificar y parsear evento
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("📩 webhook recibido:", event.type);

  // 8️⃣ manejar los tipos que te interesan
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
        console.log("ℹ️ evento no manejado:", event.type);
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
  }

  // 9️⃣ responder siempre 2xx para que Stripe no reintente
  res.status(200).json({ received: true });
}