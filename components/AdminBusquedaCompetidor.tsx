import React, { useState } from 'react';
import * as XLSX from 'xlsx';

import {
  collection,
  doc,
  getDocs,
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
  Bib: 'Número',
  Participant: 'Nombre',
  Rama: 'Rama',
  RouteName: 'Ruta',
  CategoryName: 'Categoría',
  Country: 'País',
  Estado: 'Estado',
  Ciudad: 'Ciudad',
  Municipio: 'Municipio',
  Celular: 'Celular',
  EquipoName: 'Equipo',
  'Fecha Nac.': 'Fecha de nacimiento',
  Email: 'Email',
  Ficha: 'Ficha'
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

  const [publishedUrl, setPublishedUrl] = useState('');

  /*
   * ==========================================
   * CAMPOS
   * ==========================================
   */

  const toggleField = (field: string) => {

    setSelectedFields((prev) => {

      if (prev.includes(field)) {

        return prev.filter(
          (f) => f !== field
        );

      }

      return [...prev, field];

    });

  };

  /*
   * ==========================================
   * FORMATEAR VALORES
   * ==========================================
   */

  const formatValue = (
    field: string,
    value: any
  ) => {

    if (
      field === 'Fecha Nac.' &&
      typeof value === 'number'
    ) {

      const excelDate =
        XLSX.SSF.parse_date_code(value);

      if (excelDate) {

        const day = String(
          excelDate.d
        ).padStart(2, '0');

        const month = String(
          excelDate.m
        ).padStart(2, '0');

        const year = excelDate.y;

        return `${day}/${month}/${year}`;

      }

    }

    return String(
      value ?? ''
    );

  };

  /*
   * ==========================================
   * PUBLICAR EVENTO
   * ==========================================
   */

  const handlePublish = async () => {

    if (!selectedCarrera) {

      alert(
        'Selecciona una carrera'
      );

      return;

    }

    if (excelData.length === 0) {

      alert(
        'Carga un Excel'
      );

      return;

    }

    if (selectedFields.length === 0) {

      alert(
        'Selecciona al menos un campo visible'
      );

      return;

    }

    try {

      setPublishing(true);

      setPublishedUrl('');

      /*
       * ======================================
       * DOCUMENTO PRINCIPAL
       * ======================================
       */

      const activeRef = doc(
        db,
        'busquedaCompetidor',
        'active'
      );

      /*
       * ======================================
       * SUBIR LOGO
       * ======================================
       */

      let logoUrl = '';

      if (logoFile) {

        const logoRef = ref(
          storage,
          `busquedaCompetidor/logo-${Date.now()}-${logoFile.name}`
        );

        await uploadBytes(
          logoRef,
          logoFile
        );

        logoUrl =
          await getDownloadURL(
            logoRef
          );

      }

      /*
       * ======================================
       * SUBIR BANNER
       * ======================================
       */

      let bannerUrl = '';

      if (bannerFile) {

        const bannerRef = ref(
          storage,
          `busquedaCompetidor/banner-${Date.now()}-${bannerFile.name}`
        );

        await uploadBytes(
          bannerRef,
          bannerFile
        );

        bannerUrl =
          await getDownloadURL(
            bannerRef
          );

      }

      /*
       * ======================================
       * ELIMINAR COMPETIDORES ANTERIORES
       * ======================================
       *
       * Esto es importante.
       *
       * Como usamos:
       *
       * busquedaCompetidor/active/competidores
       *
       * una nueva publicación debe reemplazar
       * la anterior.
       */

      const competidoresRef = collection(
        activeRef,
        'competidores'
      );

      const previousSnapshot =
        await getDocs(
          competidoresRef
        );

      /*
       * Firestore permite máximo 500
       * operaciones por batch.
       *
       * Usamos 400 para mantener margen.
       */

      const deleteChunkSize = 400;

      for (
        let i = 0;
        i < previousSnapshot.docs.length;
        i += deleteChunkSize
      ) {

        const chunk =
          previousSnapshot.docs.slice(
            i,
            i + deleteChunkSize
          );

        const deleteBatch =
          writeBatch(db);

        chunk.forEach(
          (competidorDoc) => {

            deleteBatch.delete(
              competidorDoc.ref
            );

          }
        );

        await deleteBatch.commit();

      }

      /*
       * ======================================
       * GUARDAR CONFIGURACIÓN
       * ======================================
       */

      const carrera =
        carreras.find(
          (c) =>
            c.id === selectedCarrera
        );

      await setDoc(
        activeRef,
        {
          carreraId: selectedCarrera,

          fields: selectedFields,

          totalCompetidores:
            excelData.length,

          logoUrl,

          bannerUrl,

          tituloEvento:
            carrera?.titulo || '',

          updatedAt:
            serverTimestamp()
        },
        {
          merge: true
        }
      );

      /*
       * ======================================
       * SUBIR COMPETIDORES
       * ======================================
       */

      const chunkSize = 400;

      for (
        let i = 0;
        i < excelData.length;
        i += chunkSize
      ) {

        const chunk =
          excelData.slice(
            i,
            i + chunkSize
          );

        const batch =
          writeBatch(db);

        chunk.forEach(
          (competidor) => {

            const compRef =
              doc(
                competidoresRef
              );

            /*
             * ================================
             * NOMBRE
             * ================================
             */

            const nombreCompleto =
              String(
                competidor.Participant ||
                ''
              )
                .toLowerCase()
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                )
                .trim();

            /*
             * ================================
             * DATOS DE BÚSQUEDA
             * ================================
             */

            const bib =
              String(
                competidor.Bib || ''
              )
                .toLowerCase()
                .trim();

            const celular =
              String(
                competidor.Celular || ''
              )
                .toLowerCase()
                .trim();

            const ficha =
              String(
                competidor.Ficha || ''
              )
                .toLowerCase()
                .trim();

            const equipo =
              String(
                competidor.EquipoName || ''
              )
                .toLowerCase()
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                )
                .trim();

            const ruta =
              String(
                competidor.RouteName || ''
              )
                .toLowerCase()
                .trim();

            const categoria =
              String(
                competidor.CategoryName || ''
              )
                .toLowerCase()
                .trim();

            const estado =
              String(
                competidor.Estado || ''
              )
                .toLowerCase()
                .trim();

            const ciudad =
              String(
                competidor.Ciudad || ''
              )
                .toLowerCase()
                .trim();

            /*
             * ================================
             * TÉRMINOS DE BÚSQUEDA
             * ================================
             */

            const palabrasNombre =
              nombreCompleto
                .split(/\s+/)
                .filter(Boolean);

            const searchTerms = [

              ...palabrasNombre,

              nombreCompleto,

              bib,

              celular,

              ficha,

              equipo,

              ruta,

              categoria,

              estado,

              ciudad

            ].filter(Boolean);

            /*
             * ================================
             * GUARDAR
             * ================================
             */

            batch.set(
              compRef,
              {
                ...competidor,

                participant_search:
                  nombreCompleto,

                search_terms:
                  searchTerms

              }
            );

          }
        );

        await batch.commit();

        console.log(
          `Chunk ${
            i / chunkSize + 1
          } subido`
        );

      }

      /*
       * ======================================
       * GENERAR LINK PÚBLICO
       * ======================================
       */

      const origin =
        typeof window !== 'undefined'
          ? window.location.origin
          : '';

      const publicUrl =
        `${origin}/buscar-competidor`;

      setPublishedUrl(
        publicUrl
      );

      /*
       * ======================================
       * MENSAJE FINAL
       * ======================================
       */

      alert(
        'Evento publicado correctamente'
      );

    } catch (error) {

      console.error(
        'Error publicando evento:',
        error
      );

      alert(
        'Error publicando el evento'
      );

    } finally {

      setPublishing(false);

    }

  };

  /*
   * ==========================================
   * CARGAR EXCEL
   * ==========================================
   */

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {

    const file =
      e.target.files?.[0];

    if (!file) return;

    try {

      const data =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(data);

      const sheetName =
        workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[
          sheetName
        ];

      const jsonData =
        XLSX.utils.sheet_to_json(
          worksheet
        );

      setExcelData(
        jsonData
      );

      if (
        jsonData.length > 0
      ) {

        const detectedColumns =
          Object.keys(
            jsonData[0] as any
          );

        /*
         * Orden preferido
         */

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

          'Email',

          'Ficha'

        ];

        const sortedColumns = [

          ...preferredOrder.filter(
            (field) =>
              detectedColumns.includes(
                field
              )
          ),

          ...detectedColumns.filter(
            (field) =>
              !preferredOrder.includes(
                field
              )
          )

        ];

        setColumns(
          sortedColumns
        );

        /*
         * Seleccionar automáticamente
         * los campos principales.
         */

        setSelectedFields(

          preferredOrder.filter(
            (field) =>
              detectedColumns.includes(
                field
              )
          )

        );

      }

      console.log(
        jsonData
      );

    } catch (error) {

      console.error(
        'Error leyendo Excel:',
        error
      );

      alert(
        'Error leyendo archivo Excel'
      );

    }

  };

  /*
   * ==========================================
   * COLUMNAS DEL PREVIEW
   * ==========================================
   */

  const previewColumns =
    columns.filter(
      (col) =>
        selectedFields.includes(
          col
        )
    );

  /*
   * ==========================================
   * RENDER
   * ==========================================
   */

  return (

    <div className="
      space-y-6
    ">

      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <div>

        <h2 className="
          text-3xl
          font-black
        ">

          Buscar Competidor

        </h2>

        <p className="
          text-dh-muted
          mt-2
        ">

          Configura el evento activo
          para búsqueda pública.

        </p>

      </div>

      {/* ================================== */}
      {/* CONFIGURACIÓN */}
      {/* ================================== */}

      <div className="
        bg-dh-panel
        border
        border-dh-border
        rounded-3xl
        p-6
        space-y-6
      ">

        {/* CARRERA */}

        <div>

          <label className="
            block
            text-sm
            font-semibold
            mb-2
          ">

            Carrera

          </label>

          <select
            value={selectedCarrera}
            onChange={(e) =>
              setSelectedCarrera(
                e.target.value
              )
            }
            className="
              w-full
              px-4
              py-3
              select-dark
            "
          >

            <option value="">
              Selecciona una carrera
            </option>

            {carreras.map(
              (c) => (

                <option
                  key={c.id}
                  value={c.id}
                >

                  {c.titulo}

                </option>

              )
            )}

          </select>

        </div>

        {/* EXCEL */}

        <div>

          <label className="
            block
            text-sm
            font-semibold
            mb-2
          ">

            Archivo Excel

          </label>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={
              handleFileUpload
            }
            className="
              w-full
              px-4
              py-3
            "
          />

        </div>

      </div>

      {/* ================================== */}
      {/* LOGO */}
      {/* ================================== */}

      <div>

        <label className="
          block
          text-sm
          font-semibold
          mb-2
        ">

          Logo del evento

        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setLogoFile(
              e.target.files?.[0] ||
              null
            )
          }
          className="
            w-full
            px-4
            py-3
          "
        />

      </div>

      {/* ================================== */}
      {/* BANNER */}
      {/* ================================== */}

      <div>

        <label className="
          block
          text-sm
          font-semibold
          mb-2
        ">

          Banner del evento

        </label>

        <input
          type="file"
          accept="image/*"
          onChange={(e) =>
            setBannerFile(
              e.target.files?.[0] ||
              null
            )
          }
          className="
            w-full
            px-4
            py-3
          "
        />

      </div>

      {/* ================================== */}
      {/* PREVIEW EXCEL */}
      {/* ================================== */}

      {excelData.length > 0 && (

        <div className="
          bg-dh-panel
          border
          border-dh-border
          rounded-3xl
          p-6
        ">

          <div className="
            flex
            items-center
            justify-between
            mb-6
          ">

            <div>

              <h3 className="
                text-xl
                font-bold
              ">

                Preview del Excel

              </h3>

              <p className="
                text-sm
                text-dh-muted
                mt-1
              ">

                Se detectaron{' '}
                {excelData.length}{' '}
                competidores

              </p>

            </div>

          </div>

          <div className="
            w-full
            overflow-x-auto
            rounded-2xl
            border
            border-white/10
          ">

            <table className="
              w-max
              min-w-full
              text-sm
            ">

              <thead className="
                bg-white/5
              ">

                <tr>

                  {previewColumns.map(
                    (col) => (

                      <th
                        key={col}
                        className="
                          px-4
                          py-3
                          text-left
                          font-semibold
                          whitespace-nowrap
                          max-w-[220px]
                        "
                      >

                        {
                          fieldLabels[
                            col
                          ] || col
                        }

                      </th>

                    )
                  )}

                </tr>

              </thead>

              <tbody>

                {excelData
                  .slice(0, 15)
                  .map(
                    (row, index) => (

                      <tr
                        key={index}
                        className="
                          border-t
                          border-white/5
                          hover:bg-white/5
                          transition
                        "
                      >

                        {previewColumns.map(
                          (col) => (

                            <td
                              key={col}
                              className="
                                px-4
                                py-3
                                text-white/90
                                max-w-[220px]
                                truncate
                              "
                            >

                              {formatValue(
                                col,
                                row[col]
                              )}

                            </td>

                          )
                        )}

                      </tr>

                    )
                  )}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {/* ================================== */}
      {/* CAMPOS VISIBLES */}
      {/* ================================== */}

      {columns.length > 0 && (

        <div className="
          bg-dh-panel
          border
          border-dh-border
          rounded-3xl
          p-6
        ">

          <div className="
            mb-5
          ">

            <h3 className="
              text-xl
              font-bold
            ">

              Campos visibles

            </h3>

            <p className="
              text-sm
              text-dh-muted
              mt-1
            ">

              Selecciona qué datos
              se mostrarán públicamente.

            </p>

          </div>

          <div className="
            overflow-x-auto
            pb-2
          ">

            <div className="
              flex
              flex-wrap
              gap-3
            ">

              {columns.map(
                (field) => {

                  const active =
                    selectedFields.includes(
                      field
                    );

                  return (

                    <button
                      type="button"
                      key={field}
                      onClick={() =>
                        toggleField(
                          field
                        )
                      }
                      className={`
                        px-4
                        py-3
                        rounded-2xl
                        border
                        text-sm
                        font-semibold
                        transition
                        whitespace-nowrap
                        ${
                          active
                            ? 'bg-dh-purple text-white border-dh-purple shadow-glowPurple'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                        }
                      `}
                    >

                      {active
                        ? '☑'
                        : '☐'}{' '}

                      {
                        fieldLabels[
                          field
                        ] || field
                      }

                    </button>

                  );

                }
              )}

            </div>

          </div>

          {/* ================================== */}
          {/* PUBLICAR */}
          {/* ================================== */}

          <div className="
            pt-6
            flex
            flex-col
            gap-5
          ">

            <div className="
              flex
              justify-end
            ">

              <button
                type="button"
                onClick={
                  handlePublish
                }
                disabled={
                  publishing
                }
                className="
                  btn-primary
                "
              >

                {publishing
                  ? 'Publicando...'
                  : 'Publicar Evento'}

              </button>

            </div>

            {/* ================================== */}
            {/* LINK PUBLICADO */}
            {/* ================================== */}

            {publishedUrl && (

              <div className="
                rounded-2xl
                border
                border-dh-purple/40
                bg-dh-purple/10
                p-5
              ">

                <div className="
                  mb-3
                ">

                  <h4 className="
                    text-lg
                    font-bold
                  ">

                    🎉 Evento publicado

                  </h4>

                  <p className="
                    text-sm
                    text-dh-muted
                    mt-1
                  ">

                    Comparte este enlace
                    para que los corredores
                    puedan buscar su información.

                  </p>

                </div>

                <div className="
                  flex
                  flex-col
                  md:flex-row
                  gap-3
                ">

                  <input
                    type="text"
                    readOnly
                    value={
                      publishedUrl
                    }
                    className="
                      flex-1
                      px-4
                      py-3
                      rounded-xl
                      bg-black/20
                      border
                      border-white/10
                      text-white/90
                      outline-none
                    "
                  />

                  <button
                    type="button"
                    onClick={async () => {

                      try {

                        await navigator.clipboard.writeText(
                          publishedUrl
                        );

                        alert(
                          'Enlace copiado'
                        );

                      } catch (error) {

                        console.error(
                          error
                        );

                        alert(
                          'No se pudo copiar el enlace'
                        );

                      }

                    }}
                    className="
                      px-5
                      py-3
                      rounded-xl
                      bg-white/10
                      border
                      border-white/10
                      hover:bg-white/15
                      transition
                      font-semibold
                    "
                  >

                    📋 Copiar enlace

                  </button>

                  <a
                    href={
                      publishedUrl
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      px-5
                      py-3
                      rounded-xl
                      bg-dh-purple
                      hover:bg-dh-purple/80
                      transition
                      font-semibold
                      text-center
                    "
                  >

                    Abrir página

                  </a>

                </div>

              </div>

            )}

          </div>

        </div>

      )}

    </div>

  );

}