
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

  // ==========================================
  // CONFIGURACIÓN DE CARRERA ESPECIAL
  // ==========================================

  const esAltata =
    insc.titulo.trim().toLowerCase() ===
    'carrera altata 130 6ta. 2026'.toLowerCase();

  console.log('¿Carrera Altata especial?', esAltata);

  // Altata necesita una composición más compacta para conservar
  // el texto legal completo entre las dos filas de patrocinadores.
  // Las demás carreras mantienen exactamente su tamaño anterior.
  const fontSize = esAltata ? 9 : 12;
  const lineHeight = fontSize * (esAltata ? 1.15 : 1.3);
  const maxWidth = width - margin * 2;

  const normalFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // ==========================================
  // LOGOS DE PATROCINADORES
  // ==========================================

  const logosAltata = [
    '/Altateno.png',
    '/CLN_Apparels.png',
    '/Impulsa.png',
    '/Lafher_Inmobiliaria.png',
    '/Panchito_Ritz.png',
    '/RefripartesMX.png',
    '/VP_Racing_Fuels.png',
    '/Welding_Fab.png',
  ];

  // ==========================================
  // HELPER: INSERTAR IMAGEN EN PDF
  // ==========================================

  async function embedImage(
    imageBytes: ArrayBuffer,
    contentType: string
  ) {
    const bytes = new Uint8Array(imageBytes);

    const isPNG =
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;

    const isJPG =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;

    if (isPNG) {
      return await doc.embedPng(imageBytes);
    }

    if (isJPG) {
      return await doc.embedJpg(imageBytes);
    }

    // Convertir otros formatos compatibles a PNG.
    const blob = new Blob([imageBytes], {
      type: contentType,
    });

    const bitmap = await createImageBitmap(blob);

    const canvas = document.createElement('canvas');

    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      bitmap.close();
      throw new Error('No se pudo crear Canvas');
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
        } else {
          reject(new Error('Error convirtiendo imagen a PNG'));
        }
      }, 'image/png');
    });

    return await doc.embedPng(await pngBlob.arrayBuffer());
  }

  // ==========================================
  // HELPER: DIBUJAR LOGO CONSERVANDO PROPORCIÓN
  // ==========================================

  function drawLogoFit(
    image: any,
    x: number,
    y: number,
    boxWidth: number,
    boxHeight: number
  ) {
    const scale = Math.min(
      boxWidth / image.width,
      boxHeight / image.height
    );

    const logoWidth = image.width * scale;
    const logoHeight = image.height * scale;

    page.drawImage(image, {
      x: x + (boxWidth - logoWidth) / 2,
      y: y + (boxHeight - logoHeight) / 2,
      width: logoWidth,
      height: logoHeight,
    });
  }

  // ==========================================
  // HELPER: CARGAR IMAGEN DESDE PUBLIC
  // ==========================================

  async function cargarLogoLocal(path: string) {
    const response = await fetch(path);

    if (!response.ok) {
      throw new Error(
        `No se pudo cargar ${path}: HTTP ${response.status}`
      );
    }

    const bytes = await response.arrayBuffer();

    if (!bytes.byteLength) {
      throw new Error(`Imagen vacía: ${path}`);
    }

    return await embedImage(
      bytes,
      response.headers.get('content-type') || 'image/png'
    );
  }

  // ==========================================
  // FONDO DECORATIVO EXCLUSIVO DE ALTATA
  // ==========================================

  if (esAltata) {
    const fondoResponse = await fetch('/fondo-altata.jpeg');

    if (!fondoResponse.ok) {
      throw new Error(
        `No se pudo cargar /fondo-altata.jpeg: HTTP ${fondoResponse.status}`
      );
    }

    const fondoBytes = await fondoResponse.arrayBuffer();
    const fondoImage = await doc.embedJpg(fondoBytes);

    // El fondo cubre toda la hoja. Se adapta al tamaño A4.
    // Se dibuja antes de los logos y del texto para mantenerlos encima.
    page.drawImage(fondoImage, {
      x: 0,
      y: 0,
      width,
      height,
    });

    console.log('✅ Fondo deportivo de Altata incorporado');
  }

  // ==========================================
  // 1. DISTRIBUCIÓN DE LOGOTIPOS
  // ==========================================

  let y = height - margin;

  if (esAltata) {
    console.group('🖼️ LOGOS CARRERA ALTATA');

    // ------------------------------------------
    // LOGO PRINCIPAL DE ALTATA
    // ------------------------------------------

    // El logo principal queda dentro de la zona blanca superior.
    const mainLogoWidth = 250;
    const mainLogoHeight = 75;

    const mainLogoY = height - 125 - mainLogoHeight;

    try {
      if (insc.imagenUrl && insc.imagenUrl.trim() !== '') {
        const originalUrl = new URL(insc.imagenUrl);

        if (originalUrl.protocol !== 'https:') {
          throw new Error('La URL del logo debe utilizar HTTPS');
        }

        const proxyUrl =
          `/api/proxy-image?url=${encodeURIComponent(insc.imagenUrl)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(
            `Error descargando logo principal: ${response.status}`
          );
        }

        const bytes = await response.arrayBuffer();

        const logoPrincipal = await embedImage(
          bytes,
          response.headers.get('content-type') || ''
        );

        drawLogoFit(
          logoPrincipal,
          (width - mainLogoWidth) / 2,
          mainLogoY,
          mainLogoWidth,
          mainLogoHeight
        );

        console.log('✅ Logo principal de Altata incorporado');

      } else {
        throw new Error('La inscripción no tiene imagenUrl');
      }

    } catch (error) {
      console.error('❌ Error cargando logo principal:', error);
      throw error;
    }

    // ------------------------------------------
    // CARGAR LOS 8 PATROCINADORES
    // ------------------------------------------

    const logosCargados: any[] = [];

    for (const ruta of logosAltata) {
      try {
        const logo = await cargarLogoLocal(ruta);

        logosCargados.push(logo);

        console.log('✅ Logo cargado:', ruta);

      } catch (error) {
        console.error('❌ Error cargando patrocinador:', ruta, error);
        throw error;
      }
    }

    // Comprobar que estén los 8 patrocinadores.
    if (logosCargados.length !== 8) {
      throw new Error(
        `Se esperaban 8 patrocinadores y se cargaron ${logosCargados.length}`
      );
    }

    // ------------------------------------------
    // LOS 8 PATROCINADORES EN LA PARTE INFERIOR
    // Dos filas de cuatro, dentro de la zona blanca
    // del marco y sin invadir el contenido central.
    // ------------------------------------------

    const sponsorWidth = maxWidth / 4;
    const sponsorHeight = 30;
    const sponsorGap = 8;

    // Fila superior del bloque inferior: logos 1 al 4.
    // Se baja el bloque completo para liberar más espacio a la carta.
    const primeraFila = logosCargados.slice(0, 4);
    const primeraFilaY = 175;

    primeraFila.forEach((logo, index) => {
      const x = margin + index * sponsorWidth;

      drawLogoFit(
        logo,
        x + 5,
        primeraFilaY,
        sponsorWidth - 10,
        sponsorHeight
      );
    });

    // Fila inferior del bloque inferior: logos 5 al 8.
    const segundaFila = logosCargados.slice(4, 8);
    const segundaFilaY = primeraFilaY - sponsorHeight - sponsorGap;

    segundaFila.forEach((logo, index) => {
      const x = margin + index * sponsorWidth;

      drawLogoFit(
        logo,
        x + 5,
        segundaFilaY,
        sponsorWidth - 10,
        sponsorHeight
      );
    });

    // El contenido comienza debajo del logo principal.
    // Ya no hay patrocinadores entre el logo principal y la carta.
    y = mainLogoY - 22;

    console.log('Logo principal de Altata: arriba, tamaño grande');
    console.log('Patrocinadores: 8 en la parte inferior, dos filas de cuatro');
    console.log('Inicio del contenido central:', y);
    console.log(
      'Límite inferior del contenido:',
      primeraFilaY + sponsorHeight + 12
    );

    console.groupEnd();

  } else {

    // ==========================================
    // LOGO NORMAL PARA LAS DEMÁS CARRERAS
    // ==========================================

    if (insc.imagenUrl && insc.imagenUrl.trim() !== '') {
      try {
        const originalUrl = new URL(insc.imagenUrl);

        if (originalUrl.protocol !== 'https:') {
          throw new Error('La URL del logo debe utilizar HTTPS');
        }

        const proxyUrl =
          `/api/proxy-image?url=${encodeURIComponent(insc.imagenUrl)}`;

        const response = await fetch(proxyUrl);

        if (!response.ok) {
          throw new Error(
            `Error del intermediario: ${response.status}`
          );
        }

        const bytes = await response.arrayBuffer();

        const logoImg = await embedImage(
          bytes,
          response.headers.get('content-type') || ''
        );

        drawLogoFit(
          logoImg,
          (width - 145) / 2,
          height - margin - 55,
          145,
          55
        );

        y = height - margin - 73;

        console.log('✅ Logo de carrera incorporado');

      } catch (error) {
        console.error('❌ ERROR AL CARGAR LOGO:', error);
      }
    }
  }

  // ==========================================
  // HELPER: CONTROL DE ESPACIO
  // ==========================================

  function ensureSpace(linesCount: number = 1) {
    const espacioNecesario = linesCount * lineHeight;

    // El límite coincide con el borde superior del bloque inferior
    // de patrocinadores, dejando un margen de seguridad.
    const limiteInferior = esAltata
      ? 175 + 30 + 12
      : margin;

    if (y - espacioNecesario < limiteInferior) {
      if (esAltata) {
        throw new Error(
          'El contenido de la carta Altata excede el espacio disponible. ' +
          'Se detuvo la generación para evitar cortar texto o invadir los logos.'
        );
      }

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

  y -= lineHeight * 1.7;

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

  y -= lineHeight * 1.7;

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

  y -= lineHeight;

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

  y -= lineHeight * 0.5;

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

  ensureSpace(exLines.length);

  for (const line of exLines) {
    page.drawText(line, {
      x: margin,
      y,
      font: normalFont,
      size: fontSize,
    });

    y -= lineHeight;
  }

  y -= lineHeight * 0.7;

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

  y -= lineHeight * 0.5;

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

    y -= lineHeight * 1.3;
  }

  // ==========================================
  // 9. VALIDAR PÁGINAS Y ESPACIO
  // ==========================================

  console.log('📄 Páginas generadas:', doc.getPageCount());
  console.log('Espacio restante:', y);

  if (esAltata && doc.getPageCount() !== 1) {
    throw new Error(
      'La confirmación especial de Altata debe tener una sola página.'
    );
  }

  // ==========================================
  // 10. GUARDAR Y DESCARGAR PDF
  // ==========================================

  console.log('📄 Generando archivo PDF...');

  const pdfBytes = await doc.save();

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
