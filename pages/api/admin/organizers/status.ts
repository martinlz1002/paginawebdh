import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import {
  getOrganizerAccount,
} from "../../../../lib/stripeConnect";

import {
  requireAdmin,
} from "../../../../lib/adminAuth";

type ResponseData =
  | {
      ok: true;
      organizerId: string;
      connectedAccountId: string;
      status: {
        stripeStatus: string;
        chargesEnabled: boolean;
        payoutsEnabled: boolean;
        detailsSubmitted: boolean;
        currentlyDue: string[];
        eventuallyDue: string[];
        disabledReason: string | null;
      };
    }
  | {
      ok: false;
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    // ============================================================
    // 1. VERIFICAR ADMINISTRADOR
    // ============================================================

    await requireAdmin(req);

    // ============================================================
    // 2. VALIDAR ORGANIZER ID
    // ============================================================

    const {
      organizerId,
    } = req.body || {};

    if (
      typeof organizerId !== "string" ||
      !organizerId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error: "Falta organizerId",
      });
    }

    const organizerIdLimpio =
      organizerId.trim();

    // ============================================================
    // 3. FIREBASE ADMIN
    // ============================================================

    const db = admin.firestore();

    const organizerRef =
      db
        .collection("organizadores")
        .doc(organizerIdLimpio);

    const organizerSnap =
      await organizerRef.get();

    if (!organizerSnap.exists) {
      return res.status(404).json({
        ok: false,
        error:
          "No se encontró el organizador",
      });
    }

    const organizer =
      organizerSnap.data();

    // ============================================================
    // 4. OBTENER CUENTA CONNECT
    // ============================================================

    const connectedAccountId =
      organizer?.connectedAccountId;

    if (
      typeof connectedAccountId !== "string" ||
      !connectedAccountId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "El organizador todavía no tiene una cuenta Stripe",
      });
    }

    // ============================================================
    // 5. CONSULTAR DIRECTAMENTE A STRIPE
    // ============================================================

    const account =
      await getOrganizerAccount(
        connectedAccountId
      );

    const chargesEnabled =
      account.charges_enabled === true;

    const payoutsEnabled =
      account.payouts_enabled === true;

    const detailsSubmitted =
      account.details_submitted === true;

    // ============================================================
    // 6. DETERMINAR ESTADO
    // ============================================================

    let stripeStatus =
      "created";

    if (!detailsSubmitted) {
      stripeStatus =
        "onboarding";
    } else if (
      !chargesEnabled ||
      !payoutsEnabled
    ) {
      stripeStatus =
        "action_required";
    } else {
      stripeStatus =
        "active";
    }

    // ============================================================
    // 7. REQUISITOS DE STRIPE
    // ============================================================

    const currentlyDue =
      account.requirements?.currently_due || [];

    const eventuallyDue =
      account.requirements?.eventually_due || [];

    const disabledReason =
      account.requirements?.disabled_reason ||
      null;

    // ============================================================
    // 8. ACTUALIZAR FIRESTORE
    // ============================================================

    await organizerRef.update({
      connectedAccountId:
        account.id,

      stripeStatus,

      chargesEnabled,

      payoutsEnabled,

      detailsSubmitted,

      currentlyDue,

      eventuallyDue,

      disabledReason,

      updatedAt:
        admin.firestore.FieldValue.serverTimestamp(),
    });

    // ============================================================
    // 9. RESPONDER
    // ============================================================

    return res.status(200).json({
      ok: true,

      organizerId:
        organizerIdLimpio,

      connectedAccountId:
        account.id,

      status: {
        stripeStatus,

        chargesEnabled,

        payoutsEnabled,

        detailsSubmitted,

        currentlyDue,

        eventuallyDue,

        disabledReason,
      },
    });

  } catch (error: any) {
    console.error(
      "Error actualizando estado del organizador:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Error interno actualizando el estado del organizador",
    });
  }
}