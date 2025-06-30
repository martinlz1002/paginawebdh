const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
// Carga el JSON desde la misma carpeta
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert({
    projectId: serviceAccount.project_id,
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
  }),
});

async function setAdmin(uid) {
  await getAuth().setCustomUserClaims(uid, { admin: true });
  console.log(`✅ admin=true set for ${uid}`);
}

// Reemplaza aquí tu UID real
setAdmin('wrug7aS09zVps6nEDNRx8eTi8hO2')
  .catch(console.error)
  .then(() => process.exit());