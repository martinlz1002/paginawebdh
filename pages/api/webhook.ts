import { buffer } from "micro";
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = {
  api: {
    bodyParser: false,
  },
};

// ============================================================
// ENV
// ============================================================

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

// ============================================================
// FIREBASE ADMIN
// ============================================================

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = Buffer.from(
      requireEnv("FIREBASE_SERVICE_ACCOUNT_KEY_B64"),
      "base64"
    ).toString("utf8");

    const serviceAccount = JSON.parse(raw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin;
}

const firebaseAdmin = getFirebaseAdmin();
const db = firebaseAdmin.firestore();
const FieldValue = firebaseAdmin.firestore.FieldValue;

// ============================================================
// STRIPE
// ============================================================

const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-05-28.basil",
});

const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

// ============================================================
// ASIGNACIÓN REAL DE NÚMERO
// ============================================================

async function allocateNumberTx(
  tx: FirebaseFirestore.Transaction,
  carreraId: string
): Promise<number> {
  const carreraRef = db.collection("carreras").doc(carreraId);

  const carreraSnap = await tx.get(carreraRef);

  if (!carreraSnap.exists) {
    throw new Error(`Carrera no existe: ${carreraId}`);
  }

  const maxCupo = Number(carreraSnap.get("maxCompetitors") || 0);

  // ----------------------------------------------------------
  // 1. NÚMEROS YA UTILIZADOS
  //
  // IMPORTANTE:
  // Solo filtramos por carreraId en Firestore y hacemos el resto
  // en memoria para evitar depender de índices compuestos.
  // ----------------------------------------------------------

  const usedSnap = await tx.get(
    db.collection("inscripciones").where("carreraId", "==", carreraId)
  );

  const used = new Set<number>();

  usedSnap.docs.forEach((doc) => {
    const data = doc.data();

    const paymentStatus = String(data.paymentStatus || "").toLowerCase();

    if (paymentStatus !== "paid" && paymentStatus !== "manual") {
      return;
    }

    const rawNumber =
      data.competitorNumber ?? data.ficha ?? data.bib ?? null;

    const number = Number(rawNumber);

    if (Number.isFinite(number) && number > 0) {
      used.add(number);
    }
  });

  // ----------------------------------------------------------
  // 2. RANGOS MANUALES ACTIVOS
  //
  // IMPORTANTE:
  // Solo filtramos por carreraId en Firestore.
  // expiresAt se revisa en memoria para evitar índice compuesto.
  // ----------------------------------------------------------

  const tempSnap = await tx.get(
    db.collection("tempusuarios").where("carreraId", "==", carreraId)
  );

  const reserved = new Set<number>();
  const now = Date.now();

  tempSnap.docs.forEach((doc) => {
    const data = doc.data();
    const range = data.range;

    if (!range) {
      return;
    }

    const expiresAt = data.expiresAt;

    if (expiresAt) {
      let expiresMs = 0;

      if (
        typeof expiresAt === "object" &&
        typeof expiresAt.toDate === "function"
      ) {
        expiresMs = expiresAt.toDate().getTime();
      } else {
        expiresMs = new Date(expiresAt).getTime();
      }

      if (Number.isFinite(expiresMs) && expiresMs <= now) {
        return;
      }
    }

    const start = Number(range.start);
    const end = Number(range.end);

    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return;
    }

    for (let n = start; n <= end; n++) {
      if (Number.isFinite(n) && n > 0) {
        reserved.add(n);
      }
    }
  });

  // ----------------------------------------------------------
  // 3. PRIMER NÚMERO DISPONIBLE
  // ----------------------------------------------------------

  const limit = maxCupo > 0 ? maxCupo : 100000;

  for (let n = 1; n <= limit; n++) {
    if (!used.has(n) && !reserved.has(n)) {
      return n;
    }
  }

  throw new Error(
    `Ya no hay números disponibles para la carrera ${carreraId}`
  );
}

// ============================================================
// BUSCAR INSCRIPCIÓN POR SESSION ID
// ============================================================

async function getInscripcionesBySessionId(sessionId: string) {
  return db
    .collection("inscripciones")
    .where("sessionId", "==", sessionId)
    .get();
}

// ============================================================
// MARCAR PAGO
// ============================================================

async function markPaymentStatus(
  sessionId: string,
  status: "paid" | "pending" | "expired" | "unpaid"
) {
  if (!sessionId || !sessionId.startsWith("cs_")) {
    console.warn(
      "[webhook] ID ignorado porque no parece Checkout Session:",
      sessionId
    );
    return;
  }

  console.log(
    `[webhook] Buscando inscripción para sessionId=${sessionId}, status=${status}`
  );

  const snap = await getInscripcionesBySessionId(sessionId);

  if (snap.empty) {
    console.warn(
      "[webhook] No se encontró inscripción para sessionId:",
      sessionId
    );
    return;
  }

  console.log(
    `[webhook] Inscripciones encontradas: ${snap.size} para ${sessionId}`
  );

  for (const docSnap of snap.docs) {
    const ref = docSnap.ref;

    // ========================================================
    // PAGADO
    // ========================================================

    if (status === "paid") {
      await db.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);

        if (!insSnap.exists) {
          return;
        }

        const data = insSnap.data()!;

        // ----------------------------------------------------
        // IDEMPOTENCIA
        // ----------------------------------------------------

        if (data.paymentStatus === "paid") {
          console.log(
            "[webhook] Inscripción ya estaba pagada:",
            ref.path
          );
          return;
        }

        let competitorNumber = Number(data.competitorNumber);

        // ----------------------------------------------------
        // YA TIENE NÚMERO
        // ----------------------------------------------------

        if (
          Number.isFinite(competitorNumber) &&
          competitorNumber > 0
        ) {
          tx.update(ref, {
            paymentStatus: "paid",
            updatedAt: FieldValue.serverTimestamp(),
          });

          console.log(
            "[webhook] Pago confirmado, conservando número:",
            competitorNumber,
            ref.path
          );

          return;
        }

        // ----------------------------------------------------
        // ASIGNAR NÚMERO
        // ----------------------------------------------------

        if (!data.carreraId) {
          throw new Error(
            `La inscripción ${ref.path} no tiene carreraId`
          );
        }

        const assigned = await allocateNumberTx(
          tx,
          String(data.carreraId)
        );

        tx.update(ref, {
          paymentStatus: "paid",
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(
          "[webhook] Pago confirmado y número asignado:",
          assigned,
          ref.path
        );
      });

      continue;
    }

    // ========================================================
    // PENDIENTE
    // ========================================================

    if (status === "pending") {
      await db.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);

        if (!insSnap.exists) {
          return;
        }

        const data = insSnap.data()!;

        // Nunca degradar una inscripción pagada.
        if (data.paymentStatus === "paid") {
          return;
        }

        tx.update(ref, {
          paymentStatus: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      continue;
    }

    // ========================================================
    // EXPIRADO / NO PAGADO
    // ========================================================

    if (status === "expired" || status === "unpaid") {
      await db.runTransaction(async (tx) => {
        const insSnap = await tx.get(ref);

        if (!insSnap.exists) {
          return;
        }

        const data = insSnap.data()!;

        // Nunca eliminar el número de una inscripción pagada.
        if (data.paymentStatus === "paid") {
          return;
        }

        tx.update(ref, {
          paymentStatus: status,
          competitorNumber: FieldValue.delete(),
          ficha: FieldValue.delete(),
          bib: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    }
  }
}

// ============================================================
// SINCRONIZAR ORGANIZADOR STRIPE
// ============================================================

async function syncOrganizerFromStripe(accountId: string) {
  if (!accountId) {
    return;
  }

  console.log(
    "[webhook] Sincronizando cuenta Connect:",
    accountId
  );

  const account = await stripe.accounts.retrieve(accountId);

  const organizerSnap = await db
    .collection("organizadores")
    .where("connectedAccountId", "==", accountId)
    .limit(1)
    .get();

  if (organizerSnap.empty) {
    console.warn(
      "[webhook] No se encontró organizador para connectedAccountId:",
      accountId
    );
    return;
  }

  const organizerRef = organizerSnap.docs[0].ref;

  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;

  let stripeStatus = "created";

  if (!detailsSubmitted) {
    stripeStatus = "onboarding";
  } else if (!chargesEnabled || !payoutsEnabled) {
    stripeStatus = "action_required";
  } else {
    stripeStatus = "active";
  }

  const currentlyDue = account.requirements?.currently_due || [];
  const eventuallyDue = account.requirements?.eventually_due || [];
  const disabledReason = account.requirements?.disabled_reason || null;

  await organizerRef.update({
    connectedAccountId: account.id,
    stripeStatus,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    currentlyDue,
    eventuallyDue,
    disabledReason,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(
    "[webhook] Organizador sincronizado:",
    accountId,
    stripeStatus
  );
}

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  // ==========================================================
  // LEER BODY
  // ==========================================================

  let buf: Buffer;

  try {
    buf = await buffer(req);
  } catch (error) {
    console.error("[webhook] Error leyendo body:", error);

    return res.status(400).json({
      error: "No fue posible leer el body",
    });
  }

  // ==========================================================
  // STRIPE SIGNATURE
  // ==========================================================

  const signature = req.headers["stripe-signature"];

  if (typeof signature !== "string") {
    console.error("[webhook] Falta stripe-signature");

    return res.status(400).json({
      error: "Missing Stripe signature",
    });
  }

  // ==========================================================
  // CONSTRUIR EVENTO
  // ==========================================================

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      signature,
      webhookSecret
    );
  } catch (error: any) {
    console.error(
      "[webhook] Firma Stripe inválida:",
      error?.message || error
    );

    return res.status(400).json({
      error: "Invalid Stripe signature",
    });
  }

  console.log(
    `[webhook] Evento recibido: ${event.type} (${event.id})`
  );

  // ==========================================================
  // PROCESAR EVENTO
  // ==========================================================

  try {
    switch (event.type) {
      // ======================================================
      // CHECKOUT COMPLETADO
      // ======================================================

      case "checkout.session.completed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        console.log(
          "[webhook] checkout.session.completed",
          {
            eventId: event.id,
            sessionId: session.id,
            paymentStatus: session.payment_status,
            paymentIntent:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id || null,
          }
        );

        await markPaymentStatus(
          session.id,
          session.payment_status === "paid"
            ? "paid"
            : "pending"
        );

        break;
      }

      // ======================================================
      // OXXO / PAGOS ASÍNCRONOS COMPLETADOS
      // ======================================================

      case "checkout.session.async_payment_succeeded": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        console.log(
          "[webhook] async payment succeeded:",
          session.id
        );

        await markPaymentStatus(session.id, "paid");

        break;
      }

      // ======================================================
      // OXXO / PAGO ASÍNCRONO FALLIDO
      // ======================================================

      case "checkout.session.async_payment_failed": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        console.log(
          "[webhook] async payment failed:",
          session.id
        );

        await markPaymentStatus(session.id, "unpaid");

        break;
      }

      // ======================================================
      // CHECKOUT EXPIRADO
      // ======================================================

      case "checkout.session.expired": {
        const session =
          event.data.object as Stripe.Checkout.Session;

        console.log(
          "[webhook] checkout expired:",
          session.id
        );

        await markPaymentStatus(session.id, "expired");

        break;
      }

      // ======================================================
      // CUENTA CONNECT ACTUALIZADA
      // ======================================================

      case "account.updated": {
        const accountId = event.account;

        if (typeof accountId === "string") {
          console.log(
            "[webhook] account.updated:",
            accountId
          );

          await syncOrganizerFromStripe(accountId);
        }

        break;
      }

      // ======================================================
      // PAYMENT INTENT
      //
      // NO procesamos estos eventos porque entregan pi_...
      // y nuestras inscripciones usan cs_...
      // ======================================================

      case "payment_intent.succeeded":
      case "payment_intent.payment_failed": {
        const paymentIntent =
          event.data.object as Stripe.PaymentIntent;

        console.log(
          "[webhook] PaymentIntent ignorado:",
          event.type,
          paymentIntent.id
        );

        break;
      }

      // ======================================================
      // OTROS EVENTOS
      // ======================================================

      default: {
        console.log(
          "[webhook] Evento no manejado:",
          event.type
        );

        break;
      }
    }

    return res.status(200).json({
      received: true,
    });
  } catch (error: any) {
    console.error(
      "[webhook] ERROR PROCESANDO EVENTO",
      {
        eventId: event.id,
        eventType: event.type,
        message: error?.message || String(error),
        code: error?.code || null,
        stack: error?.stack || null,
      }
    );

    return res.status(500).json({
      received: false,
      error: error?.message || "Error procesando webhook",
    });
  }
}

