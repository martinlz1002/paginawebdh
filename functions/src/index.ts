import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

export const crearCarrera = functions.https.onCall(
  async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo } = data;

    const buffer = Buffer.from(imagenBase64, "base64");
    const bucket = admin.storage().bucket();
    const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
    const file = bucket.file(filePath);

    await file.save(buffer, {
      metadata: {
        contentType: "image/jpeg",
      },
    });

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: "03-01-2030",
    });

    await admin.firestore().collection("carreras").add({
      titulo,
      descripcion,
      ubicacion,
      fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
      imagenUrl: url,
      creado: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { mensaje: "Carrera creada exitosamente" };
  }
);