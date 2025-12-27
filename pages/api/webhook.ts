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

/**
 * ✅ Asigna número rellenando huecos:
 * - Primero toma el hueco más pequeño en carreras/{carreraId}/freeNumbers (orderBy n asc)
 * - Si no hay huecos, usa carreras/{carreraId}.nextNumber y lo incrementa
 */
async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string
): Promise<number> {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeCol = carreraRef.collection("freeNumbers");

  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const maxCupo = (carreraSnap.get("maxCompetitors") || 0) as number;
  const nextNumber = (carreraSnap.get("nextNumber") || 1) as number;

  // 1) hueco más chico
  const q = freeCol.orderBy("n", "asc").limit(1);
  const freeSnap = await tx.get(q);

  if (!freeSnap.empty) {
    const freeDoc = freeSnap.docs[0];
    const n = freeDoc.get("n") as number;

    // Consumir hueco
    tx.delete(freeDoc.ref);

    // sanity
    if (!Number.isFinite(n) || n <= 0) throw new Error("Número libre inválido");
    if (maxCupo > 0 && n > maxCupo) throw new Error("Número libre fuera de cupo");
    return n;
  }

  // 2) sin huecos: nextNumber
  if (maxCupo > 0 && nextNumber > maxCupo) {
    throw new Error("Ya no hay números disponibles");
  }

  // merge para no pisar otros campos
  tx.set(carreraRef, { nextNumber: nextNumber + 1 }, { merge: true });
  return nextNumber;
}

/**
 * ✅ Libera número metiéndolo al pool:
 * carreras/{carreraId}/freeNumbers/{num}
 * idempotente (si ya existe, se mergea y ya)
 */
async function releaseNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string,
  number: number
) {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeRef = carreraRef.collection("freeNumbers").doc(String(number));

  tx.set(
    freeRef,
    { n: number, releasedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Actualiza estado de pago:
 * - paid/pending: asigna número si falta (rellenando huecos) y asegura ficha/bib
 * - unpaid/expired: libera número al pool y borra competitorNumber/ficha/bib
 *
 * Importante: usar transacciones para evitar números duplicados.
 */
async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "unpaid" | "expired"
) {
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) return;

  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;

    if (status === "paid" || status === "pending") {
      await firestore.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);
        if (!insSnap.exists) return;

        const data = insSnap.data() as any;

        // Si ya tiene número, solo asegura ficha/bib y status
        if (data.competitorNumber) {
          const updates: any = { paymentStatus: status };
          if (!data.ficha) updates.ficha = data.competitorNumber;
          if (!data.bib) updates.bib = data.competitorNumber;
          tx.update(ref, updates);
          return;
        }

        // Si no tiene número, asigna usando huecos primero
        const assigned = await allocateNumberTx(tx, data.carreraId);

        tx.update(ref, {
          paymentStatus: status,
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
        });
      });
    }

    if (status === "unpaid" || status === "expired") {
      await firestore.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);
        if (!insSnap.exists) return;

        const data = insSnap.data() as any;
        const n = data.competitorNumber as number | undefined | null;

        // Devuelve el número al pool si existía
        if (n && Number.isFinite(n) && n > 0) {
          await releaseNumberTx(tx, data.carreraId, n);
        }

        // Limpia número y campos derivados
        tx.update(ref, {
          paymentStatus: status,
          competitorNumber: FieldValue.delete(),
          ficha: FieldValue.delete(),
          bib: FieldValue.delete(),
        });
      });
    }
  }
}

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
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
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
      break;
  }

  return res.status(200).json({ received: true });
}