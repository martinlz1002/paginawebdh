import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    // 1) Comprobación de admin (opcional)
    if (!context.auth || !context.auth.token.admin) {
      throw new functions.https.HttpsError('permission-denied', 'Requiere permisos de administrador');
    }

    const { carreraId } = data as { carreraId: string };
    if (!carreraId) {
      throw new functions.https.HttpsError('invalid-argument', 'Falta carreraId');
    }

    // 2) Consulta todas las inscripciones de esa carrera
    const insRef = admin.firestore().collection('inscripciones').where('carreraId', '==', carreraId);
    const snapshot = await insRef.get();

    // 3) Batch delete (hasta 500 docs por batch)
    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return { eliminado: snapshot.size };
  });