
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Método no permitido',
    });
  }

  try {
    const imageUrl = req.query.url;

    if (typeof imageUrl !== 'string' || !imageUrl) {
      return res.status(400).json({
        error: 'Falta la URL de la imagen',
      });
    }

    const parsedUrl = new URL(imageUrl);

    // Seguridad: permitir únicamente Firebase Storage
    const allowedHosts = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
    ];

    if (
      parsedUrl.protocol !== 'https:' ||
      !allowedHosts.includes(parsedUrl.hostname)
    ) {
      return res.status(403).json({
        error: 'Dominio de imagen no permitido',
      });
    }

    console.log('🖼️ Descargando imagen desde Firebase:', parsedUrl.hostname);

    const response = await fetch(imageUrl);

    if (!response.ok) {
      console.error('Error Firebase Storage:', response.status);

      return res.status(response.status).json({
        error: 'No se pudo obtener la imagen de Firebase Storage',
      });
    }

    const contentType =
      response.headers.get('content-type') || '';

    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(415).json({
        error: 'El archivo obtenido no es una imagen',
      });
    }

    const imageBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    console.log('✅ Imagen obtenida:', {
      contentType,
      bytes: imageBuffer.length,
    });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');

    return res.status(200).send(imageBuffer);

  } catch (error) {
    console.error('❌ Error en proxy-image:', error);

    return res.status(500).json({
      error: 'Error interno al obtener la imagen',
    });
  }
}
