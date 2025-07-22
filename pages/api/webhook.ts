import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

// 1️⃣ Desactivar body parser de Next.js
export const config = { api: { bodyParser: false } };

// 2️⃣ Inicializar Firebase Admin SDK
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

// 3️⃣ Instanciar Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

// 4️⃣ Secret del webhook
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// 5️⃣ Función para actualizar paymentStatus y asignar/liberar número de competidor
async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "unpaid" | "expired"
) {
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

  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;
    const data = docSnap.data() as any;
    const carreraId = data.carreraId;

    // Leer cupo máximo
    const carreraDoc = await firestore
      .collection("carreras")
      .doc(carreraId)
      .get();
    const maxCupo = carreraDoc.get("maxCompetitors") || 0;

    // Inscripciones ya pagadas con número asignado
    const paidSnap = await firestore
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .where("paymentStatus", "==", "paid")
      .where("competitorNumber", ">", 0)
      .get();
    const used = paidSnap.docs.map((d) => d.data().competitorNumber as number);

    // Encontrar primer número libre
    let assigned = 1;
    while (used.includes(assigned) && assigned <= maxCupo) {
      assigned++;
    }

    if (status === "paid" || status === "pending") {
      // Asignar número si hay espacio
      if (assigned > maxCupo) {
        console.warn(`Cupo lleno para ${carreraId}, no se asignó número`);
        batch.update(ref, { paymentStatus: status });
      } else {
        batch.update(ref, {
          paymentStatus: status,
          competitorNumber: assigned,
        });
      }
    } else if (status === "unpaid" || status === "expired") {
      // Liberar número
      batch.update(ref, {
        paymentStatus: status,
        competitorNumber: FieldValue.delete(),
      });
    } else {
      // Otros estados: solo actualizar status
      batch.update(ref, { paymentStatus: status });
    }
  }

  await batch.commit();
  console.log(`✅ [webhook] paymentStatus y número actualizados a "${status}"`);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("➡️ Método entrante:", req.method);

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  // Obtener body crudo y firma
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error("⚠️ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("📩 webhook recibido:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Stripe usa session.status === "open" para pagos manuales
        // mapeamos 'open' a 'pending'; si no, al completar, marcamos 'paid'
        const status =
          session.status === "open" ? "pending" : "paid";
        await markPaymentStatus(session.id, status);
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
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markPaymentStatus(session.id, "expired");
        break;
      }
      default:
        console.log("ℹ️ evento no manejado:", event.type);
    }
  } catch (err) {
    console.error("🔴 Error procesando webhook:", err);
  }

  // Responder 2xx para que Stripe no reintente
  res.status(200).json({ received: true });
}