import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: true } };

// ---------- env guards ----------
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in server env`);
  return v;
}

// ---------- init admin ----------
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

// ---------- init stripe ----------
const stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2025-05-28.basil",
});

// ---------- helpers ----------
function norm(s: any) {
  return String(s ?? "").trim().toUpperCase();
}

function calcularTotalCobrar(neto: number) {
  const IVA = 0.16;
  const stripePct = 0.036;
  const stripeFijo = 3;

  const base = neto * (1 + IVA);
  const bruto = (base + stripeFijo) / (1 - stripePct);
  return Math.round(bruto * 100); // centavos
}

function getNetoFromCarrera(carrera: any, distancia: string, categoria: string) {
  const distN = norm(distancia);
  const catN = norm(categoria);

  const d = (carrera.distancias || []).find(
    (x: any) => norm(x.distancia) === distN
  );
  if (!d) throw new Error(`Distancia no encontrada: "${distancia}"`);

  const c = (d.categorias || []).find(
    (x: any) => norm(x.nombre) === catN
  );
  if (!c)
    throw new Error(
      `Categoría no encontrada: "${categoria}" en "${distancia}"`
    );

  const neto = Number(c.price);
  if (!Number.isFinite(neto) || neto <= 0)
    throw new Error("Precio inválido");

  return neto;
}

// ---------- pool helpers (CORREGIDO) ----------
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

  // 🔹 usados (manual + online)
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
    for (let i = start; i <= end; i++) {
      reserved.add(i);
    }
  });

  // 🔹 huecos primero
  const freeSnap = await tx.get(
    freeCol.orderBy("n", "asc").limit(5)
  );

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

  // 🔹 avanzar nextNumber hasta libre y no reservado
  while (used.has(candidate) || reserved.has(candidate)) {
    candidate++;
    if (maxCupo > 0 && candidate > maxCupo) {
      throw new Error("Ya no hay números disponibles");
    }
  }

  tx.set(carreraRef, { nextNumber: candidate + 1 }, { merge: true });
  return candidate;
}

function getOrigin(req: NextApiRequest) {
  const h = req.headers.origin;
  if (typeof h === "string" && h.length > 0) return h;

  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base)
    throw new Error(
      "Missing NEXT_PUBLIC_BASE_URL (needed when Origin header is absent)"
    );
  return base;
}

// ---------- handler ----------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { inscripcionId } = req.body as { inscripcionId?: string };
    if (!inscripcionId)
      return res.status(400).json({ error: "Falta inscripcionId" });

    const insRef = firestore.collection("inscripciones").doc(inscripcionId);

    // 1️⃣ Transacción: asegurar número y calcular neto real
    const payload = await firestore.runTransaction(async (tx) => {
      const insSnap = await tx.get(insRef);
      if (!insSnap.exists) throw new Error("Inscripción no encontrada");

      const ins = insSnap.data() as any;

      const carreraId = ins.carreraId as string;
      const perfilId = (ins.perfilId as string | null) || null;
      const categoria = ins.categoria as string;
      const distancia = (ins.distancia || ins.ruta) as string;

      if (!carreraId || !categoria || !distancia) {
        throw new Error("Inscripción incompleta");
      }

      if (ins.paymentStatus === "paid") {
        throw new Error("La inscripción ya está pagada");
      }

      let assigned = ins.competitorNumber as number | null;

      if (!assigned) {
        assigned = await allocateNumberTx(tx, carreraId);
        tx.update(insRef, {
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
          paymentStatus: "pending",
        });
      } else {
        const updates: any = { paymentStatus: "pending" };
        if (!ins.ficha) updates.ficha = assigned;
        if (!ins.bib) updates.bib = assigned;
        tx.update(insRef, updates);
      }

      const carreraRef = firestore.collection("carreras").doc(carreraId);
      const carreraSnap = await tx.get(carreraRef);
      if (!carreraSnap.exists) throw new Error("Carrera no encontrada");

      const carrera = carreraSnap.data() as any;
      const neto = getNetoFromCarrera(carrera, distancia, categoria);

      return {
        carreraId,
        perfilId,
        categoria,
        distancia,
        neto,
        competitorNumber: assigned,
      };
    });

    const origin = getOrigin(req);
    const unit_amount = calcularTotalCobrar(payload.neto);

    // 2️⃣ Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `Inscripción: ${payload.categoria} (${payload.distancia})`,
            },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/mis-inscripciones?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mis-inscripciones`,
      metadata: {
        inscripcionId,
        carreraId: payload.carreraId,
        perfilId: payload.perfilId || "",
        categoria: payload.categoria,
        distancia: payload.distancia,
        neto: String(payload.neto),
        competitorNumber: String(payload.competitorNumber),
      },
      expand: ["payment_intent"],
    });

    if (!session.url) {
      throw new Error("Stripe no devolvió URL de pago");
    }

    // 3️⃣ guardar sesión
    await insRef.update({
      sessionId: session.id,
      paymentStatus: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("[retry_checkout] error:", err?.message, err);
    return res.status(500).json({
      error: err?.message || "Error",
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
    });
  }
}
