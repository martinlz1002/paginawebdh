import type { NextApiRequest, NextApiResponse } from 'next';
import { admin } from '@/lib/firebaseAdmin';
import { getStorage } from 'firebase-admin/storage';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  // 1) Autenticación
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace(/^Bearer\s+/, '');
  if (!idToken) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  let uid: string;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // 2) Datos del body
  const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = req.body;
  if (!titulo || !descripcion || !ubicacion || !fecha || !imagenBase64 || !nombreArchivo) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    // 3) Subida de imagen
    const buffer = Buffer.from(imagenBase64, 'base64');
    const bucket = admin.storage().bucket();
    const file = bucket.file(`carreras/${Date.now()}_${nombreArchivo}`);
    await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
    const [imagenUrl] = await file.getSignedUrl({ action: 'read', expires: '03-01-2030' });

    // 4) Guardar documento en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl,
      creado: admin.firestore.FieldValue.serverTimestamp(),
      creadoPor: uid,
    });

    return res.status(200).json({ mensaje: 'Carrera creada exitosamente', imagenUrl });
  } catch (error) {
    console.error('Error al crear la carrera:', error);
    return res.status(500).json({ error: 'Error interno al crear la carrera' });
  }
}