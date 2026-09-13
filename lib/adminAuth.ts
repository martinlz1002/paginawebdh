import type { NextApiRequest } from "next";
import * as admin from "firebase-admin";

function getFirebaseAdmin() {
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

  return admin;
}

/**
 * Verifica que la petición venga de un usuario autenticado
 * y que ese usuario tenga permisos de administrador.
 */
export async function requireAdmin(
  req: NextApiRequest
) {
  const firebaseAdmin = getFirebaseAdmin();

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Usuario no autenticado");
  }

  const idToken = authHeader.substring("Bearer ".length);

  if (!idToken) {
    throw new Error("Token de autenticación vacío");
  }

  const decodedToken =
    await firebaseAdmin
      .auth()
      .verifyIdToken(idToken);

  const uid = decodedToken.uid;

  const userSnap =
    await firebaseAdmin
      .firestore()
      .collection("usuarios")
      .doc(uid)
      .get();

  if (
    !userSnap.exists ||
    userSnap.data()?.admin !== true
  ) {
    throw new Error(
      "Requiere permisos de administrador"
    );
  }

  return {
    uid,
    decodedToken,
    userData: userSnap.data(),
  };
}