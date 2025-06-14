import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();

export const crearCarrera = onCall(
  // Opcional: si quisieras añadir opciones (memory, timeout, etc.) las pones aquí:
  // { region: 'us-central1', memory: '256MiB', timeoutSeconds: 120 },
  async (request) => {
    // request.auth es el contexto de autenticación
    const auth = request.auth;
    if (!auth?.uid) {
      // El usuario no está autenticado
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }

    // Desestructuramos y validamos brevemente
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

    if (!titulo || !fecha || !imagenBase64 || !nombreArchivo) {
      throw new HttpsError(
        'invalid-argument',
        'Faltan campos obligatorios.'
      );
    }

    try {
      // Subir la imagen
      const buffer = Buffer.from(imagenBase64, 'base64');
      const bucket = admin.storage().bucket();
      const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
      const file = bucket.file(filePath);
      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg' },
      });

      // Obtener URL pública
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-01-2030',
      });

      // Guardar en Firestore
      await admin
        .firestore()
        .collection('carreras')
        .add({
          titulo,
          descripcion,
          ubicacion,
          fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
          imagenUrl: url,
          creado: admin.firestore.FieldValue.serverTimestamp(),
        });

      return { mensaje: 'Carrera creada exitosamente' };
    } catch (error) {
      console.error('Error al crear la carrera:', error);
      throw new HttpsError(
        'internal',
        'Ocurrió un error al crear la carrera.'
      );
    }
  }
);