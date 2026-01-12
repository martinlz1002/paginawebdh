import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: true } };

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

// ----------------- utils -----------------
function norm(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

function calcularTotalCobrar(neto: number) {
  const IVA = 0.16;
  const stripePct = 0.036;
  const stripeFijo = 3;

  const base = neto * (1 + IVA);
  const bruto = (base + stripeFijo) / (1 - stripePct);
  return Math.round(bruto * 100);
}

function getNetoFromCarrera(carrera: any, distancia: string, categoria: string) {
  const d = (carrera.distancias || []).find(
    (x: any) => norm(x.distancia) === norm(distancia)
  );
  if (!d) throw new Error(`Distancia no encontrada: "${distancia}"`);

  const c = (d.categorias || []).find(
    (x: any) => norm(x.nombre) === norm(categoria)
  );
  if (!c) throw new Error(`Categoría no encontrada: "${categoria}"`);

  const neto = Number(c.price);
  if (!Number.isFinite(neto) || neto <= 0) {
    throw new Error("Precio inválido");
  }
  return neto;
}

function getOrigin(req: NextApiRequest) {
  if (typeof req.headers.origin === "string") return req.headers.origin;
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) throw new Error("Missing NEXT_PUBLIC_BASE_URL");
  return base;
}

// ----------------- handler -----------------
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
    if (!inscripcionId) {
      return res.status(400).json({ error: "Falta inscripcionId" });
    }

    const insRef = firestore.collection("inscripciones").doc(inscripcionId);

    const payload = await firestore.runTransaction(async (tx) => {
      const insSnap = await tx.get(insRef);
      if (!insSnap.exists) throw new Error("Inscripción no encontrada");

      const ins = insSnap.data() as any;
      if (ins.paymentStatus === "paid") {
        throw new Error("La inscripción ya está pagada");
      }

      const carreraSnap = await tx.get(
        firestore.collection("carreras").doc(ins.carreraId)
      );
      if (!carreraSnap.exists) throw new Error("Carrera no encontrada");

      const neto = getNetoFromCarrera(
        carreraSnap.data(),
        ins.distancia || ins.ruta,
        ins.categoria
      );

      tx.update(insRef, {
        paymentStatus: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });

      return {
        neto,
        categoria: ins.categoria,
        distancia: ins.distancia || ins.ruta,
        carreraId: ins.carreraId,
        perfilId: ins.perfilId || "",
      };
    });

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
            unit_amount: calcularTotalCobrar(payload.neto),
          },
          quantity: 1,
        },
      ],
      success_url: `${getOrigin(req)}/mis-inscripciones`,
      cancel_url: `${getOrigin(req)}/mis-inscripciones`,
      metadata: {
        inscripcionId,
        carreraId: payload.carreraId,
        perfilId: payload.perfilId,
      },
    });

    await insRef.update({
      sessionId: session.id,
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("[retry_checkout]", err);
    return res.status(500).json({ error: err.message || "Error" });
  }
}