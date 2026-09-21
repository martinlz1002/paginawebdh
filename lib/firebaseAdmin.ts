// lib/firebaseAdmin.ts

import * as admin from "firebase-admin";

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
} = process.env;

if (!admin.apps.length) {
  if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Faltan credenciales de Firebase Admin. Verifica las variables de entorno."
    );
  }

  const privateKey = FIREBASE_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .trim();

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminDb = admin.firestore();

export { admin, adminDb };