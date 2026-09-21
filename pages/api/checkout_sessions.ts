  import type {
    NextApiRequest,
    NextApiResponse,
  } from "next";

 import { admin, adminDb } from "../../lib/firebaseAdmin";

  import { stripe } from "@/lib/stripe";

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
   * Calcula el total para Mercado Pago usando tarifas configurables
   * en variables de entorno. Verifica estos valores con la tarifa
   * real de la cuenta antes de habilitar cobros en producción.
   */
  function calcularTotalMercadoPago(neto: number) {
    const pct = Number(process.env.MERCADOPAGO_PCT ?? "0.0349");
    const fijo = Number(process.env.MERCADOPAGO_FIJO ?? "4");
    const iva = 0.16;

    if (!Number.isFinite(pct) || pct < 0 || pct >= 1 ||
        !Number.isFinite(fijo) || fijo < 0) {
      throw new Error("Configuración inválida de comisiones de Mercado Pago.");
    }

    const bruto = (neto + fijo * (1 + iva)) / (1 - pct * (1 + iva));
    return Math.ceil(bruto * 100);
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
      const db = adminDb;

      /**
       * ========================================================
       * ORIGIN
       * ========================================================
       */
      const configuredBaseUrl = (
  process.env.NEXT_PUBLIC_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const requestOrigin = req.headers.origin || "";

const origin = configuredBaseUrl || requestOrigin;

const isLocalOrigin =
  /localhost|127\.0\.0\.1/i.test(origin);

const useBackUrls =
  /^https:\/\/[^/]+/i.test(origin) &&
  !isLocalOrigin;

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

      // El corredor paga el precio de inscripción
// más las comisiones del procesador.
//
// La comisión DHTime NO se suma al precio.
// Se descuenta de la parte del organizador.

const baseCobro = neto;

const unit_amount =
  paymentConfig.paymentProvider === "stripe"
    ? calcularTotalCobrar(baseCobro)
    : calcularTotalMercadoPago(baseCobro);

      /**
       * ========================================================
       * CHECKOUT MERCADO PAGO
       * ========================================================
       * DHTime: usa el token global.
       * Organizador: usa su token OAuth y marketplace_fee.
       */
      if (paymentConfig.paymentProvider === "mercadopago") {
        let accessToken = "";
        let organizerIdMP: string | null = null;
        let organizerRefMP: any = null;
        let organizerMP: any = null;

        if (paymentConfig.recipient === "organizer") {
          organizerIdMP = paymentConfig.organizerId;

          if (!organizerIdMP) {
            return res.status(400).json({
              error: "La carrera está configurada para un organizador, pero no tiene organizerId.",
            });
          }

          organizerRefMP = db.collection("organizadores").doc(organizerIdMP);
          const organizerSnapMP = await organizerRefMP.get();

          if (!organizerSnapMP.exists) {
            return res.status(400).json({ error: "El organizador configurado no existe." });
          }

          organizerMP = organizerSnapMP.data() as any;

          if (organizerMP.activo === false) {
            return res.status(403).json({ error: "El organizador no está activo." });
          }

          if (organizerMP.paymentProvider !== "mercadopago") {
            return res.status(400).json({
              error: "El organizador seleccionado no está configurado para Mercado Pago.",
            });
          }

          if (organizerMP.mercadoPagoStatus !== "connected") {
            return res.status(400).json({
              error: "El organizador todavía no ha conectado su cuenta de Mercado Pago mediante OAuth.",
            });
          }

          const sellerUserId = String(organizerMP.mercadoPagoUserId || "").trim();
          accessToken = String(organizerMP.mercadoPagoAccessToken || organizerMP.mpAccessToken || organizerMP.mercado_pago_access_token || "").trim();
          const refreshToken = String(organizerMP.mercadoPagoRefreshToken || organizerMP.mpRefreshToken || organizerMP.mercado_pago_refresh_token || "").trim();

          if (!sellerUserId || !accessToken) {
            return res.status(400).json({
              error: "La conexión de Mercado Pago del organizador está incompleta. Vuelve a conectarla desde Admin.",
            });
          }

          // Renovar el token si tenemos fecha de expiración y está por vencer.
          const rawExpiry =
  organizerMP.mercadoPagoTokenExpiresAt ||
  organizerMP.mercadoPagoExpiresAt ||
  organizerMP.mercado_pago_expires_at;

let expiryMs = 0;

// Caso 1: Timestamp de Firestore
if (
  rawExpiry &&
  typeof rawExpiry.toDate === "function"
) {
  expiryMs = rawExpiry.toDate().getTime();
}

// Caso 2: Fecha como objeto Date
else if (rawExpiry instanceof Date) {
  expiryMs = rawExpiry.getTime();
}

// Caso 3: Unix timestamp numérico
else if (
  typeof rawExpiry === "number" ||
  (
    typeof rawExpiry === "string" &&
    /^\d+$/.test(rawExpiry)
  )
) {
  const numericExpiry = Number(rawExpiry);

  // Detectar segundos o milisegundos
  expiryMs =
    numericExpiry < 1_000_000_000_000
      ? numericExpiry * 1000
      : numericExpiry;
}

// Caso 4: Fecha como string ISO
else if (typeof rawExpiry === "string") {
  const parsedExpiry = new Date(rawExpiry).getTime();

  if (Number.isFinite(parsedExpiry)) {
    expiryMs = parsedExpiry;
  }
}

          if (refreshToken && expiryMs > 0 && expiryMs <= Date.now() + 5 * 60 * 1000) {
            const clientId = process.env.MERCADOPAGO_CLIENT_ID;
            const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET;

            if (!clientId || !clientSecret) {
              return res.status(500).json({
                error: "Faltan MERCADOPAGO_CLIENT_ID y/o MERCADOPAGO_CLIENT_SECRET para renovar el token OAuth.",
              });
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
              console.error("[checkout_sessions] Error renovando OAuth de Mercado Pago:", {
                status: refreshResponse.status,
                message: refreshed?.message || refreshed?.error || "Error OAuth",
              });
              return res.status(400).json({
                error: "No se pudo renovar la conexión de Mercado Pago del organizador. Vuelve a conectarla desde Admin.",
              });
            }

            accessToken = String(refreshed.access_token);
            const refreshedUpdate: any = {
              mercadoPagoAccessToken: accessToken,
              mercadoPagoTokenExpiresAt: admin.firestore.Timestamp.fromMillis(
                Date.now() + Number(refreshed.expires_in || 0) * 1000
              ),
            };
            if (refreshed.refresh_token) {
              refreshedUpdate.mercadoPagoRefreshToken = String(refreshed.refresh_token);
            }
            if (refreshed.user_id) {
              refreshedUpdate.mercadoPagoUserId = String(refreshed.user_id);
            }
            await organizerRefMP.update(refreshedUpdate);
          }
        } else {
          accessToken = String(process.env.MERCADOPAGO_ACCESS_TOKEN || "").trim();
          if (!accessToken) {
            return res.status(500).json({
              error: "Falta configurar MERCADOPAGO_ACCESS_TOKEN.",
            });
          }
        }

        const total = unit_amount / 100;
        const marketplaceFee = paymentConfig.recipient === "organizer"
          ? Math.round(comisionDHTime * 100) / 100
          : 0;

          // ============================================================
// CREAR INTENTO DE PAGO ANTES DE GENERAR LA PREFERENCIA
// ============================================================

const attemptRef = db
  .collection("paymentAttempts")
  .doc();

const expectedSellerId =
  paymentConfig.recipient === "organizer"
    ? String(organizerMP?.mercadoPagoUserId || "").trim()
    : String(process.env.MERCADOPAGO_USER_ID || "").trim();

if (!expectedSellerId) {
  return res.status(500).json({
    error:
      "No se pudo identificar la cuenta receptora de Mercado Pago.",
  });
}

await attemptRef.set({
  attemptId: attemptRef.id,

  carreraId,
  perfilId: perfilId || "",

  categoria: norm(categoria),
  distancia: norm(distancia),

  paymentProvider: "mercadopago",
  recipient: paymentConfig.recipient,

  organizerId: organizerIdMP || null,
  mercadoPagoUserId: expectedSellerId,

  expectedAmount: total,
  currency: "MXN",

  preferenceId: null,
  paymentId: null,

  status: "creating",

  createdAt:
    admin.firestore.FieldValue.serverTimestamp(),

  updatedAt:
    admin.firestore.FieldValue.serverTimestamp(),
});

        const preferenceBody: any = {
          items: [{
            title: `Inscripción: ${categoria} (${distancia})`,
            quantity: 1,
            currency_id: "MXN",
            unit_price: total,
          }],
          external_reference: attemptRef.id,
          metadata: {
            attemptId: attemptRef.id,
            carreraId,
            perfilId: perfilId || "",
            categoria: norm(categoria),
            distancia: norm(distancia),
            neto: String(neto),
            comisionDHTime: String(comisionDHTime),
            totalCobrado: total.toFixed(2),
            paymentProvider: "mercadopago",
            recipient: paymentConfig.recipient,
            organizerId: organizerIdMP || "",
            mercadoPagoUserId: organizerMP?.mercadoPagoUserId ? String(organizerMP.mercadoPagoUserId) : "",
          },
          ...(useBackUrls
  ? {
      back_urls: {
        success: `${origin}/mis-inscripciones`,
        failure: `${origin}/inscribirse?carreraId=${encodeURIComponent(
          carreraId
        )}`,
        pending: `${origin}/mis-inscripciones`,
      },
      auto_return: "approved",
    }
  : {}),
        };

        // En Marketplace, Mercado Pago descuenta primero su tarifa y luego
        // marketplace_fee del saldo restante del vendedor.
        if (marketplaceFee > 0) {
          preferenceBody.marketplace_fee = marketplaceFee;
        }

        const preferenceResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preferenceBody),
        });

        const preference = await preferenceResponse.json();
        if (!preferenceResponse.ok || !preference.init_point || !preference.id) {
          console.error("[checkout_sessions] Mercado Pago error:", {
            status: preferenceResponse.status,
            message: preference?.message || preference?.error || "No se pudo crear la preferencia",
            cause: preference?.cause,

            
          });
          await attemptRef.update({
  status: "failed",
  updatedAt:
    admin.firestore.FieldValue.serverTimestamp(),
});
          return res.status(502).json({
            error: preference.message || "No se pudo crear el checkout de Mercado Pago.",
          });
        }

        await attemptRef.update({
  preferenceId: String(preference.id),
  status: "pending",
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});

        return res.status(200).json({
          attemptId: attemptRef.id,
          url: preference.init_point,
          sessionId: preference.id,
          preferenceId: preference.id,
          paymentProvider: "mercadopago",
          neto,
          comisionDHTime,
          totalCobrado: total,
          recipient: paymentConfig.recipient,
          organizerId: organizerIdMP,
          connectedAccountId: null,
          marketplaceFee,
        });
      }

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
          paymentProvider: "stripe",
        },
      };

      // ============================================================
// DESTINATION CHARGE
// ============================================================

// La comisión de DHTime se descuenta de la inscripción.
// No se suma al importe que paga el corredor.
//
// Si es pago de una sola exhibición,
// comisionDHTime debe ser 0.

const montoOrganizador = neto - comisionDHTime;

// Validar que el monto a transferir sea válido.
if (
  !Number.isFinite(montoOrganizador) ||
  montoOrganizador < 0
) {
  return res.status(400).json({
    error:
      "La comisión de DHTime no puede ser mayor al precio de inscripción.",
  });
}

// Stripe cobra el checkout completo al corredor,
// pero transfiere al organizador únicamente
// el importe que le corresponde.

checkoutParams.payment_intent_data = {
  transfer_data: {
    destination: connectedAccountId,

    amount: Math.round(
      montoOrganizador * 100
    ),
  },
};

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

        paymentProvider: "stripe",
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