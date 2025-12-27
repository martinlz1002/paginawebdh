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

// Ajusta a tu fórmula real si la cambiaste
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

  const d = (carrera.distancias || []).find((x: any) => norm(x.distancia) === distN);
  if (!d) throw new Error(`Distancia no encontrada: "${distancia}"`);

  const c = (d.categorias || []).find((x: any) => norm(x.nombre) === catN);
  if (!c) throw new Error(`Categoría no encontrada: "${categoria}" en "${distancia}"`);

  const neto = Number(c.price);
  if (!Number.isFinite(neto) || neto <= 0) throw new Error("Precio inválido");
  return neto;
}

// Pool helpers: huecos primero, luego nextNumber
async function allocateNumberTx(tx: FirebaseFirestore.Transaction, carreraId: string) {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeCol = carreraRef.collection("freeNumbers");

  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const maxCupo = (carreraSnap.get("maxCompetitors") || 0) as number;
  const nextNumber = (carreraSnap.get("nextNumber") || 1) as number;

  // tomar hueco más pequeño
  const q = freeCol.orderBy("n", "asc").limit(1);
  const freeSnap = await tx.get(q);

  if (!freeSnap.empty) {
    const freeDoc = freeSnap.docs[0];
    const n = freeDoc.get("n") as number;
    tx.delete(freeDoc.ref);

    if (!Number.isFinite(n) || n <= 0) throw new Error("Número libre inválido");
    if (maxCupo > 0 && n > maxCupo) throw new Error("Número libre fuera de cupo");
    return n;
  }

  // sin huecos: nextNumber
  if (maxCupo > 0 && nextNumber > maxCupo) throw new Error("Ya no hay números disponibles");

  tx.set(carreraRef, { nextNumber: nextNumber + 1 }, { merge: true });
  return nextNumber;
}

function getOrigin(req: NextApiRequest) {
  // En prod a veces no viene origin (o viene vacío)
  // Usamos NEXT_PUBLIC_BASE_URL como fallback obligatorio
  const h = req.headers.origin;
  if (typeof h === "string" && h.length > 0) return h;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) throw new Error("Missing NEXT_PUBLIC_BASE_URL (needed when Origin header is absent)");
  return base;
}

// ---------- handler ----------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const { inscripcionId } = req.body as { inscripcionId?: string };
    if (!inscripcionId) return res.status(400).json({ error: "Falta inscripcionId" });

    const insRef = firestore.collection("inscripciones").doc(inscripcionId);

    // 1) tx: asegurar número + obtener datos + neto consistente desde carrera
    const payload = await firestore.runTransaction(async (tx) => {
      const insSnap = await tx.get(insRef);
      if (!insSnap.exists) throw new Error("Inscripción no encontrada");

      const ins = insSnap.data() as any;

      const carreraId = ins.carreraId as string;
      const perfilId = (ins.perfilId as string | null) || null;
      const categoria = ins.categoria as string;
      const distancia = (ins.distancia || ins.ruta) as string;

      if (!carreraId || !categoria || !distancia) {
        throw new Error("Inscripción incompleta (carrera/categoría/distancia)");
      }

      if (ins.paymentStatus === "paid") {
        throw new Error("La inscripción ya está pagada");
      }

      // número actual (si aún existe)
      let assigned = ins.competitorNumber as number | undefined | null;

      // ✅ si no hay número porque se liberó, reasignar desde huecos/next
      if (!assigned) {
        assigned = await allocateNumberTx(tx, carreraId);
        tx.update(insRef, {
          competitorNumber: assigned,
          ficha: assigned,
          bib: assigned,
          paymentStatus: "pending",
        });
      } else {
        // cura docs viejos
        const updates: any = { paymentStatus: "pending" };
        if (!ins.ficha) updates.ficha = assigned;
        if (!ins.bib) updates.bib = assigned;
        tx.update(insRef, updates);
      }

      // leer carrera y calcular neto real
      const carreraRef = firestore.collection("carreras").doc(carreraId);
      const carreraSnap = await tx.get(carreraRef);
      if (!carreraSnap.exists) throw new Error("Carrera no encontrada");

      const carrera = carreraSnap.data() as any;
      const neto = getNetoFromCarrera(carrera, distancia, categoria);

      return { carreraId, perfilId, categoria, distancia, neto, competitorNumber: assigned };
    });

    const origin = getOrigin(req);
    const unit_amount = calcularTotalCobrar(payload.neto);

    // 2) crear nueva sesión de stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: `Inscripción: ${payload.categoria} (${payload.distancia})` },
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

    const url =
      session.url ||
      (session.payment_intent as any).next_action?.oxxo_display_details?.hosted_voucher_url ||
      "";

    if (!url) {
      throw new Error("Stripe no devolvió URL de pago (session.url vacío)");
    }

    // 3) guardar sessionId vigente
    await insRef.update({
      sessionId: session.id,
      paymentStatus: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ url, sessionId: session.id });
  } catch (err: any) {
    // Log completo para Vercel/Functions
    console.error("[retry_checkout] error:", err?.message, err);

    return res.status(500).json({
      error: err?.message || "Error",
      // en prod normalmente no regreses stack, pero esto ayuda mientras debugueas
      stack: process.env.NODE_ENV !== "production" ? err?.stack : undefined,
    });
  }
}