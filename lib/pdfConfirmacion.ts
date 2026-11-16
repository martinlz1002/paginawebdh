
import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface InscView {
  id: string;
  titulo: string;
  imagenUrl?: string;
  distancia?: string;
  categoria: string;
  perfilNombre: string;
  perfilApPaterno: string;
  perfilApMaterno: string;
  competitorNumber?: number;
  kitFecha?: string;
  kitLugar?: string;
  kitHorario?: string;
}

export default async function generarPDF(insc: InscView) {
  console.group('🏁 GENERACIÓN DE PDF DHTime');

  console.log('ID inscripción:', insc.id);
  console.log('Carrera:', insc.titulo);
  console.log('URL del logo:', insc.imagenUrl);

  const doc = await PDFDocument.create();

  const pageWidth = 595;
  const pageHeight = 842;

  let page = doc.addPage([pageWidth, pageHeight]);

  const { width, height } = page.getSize();
  const margin = 35;

  // Fuentes
  const normalFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const fontSize = 12;
const lineHeight = fontSize * 1.3;
const maxWidth = width - margin * 2;

  let y = height - margin;

  // ==========================================
  // HELPER: CONTROL DE ESPACIO
  // ==========================================

  function ensureSpace(linesCount: number = 1) {
    if (y - linesCount * lineHeight < margin) {
      page = doc.addPage([pageWidth, pageHeight]);
      y = height - margin;
    }
  }

  // ==========================================
  // HELPER: AJUSTAR TEXTO
  // ==========================================

  function wrapText(
    text: string,
    font: any,
    size: number,
    availableWidth: number
  ): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const test = line ? line + ' ' + word : word;

      if (font.widthOfTextAtSize(test, size) <= availableWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);

    return lines;
  }

  // ==========================================
  // 1. LOGO DE LA CARRERA
  // ==========================================

  console.group('🖼️ DIAGNÓSTICO DEL LOGO');

  if (insc.imagenUrl && insc.imagenUrl.trim() !== '') {
    try {
      console.log('1. URL original:', insc.imagenUrl);

      // Validar URL original
      const originalUrl = new URL(insc.imagenUrl);

      if (originalUrl.protocol !== 'https:') {
        throw new Error('La URL del logo debe utilizar HTTPS');
      }

      // Descargar mediante la API de Next.js
      const proxyUrl =
        `/api/proxy-image?url=${encodeURIComponent(insc.imagenUrl)}`;

      console.log('2. Solicitando imagen mediante:', proxyUrl);

      const response = await fetch(proxyUrl);

      console.log('3. Estado HTTP:', response.status);
      console.log('4. Respuesta correcta:', response.ok);
      console.log(
        '5. Content-Type:',
        response.headers.get('content-type')
      );

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
          `Error del intermediario (${response.status}): ${errorText}`
        );
      }

      const imageBytes = await response.arrayBuffer();

      console.log(
        '6. Tamaño descargado:',
        imageBytes.byteLength,
        'bytes'
      );

      if (imageBytes.byteLength === 0) {
        throw new Error('La imagen descargada está vacía');
      }

      const contentType = (
        response.headers.get('content-type') || ''
      ).toLowerCase();

      // Detectar formato mediante los bytes reales
      const bytes = new Uint8Array(imageBytes);

      const isPNG =
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a;

      const isJPG =
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff;

      console.log('7. Formato detectado:', {
        isPNG,
        isJPG,
        contentType,
      });

      let logoImg;

      if (isPNG) {
        console.log('8. Insertando PNG...');
        logoImg = await doc.embedPng(imageBytes);

      } else if (isJPG) {
        console.log('8. Insertando JPG...');
        logoImg = await doc.embedJpg(imageBytes);

      } else {
        // Convertir WebP y otros formatos compatibles
        // con el navegador a PNG.
        console.log('8. Convirtiendo imagen a PNG...');

        const imageBlob = new Blob([imageBytes], {
          type: contentType,
        });

        const bitmap = await createImageBitmap(imageBlob);

        const canvas = document.createElement('canvas');

        canvas.width = bitmap.width;
        canvas.height = bitmap.height;

        const ctx = canvas.getContext('2d');

        if (!ctx) {
          bitmap.close();
          throw new Error('No se pudo crear el contexto Canvas');
        }

        ctx.drawImage(bitmap, 0, 0);

        bitmap.close();

        const pngBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('No se pudo convertir la imagen a PNG'));
            }
          }, 'image/png');
        });

        const pngBytes = await pngBlob.arrayBuffer();

        logoImg = await doc.embedPng(pngBytes);

        console.log('9. Imagen convertida correctamente');
      }

      console.log('10. Dimensiones originales:', {
        ancho: logoImg.width,
        alto: logoImg.height,
      });

      // Tamaño máximo del logo
      const maxLogoWidth = 145;
      const maxLogoHeight = 55;

      // Conservar proporciones
      const scale = Math.min(
        maxLogoWidth / logoImg.width,
        maxLogoHeight / logoImg.height
      );

      const logoWidth = logoImg.width * scale;
      const logoHeight = logoImg.height * scale;

      // Centrar horizontalmente
      page.drawImage(logoImg, {
        x: (width - logoWidth) / 2,
        y: height - margin - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });

      // Espacio debajo del logo
      y = height - margin - logoHeight - 18;

      console.log('✅ LOGO INCORPORADO CORRECTAMENTE AL PDF');

    } catch (error) {
      console.error('❌ ERROR AL CARGAR EL LOGO:', error);
      console.error('URL original:', insc.imagenUrl);
    }

  } else {
    console.warn('⚠️ La inscripción no tiene imagenUrl');
  }

  console.groupEnd();

  // ==========================================
  // 2. ENCABEZADO
  // ==========================================

  const header = 'Ha completado con éxito el registro';

  ensureSpace();

  let w = boldFont.widthOfTextAtSize(header, fontSize);

  page.drawText(header, {
    x: (width - w) / 2,
    y,
    font: boldFont,
    size: fontSize,
  });

  y -= lineHeight * 2;

  // ==========================================
  // 3. TÍTULO DE LA CARRERA
  // ==========================================

  const subtitle = insc.titulo || 'Carrera';

  ensureSpace();

  w = boldFont.widthOfTextAtSize(subtitle, fontSize);

  page.drawText(subtitle, {
    x: Math.max(margin, (width - w) / 2),
    y,
    font: boldFont,
    size: fontSize,
    maxWidth,
  });

  y -= lineHeight * 2;

  // ==========================================
  // 4. TEXTO INTRODUCTORIO
  // ==========================================

  const intro =
    'Favor de imprimir, firmar y llevar este comprobante al registro para recolectar su paquete.';

  const introLines = wrapText(
    intro,
    normalFont,
    fontSize,
    maxWidth
  );

  ensureSpace(introLines.length);

  for (const line of introLines) {
    page.drawText(line, {
      x: margin,
      y,
      font: normalFont,
      size: fontSize,
    });

    y -= lineHeight;
  }

  y -= lineHeight * 1.5;

  // ==========================================
  // HELPER: CAMPOS ETIQUETA / VALOR
  // ==========================================

  function drawField(label: string, value: string) {
    ensureSpace();

    const lab = label + ': ';
    const labWidth = normalFont.widthOfTextAtSize(lab, fontSize);

    page.drawText(lab, {
      x: margin,
      y,
      font: normalFont,
      size: fontSize,
    });

    page.drawText(value, {
      x: margin + labWidth,
      y,
      font: boldFont,
      size: fontSize,
      maxWidth: maxWidth - labWidth,
    });

    y -= lineHeight * 1.2;
  }

  // ==========================================
  // 5. INFORMACIÓN DEL COMPETIDOR
  // ==========================================

  const nombreCompleto = [
    insc.perfilNombre,
    insc.perfilApPaterno,
    insc.perfilApMaterno,
  ]
    .filter(Boolean)
    .join(' ');

  drawField('Nombre', nombreCompleto || '-');

  drawField('Distancia', insc.distancia || '-');

  drawField('Categoría', insc.categoria || '-');

  drawField(
    'Número de competidor',
    (insc.competitorNumber ?? '-').toString()
  );

  drawField('Ficha de Inscripción', insc.id);

  y -= lineHeight;

  // ==========================================
  // 6. EXONERACIÓN DE RESPONSABILIDAD
  // ==========================================

  ensureSpace(2);

  page.drawText('Exoneración de Responsabilidad', {
    x: margin,
    y,
    font: boldFont,
    size: fontSize,
  });

  y -= lineHeight;

  const exText = `Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi persona recaigan en cuanto a mi participación en ${insc.titulo}, en adelante el 'Evento'. Por lo tanto, yo soy el único responsable de mi salud, cualquier consecuencia, accidente, perjuicios o deficiencias que puedan causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte. Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus directores, patrocinadores, accionistas y representantes, directores financieros y consejeros de las compañías y por medio de este conducto renuncio sin limitación alguna a cualquier derecho, demanda o indemnización al respecto. También reconozco y acepto que todas las personas y entidades referidas no son ni serán consideradas responsables de mi salud. Así mismo, autorizo al Comité Organizador y/o a quien ésta designe, el uso de mi imagen y voz, ya sea parcial o totalmente, en cuanto a todo lo relacionado en el Evento, de cualquier manera y en cualquier momento. Por este conducto reconozco que sé y entiendo todas las regulaciones del Evento. Igualmente, manifiesto bajo protesta de decir verdad que mi equipo reúne y cumple con todos los requisitos reglamentarios aplicables y los temas establecidos en la mencionada normatividad.`;

  const exLines = wrapText(
    exText,
    normalFont,
    fontSize,
    maxWidth
  );

  for (const line of exLines) {
    ensureSpace();

    page.drawText(line, {
      x: margin,
      y,
      font: normalFont,
      size: fontSize,
    });

    y -= lineHeight;
  }

  y -= lineHeight;

  // ==========================================
  // 7. ENTREGA DE KITS
  // ==========================================

  ensureSpace(2);

  page.drawText('Entrega de kits:', {
    x: margin,
    y,
    font: boldFont,
    size: fontSize,
  });

  y -= lineHeight;

  drawField('Fecha', insc.kitFecha || 'Por definir');

  drawField('Lugar', insc.kitLugar || 'Por definir');

  drawField('Horario', insc.kitHorario || 'Por definir');

  y -= lineHeight;

  // ==========================================
  // 8. REQUISITOS
  // ==========================================

  ensureSpace(2);

  page.drawText('Requisitos:', {
    x: margin,
    y,
    font: boldFont,
    size: fontSize,
  });

  y -= lineHeight;

  const reqs = [
    'Hoja de confirmación impresa',
    'Identificación del corredor',
  ];

  for (const requisito of reqs) {
    ensureSpace();

    page.drawText('• ' + requisito, {
      x: margin + 10,
      y,
      font: normalFont,
      size: fontSize,
    });

    y -= lineHeight * 1.6;
  }

  // ==========================================
  // 9. GUARDAR Y DESCARGAR PDF
  // ==========================================

  console.log('📄 Generando archivo PDF...');

  const pdfBytes = await doc.save();

  // ArrayBuffer independiente para evitar TS2322
  const pdfArrayBuffer = new ArrayBuffer(pdfBytes.byteLength);

  new Uint8Array(pdfArrayBuffer).set(pdfBytes);

  const blob = new Blob([pdfArrayBuffer], {
    type: 'application/pdf',
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;
  a.download = `Confirmacion-${insc.id}.pdf`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  console.log('✅ PDF GENERADO Y DESCARGADO CORRECTAMENTE');
  console.groupEnd();
}
