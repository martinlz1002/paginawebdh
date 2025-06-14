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
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearCarrera = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
admin.initializeApp();
exports.crearCarrera = (0, https_1.onCall)(async (request) => {
    // 1) Verificamos autenticación
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Debes iniciar sesión.');
    }
    // 2) Extraemos datos (TypeScript ya infiere CallableRequest)
    const { titulo, descripcion, ubicacion, fecha, imagenBase64, nombreArchivo, } = request.data;
    try {
        // 3) Subimos la imagen
        const buffer = Buffer.from(imagenBase64, 'base64');
        const bucket = admin.storage().bucket();
        const filePath = `carreras/${Date.now()}_${nombreArchivo}`;
        const file = bucket.file(filePath);
        await file.save(buffer, { metadata: { contentType: 'image/jpeg' } });
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
    }
    catch (error) {
        console.error('Error al crear carrera:', error);
        throw new https_1.HttpsError('internal', 'Error al crear la carrera.');
    }
});
