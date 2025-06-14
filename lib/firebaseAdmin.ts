// lib/firebaseAdmin.ts
import * as admin from 'firebase-admin';

// Estas variables las defines en tu .env.local
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
      // las líneas nuevas (\n) suelen venir escapadas en .env
      privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export { admin };