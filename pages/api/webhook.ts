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

/**
 * ✅ Asigna número SIN duplicados y respetando rangos manuales
 */
async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string
): Promise<number> {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeCol = carreraRef.collection("freeNumbers");

  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const maxCupo = Number(carreraSnap.get("maxCompetitors") || 0);
  let candidate = Number(carreraSnap.get("nextNumber") || 1);

  // 🔹 números ya usados (manual + online)
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

  // 🔹 rangos manuales activos
  const now = new Date();
  const manualSnap = await tx.get(
    firestore
      .collection("tempusuarios")
      .where("carreraId", "==", carreraId)
      .where("expiresAt", ">", now)
  );

  const reserved = new Set<number>();
  manualSnap.docs.forEach((d) => {
    const r = d.get("range");
    if (!r) return;
    const start = Number(r.start);
    const end = Number(r.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return;
    for (let i = start; i <= end; i++) reserved.add(i);
  });

  // 🔹 huecos primero
  const freeSnap = await tx.get(freeCol.orderBy("n", "asc").limit(5));
  for (const doc of freeSnap.docs) {
    const n = Number(doc.get("n"));
    if (!used.has(n) && !reserved.has(n)) {
      if (maxCupo > 0 && n > maxCupo) {
        throw new Error("Número fuera de cupo");
      }
      tx.delete(doc.ref);
      return n;
    }
  }

  // 🔹 avanzar nextNumber hasta uno libre y no reservado
  while (used.has(candidate) || reserved.has(candidate)) {
    candidate++;
    if (maxCupo > 0 && candidate > maxCupo) {
      throw new Error("Ya no hay números disponibles");
    }
  }

  tx.set(carreraRef, { nextNumber: candidate + 1 }, { merge: true });
  return candidate;
}

/**
 * Libera número
 */
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

/**
 * Estado de pago (flujo original intacto)
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
        const current = Number(data.competitorNumber || 0);

        if (current > 0) {
          tx.update(ref, { paymentStatus: status });
          return;
        }

        const assigned = await allocateNumberTx(tx, data.carreraId);
        tx.update(ref, {
          paymentStatus: status,
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
        });
      });
      continue;
    }

    if (status === "unpaid" || status === "expired") {
      await firestore.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);
        if (!insSnap.exists) return;

        const data = insSnap.data() as any;
        const n = Number(data.competitorNumber || 0);

        if (n > 0) {
          releaseNumberTx(tx, data.carreraId, n);
        }

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

  return res.status(200).json({ received: true });
}
