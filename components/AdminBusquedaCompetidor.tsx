import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

import { db } from '@/lib/firebase';

import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';

import { storage } from '@/lib/firebase';

interface CarreraOption {
  id: string;
  titulo: string;
}

interface Props {
  carreras: CarreraOption[];
}

const fieldLabels: Record<string, string> = {
  Participant: 'Nombre',
  RouteName: 'Ruta',
  CategoryName: 'Categoría',
  EquipoName: 'Equipo',
  Country: 'País'
};

export default function AdminBusquedaCompetidor({
  carreras
}: Props) {

  const [selectedCarrera, setSelectedCarrera] = useState('');
  const [excelData, setExcelData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  const [logoFile, setLogoFile] = useState<File | null>(null);

const [bannerFile, setBannerFile] = useState<File | null>(null);


  const toggleField = (field: string) => {

  setSelectedFields((prev) => {

    if (prev.includes(field)) {
      return prev.filter((f) => f !== field);
    }

    return [...prev, field];

  });

};

const formatValue = (field: string, value: any) => {

  if (
    field === 'Fecha Nac.' &&
    typeof value === 'number'
  ) {

    const excelDate = XLSX.SSF.parse_date_code(value);

    if (excelDate) {

      const day = String(excelDate.d).padStart(2, '0');
      const month = String(excelDate.m).padStart(2, '0');
      const year = excelDate.y;

      return `${day}/${month}/${year}`;
    }
  }

  return String(value ?? '');
};

const handlePublish = async () => {

  if (!selectedCarrera) {
    alert('Selecciona una carrera');
    return;
  }

  if (excelData.length === 0) {
    alert('Carga un Excel');
    return;
  }

  try {

    setPublishing(true);

    // Documento principal
    const activeRef = doc(
      db,
      'busquedaCompetidor',
      'active'
    );

    let logoUrl = '';
let bannerUrl = '';

if (logoFile) {

  const logoRef = ref(
    storage,
    `busquedaCompetidor/logo-${Date.now()}`
  );

  if (bannerFile) {

  const bannerRef = ref(
    storage,
    `busquedaCompetidor/banner-${Date.now()}`
  );

  await uploadBytes(bannerRef, bannerFile);

  bannerUrl = await getDownloadURL(bannerRef);

}

  await uploadBytes(logoRef, logoFile);

  logoUrl = await getDownloadURL(logoRef);

}

    await setDoc(activeRef, {
      carreraId: selectedCarrera,
      fields: selectedFields,
      totalCompetidores: excelData.length,
      logoUrl,
    bannerUrl,
      updatedAt: serverTimestamp(),
      tituloEvento:
  carreras.find(
    (c) => c.id === selectedCarrera
  )?.titulo || '',
      
    });

    // Subcolección competidores
    const chunkSize = 400;

for (let i = 0; i < excelData.length; i += chunkSize) {

  const chunk = excelData.slice(i, i + chunkSize);

  const batch = writeBatch(db);

  chunk.forEach((competidor) => {

    const compRef = doc(
      collection(activeRef, 'competidores')
    );

    const nombre = String(
  competidor.Participant || ''
)
.toLowerCase()
.trim();

const nombreCompleto = String(
  competidor.Participant || ''
)
.toLowerCase()
.trim();

const palabrasNombre =
  nombreCompleto.split(' ');

const bib = String(
  competidor.Bib || ''
);

const celular = String(
  competidor.Celular || ''
);

const ficha = String(
  competidor.Ficha || ''
);

const equipo = String(
  competidor.EquipoName || ''
)
.toLowerCase();

const searchTerms = [

  ...palabrasNombre,

  nombreCompleto,

  bib,

  celular,

  ficha,

  equipo

].filter(Boolean);

batch.set(compRef, {

  ...competidor,

  participant_search: nombreCompleto,

  search_terms: searchTerms

});

  });

  await batch.commit();

  console.log(
    `Chunk ${i / chunkSize + 1} subido`
  );
}

    alert('Evento publicado');

  } catch (error) {

    console.error(error);

    alert('Error publicando');

  } finally {

    setPublishing(false);

  }
};

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {


    const file = e.target.files?.[0];

    if (!file) return;

    try {

      const data = await file.arrayBuffer();

      const workbook = XLSX.read(data);

      const sheetName = workbook.SheetNames[0];

      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      setExcelData(jsonData);

      if (jsonData.length > 0) {

  const detectedColumns = Object.keys(jsonData[0] as any);


  const preferredOrder = [
  'Bib',
  'Participant',
  'Rama',
  'RouteName',
  'CategoryName',
  'Country',
  'Estado',
  'Ciudad',
  'Municipio',
  'Celular',
  'EquipoName',
  'Fecha Nac.',
  'Email'
];

const sortedColumns = [
  ...preferredOrder.filter((field) =>
    detectedColumns.includes(field)
  ),

  ...detectedColumns.filter(
    (field) => !preferredOrder.includes(field)
  )
];

setColumns(sortedColumns);

setSelectedFields(
  preferredOrder.filter((field) =>
    detectedColumns.includes(field)
  )
);

}

      console.log(jsonData);

    } catch (error) {

      console.error(error);

      alert('Error leyendo archivo Excel');

    }
  };

  const previewColumns = columns.filter((col) =>
  selectedFields.includes(col)
);

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="text-3xl font-black">
          Buscar Competidor
        </h2>

        <p className="text-dh-muted mt-2">
          Configura el evento activo para búsqueda pública.
        </p>
      </div>

      {/* CONFIG */}
      <div className="bg-dh-panel border border-dh-border rounded-3xl p-6 space-y-6">

        {/* CARRERA */}
        <div>

          <label className="block text-sm font-semibold mb-2">
            Carrera
          </label>

          <select
            value={selectedCarrera}
            onChange={(e) => setSelectedCarrera(e.target.value)}
            className="w-full px-4 py-3 select-dark"
          >

            <option value="">
              Selecciona una carrera
            </option>

            {carreras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}

          </select>

        </div>

        {/* EXCEL */}
        <div>

          <label className="block text-sm font-semibold mb-2">
            Archivo Excel
          </label>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="w-full px-4 py-3"
          />

        </div>

      </div>


{/* LOGO */}
      <div>

  <label className="block text-sm font-semibold mb-2">
    Logo del evento
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) =>
      setLogoFile(e.target.files?.[0] || null)
    }
    className="w-full px-4 py-3"
  />

</div>


{/* BANNER */}
<div>

  <label className="block text-sm font-semibold mb-2">
    Banner del evento
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) =>
      setBannerFile(e.target.files?.[0] || null)
    }
    className="w-full px-4 py-3"
  />

</div>

      {/* PREVIEW */}
      {excelData.length > 0 && (

        <div className="bg-dh-panel border border-dh-border rounded-3xl p-6">

          <div className="flex items-center justify-between mb-6">

            <div>
              <h3 className="text-xl font-bold">
                Preview del Excel
              </h3>

              <p className="text-sm text-dh-muted mt-1">
                Se detectaron {excelData.length} competidores
              </p>
            </div>

          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-white/10">

            <table className="w-max min-w-full text-sm">

              <thead className="bg-white/5">

                <tr>

                  {previewColumns.map((col) => (
                    <th
                      key={fieldLabels[col] || col}
                      className="px-4 py-3 text-left font-semibold whitespace-nowrap max-w-[220px]"
                    >
                      {fieldLabels[col] || col}
                    </th>
                  ))}

                </tr>

              </thead>

              <tbody>

                {excelData.slice(0, 15).map((row, index) => (

                  <tr
                    key={index}
                    className="border-t border-white/5 hover:bg-white/5 transition"
                  >

                    {previewColumns.map((col) => (

                      <td
                        key={fieldLabels[col] || col}
                        className="px-4 py-3 text-white/90 max-w-[220px] truncate"
                      >
                        {formatValue(col, row[col])}
                      </td>

                    ))}

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {columns.length > 0 && (

  <div className="bg-dh-panel border border-dh-border rounded-3xl p-6">

    <div className="mb-5">

      <h3 className="text-xl font-bold">
        Campos visibles
      </h3>

      <p className="text-sm text-dh-muted mt-1">
        Selecciona qué datos se mostrarán públicamente.
      </p>

    </div>

    <div className="overflow-x-auto pb-2">

  <div className="flex flex-wrap gap-3">

      {columns.map((field) => {

        const active = selectedFields.includes(field);

        return (

          <button
            key={field}
            onClick={() => toggleField(field)}
            className={`
  px-4 py-3 rounded-2xl border text-sm font-semibold transition whitespace-nowrap
  ${
    active
      ? 'bg-dh-purple text-white border-dh-purple shadow-glowPurple'
      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
  }
`}
          >
            {active ? '☑' : '☐'} {fieldLabels[field] || field}
          </button>

        );

      })}

    </div>

    <div className="pt-6 flex justify-end">

  <button
    onClick={handlePublish}
    disabled={publishing}
    className="btn-primary"
  >
    {publishing
      ? 'Publicando...'
      : 'Publicar Evento'}
  </button>

</div>

  </div>

</div>
)}

    </div>
  );
}