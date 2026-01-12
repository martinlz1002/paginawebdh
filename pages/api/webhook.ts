import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: false } };

// ----------------- helpers env -----------------
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in server env`);
  return v;
}

// ----------------- init admin -----------------
if (!admin.apps.length) {
  const b64 = requireEnv("FIREBASE_SERVICE_ACCOUNT_KEY_B64");
  const raw = Buffer.from(b64, "base64").toString("utf8");
  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const firestore = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ----------------- init stripe -----------------
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-05-28.basil",
});

const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

// ----------------- NUMBER ALLOCATION -----------------
async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string
): Promise<number> {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeCol = carreraRef.collection("freeNumbers");

  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const max = Number(carreraSnap.get("maxCompetitors") || 0);
  let candidate = Number(carreraSnap.get("nextNumber") || 1);

  const usedSnap = await tx.get(
    firestore
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .where("competitorNumber", "!=", null)
      .where("paymentStatus", "in", ["pending", "paid"])
  );

  const used = new Set<number>();
  usedSnap.docs.forEach((d) => {
    const n = Number(d.get("competitorNumber"));
    if (Number.isFinite(n) && n > 0) used.add(n);
  });

  const freeSnap = await tx.get(freeCol.orderBy("n", "asc").limit(10));
  for (const doc of freeSnap.docs) {
    const n = Number(doc.get("n"));
    if (!used.has(n)) {
      if (max && n > max) throw new Error("Cupo agotado");
      tx.delete(doc.ref);
      return n;
    }
  }

  while (used.has(candidate)) {
    candidate++;
    if (max && candidate > max) throw new Error("Cupo agotado");
  }

  tx.set(carreraRef, { nextNumber: candidate + 1 }, { merge: true });
  return candidate;
}

function releaseNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string,
  number: number
) {
  const freeRef = firestore
    .collection("carreras")
    .doc(carreraId)
    .collection("freeNumbers")
    .doc(String(number));

  tx.set(
    freeRef,
    { n: number, releasedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// ----------------- PAYMENT STATUS -----------------
async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "unpaid" | "expired"
) {
  const snap = await firestore
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;

    await firestore.runTransaction(async (tx) => {
      const insSnap = await tx.get(ref);
      if (!insSnap.exists) return;

      const data = insSnap.data() as any;
      const n = Number(data.competitorNumber || 0);

      if (status === "paid") {
        if (!n) {
          const assigned = await allocateNumberTx(tx, data.carreraId);
          tx.update(ref, {
            paymentStatus: "paid",
            competitorNumber: assigned,
            ficha: assigned,
            bib: assigned,
          });
        } else {
          tx.update(ref, { paymentStatus: "paid" });
        }
        return;
      }

      if (status === "expired" || status === "unpaid") {
        if (n) releaseNumberTx(tx, data.carreraId, n);
        tx.update(ref, {
          paymentStatus: status,
          competitorNumber: FieldValue.delete(),
          ficha: FieldValue.delete(),
          bib: FieldValue.delete(),
        });
      }
    });
  }
}

// ----------------- handler -----------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  const event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "payment_intent.succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentStatus(session.id, "paid");
      break;
    }
    case "checkout.session.expired":
    case "payment_intent.payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await markPaymentStatus(session.id, "expired");
      break;
    }
  }

  res.status(200).json({ received: true });
}