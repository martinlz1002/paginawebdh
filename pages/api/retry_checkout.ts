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
// CALCULAR TOTAL MERCADO PAGO
// ============================================================

function calcularTotalMercadoPago(neto: number) {
  const pct = Number(process.env.MERCADOPAGO_PCT ?? "0.0349");
  const fijo = Number(process.env.MERCADOPAGO_FIJO ?? "4");
  const iva = 0.16;

  if (
    !Number.isFinite(pct) || pct < 0 || pct >= 1 ||
    !Number.isFinite(fijo) || fijo < 0
  ) {
    throw new Error("Configuración inválida de comisiones de Mercado Pago.");
  }

  const bruto = (neto + fijo * (1 + iva)) / (1 - pct * (1 + iva));
  return Math.ceil(bruto * 100);
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
    paymentProvider:
      config.paymentProvider === "mercadopago"
        ? "mercadopago"
        : "stripe",

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
  preferenceId?: string;
  attemptId?: string;
  paymentProvider?: string;
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

          if (
            String(ins.paymentStatus || "").toLowerCase() === "paid" ||
            String(ins.paymentStatus || "").toLowerCase() === "approved"
          ) {
            throw new Error("Esta inscripción ya aparece como pagada. No se puede generar otro checkout.");
          }

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
            paymentConfig.recipient === "organizer" &&
            paymentConfig.paymentProvider === "stripe"
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
            perfilId: String(ins.perfilId || ""),
            categoria,
            distancia,
            neto,
            comisionDHTime,
            paymentProvider: paymentConfig.paymentProvider,
            recipient:
              paymentConfig.recipient,
            organizerId,
            connectedAccountId,
          };
        }
      );

    // ========================================================
    // MERCADO PAGO
    // ========================================================

    if (payload.paymentProvider === "mercadopago") {
      const origin = getOrigin(req);
      const baseCobro = payload.neto + payload.comisionDHTime;
      const unitAmount = calcularTotalMercadoPago(baseCobro);
      const total = unitAmount / 100;

      let accessToken = "";
      let organizerMP: any = null;
      let organizerRefMP: any = null;
      let organizerIdMP: string | null = null;

      if (payload.recipient === "organizer") {
        organizerIdMP = String(payload.organizerId || "").trim();
        if (!organizerIdMP) {
          return res.status(400).json({ error: "La carrera está configurada para un organizador, pero no tiene organizerId." });
        }

        organizerRefMP = firestore.collection("organizadores").doc(organizerIdMP);
        const organizerSnapMP = await organizerRefMP.get();
        if (!organizerSnapMP.exists) {
          return res.status(404).json({ error: "El organizador configurado no existe." });
        }

        organizerMP = organizerSnapMP.data() as any;
        if (organizerMP.activo === false) {
          return res.status(403).json({ error: "El organizador no está activo." });
        }
        if (organizerMP.paymentProvider !== "mercadopago") {
          return res.status(400).json({ error: "El organizador no está configurado para Mercado Pago." });
        }
        if (organizerMP.mercadoPagoStatus !== "connected") {
          return res.status(400).json({ error: "El organizador todavía no ha conectado su cuenta de Mercado Pago mediante OAuth." });
        }

        const sellerUserId = String(organizerMP.mercadoPagoUserId || "").trim();
        accessToken = String(
          organizerMP.mercadoPagoAccessToken ||
          organizerMP.mpAccessToken ||
          organizerMP.mercado_pago_access_token || ""
        ).trim();
        const refreshToken = String(
          organizerMP.mercadoPagoRefreshToken ||
          organizerMP.mpRefreshToken ||
          organizerMP.mercado_pago_refresh_token || ""
        ).trim();

        if (!sellerUserId || !accessToken) {
          return res.status(400).json({ error: "La conexión de Mercado Pago del organizador está incompleta. Vuelve a conectarla desde Admin." });
        }

        const rawExpiry =
          organizerMP.mercadoPagoTokenExpiresAt ||
          organizerMP.mercadoPagoExpiresAt ||
          organizerMP.mercado_pago_expires_at;
        let expiryMs = 0;
        if (rawExpiry && typeof rawExpiry.toDate === "function") expiryMs = rawExpiry.toDate().getTime();
        else if (rawExpiry instanceof Date) expiryMs = rawExpiry.getTime();
        else if (typeof rawExpiry === "number" || (typeof rawExpiry === "string" && /^\d+$/.test(rawExpiry))) {
          const n = Number(rawExpiry);
          expiryMs = n < 1_000_000_000_000 ? n * 1000 : n;
        } else if (typeof rawExpiry === "string") {
          const parsed = new Date(rawExpiry).getTime();
          if (Number.isFinite(parsed)) expiryMs = parsed;
        }

        if (refreshToken && expiryMs > 0 && expiryMs <= Date.now() + 5 * 60 * 1000) {
          const clientId = process.env.MERCADOPAGO_CLIENT_ID;
          const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;
          if (!clientId || !clientSecret) {
            return res.status(500).json({ error: "Faltan MERCADOPAGO_CLIENT_ID y/o MERCADOPAGO_CLIENT_SECRET para renovar OAuth." });
          }

          const refreshBody = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          });
          const refreshResponse = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: refreshBody.toString(),
          });
          const refreshed = await refreshResponse.json();
          if (!refreshResponse.ok || !refreshed.access_token) {
            console.error("[retry_checkout] Error renovando OAuth MP:", refreshResponse.status, refreshed?.message || refreshed?.error);
            return res.status(400).json({ error: "No se pudo renovar la conexión de Mercado Pago del organizador. Vuelve a conectarla desde Admin." });
          }

          accessToken = String(refreshed.access_token);
          const updateOAuth: any = {
            mercadoPagoAccessToken: accessToken,
            mercadoPagoTokenExpiresAt: admin.firestore.Timestamp.fromMillis(
              Date.now() + Number(refreshed.expires_in || 0) * 1000
            ),
          };
          if (refreshed.refresh_token) updateOAuth.mercadoPagoRefreshToken = String(refreshed.refresh_token);
          if (refreshed.user_id) updateOAuth.mercadoPagoUserId = String(refreshed.user_id);
          await organizerRefMP.update(updateOAuth);
          if (refreshed.user_id) organizerMP.mercadoPagoUserId = String(refreshed.user_id);
        }
      } else {
        accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
        if (!accessToken) {
          return res.status(500).json({ error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN." });
        }
      }

      const expectedSellerId = payload.recipient === "organizer"
        ? String(organizerMP?.mercadoPagoUserId || "").trim()
        : String(process.env.MERCADOPAGO_USER_ID || "").trim();
      if (!expectedSellerId) {
        return res.status(500).json({ error: "No se pudo identificar la cuenta receptora de Mercado Pago." });
      }

      const attemptRef = firestore.collection("paymentAttempts").doc();
      const marketplaceFee = payload.recipient === "organizer"
        ? Math.round(payload.comisionDHTime * 100) / 100
        : 0;

      await attemptRef.set({
        attemptId: attemptRef.id,
        inscripcionId,
        carreraId: payload.carreraId,
        perfilId: payload.perfilId || "",
        categoria: norm(payload.categoria),
        distancia: norm(payload.distancia),
        paymentProvider: "mercadopago",
        recipient: payload.recipient,
        organizerId: organizerIdMP,
        mercadoPagoUserId: expectedSellerId,
        expectedAmount: total,
        currency: "MXN",
        preferenceId: null,
        paymentId: null,
        status: "creating",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const preferenceBody: any = {
        items: [{
          title: `Inscripción: ${payload.categoria} (${payload.distancia})`,
          quantity: 1,
          currency_id: "MXN",
          unit_price: total,
        }],
        external_reference: attemptRef.id,
        metadata: {
          attemptId: attemptRef.id,
          inscripcionId,
          carreraId: payload.carreraId,
          perfilId: payload.perfilId || "",
          categoria: norm(payload.categoria),
          distancia: norm(payload.distancia),
          neto: String(payload.neto),
          comisionDHTime: String(payload.comisionDHTime),
          totalCobrado: total.toFixed(2),
          paymentProvider: "mercadopago",
          recipient: payload.recipient,
          organizerId: organizerIdMP || "",
          mercadoPagoUserId: expectedSellerId,
        },
        back_urls: {
          success: `${origin}/mis-inscripciones`,
          failure: `${origin}/mis-inscripciones`,
          pending: `${origin}/mis-inscripciones`,
        },
        auto_return: "approved",
      };
      if (marketplaceFee > 0) preferenceBody.marketplace_fee = marketplaceFee;

      const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferenceBody),
      });
      const preference = await preferenceResponse.json();

      if (!preferenceResponse.ok || !preference.id || !preference.init_point) {
        await attemptRef.update({
          status: "failed",
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.error("[retry_checkout] Error creando preferencia MP:", {
          status: preferenceResponse.status,
          message: preference?.message || preference?.error,
          cause: preference?.cause,
        });
        return res.status(502).json({ error: preference?.message || "No se pudo crear el checkout de Mercado Pago." });
      }

      await attemptRef.update({
        preferenceId: String(preference.id),
        status: "pending",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Vincular la inscripción al nuevo intento SOLO después de crear la preferencia.
      await firestore.runTransaction(async (tx) => {
        const freshSnap = await tx.get(insRef);
        if (!freshSnap.exists) throw new Error("La inscripción ya no existe.");
        const fresh = freshSnap.data() as any;
        if (["paid", "approved"].includes(String(fresh.paymentStatus || "").toLowerCase())) {
          throw new Error("La inscripción ya fue pagada. No se puede reemplazar su intento de pago.");
        }
        tx.update(insRef, {
          paymentProvider: "mercadopago",
          paymentAttemptId: attemptRef.id,
          preferenceId: String(preference.id),
          paymentStatus: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return res.status(200).json({
        url: preference.init_point,
        sessionId: String(preference.id),
        preferenceId: String(preference.id),
        attemptId: attemptRef.id,
        paymentProvider: "mercadopago",
      });
    }

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