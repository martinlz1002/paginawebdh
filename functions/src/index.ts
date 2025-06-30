import * as functions from 'firebase-functions/v1';
import * as admin     from 'firebase-admin';

admin.initializeApp();

export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError('permission-denied', 'Requiere permisos de administrador');
      }
      const { carreraId } = data as { carreraId: string };
      if (!carreraId) {
        throw new functions.https.HttpsError('invalid-argument', 'Falta carreraId');
      }
      const insRef = admin.firestore().collection('inscripciones').where('carreraId', '==', carreraId);
      const snapshot = await insRef.get();
      const batch = admin.firestore().batch();
      snapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      return { eliminado: snapshot.size };
    } catch (e: any) {
      console.error('Error en borrarInscripcionesDeCarrera:', e);
      if (e instanceof functions.https.HttpsError) throw e;
      // cualquier otro error lo devolvemos como internal
      throw new functions.https.HttpsError('internal', e.message || 'Error desconocido');
    }
  });