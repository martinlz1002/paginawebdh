import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: false } };

// ----------------- env -----------------
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

// ----------------- firebase -----------------
if (!admin.apps.length) {
  const raw = Buffer.from(
    requireEnv("FIREBASE_SERVICE_ACCOUNT_KEY_B64"),
    "base64"
  ).toString("utf8");

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ----------------- stripe -----------------
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-05-28.basil",
});

const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

/**
 * =========================================================
 * ASIGNACIÓN REAL DE NÚMERO (FUENTE DE VERDAD)
 * =========================================================
 */
async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string
): Promise<number> {
  const carreraRef = db.collection("carreras").doc(carreraId);
  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const maxCupo = Number(carreraSnap.get("maxCompetitors") || 0);

  // 1️⃣ NÚMEROS USADOS REALES
  const usedSnap = await tx.get(
    db
      .collection("inscripciones")
      .where("carreraId", "==", carreraId)
      .where("competitorNumber", "!=", null)
      .where("paymentStatus", "in", ["paid", "manual"])
  );

  const used = new Set<number>();
  usedSnap.docs.forEach((d) => {
    const n = Number(d.get("competitorNumber"));
    if (Number.isFinite(n) && n > 0) used.add(n);
  });

  // 2️⃣ RANGOS MANUALES ACTIVOS
  const now = new Date();
  const tempSnap = await tx.get(
    db
      .collection("tempusuarios")
      .where("carreraId", "==", carreraId)
      .where("expiresAt", ">", now)
  );

  const reserved = new Set<number>();
  tempSnap.docs.forEach((d) => {
    const r = d.get("range");
    if (!r) return;
    for (let i = Number(r.start); i <= Number(r.end); i++) {
      if (Number.isFinite(i)) reserved.add(i);
    }
  });

  // 3️⃣ MENOR NÚMERO DISPONIBLE REAL
  const limit = maxCupo > 0 ? maxCupo : 100000;

  for (let n = 1; n <= limit; n++) {
    if (!used.has(n) && !reserved.has(n)) {
      return n;
    }
  }

  throw new Error("Ya no hay números disponibles");
}

/**
 * =========================================================
 * MARCAR ESTADO DE PAGO
 * =========================================================
 */
async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "expired" | "unpaid"
) {
  const snap = await db
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();

  if (snap.empty) return;

  for (const doc of snap.docs) {
    const ref = doc.ref;

    if (status === "paid") {
      await db.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);
        if (!insSnap.exists) return;

        const data = insSnap.data()!;
        if (Number(data.competitorNumber) > 0) {
          tx.update(ref, { paymentStatus: "paid" });
          return;
        }

        const assigned = await allocateNumberTx(tx, data.carreraId);

        tx.update(ref, {
          paymentStatus: "paid",
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
        });
      });
      continue;
    }

    if (status === "pending") {
      await ref.update({ paymentStatus: "pending" });
      continue;
    }

    if (status === "expired" || status === "unpaid") {
      await ref.update({
        paymentStatus: status,
        competitorNumber: FieldValue.delete(),
        ficha: FieldValue.delete(),
        bib: FieldValue.delete(),
      });
    }
  }
}

// ----------------- handler -----------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"] as string;

  const event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      await markPaymentStatus(
        s.id,
        s.payment_status === "paid" ? "paid" : "pending"
      );
      break;
    }
    case "checkout.session.async_payment_succeeded":
    case "payment_intent.succeeded": {
      const s = event.data.object as any;
      await markPaymentStatus(s.id, "paid");
      break;
    }
    case "checkout.session.expired":
    case "payment_intent.payment_failed": {
      const s = event.data.object as any;
      await markPaymentStatus(s.id, "expired");
      break;
    }
  }

  res.status(200).json({ received: true });
}
