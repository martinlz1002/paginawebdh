import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe"; // si tu lib ya exporta stripe configurado, úsalo
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function norm(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

// ⚠️ OJO: aquí define UNA sola fórmula para TODO el proyecto
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
  if (!Number.isFinite(neto) || neto <= 0) throw new Error("Precio inválido");
  return neto;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Método ${req.method} No Permitido`);
  }

  try {
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL;
    if (!origin) return res.status(500).json({ error: "Missing origin / NEXT_PUBLIC_BASE_URL" });

    // ✅ Ya NO recibimos price como verdad
    const { carreraId, perfilId, categoria, distancia } = req.body as {
      carreraId?: string;
      perfilId?: string | null;
      categoria?: string;
      distancia?: string; // viene de UI (distancia/ruta)
    };

    if (!carreraId || !categoria || !distancia) {
      return res.status(400).json({
        error: "Faltan datos (carreraId, categoria, distancia)",
      });
    }

    // ✅ bloqueo inscripciones
    const carreraSnap = await getDoc(doc(db, "carreras", carreraId));
    if (!carreraSnap.exists()) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }
    const carrera = carreraSnap.data() as any;

    const abiertas = carrera.inscripcionesAbiertas !== false;
    if (!abiertas) {
      return res.status(403).json({
        error: carrera.inscripcionesMensaje || "Inscripciones pausadas temporalmente.",
      });
    }

    // ✅ neto desde carrera y total con la MISMA fórmula que retry
    const neto = getNetoFromCarrera(carrera, distancia, categoria);
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
      cancel_url: `${origin}/inscribirse?carreraId=${carreraId}`,
      metadata: {
        carreraId,
        perfilId: perfilId || "",
        categoria,
        distancia,
        neto: String(neto),
      },
      expand: ["payment_intent"],
    });

    const url =
      session.url ||
      (session.payment_intent as any).next_action?.oxxo_display_details?.hosted_voucher_url ||
      "";

    if (!url) return res.status(500).json({ error: "Stripe no devolvió url" });

    return res.status(200).json({ url, sessionId: session.id });
  } catch (err: any) {
    console.error("[checkout_sessions] error:", err?.message, err);
    return res.status(500).json({ error: err?.message || "Error" });
  }
}
