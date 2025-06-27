import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK sólo una vez
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!
  );
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const firestore = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2022-11-15",
});

export const config = {
  api: { bodyParser: false },
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

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Función interna para actualizar Firestore dado un sessionId
  async function markPaid(sessionId: string, paymentStatus: string) {
    const snap = await firestore
      .collection("inscripciones")
      .where("sessionId", "==", sessionId)
      .get();

    if (snap.empty) {
      console.warn(`⚠️ No encontré inscripciones con sessionId=${sessionId}`);
      return;
    }

    const batch = firestore.batch();
    snap.docs.forEach((docSnap) => {
      batch.update(docSnap.ref, { paymentStatus });
    });
    await batch.commit();
    console.log(
      `✅ Actualizado paymentStatus="${paymentStatus}" en ${snap.size} inscripciones.`
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaid(session.id, session.payment_status);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        // buscamos el checkout.session asociado al intent
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          await markPaid(session.id, intent.status === "succeeded" ? "paid" : intent.status);
        } else {
          console.warn(`⚠️ No session for payment_intent ${intent.id}`);
        }
        break;
      }

      // si quieres puedes manejar otros eventos...
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
    // respondemos 200 para no reintentar webhook, incluso si falló actualización
  }

  res.status(200).json({ received: true });
}