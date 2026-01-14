import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

function norm(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

// ✅ UNA sola fórmula para TODO el proyecto
function calcularTotalCobrar(neto: number) {
  const IVA = 0.16;
  const stripePct = 0.036;
  const stripeFijo = 3;

  const base = neto * (1 + IVA);
  const bruto = (base + stripeFijo) / (1 - stripePct);

  return Math.round(bruto * 100);
}

function getNetoFromCarrera(
  carrera: any,
  distancia: string,
  categoria: string
) {
  if (!Array.isArray(carrera.distancias)) {
    throw new Error("La carrera no tiene distancias configuradas");
  }

  const d = carrera.distancias.find(
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

function carreraYaFinalizo(fecha: any): boolean {
  let d: Date;

  if (fecha instanceof Timestamp) {
    d = fecha.toDate();
  } else if (typeof fecha === "string") {
    const [y, m, day] = fecha.split("-").map(Number);
    d = new Date(y, m - 1, day);
  } else {
    return false;
  }

  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return d < today;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Método ${req.method} No Permitido`);
  }

  try {
    const origin = req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL;
    if (!origin) {
      return res.status(500).json({
        error: "Missing origin / NEXT_PUBLIC_BASE_URL",
      });
    }

    const { carreraId, perfilId, categoria, distancia } = req.body as {
      carreraId?: string;
      perfilId?: string | null;
      categoria?: string;
      distancia?: string;
    };

    if (!carreraId || !categoria || !distancia) {
      return res.status(400).json({
        error: "Faltan datos (carreraId, categoria, distancia)",
      });
    }

    // ---------- CARRERA ----------
    const carreraSnap = await getDoc(doc(db, "carreras", carreraId));
    if (!carreraSnap.exists()) {
      return res.status(404).json({ error: "Carrera no encontrada" });
    }

    const carrera = carreraSnap.data() as any;

    // 🔒 PAUSA ADMIN
    if (carrera.inscripcionesAbiertas === false) {
      return res.status(403).json({
        error:
          carrera.inscripcionesMensaje ||
          "Inscripciones pausadas temporalmente.",
      });
    }

    // 🔒 CARRERA FINALIZADA
    if (carreraYaFinalizo(carrera.fecha)) {
      return res.status(403).json({
        error: "Esta carrera ya se llevó a cabo",
      });
    }

    // ---------- PRECIO ----------
    const neto = getNetoFromCarrera(carrera, distancia, categoria);
    const unit_amount = calcularTotalCobrar(neto);

    // ---------- STRIPE ----------
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: {
              name: `Inscripción: ${categoria} (${distancia})`,
            },
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
        categoria: norm(categoria),
        distancia: norm(distancia),
        neto: String(neto),
      },
    });

    if (!session.url) {
      return res.status(500).json({
        error: "Stripe no devolvió url de checkout",
      });
    }

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error("[checkout_sessions] error:", err);
    return res.status(500).json({
      error: err?.message || "Error interno",
    });
  }
}
