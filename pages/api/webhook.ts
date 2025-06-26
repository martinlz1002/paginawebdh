import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK sólo una vez
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY!
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
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  // Stripe necesita el body sin parsear
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"]!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Sólo nos interesa cuando termina el checkout
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = session.id;
    const paymentStatus = session.payment_status; // 'paid', 'unpaid', etc.

    try {
      // Busca las inscripciones con este sessionId
      const snap = await firestore
        .collection("inscripciones")
        .where("sessionId", "==", sessionId)
        .get();

      // Actualiza cada documento
      const batch = firestore.batch();
      snap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { paymentStatus });
      });
      await batch.commit();
      console.log(
        `✅ Actualizado paymentStatus="${paymentStatus}" en ${snap.size} inscripciones.`
      );
    } catch (dbErr) {
      console.error("🔴 Error al actualizar Firestore:", dbErr);
      // aunque falle la actualización, respondemos 200 para no reintentar webhooks
    }
  }

  // responde 200 siempre para que Stripe no reintente
  res.status(200).json({ received: true });
}