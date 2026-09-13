import type { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

function norm(v: any) {
  return String(v ?? "").trim().toUpperCase();
}

/**
 * Calcula cuánto debe pagar el corredor para que DHTime
 * reciba exactamente el precio configurado en la carrera,
 * después de descontar la comisión de Stripe y el IVA
 * aplicado sobre dicha comisión.
 *
 * Stripe México:
 * Tarjeta nacional = 3.6% + $3 MXN
 *
 * Importante:
 * - El precio de inscripción NO lleva IVA aquí.
 * - El IVA se considera únicamente sobre la comisión de Stripe.
 * - El corredor absorbe el costo de procesamiento.
 */
function calcularTotalCobrar(neto: number) {
  const IVA_SOBRE_COMISION = 0.16;
  const STRIPE_PCT = 0.036;
  const STRIPE_FIJO = 3;

  /**
   * Queremos:
   *
   * bruto
   * - ((bruto * 3.6%) + $3) * 1.16
   * = neto
   *
   * Despejando:
   *
   * bruto =
   * (neto + fijo * IVA)
   * / (1 - porcentaje * IVA)
   */

  const bruto =
    (neto + STRIPE_FIJO * (1 + IVA_SOBRE_COMISION)) /
    (1 - STRIPE_PCT * (1 + IVA_SOBRE_COMISION));

  return Math.ceil(bruto * 100);
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

  if (!d) {
    throw new Error(`Distancia no encontrada: "${distancia}"`);
  }

  const c = (d.categorias || []).find(
    (x: any) => norm(x.nombre) === norm(categoria)
  );

  if (!c) {
    throw new Error(`Categoría no encontrada: "${categoria}"`);
  }

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

    if (!y || !m || !day) {
      return false;
    }

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

    return res
      .status(405)
      .end(`Método ${req.method} No Permitido`);
  }

  try {
    const origin =
      req.headers.origin || process.env.NEXT_PUBLIC_BASE_URL;

    if (!origin) {
      return res.status(500).json({
        error: "Missing origin / NEXT_PUBLIC_BASE_URL",
      });
    }

    const {
      carreraId,
      perfilId,
      categoria,
      distancia,
    } = req.body as {
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

    // =========================================================
    // CARRERA
    // =========================================================

    const carreraSnap = await getDoc(
      doc(db, "carreras", carreraId)
    );

    if (!carreraSnap.exists()) {
      return res.status(404).json({
        error: "Carrera no encontrada",
      });
    }

    const carrera = carreraSnap.data() as any;

    // =========================================================
    // PAUSA DE INSCRIPCIONES
    // =========================================================

    if (carrera.inscripcionesAbiertas === false) {
      return res.status(403).json({
        error:
          carrera.inscripcionesMensaje ||
          "Inscripciones pausadas temporalmente.",
      });
    }

    // =========================================================
    // CARRERA FINALIZADA
    // =========================================================

    if (carreraYaFinalizo(carrera.fecha)) {
      return res.status(403).json({
        error: "Esta carrera ya se llevó a cabo",
      });
    }

    // =========================================================
    // PRECIO
    // =========================================================

    /**
     * Este es el precio NETO que DHTime quiere recibir.
     *
     * Ejemplo:
     *
     * carrera.price = 350
     *
     * DHTime debe recibir:
     *
     * $350.00
     */
    const neto = getNetoFromCarrera(
      carrera,
      distancia,
      categoria
    );

    /**
     * Calculamos el precio final que verá/pagará el corredor.
     *
     * Ejemplo:
     *
     * $350 configurados
     * -> aproximadamente $368.88 cobrados
     *
     * $450 configurados
     * -> aproximadamente $473.24 cobrados
     */
    const unit_amount = calcularTotalCobrar(neto);

    // =========================================================
    // STRIPE CHECKOUT
    // =========================================================

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

            /**
             * Stripe recibe centavos.
             *
             * Ejemplo:
             *
             * $368.88 -> 36888
             */
            unit_amount,

          },

          quantity: 1,
        },
      ],

      success_url:
        `${origin}/mis-inscripciones` +
        `?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${origin}/inscribirse` +
        `?carreraId=${encodeURIComponent(carreraId)}`,

      metadata: {
        carreraId,
        perfilId: perfilId || "",
        categoria: norm(categoria),
        distancia: norm(distancia),

        /**
         * Precio que corresponde a la inscripción.
         * Este es el importe que DHTime quiere recibir.
         */
        neto: String(neto),

        /**
         * Precio que realmente pagó el corredor.
         */
        totalCobrado: String(
          (unit_amount / 100).toFixed(2)
        ),
      },
    });

    // =========================================================
    // VALIDACIÓN
    // =========================================================

    if (!session.url) {
      return res.status(500).json({
        error: "Stripe no devolvió url de checkout",
      });
    }

    // =========================================================
    // RESPUESTA
    // =========================================================

    return res.status(200).json({
      url: session.url,
      sessionId: session.id,

      /**
       * Datos útiles para mostrar/registrar.
       */
      neto,
      totalCobrado: unit_amount / 100,
    });

  } catch (err: any) {
    console.error(
      "[checkout_sessions] error:",
      err
    );

    return res.status(500).json({
      error:
        err?.message ||
        "Error interno",
    });
  }
}
