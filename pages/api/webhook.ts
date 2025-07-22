import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: false } };

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
const FieldValue = admin.firestore.FieldValue;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "unpaid" | "expired"
) {
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();
  if (snap.empty) return;

  const batch = firestore.batch();

  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;
    if (status === "paid" || status === "pending") {
      batch.update(ref, { paymentStatus: status });
    } else if (status === "unpaid" || status === "expired") {
      batch.update(ref, {
        paymentStatus: status,
        competitorNumber: FieldValue.delete(),
      });
    } else {
      batch.update(ref, { paymentStatus: status });
    }
  }

  await batch.commit();
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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // session.payment_status = 'paid' | 'unpaid' | 'no_payment_required'
      // session.status = 'open' | 'complete'
      // Para manual payments, async_payment_succeeded viene luego
      const ps = session.payment_status === "paid" ? "paid" : "pending";
      await markPaymentStatus(session.id, ps);
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentStatus(session.id, "paid");
      break;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentStatus(session.id, "expired");
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
      // ignorar el resto
      break;
  }

  res.status(200).json({ received: true });
}