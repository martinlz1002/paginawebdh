// lib/organizerAuth.ts

import type { NextApiRequest } from "next";
import { admin, adminDb } from "./firebaseAdmin";

export async function requireOrganizer(req: NextApiRequest) {
  // Obtener el token enviado por el usuario
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Usuario no autenticado");
  }

  const idToken = authHeader.substring("Bearer ".length).trim();

  if (!idToken) {
    throw new Error("Token de autenticación vacío");
  }

  // Verificar el token con Firebase Authentication
  const decoded = await admin.auth().verifyIdToken(idToken);

  if (!decoded.email) {
    throw new Error("La cuenta no tiene correo electrónico");
  }

  // Exigir correo verificado
  if (decoded.email_verified !== true) {
    throw new Error(
      "Debes verificar tu correo electrónico antes de entrar"
    );
  }

  const email = decoded.email.trim().toLowerCase();

  // Buscar organizador usando la instancia compartida de Firestore
  const snap = await adminDb
    .collection("organizadores")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    throw new Error(
      "No existe un organizador asociado a este correo"
    );
  }

  const organizerDoc = snap.docs[0];
  const organizer = organizerDoc.data();

  // Verificar si la cuenta está activa
  if (organizer.activo === false) {
    throw new Error("Tu cuenta de organizador está desactivada");
  }

  // Evitar que el organizador se vincule a otra cuenta
  if (
    organizer.userId &&
    organizer.userId !== decoded.uid
  ) {
    throw new Error(
      "Este organizador ya está vinculado a otra cuenta"
    );
  }

  // Primera entrada: vincular UID de Firebase
  if (!organizer.userId) {
    await organizerDoc.ref.update({
      userId: decoded.uid,
      userLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  // Devolver los datos del organizador autenticado
  return {
    uid: decoded.uid,
    email,

    organizerId: organizerDoc.id,

    organizer: {
      id: organizerDoc.id,
      ...organizer,
      userId: decoded.uid,
    },

    db: adminDb,
    firebaseAdmin: admin,
  };
}