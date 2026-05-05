// lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
} = process.env;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// 👇 ESTA ES LA LÍNEA QUE TE FALTABA
export const adminDb = admin.firestore();

export { admin };