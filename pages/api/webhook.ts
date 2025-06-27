import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// Inicializa Admin SDK sólo una vez
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
  const sig = req.headers["stripe-signature"]!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig as string, webhookSecret);
  } catch (err: any) {
    console.error("⚠️  Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // función auxiliar que busca en cada slug de carrera
  async function markPaid(sessionId: string, status: string) {
    // 1) Obtiene todos los slugs
    const carrerasSnap = await firestore.collection("carreras").get();
    for (const cDoc of carrerasSnap.docs) {
      const { slug } = cDoc.data() as any;
      if (!slug) continue;

      // 2) Busca en inscripciones/{slug}/docs
      const subCol = firestore
        .collection("inscripciones")
        .doc(slug)
        .collection("docs");
      const snap = await subCol.where("sessionId", "==", sessionId).get();
      if (snap.empty) continue;

      // 3) Actualiza
      const batch = firestore.batch();
      snap.docs.forEach((d) => batch.update(d.ref, { paymentStatus: status }));
      await batch.commit();
      console.log(`✅ [${slug}] paymentStatus="${status}" actualizado en ${snap.size} inscripciones.`);
      return; // salimos tras encontrar la primera coincidencia
    }
    console.warn(`⚠️  No se encontró sessionId=${sessionId} en ninguna subcolección.`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaid(session.id, session.payment_status);
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        // Encuentra la sesión asociada
        const sessions = await stripe.checkout.sessions.list({
          payment_intent: pi.id,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session) {
          await markPaid(session.id, "paid");
        } else {
          console.warn(`⚠️  No session para payment_intent ${pi.id}`);
        }
        break;
      }
      // ...otros eventos si los necesitas
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
    // respondemos 200 para que Stripe no reintente
  }

  res.status(200).json({ received: true });
}