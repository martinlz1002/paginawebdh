import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

import {
  createOrganizerOnboardingLink,
} from "../../../../lib/stripeConnect";

import { requireAdmin } from "../../../../lib/adminAuth";

type ResponseData =
  | {
      ok: true;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // ==========================================
  // MÉTODO
  // ==========================================

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Método no permitido",
    });
  }

  try {
    // ==========================================
    // VERIFICAR ADMIN
    // ==========================================

    await requireAdmin(req);

    // ==========================================
    // DATOS
    // ==========================================

    const {
      organizerId,
    } = req.body || {};

    if (
      typeof organizerId !== "string" ||
      !organizerId.trim()
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "Falta organizerId",
      });
    }

    // ==========================================
    // FIREBASE
    // ==========================================

    const db =
      admin.firestore();

    const organizerRef =
      db
        .collection("organizadores")
        .doc(organizerId.trim());

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

    const connectedAccountId =
      organizer?.connectedAccountId;

    if (
      typeof connectedAccountId !== "string" ||
      !connectedAccountId
    ) {
      return res.status(400).json({
        ok: false,
        error:
          "El organizador todavía no tiene una cuenta Stripe",
      });
    }

    // ==========================================
    // ORIGEN DEL SITIO
    // ==========================================

    const forwardedProto =
      req.headers["x-forwarded-proto"];

    const forwardedHost =
      req.headers["x-forwarded-host"];

    const protocol =
      typeof forwardedProto === "string"
        ? forwardedProto
        : "https";

    const host =
      typeof forwardedHost === "string"
        ? forwardedHost
        : req.headers.host;

    if (!host) {
      return res.status(500).json({
        ok: false,
        error:
          "No fue posible determinar la URL del sitio",
      });
    }

    const baseUrl =
      `${protocol}://${host}`;

    // ==========================================
    // CREAR ACCOUNT LINK
    // ==========================================

    const accountLink =
      await createOrganizerOnboardingLink({
        accountId:
          connectedAccountId,

        refreshUrl:
          `${baseUrl}/admin/organizadores/onboarding?organizerId=${encodeURIComponent(
            organizerId
          )}`,

        returnUrl:
          `${baseUrl}/admin/organizadores/onboarding?organizerId=${encodeURIComponent(
            organizerId
          )}&completed=1`,
      });

    // ==========================================
    // GUARDAR ESTADO
    // ==========================================

    await organizerRef.update({
      stripeStatus:
        "onboarding",

      updatedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });

    // ==========================================
    // RESPUESTA
    // ==========================================

    return res.status(200).json({
      ok: true,
      url: accountLink.url,
    });

  } catch (error: any) {
    console.error(
      "Error generando onboarding Stripe:",
      error
    );

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Error interno generando onboarding",
    });
  }
}