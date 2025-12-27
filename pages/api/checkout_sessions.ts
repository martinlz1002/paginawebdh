import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ✅ tu fórmula (ajústala a la real)
function calcularTotalCobrar(neto: number) {
  const IVA = 0.16;
  const stripePct = 0.036; // ajusta
  const stripeFijo = 3;    // ajusta

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Método ${req.method} No Permitido`);
  }

  const origin = req.headers.origin!;
  const { inscripcionId, carreraId, perfilId, categoria, distancia } = req.body as any;

  try {
    let _inscripcionId: string | null = inscripcionId || null;
    let _carreraId = carreraId;
    let _perfilId = perfilId;
    let _categoria = categoria;
    let _distancia = distancia;

    // ✅ Reintento: resolve todo desde la inscripción
    if (_inscripcionId) {
      const insSnap = await getDoc(doc(db, "inscripciones", _inscripcionId));
      if (!insSnap.exists()) return res.status(404).json({ error: "Inscripción no encontrada" });

      const ins = insSnap.data() as any;

      // ⚠️ Ajusta si tus campos se llaman distinto:
      _carreraId = ins.carreraId;
      _perfilId = ins.perfilId;
      _categoria = ins.categoria;
      _distancia = ins.distancia || ins.ruta; // por si usas ruta

      if (!_carreraId || !_perfilId || !_categoria || !_distancia) {
        return res.status(400).json({ error: "Inscripción incompleta (carrera/perfil/categoría/distancia)" });
      }
    }

    // ✅ Cargar carrera
    const carreraSnap = await getDoc(doc(db, "carreras", _carreraId));
    if (!carreraSnap.exists()) return res.status(404).json({ error: "Carrera no encontrada" });
    const carrera = carreraSnap.data() as any;

    // ✅ Bloqueo inscripciones
    const abiertas = carrera.inscripcionesAbiertas !== false;
    if (!abiertas) {
      return res.status(403).json({
        error: carrera.inscripcionesMensaje || "Inscripciones pausadas temporalmente.",
      });
    }

    // ✅ calcular neto desde el modelo real
    const neto = getNetoFromCarrera(carrera, _distancia, _categoria);
    const unit_amount = calcularTotalCobrar(neto);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "oxxo"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "mxn",
            product_data: { name: `Inscripción: ${_categoria} (${_distancia})` },
            unit_amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/mis-inscripciones?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mis-inscripciones`,
      metadata: {
        inscripcionId: _inscripcionId || "",
        carreraId: _carreraId,
        perfilId: _perfilId,
        categoria: _categoria,
        distancia: _distancia,
        neto: String(neto),
      },
      expand: ["payment_intent"],
    });

    const url =
      session.url ||
      (session.payment_intent as any).next_action?.oxxo_display_details?.hosted_voucher_url ||
      "";

    return res.status(200).json({ url, sessionId: session.id });
  } catch (err: any) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: err.message });
  }
}