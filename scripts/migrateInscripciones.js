const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function migrate() {
  const colGroups = await db.collectionGroup("docs").get();
  for (const docSnap of colGroups.docs) {
    const data = docSnap.data();
    // extrae carreraId de la ruta: inscripciones/{carreraId}/docs/{inscId}
    const carreraId = docSnap.ref.parent.parent.id;
    await db.collection("inscripciones").doc(docSnap.id).set({
      ...data,
      carreraId,
    });
    console.log(`Migrado insc ${docSnap.id} (carrera=${carreraId})`);
  }
  console.log("¡Migración completada!");
}

migrate().catch(console.error);