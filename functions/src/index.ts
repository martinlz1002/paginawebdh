import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export const borrarInscripcionesDeCarrera = functions
  .runWith({ memory: '256MB', timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth?.token.admin) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Requiere permisos de administrador'
        );
      }

      const { carreraId } = data as { carreraId: string };
      if (!carreraId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Falta carreraId'
        );
      }

      const insSnap = await db
        .collection('inscripciones')
        .where('carreraId', '==', carreraId)
        .get();

      if (insSnap.empty) {
        return { eliminado: 0 };
      }

      const batch = db.batch();
      const carreraRef = db.collection('carreras').doc(carreraId);

      for (const docSnap of insSnap.docs) {
        const data = docSnap.data() as any;
        const n = data.competitorNumber as number | undefined | null;

        // ✅ devolver número al pool si existía
        if (n && Number.isFinite(n) && n > 0) {
          const freeRef = carreraRef
            .collection('freeNumbers')
            .doc(String(n));

          batch.set(
            freeRef,
            {
              n,
              releasedAt: FieldValue.serverTimestamp(),
              reason: 'admin_delete',
            },
            { merge: true }
          );
        }

        // eliminar inscripción
        batch.delete(docSnap.ref);
      }

      await batch.commit();

      return { eliminado: insSnap.size };
    } catch (e: any) {
      console.error('Error en borrarInscripcionesDeCarrera:', e);
      if (e instanceof functions.https.HttpsError) throw e;
      throw new functions.https.HttpsError(
        'internal',
        e.message || 'Error desconocido'
      );
    }
  });