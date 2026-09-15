import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import { stripe } from "@/lib/stripe";

/**
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
 *
 * Este endpoint corre en el servidor.
 *
 * IMPORTANTE:
 * No usamos el Firebase Client SDK para consultar
 * organizadores porque esa consulta estaría sujeta
 * a las reglas públicas/privadas de Firestore.
 *
 * Firebase Admin accede directamente desde el servidor.
 */
function getAdminDb() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

    if (!raw) {
      throw new Error(
        "Falta FIREBASE_SERVICE_ACCOUNT_KEY_B64"
      );
    }

    const serviceAccount = JSON.parse(
      Buffer.from(raw, "base64").toString("utf8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  return admin.firestore();
}

/**
 * ============================================================
 * NORMALIZAR
 * ============================================================
 */
function norm(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

/**
 * ============================================================
 * CALCULAR TOTAL A COBRAR
 * ============================================================
 *
 * El precio "neto" de la carrera es lo que debe recibir
 * DHTime o el organizador.
 *
 * El corredor absorbe el costo de procesamiento de Stripe.
 *
 * Stripe México:
 *
 * Tarjeta nacional:
 *   3.6% + $3 MXN
 *
 * IVA sobre la comisión:
 *   16%
 *
 * Queremos:
 *
 * bruto
 * - ((bruto * 3.6%) + $3) * 1.16
 * = neto
 *
 * Despejando:
 *
 * bruto =
 * (neto + fijo * 1.16)
 * / (1 - porcentaje * 1.16)
 *
 * ============================================================
 */
function calcularTotalCobrar(
  neto: number
) {
  const IVA_SOBRE_COMISION = 0.16;

  const STRIPE_PCT = 0.036;

  const STRIPE_FIJO = 3;

  const bruto =
    (
      neto +
      STRIPE_FIJO *
        (1 + IVA_SOBRE_COMISION)
    ) /
    (
      1 -
      STRIPE_PCT *
        (1 + IVA_SOBRE_COMISION)
    );

  return Math.ceil(
    bruto * 100
  );
}

/**
 * ============================================================
 * OBTENER PRECIO NETO DE LA CARRERA
 * ============================================================
 */
function getNetoFromCarrera(
  carrera: any,
  distancia: string,
  categoria: string
) {
  if (
    !Array.isArray(
      carrera.distancias
    )
  ) {
    throw new Error(
      "La carrera no tiene distancias configuradas"
    );
  }

  const d =
    carrera.distancias.find(
      (x: any) =>
        norm(x.distancia) ===
        norm(distancia)
    );

  if (!d) {
    throw new Error(
      `Distancia no encontrada: "${distancia}"`
    );
  }

  const c =
    (
      d.categorias || []
    ).find(
      (x: any) =>
        norm(x.nombre) ===
        norm(categoria)
    );

  if (!c) {
    throw new Error(
      `Categoría no encontrada: "${categoria}"`
    );
  }

  const neto =
    Number(c.price);

  if (
    !Number.isFinite(neto) ||
    neto <= 0
  ) {
    throw new Error(
      "Precio inválido"
    );
  }

  return neto;
}

/**
 * ============================================================
 * VERIFICAR SI LA CARRERA YA FINALIZÓ
 * ============================================================
 */
function carreraYaFinalizo(
  fecha: any
): boolean {
  let d: Date;

  /**
   * Firestore Timestamp
   *
   * No dependemos de importar Timestamp directamente.
   * Esto funciona con objetos Timestamp provenientes
   * de Firebase Admin.
   */
  if (
    fecha &&
    typeof fecha.toDate === "function"
  ) {
    d = fecha.toDate();

  } else if (
    typeof fecha === "string"
  ) {
    const [
      y,
      m,
      day,
    ] =
      fecha
        .split("-")
        .map(Number);

    if (
      !y ||
      !m ||
      !day
    ) {
      return false;
    }

    d = new Date(
      y,
      m - 1,
      day
    );

  } else {
    return false;
  }

  d.setHours(
    0,
    0,
    0,
    0
  );

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  return d < today;
}

/**
 * ============================================================
 * OBTENER CONFIGURACIÓN DE PAGOS
 * ============================================================
 */
function obtenerPaymentConfig(
  carrera: any
) {
  const config =
    carrera?.paymentConfig ||
    {};

  return {
    recipient:
      config.recipient ===
      "organizer"
        ? "organizer"
        : "dhtime",

    dhFeeMode:
      config.dhFeeMode ===
      "per_registration"
        ? "per_registration"
        : "external",

    dhFeeType:
      config.dhFeeType ===
      "percentage"
        ? "percentage"
        : "fixed",

    dhFeeAmount:
      Number(
        config.dhFeeAmount
      ) || 0,

    organizerId:
      typeof config.organizerId ===
      "string"
        ? config.organizerId.trim()
        : "",

    connectedAccountId:
      typeof config.connectedAccountId ===
      "string"
        ? config.connectedAccountId.trim()
        : "",
  };
}

/**
 * ============================================================
 * CALCULAR COMISIÓN DHTIME
 * ============================================================
 *
 * external
 *   → DHTime no cobra comisión por inscripción.
 *
 * per_registration
 *   → se calcula la comisión configurada.
 */
function calcularComisionDHTime(
  neto: number,
  paymentConfig: ReturnType<
    typeof obtenerPaymentConfig
  >
) {
  if (
    paymentConfig.dhFeeMode !==
    "per_registration"
  ) {
    return 0;
  }

  const amount =
    Number(
      paymentConfig.dhFeeAmount
    ) || 0;

  if (amount <= 0) {
    return 0;
  }

  if (
    paymentConfig.dhFeeType ===
    "percentage"
  ) {
    return (
      neto *
      (amount / 100)
    );
  }

  return amount;
}

/**
 * ============================================================
 * HANDLER
 * ============================================================
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (
    req.method !== "POST"
  ) {
    res.setHeader(
      "Allow",
      ["POST"]
    );

    return res
      .status(405)
      .end(
        `Método ${req.method} No Permitido`
      );
  }

  try {
    /**
     * ========================================================
     * FIREBASE ADMIN DB
     * ========================================================
     */
    const db = getAdminDb();

    /**
     * ========================================================
     * ORIGIN
     * ========================================================
     */
    const origin =
      req.headers.origin ||
      process.env.NEXT_PUBLIC_BASE_URL;

    if (!origin) {
      return res.status(500).json({
        error:
          "Missing origin / NEXT_PUBLIC_BASE_URL",
      });
    }

    /**
     * ========================================================
     * DATOS RECIBIDOS
     * ========================================================
     */
    const {
      carreraId,
      perfilId,
      categoria,
      distancia,
    } =
      req.body as {
        carreraId?: string;
        perfilId?: string | null;
        categoria?: string;
        distancia?: string;
      };

    if (
      !carreraId ||
      !categoria ||
      !distancia
    ) {
      return res.status(400).json({
        error:
          "Faltan datos (carreraId, categoria, distancia)",
      });
    }

    /**
     * ========================================================
     * CARRERA
     * ========================================================
     *
     * Ahora también la obtenemos desde Admin.
     *
     * Esto hace que todo el checkout sea procesado
     * en servidor y no dependa de reglas Firestore
     * del cliente.
     */
    const carreraRef =
      db
        .collection("carreras")
        .doc(carreraId);

    const carreraSnap =
      await carreraRef.get();

    if (
      !carreraSnap.exists
    ) {
      return res.status(404).json({
        error:
          "Carrera no encontrada",
      });
    }

    const carrera =
      carreraSnap.data() as any;

    /**
     * ========================================================
     * PAUSA DE INSCRIPCIONES
     * ========================================================
     */
    if (
      carrera.inscripcionesAbiertas ===
      false
    ) {
      return res.status(403).json({
        error:
          carrera.inscripcionesMensaje ||
          "Inscripciones pausadas temporalmente.",
      });
    }

    /**
     * ========================================================
     * CARRERA FINALIZADA
     * ========================================================
     */
    if (
      carreraYaFinalizo(
        carrera.fecha
      )
    ) {
      return res.status(403).json({
        error:
          "Esta carrera ya se llevó a cabo",
      });
    }

    /**
     * ========================================================
     * PRECIO NETO
     * ========================================================
     */
    const neto =
      getNetoFromCarrera(
        carrera,
        distancia,
        categoria
      );

    /**
     * ========================================================
     * CONFIGURACIÓN DE PAGOS
     * ========================================================
     */
    const paymentConfig =
      obtenerPaymentConfig(
        carrera
      );

    /**
     * ========================================================
     * COMISIÓN DHTIME
     * ========================================================
     */
    const comisionDHTime =
      calcularComisionDHTime(
        neto,
        paymentConfig
      );

    /**
     * ========================================================
     * TOTAL A COBRAR
     * ========================================================
     *
     * El costo de Stripe se calcula sobre:
     *
     *     neto + comisión DHTime
     *
     * Cuando existe una comisión por inscripción,
     * también la absorbe el corredor.
     *
     * El organizador seguirá recibiendo exactamente
     * el precio neto.
     */
    const baseCobro =
      neto +
      comisionDHTime;

    const unit_amount =
      calcularTotalCobrar(
        baseCobro
      );

    /**
     * ========================================================
     * CONFIGURAR DESTINO
     * ========================================================
     */
    let connectedAccountId =
      "";

    let organizerId =
      "";

    /**
     * ========================================================
     * CARRERA DE ORGANIZADOR
     * ========================================================
     */
    if (
      paymentConfig.recipient ===
      "organizer"
    ) {
      organizerId =
        paymentConfig.organizerId;

      if (!organizerId) {
        return res.status(400).json({
          error:
            "La carrera está configurada para un organizador, pero no tiene organizerId.",
        });
      }

      /**
       * ======================================================
       * ORGANIZADOR DESDE FIREBASE ADMIN
       * ======================================================
       *
       * ESTE ES EL CAMBIO PRINCIPAL.
       *
       * Antes:
       *
       * getDoc(doc(db, "organizadores", organizerId))
       *
       * Eso utilizaba Firebase Client SDK y chocaba
       * con las reglas de Firestore.
       *
       * Ahora:
       *
       * db.collection("organizadores").doc(...).get()
       *
       * usando Firebase Admin.
       */
      const organizerRef =
        db
          .collection("organizadores")
          .doc(organizerId);

      const organizerSnap =
        await organizerRef.get();

      if (
        !organizerSnap.exists
      ) {
        return res.status(400).json({
          error:
            "El organizador configurado no existe.",
        });
      }

      const organizer =
        organizerSnap.data() as any;

      /**
       * ======================================================
       * ORGANIZADOR ACTIVO
       * ======================================================
       */
      if (
        organizer.activo ===
        false
      ) {
        return res.status(403).json({
          error:
            "El organizador no está activo.",
        });
      }

      /**
       * ======================================================
       * CUENTA CONNECT
       * ======================================================
       */
      connectedAccountId =
        String(
          organizer.connectedAccountId ||
          ""
        ).trim();

      if (
        !connectedAccountId
      ) {
        return res.status(400).json({
          error:
            "El organizador todavía no tiene una cuenta Stripe Connect.",
        });
      }

      /**
       * ======================================================
       * VALIDACIÓN DEL ESTADO LOCAL
       * ======================================================
       */
      if (
        organizer.detailsSubmitted !==
        true
      ) {
        return res.status(400).json({
          error:
            "El organizador todavía no ha completado la configuración de Stripe.",
        });
      }

      if (
        organizer.chargesEnabled !==
        true
      ) {
        return res.status(400).json({
          error:
            "La cuenta Stripe del organizador todavía no puede recibir pagos.",
        });
      }

      if (
        organizer.payoutsEnabled !==
        true
      ) {
        return res.status(400).json({
          error:
            "La cuenta Stripe del organizador todavía no puede recibir retiros.",
        });
      }

      /**
       * ======================================================
       * VALIDACIÓN REAL CONTRA STRIPE
       * ======================================================
       *
       * No confiamos únicamente en los datos guardados
       * en Firestore.
       *
       * Consultamos directamente la cuenta Connect.
       */
      const stripeAccount =
        await stripe.accounts.retrieve(
          connectedAccountId
        );

      if (
        stripeAccount.id !==
        connectedAccountId
      ) {
        return res.status(400).json({
          error:
            "La cuenta Stripe del organizador no coincide con la cuenta configurada.",
        });
      }

      if (
        stripeAccount.details_submitted !==
        true
      ) {
        return res.status(400).json({
          error:
            "La cuenta Stripe del organizador todavía no ha completado su configuración.",
        });
      }

      if (
        stripeAccount.charges_enabled !==
        true
      ) {
        return res.status(400).json({
          error:
            "Stripe todavía no permite recibir pagos en la cuenta del organizador.",
        });
      }

      if (
        stripeAccount.payouts_enabled !==
        true
      ) {
        return res.status(400).json({
          error:
            "Stripe todavía no permite retiros en la cuenta del organizador.",
        });
      }
    }

    /**
     * ========================================================
     * CREAR CHECKOUT
     * ========================================================
     */
    const checkoutParams: any = {
      payment_method_types: [
        "card",
        "oxxo",
      ],

      mode: "payment",

      line_items: [
        {
          price_data: {
            currency:
              "mxn",

            product_data: {
              name:
                `Inscripción: ${categoria} (${distancia})`,
            },

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
        `?carreraId=${encodeURIComponent(
          carreraId
        )}`,

      metadata: {
        carreraId,

        perfilId:
          perfilId || "",

        categoria:
          norm(categoria),

        distancia:
          norm(distancia),

        neto:
          String(neto),

        comisionDHTime:
          String(
            comisionDHTime
          ),

        totalCobrado:
          String(
            (
              unit_amount /
              100
            ).toFixed(2)
          ),

        recipient:
          paymentConfig.recipient,

        organizerId,

        connectedAccountId,
      },
    };

    /**
     * ========================================================
     * DESTINATION CHARGE
     * ========================================================
     *
     * Si la carrera pertenece a un organizador:
     *
     * El Checkout cobra el total al corredor.
     *
     * Stripe transfiere EXACTAMENTE el neto al
     * connected account del organizador.
     *
     * Ejemplo:
     *
     * Carrera:
     *     $100
     *
     * Corredor:
     *     paga el precio + procesamiento
     *
     * Organizador:
     *     recibe $100.00
     *
     * DHTime:
     *     conserva el importe restante para cubrir
     *     procesamiento y, cuando corresponda,
     *     comisión DHTime.
     *
     * ========================================================
     */
    if (
      paymentConfig.recipient ===
      "organizer"
    ) {
      /**
       * Seguridad adicional.
       *
       * Nunca debemos intentar crear un Destination Charge
       * sin una cuenta Connect válida.
       */
      if (
        !connectedAccountId
      ) {
        return res.status(400).json({
          error:
            "No existe una cuenta Stripe Connect válida para esta carrera.",
        });
      }

      checkoutParams.payment_intent_data =
        {
          transfer_data: {
            destination:
              connectedAccountId,

            /**
             * El organizador recibe exactamente
             * el precio neto de la inscripción.
             */
            amount:
              Math.round(
                neto * 100
              ),
          },
        };
    }

    /**
     * ========================================================
     * CREAR SESIÓN STRIPE
     * ========================================================
     */
    const session =
      await stripe.checkout.sessions.create(
        checkoutParams
      );

    /**
     * ========================================================
     * VALIDACIÓN
     * ========================================================
     */
    if (
      !session.url
    ) {
      return res.status(500).json({
        error:
          "Stripe no devolvió url de checkout",
      });
    }

    /**
     * ========================================================
     * RESPUESTA
     * ========================================================
     */
    return res.status(200).json({
      url:
        session.url,

      sessionId:
        session.id,

      neto,

      comisionDHTime,

      totalCobrado:
        unit_amount / 100,

      recipient:
        paymentConfig.recipient,

      organizerId:
        organizerId || null,

      connectedAccountId:
        connectedAccountId || null,
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