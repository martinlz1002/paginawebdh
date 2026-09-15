import type { NextApiRequest } from "next";
import * as admin from "firebase-admin";

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64;

    if (!raw) {
      throw new Error("Falta FIREBASE_SERVICE_ACCOUNT_KEY_B64");
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

export async function requireOrganizer(req: NextApiRequest) {
  const firebaseAdmin = getFirebaseAdmin();

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Usuario no autenticado");
  }

  const idToken = authHeader.substring("Bearer ".length).trim();

  if (!idToken) {
    throw new Error("Token de autenticación vacío");
  }

  const decoded = await firebaseAdmin
    .auth()
    .verifyIdToken(idToken);

  if (!decoded.email) {
    throw new Error("La cuenta no tiene correo electrónico");
  }

  // Para el acceso del organizador exigimos correo verificado.
  if (decoded.email_verified !== true) {
    throw new Error("Debes verificar tu correo electrónico antes de entrar");
  }

  const email = decoded.email.trim().toLowerCase();

  const db = firebaseAdmin.firestore();

  const snap = await db
    .collection("organizadores")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error("No existe un organizador asociado a este correo");
  }

  const organizerDoc = snap.docs[0];
  const organizer = organizerDoc.data();

  if (organizer.activo === false) {
    throw new Error("Tu cuenta de organizador está desactivada");
  }

  // Primera entrada: vinculamos de forma segura el UID de Firebase
  // con el organizador cuyo correo ya fue verificado.
  if (organizer.userId && organizer.userId !== decoded.uid) {
    throw new Error("Este organizador ya está vinculado a otra cuenta");
  }

  if (!organizer.userId) {
    await organizerDoc.ref.update({
      userId: decoded.uid,
      userLinkedAt: firebaseAdmin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return {
    uid: decoded.uid,
    email,
    organizerId: organizerDoc.id,
    organizer: {
      id: organizerDoc.id,
      ...organizer,
      userId: decoded.uid,
    },
    db,
    firebaseAdmin,
  };
}
