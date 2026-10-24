import { useEffect, useMemo, useState } from 'react';

import {
  collection,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';

import * as XLSX from 'xlsx';

import {
  Search,
  Trophy,
  MapPin,
  Phone,
  Calendar,
  User,
  Timer,
  X,
  Hash,
  Users,
  Mail,
  Globe
} from 'lucide-react';

import { db } from '@/lib/firebase';

export default function BusquedaCompetidor() {

  const [search, setSearch] = useState('');
  const [competidores, setCompetidores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [tituloEvento, setTituloEvento] = useState('');

  const [eventoExiste, setEventoExiste] = useState(false);

  const fieldIcons: Record<string, any> = {

    Estado: MapPin,

    Ciudad: MapPin,

    Celular: Phone,

    'Fecha Nac.': Calendar,

    Rama: User,

    Bib: Hash,

    EquipoName: Users,

    Email: Mail,

    Country: Globe

  };

  const fieldLabels: Record<string, string> = {

    Bib: 'Número',

    Participant: 'Nombre',

    RouteName: 'Ruta',

    CategoryName: 'Categoría',

    Ciudad: 'Ciudad',

    Estado: 'Estado',

    Rama: 'Rama',

    EquipoName: 'Equipo',

    Celular: 'Celular',

    Email: 'Email',

    Country: 'País',

    Municipio: 'Municipio',

    Ficha: 'Ficha',

    'Fecha Nac.': 'Fecha de nacimiento'

  };

  /*
   * ==========================================
   * NORMALIZAR TEXTO
   * ==========================================
   *
   * Convierte:
   *
   * "José Pérez"
   *
   * en:
   *
   * "jose perez"
   *
   * Esto permite buscar sin importar
   * mayúsculas o acentos.
   */

  const normalizeText = (value: any) => {

    return String(value ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  };

  /*
   * ==========================================
   * CARGAR EVENTO ACTIVO
   * ==========================================
   */

  useEffect(() => {

    const cargarEvento = async () => {

      try {

        setLoading(true);

        const activeRef = doc(
          db,
          'busquedaCompetidor',
          'active'
        );

        /*
         * Primero obtenemos la configuración
         * del evento.
         */

        const configSnap = await getDoc(activeRef);

        if (!configSnap.exists()) {

          setEventoExiste(false);

          setCompetidores([]);

          return;

        }

        const config = configSnap.data();

        setEventoExiste(true);

        setVisibleFields(
          config.fields || []
        );

        setLogoUrl(
          config.logoUrl || ''
        );

        setBannerUrl(
          config.bannerUrl || ''
        );

        setTituloEvento(
          config.tituloEvento || ''
        );

        /*
         * ======================================
         * CARGAR COMPETIDORES
         * ======================================
         */

        const competidoresRef = collection(
          activeRef,
          'competidores'
        );

        const snapshot = await getDocs(
          competidoresRef
        );

        const data = snapshot.docs.map(
          (documento) => ({

            id: documento.id,

            ...documento.data()

          })
        );

        setCompetidores(data);

      } catch (error) {

        console.error(
          'Error cargando evento:',
          error
        );

        setEventoExiste(false);

        setCompetidores([]);

      } finally {

        setLoading(false);

      }

    };

    cargarEvento();

  }, []);

  /*
   * ==========================================
   * BUSCADOR
   * ==========================================
   *
   * La búsqueda se realiza sobre TODOS
   * los campos disponibles del competidor.
   *
   * Ejemplos:
   *
   * Juan
   * 254
   * Pérez
   * Venados
   * 123456
   * Monterrey
   * etc.
   */

  const results = useMemo(() => {

    const texto = normalizeText(search);

    /*
     * Si no hay búsqueda,
     * no mostramos resultados.
     */

    if (!texto) {

      return [];

    }

    /*
     * Permite búsquedas como:
     *
     * "juan perez"
     *
     * Las dos palabras tienen que aparecer
     * dentro del registro.
     */

    const palabras = texto
      .split(/\s+/)
      .filter(Boolean);

    const resultados = competidores.filter(
      (competidor) => {

        /*
         * Convertimos todos los valores
         * del competidor en texto.
         */

        const valores = Object.entries(
          competidor
        )
          .filter(([key]) => key !== 'id')
          .map(([, value]) =>
            normalizeText(value)
          )
          .filter(Boolean);

        const textoCompleto =
          valores.join(' ');

        /*
         * Cada palabra buscada debe aparecer
         * en algún lugar del registro.
         */

        return palabras.every(
          (palabra) =>
            textoCompleto.includes(palabra)
        );

      }
    );

    /*
     * Evitamos mostrar cientos de resultados
     * de golpe.
     */

    return resultados.slice(0, 20);

  }, [search, competidores]);

  /*
   * ==========================================
   * FORMATEAR VALORES
   * ==========================================
   */

  const formatValue = (
    field: string,
    value: any
  ) => {

    /*
     * Convertir fechas de Excel.
     */

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
      value ?? '-'
    );

  };

  /*
   * ==========================================
   * PANTALLA DE CARGA
   * ==========================================
   */

  if (loading) {

    return (

      <div className="
        min-h-screen
        bg-dh-bg
        text-white
        p-6
      ">

        <div className="
          max-w-6xl
          mx-auto
        ">

          <div className="
            h-72
            rounded-3xl
            bg-white/[0.03]
            border
            border-white/10
            animate-pulse
          " />

        </div>

      </div>

    );

  }

  /*
   * ==========================================
   * NO HAY EVENTO PUBLICADO
   * ==========================================
   */

  if (!eventoExiste) {

    return (

      <div className="
        min-h-screen
        bg-dh-bg
        text-white
        flex
        items-center
        justify-center
        p-6
      ">

        <div className="
          max-w-lg
          w-full
          text-center
          bg-dh-panel
          border
          border-white/10
          rounded-3xl
          p-10
        ">

          <div className="
            text-6xl
            mb-5
          ">
            🏁
          </div>

          <h1 className="
            text-3xl
            font-black
            mb-3
          ">
            Evento no disponible
          </h1>

          <p className="
            text-dh-muted
            leading-relaxed
          ">
            Actualmente no hay ningún evento
            publicado para consulta.
          </p>

        </div>

      </div>

    );

  }

  /*
   * ==========================================
   * PÁGINA PÚBLICA
   * ==========================================
   */

  return (

    <div className="
      min-h-screen
      bg-dh-bg
      text-white
      p-6
    ">

      <div className="
        max-w-6xl
        mx-auto
      ">

        {/* ================================== */}
        {/* BANNER */}
        {/* ================================== */}

        {bannerUrl ? (

          <div className="
            relative
            mb-10
            overflow-hidden
            rounded-3xl
            border
            border-white/10
            shadow-[0_0_60px_rgba(139,92,246,0.15)]
          ">

            <img
              src={bannerUrl}
              alt="Banner del evento"
              className="
                w-full
                h-[260px]
                object-cover
              "
            />

            <div className="
              absolute
              inset-0
              bg-black/50
            " />

            <div className="
              absolute
              inset-0
              flex
              flex-col
              items-center
              justify-center
              text-center
              p-6
            ">

              {logoUrl && (

                <img
                  src={logoUrl}
                  alt="Logo del evento"
                  className="
                    w-28
                    h-28
                    object-contain
                    rounded-2xl
                    bg-white/10
                    backdrop-blur-md
                    p-2
                    mb-4
                  "
                />

              )}

              <h1 className="
                text-4xl
                md:text-5xl
                font-black
                text-white
              ">

                {tituloEvento ||
                  'Buscar Competidor'}

              </h1>

              <p className="
                text-white/80
                mt-3
                max-w-2xl
              ">

                Consulta tu información
                de inscripción, número
                y categoría oficial
                del evento.

              </p>

            </div>

          </div>

        ) : (

          /*
           * Si no existe banner,
           * mostramos solamente el logo
           * y el título.
           */

          <div className="
            mb-10
            text-center
            py-10
          ">

            {logoUrl && (

              <img
                src={logoUrl}
                alt="Logo del evento"
                className="
                  w-24
                  h-24
                  object-contain
                  mx-auto
                  mb-5
                  rounded-2xl
                "
              />

            )}

            <h1 className="
              text-4xl
              md:text-5xl
              font-black
            ">

              {tituloEvento ||
                'Buscar Competidor'}

            </h1>

          </div>

        )}

        {/* ================================== */}
        {/* BUSCADOR */}
        {/* ================================== */}

        <div className="
          relative
          mb-6
        ">

          <Search
            className="
              absolute
              left-5
              top-1/2
              -translate-y-1/2
              text-white/40
              w-5
              h-5
              pointer-events-none
            "
          />

          <input
            type="text"
            placeholder="
              Buscar por nombre, número, ficha, equipo...
            "
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="
              w-full
              pl-14
              pr-14
              py-5
              text-lg
              rounded-2xl
              bg-white/[0.03]
              border
              border-white/10
              backdrop-blur-xl
              outline-none
              transition-all
              duration-300
              focus:border-dh-purple
              focus:ring-4
              focus:ring-dh-purple/20
              hover:border-white/20
              shadow-[0_0_40px_rgba(0,0,0,0.25)]
            "
          />

          {search && (

            <button
              type="button"
              onClick={() => setSearch('')}
              className="
                absolute
                right-4
                top-1/2
                -translate-y-1/2
                p-2
                rounded-xl
                text-white/50
                hover:text-white
                hover:bg-white/10
                transition
              "
              aria-label="Limpiar búsqueda"
            >

              <X className="
                w-5
                h-5
              " />

            </button>

          )}

        </div>

        {/* ================================== */}
        {/* AYUDA */}
        {/* ================================== */}

        {!search && (

          <div className="
            text-center
            py-8
            text-dh-muted
          ">

            <Search className="
              w-8
              h-8
              mx-auto
              mb-3
              opacity-40
            " />

            <p>
              Escribe el nombre, número,
              ficha o equipo del competidor.
            </p>

          </div>

        )}

        {/* ================================== */}
        {/* CONTADOR */}
        {/* ================================== */}

        {search && (

          <div className="
            flex
            items-center
            justify-between
            mb-5
            px-1
          ">

            <p className="
              text-sm
              text-dh-muted
            ">

              {results.length > 0
                ? `${results.length} resultado${results.length === 1 ? '' : 's'}`
                : 'Sin resultados'}

            </p>

          </div>

        )}

        {/* ================================== */}
        {/* SIN RESULTADOS */}
        {/* ================================== */}

        {search &&
          results.length === 0 && (

            <div className="
              text-center
              py-20
              border
              border-dashed
              border-white/10
              rounded-3xl
              bg-white/[0.02]
            ">

              <div className="
                text-6xl
                mb-4
              ">
                🏃
              </div>

              <h3 className="
                text-2xl
                font-bold
                mb-2
              ">
                Sin resultados
              </h3>

              <p className="
                text-dh-muted
              ">

                No encontramos competidores
                con esa búsqueda.

              </p>

            </div>

          )}

        {/* ================================== */}
        {/* RESULTADOS */}
        {/* ================================== */}

        <div className="
          space-y-4
        ">

          {results.map((competidor) => (

            <div
              key={competidor.id}
              className="
                bg-dh-panel
                border
                border-white/10
                rounded-3xl
                px-5
                py-5
                hover:border-dh-purple/50
                hover:-translate-y-1
                hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]
                transition
              "
            >

              {/* ============================ */}
              {/* DATOS PRINCIPALES */}
              {/* ============================ */}

              <div className="
                flex
                flex-col
                md:flex-row
                md:items-center
                md:justify-between
                gap-4
              ">

                <div>

                  <div className="
                    text-dh-purple
                    text-2xl
                    font-black
                    leading-none
                    mb-2
                  ">

                    #{competidor.Bib || '---'}

                  </div>

                  <h2 className="
                    text-xl
                    tracking-tight
                    font-black
                    leading-tight
                  ">

                    {competidor.Participant ||
                      'Competidor'}

                  </h2>

                </div>

                {/* ========================== */}
                {/* RUTA / CATEGORÍA */}
                {/* ========================== */}

                <div className="
                  flex
                  flex-wrap
                  gap-2
                ">

                  {competidor.RouteName && (

                    <div className="
                      flex
                      items-center
                      gap-2
                      px-3
                      py-1.5
                      rounded-xl
                      bg-dh-purple/20
                      backdrop-blur-md
                      text-dh-purple
                      text-sm
                      font-bold
                    ">

                      <Timer className="
                        w-4
                        h-4
                      " />

                      {competidor.RouteName}

                    </div>

                  )}

                  {competidor.CategoryName && (

                    <div className="
                      flex
                      items-center
                      gap-2
                      px-3
                      py-1.5
                      rounded-xl
                      bg-white/5
                      backdrop-blur-md
                      border
                      border-white/10
                      text-sm
                      font-semibold
                    ">

                      <Trophy className="
                        w-4
                        h-4
                      " />

                      {competidor.CategoryName}

                    </div>

                  )}

                </div>

              </div>

              {/* ============================ */}
              {/* CAMPOS ADICIONALES */}
              {/* ============================ */}

              <div className="
                flex
                flex-wrap
                gap-x-6
                gap-y-2
                mt-5
                text-sm
              ">

                {visibleFields
                  .filter((field) =>
                    ![
                      'Participant',
                      'Bib',
                      'RouteName',
                      'CategoryName'
                    ].includes(field)
                  )
                  .map((field) => {

                    const Icon =
                      fieldIcons[field];

                    return (

                      <div
                        key={field}
                        className="
                          flex
                          items-center
                          gap-2
                          bg-white/[0.03]
                          border
                          border-white/5
                          px-3
                          py-2
                          rounded-xl
                        "
                      >

                        {Icon && (

                          <Icon className="
                            w-4
                            h-4
                            text-dh-purple
                          " />

                        )}

                        <span className="
                          text-dh-muted
                          text-xs
                        ">

                          {fieldLabels[field] ||
                            field}:

                        </span>

                        <span className="
                          font-semibold
                        ">

                          {formatValue(
                            field,
                            competidor[field]
                          )}

                        </span>

                      </div>

                    );

                  })}

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>

  );

}