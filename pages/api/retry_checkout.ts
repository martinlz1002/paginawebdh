import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import Stripe from "stripe";
import * as admin from "firebase-admin";

export const config = {
  api: {
    bodyParser: true,
  },
};

// ============================================================
// ENV
// ============================================================

function requireEnv(
  name: string
) {
  const value =
    process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name} in server env`
    );
  }

  return value;
}

// ============================================================
// FIREBASE ADMIN
// ============================================================

if (!admin.apps.length) {
  const b64 =
    requireEnv(
      "FIREBASE_SERVICE_ACCOUNT_KEY_B64"
    );

  const raw =
    Buffer
      .from(b64, "base64")
      .toString("utf8");

  const serviceAccount =
    JSON.parse(raw);

  admin.initializeApp({
    credential:
      admin.credential.cert(
        serviceAccount
      ),
  });
}

const firestore =
  admin.firestore();

const FieldValue =
  admin.firestore.FieldValue;

// ============================================================
// STRIPE
// ============================================================

const stripe =
  new Stripe(
    requireEnv(
      "STRIPE_SECRET_KEY"
    ),
    {
      apiVersion:
        "2025-05-28.basil",
    }
  );

// ============================================================
// HELPERS
// ============================================================

function norm(v: any) {
  return String(v ?? "")
    .trim()
    .toUpperCase();
}

// ============================================================
// CALCULAR TOTAL
// ============================================================

function calcularTotalCobrar(
  neto: number
) {
  const IVA_SOBRE_COMISION =
    0.16;

  const STRIPE_PCT =
    0.036;

  const STRIPE_FIJO =
    3;

  const bruto =
    (
      neto +
      STRIPE_FIJO *
        (1 +
          IVA_SOBRE_COMISION)
    ) /
    (
      1 -
      STRIPE_PCT *
        (1 +
          IVA_SOBRE_COMISION)
    );

  return Math.ceil(
    bruto * 100
  );
}

// ============================================================
// OBTENER PRECIO
// ============================================================

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
      `Distancia no encontrada: ${distancia}`
    );
  }

  const c =
    (
      d.categorias ||
      []
    ).find(
      (x: any) =>
        norm(x.nombre) ===
        norm(categoria)
    );

  if (!c) {
    throw new Error(
      `Categoría no encontrada: ${categoria}`
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

// ============================================================
// CARRERA FINALIZADA
// ============================================================

function carreraYaFinalizo(
  fecha: any
): boolean {
  let d: Date;

  if (
    fecha instanceof
    admin.firestore.Timestamp
  ) {
    d = fecha.toDate();

  } else if (
    typeof fecha ===
    "string"
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

// ============================================================
// PAYMENT CONFIG
// ============================================================

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

// ============================================================
// COMISIÓN DHTime
// ============================================================

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

  if (
    amount <= 0
  ) {
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

// ============================================================
// ORIGIN
// ============================================================

function getOrigin(
  req: NextApiRequest
) {
  if (
    typeof req.headers.origin ===
      "string" &&
    req.headers.origin.length >
      0
  ) {
    return req.headers.origin;
  }

  const base =
    process.env
      .NEXT_PUBLIC_BASE_URL;

  if (!base) {
    throw new Error(
      "Missing NEXT_PUBLIC_BASE_URL"
    );
  }

  return base;
}

// ============================================================
// RESPONSE
// ============================================================

type ResponseData = {
  url?: string | null;
  sessionId?: string;
  error?: string;
  stack?: string;
};

// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
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
        "Method Not Allowed"
      );
  }

  try {
    // ========================================================
    // INSCRIPCIÓN
    // ========================================================

    const {
      inscripcionId,
    } =
      req.body as {
        inscripcionId?: string;
      };

    if (
      !inscripcionId
    ) {
      return res.status(400).json({
        error:
          "Falta inscripcionId",
      });
    }

    const insRef =
      firestore
        .collection(
          "inscripciones"
        )
        .doc(
          inscripcionId
        );

    // ========================================================
    // TRANSACTION
    // ========================================================

    const payload =
      await firestore.runTransaction(
        async (tx) => {
          const insSnap =
            await tx.get(
              insRef
            );

          if (
            !insSnap.exists
          ) {
            throw new Error(
              "Inscripción no encontrada"
            );
          }

          const ins =
            insSnap.data() as any;

          const carreraId =
            ins.carreraId;

          const categoria =
            ins.categoria;

          const distancia =
            ins.distancia ||
            ins.ruta;

          if (
            !carreraId ||
            !categoria ||
            !distancia
          ) {
            throw new Error(
              "Inscripción incompleta"
            );
          }

          // ==================================================
          // CARRERA
          // ==================================================

          const carreraRef =
            firestore
              .collection(
                "carreras"
              )
              .doc(
                carreraId
              );

          const carreraSnap =
            await tx.get(
              carreraRef
            );

          if (
            !carreraSnap.exists
          ) {
            throw new Error(
              "Carrera no encontrada"
            );
          }

          const carrera =
            carreraSnap.data() as any;

          // ==================================================
          // PAUSA
          // ==================================================

          if (
            carrera.inscripcionesAbiertas ===
            false
          ) {
            throw new Error(
              carrera.inscripcionesMensaje ||
                "Las inscripciones para esta carrera están pausadas."
            );
          }

          // ==================================================
          // FECHA
          // ==================================================

          if (
            carreraYaFinalizo(
              carrera.fecha
            )
          ) {
            throw new Error(
              "Esta carrera ya se llevó a cabo"
            );
          }

          // ==================================================
          // PRECIO
          // ==================================================

          const neto =
            getNetoFromCarrera(
              carrera,
              distancia,
              categoria
            );

          // ==================================================
          // PAYMENT CONFIG
          // ==================================================

          const paymentConfig =
            obtenerPaymentConfig(
              carrera
            );

          // ==================================================
          // COMISIÓN DHTime
          // ==================================================

          const comisionDHTime =
            calcularComisionDHTime(
              neto,
              paymentConfig
            );

          // ==================================================
          // ORGANIZADOR
          // ==================================================

          let organizerId =
            "";

          let connectedAccountId =
            "";

          if (
            paymentConfig.recipient ===
            "organizer"
          ) {
            organizerId =
              paymentConfig.organizerId;

            if (
              !organizerId
            ) {
              throw new Error(
                "La carrera está configurada para un organizador, pero no tiene organizerId."
              );
            }

            // ==============================================
            // LEER ORGANIZADOR
            // ==============================================

            const organizerRef =
              firestore
                .collection(
                  "organizadores"
                )
                .doc(
                  organizerId
                );

            const organizerSnap =
              await tx.get(
                organizerRef
              );

            if (
              !organizerSnap.exists
            ) {
              throw new Error(
                "El organizador configurado no existe."
              );
            }

            const organizer =
              organizerSnap.data() as any;

            if (
              organizer.activo ===
              false
            ) {
              throw new Error(
                "El organizador no está activo."
              );
            }

            connectedAccountId =
              String(
                organizer.connectedAccountId ||
                  ""
              ).trim();

            if (
              !connectedAccountId
            ) {
              throw new Error(
                "El organizador todavía no tiene una cuenta Stripe Connect."
              );
            }

            if (
              organizer.detailsSubmitted !==
              true
            ) {
              throw new Error(
                "El organizador todavía no ha completado la configuración de Stripe."
              );
            }

            if (
              organizer.chargesEnabled !==
              true
            ) {
              throw new Error(
                "La cuenta Stripe del organizador todavía no puede recibir pagos."
              );
            }

            if (
              organizer.payoutsEnabled !==
              true
            ) {
              throw new Error(
                "La cuenta Stripe del organizador todavía no puede recibir retiros."
              );
            }
          }

          // ==================================================
          // MARCAR PENDING
          // ==================================================

          tx.update(
            insRef,
            {
              paymentStatus:
                "pending",

              updatedAt:
                FieldValue.serverTimestamp(),
            }
          );

          return {
            carreraId,
            categoria,
            distancia,
            neto,
            comisionDHTime,
            recipient:
              paymentConfig.recipient,
            organizerId,
            connectedAccountId,
          };
        }
      );

    // ========================================================
    // STRIPE
    // ========================================================

    const origin =
      getOrigin(req);

    const baseCobro =
      payload.neto +
      payload.comisionDHTime;

    const unit_amount =
      calcularTotalCobrar(
        baseCobro
      );

    // ========================================================
    // CHECKOUT PARAMETERS
    // ========================================================

    const checkoutParams: Stripe.Checkout.SessionCreateParams =
      {
        payment_method_types: [
          "card",
          "oxxo",
        ],

        mode:
          "payment",

        line_items: [
          {
            price_data: {
              currency:
                "mxn",

              product_data: {
                name:
                  `Inscripción: ${payload.categoria} (${payload.distancia})`,
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
          `${origin}/mis-inscripciones`,

        metadata: {
          inscripcionId,

          carreraId:
            payload.carreraId,

          categoria:
            norm(
              payload.categoria
            ),

          distancia:
            norm(
              payload.distancia
            ),

          neto:
            String(
              payload.neto
            ),

          comisionDHTime:
            String(
              payload.comisionDHTime
            ),

          totalCobrado:
            String(
              (
                unit_amount /
                100
              ).toFixed(2)
            ),

          recipient:
            payload.recipient,

          organizerId:
            payload.organizerId,

          connectedAccountId:
            payload.connectedAccountId,
        },
      };

    // ========================================================
    // STRIPE CONNECT
    // ========================================================

    if (
      payload.recipient ===
      "organizer"
    ) {
      checkoutParams.payment_intent_data =
        {
          transfer_data: {
            destination:
              payload.connectedAccountId,

            amount:
              Math.round(
                payload.neto *
                  100
              ),
          },
        };
    }

    // ========================================================
    // CREAR SESIÓN
    // ========================================================

    const session =
      await stripe.checkout.sessions.create(
        checkoutParams
      );

    if (
      !session.url
    ) {
      throw new Error(
        "Stripe no devolvió url de checkout"
      );
    }

    // ========================================================
    // GUARDAR SESSION ID
    // ========================================================

    await insRef.update({
      sessionId:
        session.id,

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    // ========================================================
    // RESPUESTA
    // ========================================================

    return res.status(200).json({
      url:
        session.url,

      sessionId:
        session.id,
    });

  } catch (
    err: any
  ) {
    console.error(
      "[retry_checkout] error:",
      err
    );

    return res.status(500).json({
      error:
        err?.message ||
        "Error",

      stack:
        process.env.NODE_ENV !==
        "production"
          ? err?.stack
          : undefined,
    });
  }
}