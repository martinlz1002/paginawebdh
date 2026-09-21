import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

/**
 * ============================================================
 * FIREBASE ADMIN
 * ============================================================
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
 * ENDPOINT DE RECUPERACIÓN DE PAGO MERCADO PAGO
 * ============================================================
 *
 * Uso exclusivo administrativo.
 *
 * No crea inscripciones.
 * No genera cobros.
 * No crea preferencias.
 *
 * Consulta un pago existente y, si todas las validaciones
 * coinciden, actualiza el paymentAttempt y la inscripción.
 */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      error: "Método no permitido",
    });
  }

  try {
    /**
     * ========================================================
     * 1. AUTORIZACIÓN CON SECRETO PRIVADO
     * ========================================================
     */

    const configuredSecret = String(
      process.env.MP_REPROCESS_SECRET || ""
    ).trim();

    const receivedSecret = String(
      req.headers["x-reprocess-secret"] || ""
    ).trim();

    if (!configuredSecret) {
      console.error(
        "[MP Reprocess] Falta MP_REPROCESS_SECRET"
      );

      return res.status(500).json({
        error: "Endpoint no configurado",
      });
    }

    if (
      !receivedSecret ||
      receivedSecret !== configuredSecret
    ) {
      return res.status(401).json({
        error: "No autorizado",
      });
    }

    /**
     * ========================================================
     * 2. RECIBIR IDENTIFICADORES
     * ========================================================
     */

    const paymentId = String(
      req.body?.paymentId || ""
    ).trim();

    const attemptId = String(
      req.body?.attemptId || ""
    ).trim();

    if (!paymentId || !attemptId) {
      return res.status(400).json({
        error:
          "Debes enviar paymentId y attemptId",
      });
    }

    const db = getAdminDb();

    /**
     * ========================================================
     * 3. OBTENER PAYMENT ATTEMPT
     * ========================================================
     */

    const attemptRef = db
      .collection("paymentAttempts")
      .doc(attemptId);

    const attemptSnap = await attemptRef.get();

    if (!attemptSnap.exists) {
      return res.status(404).json({
        error: "PaymentAttempt no encontrado",
      });
    }

    const attempt = attemptSnap.data()!;

    /**
     * ========================================================
     * 4. VALIDAR PROVEEDOR
     * ========================================================
     */

    if (
      String(attempt.paymentProvider || "")
        .toLowerCase() !== "mercadopago"
    ) {
      return res.status(409).json({
        error:
          "El intento no pertenece a Mercado Pago",
      });
    }

    /**
     * ========================================================
     * 5. OBTENER ACCESS TOKEN DE LA CUENTA RECEPTORA
     * ========================================================
     */

    let accessToken = "";

    const recipient = String(
      attempt.recipient || "dhtime"
    ).toLowerCase();

    if (recipient === "organizer") {
      const organizerId = String(
        attempt.organizerId || ""
      ).trim();

      if (!organizerId) {
        return res.status(409).json({
          error:
            "El intento no tiene organizerId",
        });
      }

      const organizerSnap = await db
        .collection("organizadores")
        .doc(organizerId)
        .get();

      if (!organizerSnap.exists) {
        return res.status(404).json({
          error: "Organizador no encontrado",
        });
      }

      const organizer = organizerSnap.data()!;

      if (
        organizer.mercadoPagoStatus !== "connected"
      ) {
        return res.status(409).json({
          error:
            "La cuenta de Mercado Pago del organizador no está conectada",
        });
      }

      accessToken = String(
        organizer.mercadoPagoAccessToken || ""
      ).trim();

    } else {
      accessToken = String(
        process.env.MERCADOPAGO_ACCESS_TOKEN || ""
      ).trim();
    }

    if (!accessToken) {
      return res.status(500).json({
        error:
          "No se encontró el Access Token de la cuenta receptora",
      });
    }

    /**
     * ========================================================
     * 6. CONSULTAR EL PAGO REAL EN MERCADO PAGO
     * ========================================================
     */

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

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error(
        "[MP Reprocess] Error consultando pago",
        {
          status: paymentResponse.status,
          message:
            payment?.message ||
            payment?.error ||
            "Error desconocido",
        }
      );

      return res.status(502).json({
        error:
          "Mercado Pago no permitió consultar el pago",
      });
    }

    /**
     * ========================================================
     * 7. VALIDAR IDENTIDAD DEL PAGO
     * ========================================================
     */

    if (String(payment.id) !== paymentId) {
      return res.status(409).json({
        error: "El ID del pago no coincide",
      });
    }

    /**
     * El pago debe pertenecer exactamente
     * al paymentAttempt enviado.
     */

    const paymentExternalReference = String(
      payment.external_reference || ""
    ).trim();

    if (paymentExternalReference !== attemptId) {
      console.error(
        "[MP Reprocess] external_reference no coincide",
        {
          paymentId,
          attemptId,
          paymentExternalReference,
        }
      );

      return res.status(409).json({
        error:
          "El pago no corresponde al paymentAttempt indicado",
      });
    }

    /**
     * ========================================================
     * 8. VALIDAR CUENTA RECEPTORA
     * ========================================================
     */

    const expectedSellerId = String(
      attempt.mercadoPagoUserId || ""
    ).trim();

    const paymentCollectorId = String(
      payment.collector_id || ""
    ).trim();

    if (
      !expectedSellerId ||
      paymentCollectorId !== expectedSellerId
    ) {
      return res.status(409).json({
        error:
          "La cuenta receptora del pago no coincide con el intento",
      });
    }

    /**
     * ========================================================
     * 9. VALIDAR MONEDA
     * ========================================================
     */

    const paymentCurrency = String(
      payment.currency_id || ""
    ).toUpperCase();

    const expectedCurrency = String(
      attempt.currency || "MXN"
    ).toUpperCase();

    if (paymentCurrency !== expectedCurrency) {
      return res.status(409).json({
        error: "La moneda del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 10. VALIDAR MONTO
     * ========================================================
     */

    const transactionAmount = Number(
      payment.transaction_amount
    );

    const expectedAmount = Number(
      attempt.expectedAmount
    );

    if (
      !Number.isFinite(transactionAmount) ||
      !Number.isFinite(expectedAmount) ||
      transactionAmount <= 0 ||
      expectedAmount <= 0 ||
      Math.round(transactionAmount * 100) !==
        Math.round(expectedAmount * 100)
    ) {
      return res.status(409).json({
        error: "El monto del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 11. VALIDAR PREFERENCE ID
     * ========================================================
     *
     * Si Mercado Pago devuelve preference_id,
     * debe coincidir.
     *
     * Si viene vacío, se permite continuar porque
     * external_reference, cuenta y monto ya fueron
     * verificados contra el intento existente.
     */

    const paymentPreferenceId = String(
      payment.preference_id || ""
    ).trim();

    const attemptPreferenceId = String(
      attempt.preferenceId || ""
    ).trim();

    if (
      paymentPreferenceId &&
      paymentPreferenceId !== attemptPreferenceId
    ) {
      return res.status(409).json({
        error:
          "El preferenceId del pago no coincide",
      });
    }

    /**
     * ========================================================
     * 12. VALIDAR QUE EL PAGO ESTÉ APROBADO
     * ========================================================
     */

    const paymentStatus = String(
      payment.status || ""
    ).toLowerCase();

    if (paymentStatus !== "approved") {
      return res.status(409).json({
        error: "El pago todavía no está aprobado",
        paymentStatus,
      });
    }

    /**
     * ========================================================
     * 13. BUSCAR INSCRIPCIÓN EXISTENTE
     * ========================================================
     */

    const inscripcionesSnap = await db
      .collection("inscripciones")
      .where("paymentAttemptId", "==", attemptId)
      .limit(2)
      .get();

    if (inscripcionesSnap.empty) {
      return res.status(404).json({
        error:
          "No se encontró una inscripción asociada al intento",
      });
    }

    if (inscripcionesSnap.size !== 1) {
      return res.status(409).json({
        error:
          "El intento está asociado a más de una inscripción",
      });
    }

    const inscripcionDoc =
      inscripcionesSnap.docs[0];

    /**
     * ========================================================
     * 14. ACTUALIZACIÓN TRANSACCIONAL
     * ========================================================
     */

    await db.runTransaction(async (transaction) => {
      const freshAttemptSnap =
        await transaction.get(attemptRef);

      const freshInscripcionSnap =
        await transaction.get(inscripcionDoc.ref);

      if (
        !freshAttemptSnap.exists ||
        !freshInscripcionSnap.exists
      ) {
        throw new Error(
          "El intento o la inscripción ya no existen"
        );
      }

      const freshAttempt =
        freshAttemptSnap.data()!;

      const freshInscripcion =
        freshInscripcionSnap.data()!;

      /**
       * Revalidar relación entre documentos.
       */

      if (
  String(freshInscripcion.paymentAttemptId || "") !==
    attemptId ||
  String(freshAttempt.paymentProvider || "")
    .toLowerCase() !== "mercadopago"
) {
        throw new Error(
          "El intento y la inscripción no coinciden"
        );
      }

      /**
       * No sobrescribir un pago diferente.
       */

      if (
        freshInscripcion.paymentStatus === "paid" &&
        String(freshInscripcion.paymentId || "") !==
          paymentId
      ) {
        throw new Error(
          "La inscripción ya fue pagada con otro pago"
        );
      }

      /**
       * No duplicar la aplicación del mismo pago.
       */

      if (
        freshInscripcion.paymentStatus === "paid" &&
        String(freshInscripcion.paymentId || "") ===
          paymentId
      ) {
        return;
      }

      const now =
        admin.firestore.FieldValue.serverTimestamp();

      /**
       * Actualizar paymentAttempt.
       */

      transaction.update(attemptRef, {
        status: "approved",
        paymentStatus: "approved",

        paymentId,
        preferenceId:
          paymentPreferenceId || attemptPreferenceId,

        paymentAmount: transactionAmount,
        paymentCurrency,

        approvedAt: now,
        updatedAt: now,
      });

      /**
       * Actualizar inscripción EXISTENTE.
       */

      transaction.update(inscripcionDoc.ref, {
        paymentStatus: "paid",
        paymentProvider: "mercadopago",

        paymentAttemptId: attemptId,
        paymentId,

        preferenceId:
          paymentPreferenceId || attemptPreferenceId,

        paymentMethod:
          payment.payment_method_id || null,

        paymentType:
          payment.payment_type_id || null,

        paymentApprovedAt: now,

        paymentAmount: transactionAmount,
        paymentCurrency,

        updatedAt: now,
      });
    });

    /**
     * ========================================================
     * 15. RESPUESTA
     * ========================================================
     */

    return res.status(200).json({
      success: true,
      message:
        "Pago verificado y procesado correctamente",
      paymentId,
      attemptId,
      paymentStatus: "approved",
      inscripcionId: inscripcionDoc.id,
    });

  } catch (error: any) {
    console.error(
      "[MP Reprocess] Error:",
      error?.message || error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Error interno al reprocesar el pago",
    });
  }
}