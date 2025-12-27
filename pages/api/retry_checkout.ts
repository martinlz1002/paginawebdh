import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = { api: { bodyParser: true } };

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

// misma fórmula que ya tienes
function calcularTotalCobrar(neto: number) {
  const IVA = 0.16;
  const stripePct = 0.036;
  const stripeFijo = 3;

  const base = neto * (1 + IVA);
  const bruto = (base + stripeFijo) / (1 - stripePct);
  return Math.round(bruto * 100);
}

function getNetoFromCarrera(carrera: any, distancia: string, categoria: string) {
  const d = (carrera.distancias || []).find((x: any) => x.distancia === distancia);
  if (!d) throw new Error("Distancia no encontrada en la carrera");

  const c = (d.categorias || []).find((x: any) => x.nombre === categoria);
  if (!c) throw new Error("Categoría no encontrada en la distancia");

  const neto = Number(c.price);
  if (!Number.isFinite(neto) || neto <= 0) throw new Error("Precio inválido");
  return neto;
}

// pool helpers
async function allocateNumberTx(tx: FirebaseFirestore.Transaction, carreraId: string) {
  const carreraRef = firestore.collection("carreras").doc(carreraId);
  const freeCol = carreraRef.collection("freeNumbers");

  const carreraSnap = await tx.get(carreraRef);
  if (!carreraSnap.exists) throw new Error("Carrera no existe");

  const maxCupo = (carreraSnap.get("maxCompetitors") || 0) as number;
  const nextNumber = (carreraSnap.get("nextNumber") || 1) as number;

  const q = freeCol.orderBy("n", "asc").limit(1);
  const freeSnap = await tx.get(q);

  if (!freeSnap.empty) {
    const freeDoc = freeSnap.docs[0];
    const n = freeDoc.get("n") as number;
    tx.delete(freeDoc.ref);
    if (n <= 0 || (maxCupo > 0 && n > maxCupo)) throw new Error("Número libre inválido");
    return n;
  }

  if (maxCupo > 0 && nextNumber > maxCupo) throw new Error("Ya no hay números disponibles");
  tx.set(carreraRef, { nextNumber: nextNumber + 1 }, { merge: true });
  return nextNumber;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end("Method Not Allowed");
  }

  const { inscripcionId } = req.body as { inscripcionId?: string };
  if (!inscripcionId) return res.status(400).json({ error: "Falta inscripcionId" });

  try {
    // 1) transacción: garantizar número asignado (rellenando huecos)
    const insRef = firestore.collection("inscripciones").doc(inscripcionId);

    const { carreraId, perfilId, categoria, distancia, neto, competitorNumber } =
      await firestore.runTransaction(async (tx) => {
        const insSnap = await tx.get(insRef);
        if (!insSnap.exists) throw new Error("Inscripción no encontrada");

        const ins = insSnap.data() as any;

        const carreraId = ins.carreraId as string;
        const perfilId = ins.perfilId as string | null;
        const categoria = ins.categoria as string;
        const distancia = (ins.distancia || ins.ruta) as string;

        if (!carreraId || !categoria || !distancia) {
          throw new Error("Inscripción incompleta (carrera/categoría/distancia)");
        }

        // si está pagada, no reintenta
        if (ins.paymentStatus === "paid") {
          throw new Error("La inscripción ya está pagada");
        }

        let assigned = ins.competitorNumber as number | undefined;

        // ✅ si no tiene número (porque expiró y lo liberaste), asigna otro del pool
        if (!assigned) {
          assigned = await allocateNumberTx(tx, carreraId);
          tx.update(insRef, {
            competitorNumber: assigned,
            ficha: assigned,
            bib: assigned,
            // status pendiente, se confirma con webhook
            paymentStatus: "pending",
          });
        } else {
          // asegura ficha/bib si faltan
          const updates: any = { paymentStatus: "pending" };
          if (!ins.ficha) updates.ficha = assigned;
          if (!ins.bib) updates.bib = assigned;
          tx.update(insRef, updates);
        }

        // leer carrera dentro de la transacción para calcular neto consistente
        const carreraRef = firestore.collection("carreras").doc(carreraId);
        const carreraSnap = await tx.get(carreraRef);
        if (!carreraSnap.exists) throw new Error("Carrera no encontrada");

        const carrera = carreraSnap.data() as any;
        const neto = getNetoFromCarrera(carrera, distancia, categoria);

        return { carreraId, perfilId, categoria, distancia, neto, competitorNumber: assigned };
      });

    // 2) crear sesión Stripe nueva con total calculado
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL!;
    const unit_amount = calcularTotalCobrar(neto);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: `Inscripción: ${categoria} (${distancia})` },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/mis-inscripciones?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mis-inscripciones`,
      metadata: {
        inscripcionId,
        carreraId,
        perfilId: perfilId || "",
        categoria,
        distancia,
        neto: String(neto),
        competitorNumber: String(competitorNumber),
      },
      expand: ["payment_intent"],
    });

    const url =
      session.url ||
      (session.payment_intent as any).next_action?.oxxo_display_details?.hosted_voucher_url ||
      "";

    // 3) guardar sessionId en inscripción
    await insRef.update({
      sessionId: session.id,
      paymentStatus: "pending",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ url, sessionId: session.id });
  } catch (err: any) {
    console.error("[retry_checkout] error:", err);
    return res.status(500).json({ error: err.message || "Error" });
  }
}