import type { NextApiRequest, NextApiResponse } from 'next';
import * as admin from 'firebase-admin';

// Inicializa Admin SDK si no está ya
if (!admin.apps.length) {
  const raw = Buffer.from(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY_B64!,
    'base64'
  ).toString('utf8');
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}
const firestore = admin.firestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  if (req.method !== 'GET' || typeof id !== 'string') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).end('Method Not Allowed');
  }

  const snap = await firestore.collection('tempusuarios').doc(id).get();
  if (!snap.exists) {
    return res.status(404).json({ error: 'Enlace no encontrado' });
  }
  const data = snap.data()!;
  const expiresAt = (data.expiresAt as admin.firestore.Timestamp).toDate();
  if (expiresAt.getTime() < Date.now()) {
    return res.status(410).json({ error: 'Enlace expirado' });
  }

  // Serializar Date a ISO
  return res.status(200).json({
    id: snap.id,
    carreraId: data.carreraId,
    range: data.range,
    username: data.username,
    // no devolvemos password aquí
    expiresAt: expiresAt.toISOString(),
  });
}   