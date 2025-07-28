import { PDFDocument, StandardFonts } from 'pdf-lib';

export interface InscView {
  id: string;
  titulo: string;
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
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const margin = 40;

  // Fuentes
  const normalFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont   = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontSize   = 12;
  const lineHeight = fontSize * 1.4;
  let y = height - margin;

  // Helper: ajusta y, y si es necesario crea nueva página
  function ensureSpace(linesCount: number = 1) {
    if (y - linesCount * lineHeight < margin) {
      page = doc.addPage([595, 842]);
      y = height - margin;
    }
  }

  // Helper: ajuste de texto por ancho
  function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  // 1) Logo
  try {
    const logoUrl    = '/mi-logo.png';
  const logoBytes  = await fetch(logoUrl).then(r => r.arrayBuffer());
  const logoImg    = await doc.embedPng(logoBytes);

  // Ancho y alto independientes
  const logoWidth  = 180;  // más ancho
  const logoHeight = 40;   // menos alto (aplanado)

  // Si tu variable `y` es la posición actual del cursor de texto,
  // mejor sitúa el logo respecto al top de la página:
  const logoY = height - margin - logoHeight;

  page.drawImage(logoImg, {
    x: margin,
    y: logoY,
    width:  logoWidth,
    height: logoHeight,
    });
  } catch {
    // si falla, seguimos sin logo
  }

  // 2) Encabezado centrado
  const header = 'Ha completado con éxito el registro';
  ensureSpace();
  let w = boldFont.widthOfTextAtSize(header, fontSize);
  page.drawText(header, {
    x: (width - w) / 2,
    y,
    font: boldFont,
    size: fontSize,
  });
  y -= lineHeight * 2.0;

  // 3) Subtítulo (título de la carrera) centrado
  const subtitle = insc.titulo;
  ensureSpace();
  w = boldFont.widthOfTextAtSize(subtitle, fontSize);
  page.drawText(subtitle, {
    x: (width - w) / 2,
    y,
    font: boldFont,
    size: fontSize,
  });
  y -= lineHeight * 2.0;

  // 4) Texto introductorio
  const intro = 'Favor de imprimir, firmar y llevar este comprobante al registro para recolectar su paquete.';
  const maxWidth = width - margin * 2;
  const introLines = wrapText(intro, normalFont, fontSize, maxWidth);
  ensureSpace(introLines.length);
  for (const line of introLines) {
    page.drawText(line, { x: margin, y, font: normalFont, size: fontSize });
    y -= lineHeight;
  }
  y -= lineHeight * 1.5;

  // Helper para campos etiqueta:valor
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
    });
    y -= lineHeight * 1.6;
  }

  // 5) Campos
  drawField('Nombre', ` ${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`);
  drawField('Distancia', insc.distancia || '-');
  drawField('Categoría', insc.categoria);
  drawField('Número de competidor', (insc.competitorNumber ?? '-').toString());
  drawField('Ficha de Inscripción', insc.id);

  y -= lineHeight * 1.0;

  // 6) Sección Exoneración
  ensureSpace();
  page.drawText('Exoneración de Responsabilidad', {
    x: margin,
    y,
    font: boldFont,
    size: fontSize,
  });
  y -= lineHeight;

  const exText = `Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi persona recaigan en cuanto a mi participación en ${insc.titulo}, en adelante el 'Evento'. Por lo tanto, yo soy el único responsable de mi salud, cualquier consecuencia, accidente, perjuicios o deficiencias que puedan [sic] causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte. Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus directores, patrocinadores, accionistas y representantes, y renuncio a cualquier derecho o demanda al respecto. También reconozco y acepto el uso de mi imagen y voz en relación con el Evento.`;

  const exLines = wrapText(exText, normalFont, fontSize, maxWidth);
  ensureSpace(exLines.length);
  for (const line of exLines) {
    page.drawText(line, { x: margin, y, font: normalFont, size: fontSize });
    y -= lineHeight;
  }
  y -= lineHeight * 1.0;

  // 7) Sección Entrega de kits
  ensureSpace();
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

  y -= lineHeight * 1.0;

  // 8) Sección Requisitos
  ensureSpace();
  page.drawText('Requisitos:', {
    x: margin,
    y,
    font: boldFont,
    size: fontSize,
  });
  y -= lineHeight;
  const reqs = ['Hoja de confirmación impresa', 'Identificación del corredor'];
  for (const r of reqs) {
    ensureSpace();
    page.drawText('• ' + r, { x: margin + 10, y, font: normalFont, size: fontSize });
    y -= lineHeight * 1.6;
  }

  // 9) Guardar y descargar
  const pdfBytes = await doc.save();
  const blob     = new Blob([pdfBytes], { type: 'application/pdf' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `Confirmacion-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}