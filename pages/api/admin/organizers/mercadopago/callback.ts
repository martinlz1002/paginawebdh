import type {
  NextApiRequest,
  NextApiResponse,
} from "next";

import * as admin from "firebase-admin";

function regresarResultado(
  res: NextApiResponse,
  resultado: string
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://www.dhtimeeventos.com";

  return res.redirect(
    302,
    `${baseUrl}/mercadopago/vinculado?estado=${encodeURIComponent(
      resultado
    )}`
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).send(
      "Método no permitido"
    );
  }

  try {
    const {
      code,
      state,
      error,
    } = req.query;

    if (error) {
      return regresarResultado(
        res,
        "authorization_denied"
      );
    }

    if (
      typeof code !== "string" ||
      typeof state !== "string"
    ) {
      return regresarResultado(
        res,
        "invalid_callback"
      );
    }

    const clientId =
      process.env.MERCADOPAGO_CLIENT_ID;

    const clientSecret =
      process.env.MERCADOPAGO_CLIENT_SECRET;

    const redirectUri =
      process.env.MERCADOPAGO_REDIRECT_URI;

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      throw new Error(
        "Faltan variables OAuth de Mercado Pago"
      );
    }

    const db = admin.firestore();

    const stateRef = db
      .collection("mercadoPagoOAuthStates")
      .doc(state);

    // Validar y consumir el state una sola vez.
    const stateData =
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(stateRef);

        if (!snap.exists) {
          throw new Error(
            "Estado OAuth inválido"
          );
        }

        const data = snap.data()!;

        if (data.used === true) {
          throw new Error(
            "Este enlace OAuth ya fue utilizado"
          );
        }

        const now = Date.now();

// Compatibilidad con estados antiguos que no tienen expiresAt.
const expiresAt =
  typeof data.expiresAt === "number"
    ? data.expiresAt
    : data.createdAt + 15 * 60 * 1000;

if (
  typeof data.createdAt !== "number" ||
  now < data.createdAt ||
  now > expiresAt
) {
  throw new Error(
    "El enlace OAuth expiró. Solicita uno nuevo a DHTime."
  );
}

        tx.update(stateRef, {
          used: true,
        });

        return data;
      });

    const organizerId =
      stateData.organizerId;

    // Intercambiar el código OAuth por tokens.
    const tokenResponse = await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          client_id: clientId,

          client_secret: clientSecret,

          code,

          grant_type:
            "authorization_code",

          redirect_uri: redirectUri,
        }),
      }
    );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData.access_token ||
      !tokenData.user_id
    ) {
      console.error(
        "[MP OAuth token]",
        tokenData
      );

      throw new Error(
        "Mercado Pago no pudo completar la vinculación"
      );
    }

    const organizerRef = db
      .collection("organizadores")
      .doc(organizerId);

    const organizerSnap =
      await organizerRef.get();

    if (!organizerSnap.exists) {
      throw new Error(
        "El organizador ya no existe"
      );
    }

    const organizer =
      organizerSnap.data();

    if (
      organizer?.paymentProvider !==
      "mercadopago"
    ) {
      throw new Error(
        "El organizador no utiliza Mercado Pago"
      );
    }

    // Guardar credenciales SOLO en servidor/Firestore.
    await organizerRef.update({
      mercadoPagoUserId:
        String(tokenData.user_id),

      mercadoPagoAccessToken:
        tokenData.access_token,

      mercadoPagoRefreshToken:
        tokenData.refresh_token || "",

      mercadoPagoPublicKey:
        tokenData.public_key || "",

      mercadoPagoTokenExpiresAt:
        Date.now() +
        Number(tokenData.expires_in || 0) *
          1000,

      mercadoPagoStatus: "connected",

      mercadoPagoLiveMode:
        tokenData.live_mode === true,

      mercadoPagoConnectedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),

      updatedAt:
        admin.firestore.FieldValue
          .serverTimestamp(),
    });

    return regresarResultado(
      res,
      "connected"
    );

  } catch (error: any) {
    console.error(
      "[MP OAuth callback]",
      error
    );

    return regresarResultado(
      res,
      "error"
    );
  }
}