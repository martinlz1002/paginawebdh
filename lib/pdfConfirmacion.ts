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
  // 1) Crear documento
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]); // A4
  const { width, height } = page.getSize();

  // 2) Fuentes
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 3) Métricas
  const margin = 40;
  const lineHeight = 14;
  const maxWidth = width - margin * 2;

  // 4) Logo alargado y pequeño en esquina superior izquierda
  try {
    const logoBytes = await fetch('/mi-logo.png').then(r => r.arrayBuffer());
    const logoImg = await doc.embedPng(logoBytes);

    const logoWidth = 100;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;

    page.drawImage(logoImg, {
      x: margin,
      y: height - margin - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  } catch {}

  // 5) Título centrado
  const titleFontSize = 18;
  const subtitleFontSize = 14;
  const headerY = height - margin - 20;
  const headerText = 'Ha completado con éxito el registro en:';
  const headerWidth = fontBold.widthOfTextAtSize(headerText, titleFontSize);
  page.drawText(headerText, {
    x: (width - headerWidth) / 2,
    y: headerY,
    size: titleFontSize,
    font: fontBold,
  });

  const subtY = headerY - titleFontSize - 4;
  const subtText = insc.titulo;
  const subtWidth = fontBold.widthOfTextAtSize(subtText, subtitleFontSize);
  page.drawText(subtText, {
    x: (width - subtWidth) / 2,
    y: subtY,
    size: subtitleFontSize,
    font: fontBold,
  });

  // 6) Datos en negritas para variables
  let y = subtY - subtitleFontSize - 20;
  const drawField = (label: string, value: string) => {
    const labelWidth = font.widthOfTextAtSize(label + ': ', 12);
    page.drawText(label + ': ', {
      x: margin,
      y,
      size: 12,
      font,
    });
    page.drawText(value, {
      x: margin + labelWidth,
      y,
      size: 12,
      font: fontBold,
    });
    y -= lineHeight;
  };

  drawField('Nombre', `${insc.perfilNombre} ${insc.perfilApPaterno} ${insc.perfilApMaterno}`);
  drawField('Distancia', insc.distancia ?? '-');
  drawField('Categoría', insc.categoria);
  drawField('Número de competidor', (insc.competitorNumber ?? '-').toString());
  drawField('Ficha de Inscripción', insc.id);

  // 7) Exoneración (texto largo)
  const exoTitle = 'Exoneración de Responsabilidad:';
  page.drawText(exoTitle, {
    x: margin,
    y,
    size: 12,
    font: fontBold,
  });
  y -= lineHeight;

  const exoText = `Yo, por el solo hecho de firmar este documento, acepto cualquier y todos los riesgos y peligros que sobre mi persona recaigan en cuanto a mi participación en ${insc.titulo}, en adelante el "Evento". Por lo tanto, yo soy el único responsable de mi salud, cualquier consecuencia, accidente, perjuicios, deficiencias que puedan causar, de cualquier manera posible alteraciones a mi salud, integridad física o inclusive la muerte. Por esta razón libero de cualquier responsabilidad al respecto a la Empresa/Comité Organizador, sus directores, patrocinadores, accionistas, representantes, y renuncio a cualquier derecho o demanda al respecto. También reconozco y acepto que autorizo al Comité Organizador el uso de mi imagen y voz en relación con el Evento.`;
  const wrap = (text: string) => {
    const words = text.split(' ');
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, 12) < maxWidth) {
        line = test;
      } else {
        page.drawText(line, { x: margin, y, size: 12, font });
        y -= lineHeight;
        line = w;
      }
    }
    if (line) {
      page.drawText(line, { x: margin, y, size: 12, font });
      y -= lineHeight;
    }
  };
  wrap(exoText);

  // 8) Entrega de kits
  y -= lineHeight / 2;
  page.drawText('Entrega de Kits:', { x: margin, y, size: 12, font: fontBold });
  y -= lineHeight;
  drawField('Fecha', insc.kitFecha ?? 'Por definir');
  drawField('Lugar', insc.kitLugar ?? 'Por definir');
  drawField('Horario', insc.kitHorario ?? 'Por definir');

  // 9) Guardar y descargar
  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Confirmacion-${insc.id}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
