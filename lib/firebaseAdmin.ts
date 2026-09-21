// lib/firebaseAdmin.ts

import * as admin from "firebase-admin";

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
} = process.env;

// Inicializar Firebase Admin una sola vez
if (!admin.apps.length) {
  if (
    !FIREBASE_PROJECT_ID ||
    !FIREBASE_CLIENT_EMAIL ||
    !FIREBASE_PRIVATE_KEY
  ) {
    throw new Error(
      "Faltan credenciales de Firebase Admin. Verifica FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY."
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// Instancia compartida de Firestore
const adminDb = admin.firestore();

export { admin, adminDb };