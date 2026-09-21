import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import crypto from "crypto";

/**
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
 */

function getAdminDb() {
  if (!admin.apps.length) {
    const raw =
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

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
 * VALIDAR FIRMA MERCADO PAGO
 * ============================================================
 */

function validarFirmaMercadoPago(
  req: NextApiRequest,
  paymentId: string
): boolean {
  const secret =
    process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    console.error(
      "Falta MERCADOPAGO_WEBHOOK_SECRET"
    );

    return false;
  }

  const xSignature =
    req.headers["x-signature"];

  const xRequestId =
    req.headers["x-request-id"];

  if (
    typeof xSignature !== "string" ||
    typeof xRequestId !== "string"
  ) {
    return false;
  }

  const parts = xSignature
    .split(",")
    .map((part) => part.trim());

  const tsPart = parts.find(
    (part) => part.startsWith("ts=")
  );

  const v1Part = parts.find(
    (part) => part.startsWith("v1=")
  );

  if (!tsPart || !v1Part) {
    return false;
  }

  const ts = tsPart.substring(3);
  const receivedSignature =
    v1Part.substring(3);

  const manifest =
    `id:${paymentId};` +
    `request-id:${xRequestId};` +
    `ts:${ts};`;

  const expectedSignature =
    crypto
      .createHmac("sha256", secret)
      .update(manifest)
      .digest("hex");

  try {
    const received = Buffer.from(
      receivedSignature,
      "hex"
    );

    const expected = Buffer.from(
      expectedSignature,
      "hex"
    );

    if (received.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      received,
      expected
    );
  } catch {
    return false;
  }
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
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).end(
      `Método ${req.method} No Permitido`
    );
  }

  try {
    /**
     * ========================================================
     * OBTENER ID DEL PAGO
     * ========================================================
     */

    const paymentId =
      String(
        req.query["data.id"] ||
        req.body?.data?.id ||
        ""
      ).trim();

    const topic =
      String(
        req.query.type ||
        req.body?.type ||
        ""
      ).trim();

    /**
     * Mercado Pago puede enviar notificaciones
     * de distintos tipos.
     *
     * Solo procesamos pagos.
     */

    if (
      topic !== "payment" ||
      !paymentId
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    /**
     * ========================================================
     * VALIDAR FIRMA
     * ========================================================
     */

    const firmaValida =
      validarFirmaMercadoPago(
        req,
        paymentId
      );

    if (!firmaValida) {
      console.error(
        "[MP Webhook] Firma inválida"
      );

      return res.status(401).json({
        error: "Firma inválida",
      });
    }

    /**
     * ========================================================
     * CONSULTAR PAGO REAL EN MERCADO PAGO
     * ========================================================
     */

    const accessToken =
      process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error(
        "Falta MERCADOPAGO_ACCESS_TOKEN"
      );
    }

    const paymentResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
        paymentId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const payment =
      await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "[MP Webhook] Error consultando pago:",
        payment
      );

      return res.status(500).json({
        error: "No se pudo consultar el pago",
      });
    }

    /**
     * ========================================================
     * VALIDAR DATOS DEL PAGO
     * ========================================================
     */

    if (
      String(payment.id) !== paymentId
    ) {
      return res.status(400).json({
        error: "ID de pago no coincide",
      });
    }

    /**
     * No procesar pagos de otra moneda.
     */

    if (payment.currency_id !== "MXN") {
      console.error(
        "[MP Webhook] Moneda no válida:",
        payment.currency_id
      );

      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    /**
     * ========================================================
     * OBTENER PREFERENCE ID
     * ========================================================
     */

    const preferenceId =
      String(
        payment.preference_id || ""
      ).trim();

    if (!preferenceId) {
      console.error(
        "[MP Webhook] El pago no tiene preference_id",
        paymentId
      );

      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    /**
     * ========================================================
     * FIRESTORE
     * ========================================================
     */

    const db = getAdminDb();

    /**
     * En el checkout actual, Mercado Pago devuelve
     * preference.id como sessionId.
     *
     * La inscripción debe guardar ese mismo valor.
     */

    const inscripcionesSnap = await db
  .collection("inscripciones")
  .where("preferenceId", "==", preferenceId)
  .get();

    if (inscripcionesSnap.empty) {
      /**
       * Puede ocurrir si la notificación llega antes
       * de que el frontend termine de guardar la
       * inscripción.
       *
       * Respondemos 500 para permitir que Mercado Pago
       * reintente la notificación.
       */

      console.warn(
        "[MP Webhook] Inscripción aún no encontrada:",
        preferenceId
      );

      return res.status(500).json({
        error: "Inscripción aún no encontrada",
      });
    }

    /**
     * ========================================================
     * ESTADO DEL PAGO
     * ========================================================
     */

    const paymentStatus =
      String(payment.status || "")
        .toLowerCase();

    /**
     * Solo payment.status === "approved"
     * confirma una inscripción pagada.
     *
     * Los demás estados no deben asignar número
     * ni marcar la inscripción como pagada.
     */

    if (paymentStatus !== "approved") {
      console.log(
        "[MP Webhook] Pago aún no aprobado:",
        paymentStatus
      );

      return res.status(200).json({
        received: true,
        paymentStatus,
      });
    }

    /**
     * ========================================================
     * VALIDAR MONTO
     * ========================================================
     */

    const transactionAmount =
      Number(payment.transaction_amount);

    if (
      !Number.isFinite(transactionAmount) ||
      transactionAmount <= 0
    ) {
      return res.status(200).json({
        received: true,
        ignored: true,
      });
    }

    /**
     * ========================================================
     * ACTUALIZAR INSCRIPCIÓN
     * ========================================================
     */

    const batch = db.batch();

    inscripcionesSnap.docs.forEach(
      (inscripcionDoc) => {
        const data = inscripcionDoc.data();

        /**
         * Evitar procesar inscripciones que
         * ya fueron marcadas como pagadas.
         */

        if (
          data.paymentStatus === "paid"
        ) {
          return;
        }

        batch.update(
          inscripcionDoc.ref,
          {
            paymentStatus: "paid",

            paymentProvider: "mercadopago",

            paymentId: String(payment.id),

            preferenceId,

            paymentMethod:
              payment.payment_method_id || null,

            paymentType:
              payment.payment_type_id || null,

            paymentApprovedAt:
              admin.firestore.FieldValue.serverTimestamp(),

            paymentAmount:
              transactionAmount,

            paymentCurrency:
              payment.currency_id,

            updatedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          }
        );
      }
    );

    await batch.commit();

    console.log(
      "[MP Webhook] Inscripción actualizada:",
      preferenceId
    );

    return res.status(200).json({
      received: true,
      paymentStatus: "approved",
    });

  } catch (error: any) {
    console.error(
      "[MP Webhook] Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno del webhook",
    });
  }
}