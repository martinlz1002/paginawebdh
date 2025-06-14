import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();

export const crearCarrera = onCall(async (request) => {
  // 1) Verificamos autenticación
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  // 2) Extraemos datos (TypeScript ya infiere CallableRequest)
  const {
    titulo,
    descripcion,
    ubicacion,
    fecha,
    imagenBase64,
    nombreArchivo,
  } = request.data as {
    titulo: string;
    descripcion: string;
    ubicacion: string;
    fecha: string;
    imagenBase64: string;
    nombreArchivo: string;
  };

  try {
    // 3) Subimos la imagen
    const buffer = Buffer.from(imagenBase64, 'base64');
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, { metadata: { contentType: 'image/jpeg' }});

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2030',
    });

    // 4) Creamos el documento en Firestore
    await admin.firestore().collection('carreras').add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { mensaje: 'Carrera creada exitosamente' };
  } catch (error) {
    console.error('Error al crear carrera:', error);
    throw new HttpsError('internal', 'Error al crear la carrera.');
  }
});