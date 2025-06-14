"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
// functions/src/index.ts
const admin = __importStar(require("firebase-admin"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const https_1 = require("firebase-functions/v2/https");
// Inicializar SDK Admin
admin.initializeApp();
// Crear servidor Express
const app = (0, express_1.default)();
// Permitir CORS para peticiones desde cualquier origen
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json());
// Middleware de autenticación de Firebase
async function validateFirebaseIdToken(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    const idToken = header.split('Bearer ')[1];
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        req.uid = decoded.uid;
        return next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Token inválido' });
    }
}
// Ruta POST para crear carrera
app.post('/crearCarrera', validateFirebaseIdToken, async (req, res) => {
    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo, } = req.body;
    if (!titulo || !fecha || !imagenBase64 || !nombreArchivo) {
        return res.status(400).json({ error: 'Faltan campos obligatorios.' });
    }
    try {
        // Subir imagen a Storage
        const buffer = Buffer.from(imagenBase64, 'base64');
        const bucket = admin.storage().bucket();
        const path = `carreras/${Date.now()}_${nombreArchivo}`;
        const file = bucket.file(path);
        await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
        const [url] = await file.getSignedUrl({ action: 'read', expires: '03-01-2030' });
        // Guardar documento en Firestore
        await admin.firestore().collection('carreras').add({
            titulo,
            descripcion,
            ubicacion,
            fecha: admin.firestore.Timestamp.fromDate(new Date(fecha)),
            imagenUrl: url,
            creado: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.json({ mensaje: 'Carrera creada exitosamente' });
    }
    catch (error) {
        console.error('Error al crear carrera:', error);
        return res.status(500).json({ error: 'Error interno al crear la carrera.' });
    }
});
// Exportar función en US Central 1
exports.api = (0, https_1.onRequest)({ region: 'us-central1' }, app);
