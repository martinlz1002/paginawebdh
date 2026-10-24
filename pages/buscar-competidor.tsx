import { useEffect, useState } from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import * as XLSX from "xlsx";

import {
  Search,
  Trophy,
  MapPin,
  Phone,
  Calendar,
  User,
  Timer,
  Users,
  Hash,
  Mail,
  Globe,
  Flag,
} from "lucide-react";

import { db } from "@/lib/firebase";


interface Competidor {
  id: string;
  Participant?: string;
  Bib?: string | number;
  RouteName?: string;
  CategoryName?: string;
  Ciudad?: string;
  Estado?: string;
  Rama?: string;
  EquipoName?: string;
  Celular?: string;
  Email?: string;
  Country?: string;
  [key: string]: any;
}

export default function BuscarCompetidor() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [results, setResults] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [tituloEvento, setTituloEvento] = useState("");

  const [eventExists, setEventExists] = useState(true);

  /*
   * ==========================================
   * ICONOS
   * ==========================================
   */

  const fieldIcons: Record<string, any> = {
    Estado: MapPin,
    Ciudad: MapPin,
    Municipio: MapPin,
    Celular: Phone,
    "Fecha Nac.": Calendar,
    Rama: User,
    EquipoName: Users,
    Email: Mail,
    Country: Globe,
    Ficha: Hash,
    Bib: Hash,
    RouteName: Timer,
    CategoryName: Trophy,
  };

  /*
   * ==========================================
   * LABELS
   * ==========================================
   */

  const fieldLabels: Record<string, string> = {
    Bib: "Número",
    Participant: "Nombre",
    RouteName: "Ruta",
    CategoryName: "Categoría",
    Ciudad: "Ciudad",
    Estado: "Estado",
    Municipio: "Municipio",
    Rama: "Rama",
    EquipoName: "Equipo",
    Celular: "Celular",
    Email: "Email",
    Country: "País",
    Ficha: "Ficha",
    "Fecha Nac.": "Fecha de nacimiento",
  };

  /*
   * ==========================================
   * NORMALIZAR TEXTO
   * ==========================================
   *
   * Quita acentos y convierte todo a minúsculas.
   *
   * Ejemplo:
   *
   * "José Pérez"
   *
   * se convierte en:
   *
   * "jose perez"
   *
   */

  const normalizeText = (value: any) => {
    return String(value ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  };

  /*
   * ==========================================
   * DEBOUNCE
   * ==========================================
   */

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 350);

    return () => clearTimeout(timer);
  }, [search]);

  /*
   * ==========================================
   * CARGAR CONFIGURACIÓN DEL EVENTO
   * ==========================================
   */

  useEffect(() => {
    const cargarConfiguracion = async () => {
      try {
        setLoadingConfig(true);

        const ref = doc(
          db,
          "busquedaCompetidor",
          "active"
        );

        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setEventExists(false);
          return;
        }

        const data = snap.data();

        setEventExists(true);

        setVisibleFields(
          Array.isArray(data.fields)
            ? data.fields
            : []
        );

        setLogoUrl(
          data.logoUrl || ""
        );

        setBannerUrl(
          data.bannerUrl || ""
        );

        setTituloEvento(
          data.tituloEvento || ""
        );

      } catch (error) {
        console.error(
          "Error cargando configuración:",
          error
        );

        setEventExists(false);

      } finally {
        setLoadingConfig(false);
      }
    };

    cargarConfiguracion();
  }, []);

   // Buscar competidores
useEffect(() => {

  let cancelado = false;

  const buscar = async () => {

    const texto = debouncedSearch
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .replace(/\s+/g, ' ');

    // No buscar con menos de 2 caracteres
    if (texto.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    /*
     * Separamos la búsqueda en palabras.
     *
     * "jose pill"
     *
     * se convierte en:
     *
     * ["jose", "pill"]
     */
    const palabras = Array.from(
      new Set(
        texto
          .split(/\s+/)
          .filter(
            (palabra) =>
              palabra.length >= 2
          )
      )
    );

    if (palabras.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    try {

      setLoading(true);

      const competidoresRef = collection(
        db,
        'busquedaCompetidor',
        'active',
        'competidores'
      );

      /*
       * ========================================
       * BUSCAR CADA PALABRA
       * ========================================
       *
       * Firestore busca cada prefijo dentro
       * de search_terms.
       *
       * Por ejemplo:
       *
       * "pill"
       *
       * encuentra:
       *
       * "pill"
       *
       * porque el Admin ahora genera los
       * prefijos de "pillado".
       */

      const resultadosPorPalabra =
        await Promise.all(
          palabras.map(async (palabra) => {

            const q = query(
              competidoresRef,

              where(
                'search_terms',
                'array-contains',
                palabra
              ),

              limit(150)
            );

            const snapshot =
              await getDocs(q);

            return snapshot.docs.map(
              (document) => ({
                id: document.id,
                ...document.data()
              })
            );

          })
        );

      if (cancelado) return;

      /*
       * ========================================
       * UNIR RESULTADOS
       * ========================================
       */

      const mapa =
        new Map<string, any>();

      resultadosPorPalabra.forEach(
        (grupo) => {

          grupo.forEach(
            (competidor) => {

              mapa.set(
                competidor.id,
                competidor
              );

            }
          );

        }
      );

      const candidatos =
        Array.from(mapa.values());

      /*
       * ========================================
       * FILTRAR
       * ========================================
       *
       * Todas las palabras escritas por el
       * usuario deben coincidir.
       *
       * Ejemplo:
       *
       * "jose pill"
       *
       * debe encontrar:
       *
       * "JOSE ANGEL PILLADO LIPAROLI"
       */

      const resultadosFiltrados =
        candidatos.filter(
          (competidor) => {

            const participante =
              String(
                competidor.Participant ?? ''
              )
                .toLowerCase()
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                );

            const searchTerms =
              Array.isArray(
                competidor.search_terms
              )
                ? competidor.search_terms
                    .map(
                      (term: any) =>
                        String(term)
                          .toLowerCase()
                          .normalize('NFD')
                          .replace(
                            /[\u0300-\u036f]/g,
                            ''
                          )
                    )
                : [];

            const valores = [
              participante,
              ...searchTerms
            ];

            /*
             * Cada palabra de la búsqueda
             * debe encontrarse en al menos
             * un valor.
             */

            return palabras.every(
              (palabra) =>
                valores.some(
                  (valor) =>
                    valor.includes(
                      palabra
                    )
                )
            );

          }
        );

      /*
       * ========================================
       * ORDENAR POR RELEVANCIA
       * ========================================
       */

      const resultadosOrdenados =
        [...resultadosFiltrados].sort(
          (a, b) => {

            const nombreA =
              String(
                a.Participant ?? ''
              )
                .toLowerCase()
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                );

            const nombreB =
              String(
                b.Participant ?? ''
              )
                .toLowerCase()
                .normalize('NFD')
                .replace(
                  /[\u0300-\u036f]/g,
                  ''
                );

            let scoreA = 0;
            let scoreB = 0;

            palabras.forEach(
              (palabra) => {

                /*
                 * Coincidencia exacta
                 */
                if (
                  nombreA === palabra
                ) {
                  scoreA += 1000;
                }

                if (
                  nombreB === palabra
                ) {
                  scoreB += 1000;
                }

                /*
                 * El nombre comienza con
                 * la palabra.
                 */
                if (
                  nombreA.startsWith(
                    palabra
                  )
                ) {
                  scoreA += 200;
                }

                if (
                  nombreB.startsWith(
                    palabra
                  )
                ) {
                  scoreB += 200;
                }

                /*
                 * La palabra aparece dentro
                 * del nombre.
                 */
                if (
                  nombreA.includes(
                    palabra
                  )
                ) {
                  scoreA += 50;
                }

                if (
                  nombreB.includes(
                    palabra
                  )
                ) {
                  scoreB += 50;
                }

              }
            );

            /*
             * Si toda la búsqueda coincide
             * con el comienzo del nombre,
             * darle prioridad.
             */

            if (
              nombreA.startsWith(texto)
            ) {
              scoreA += 500;
            }

            if (
              nombreB.startsWith(texto)
            ) {
              scoreB += 500;
            }

            if (scoreA !== scoreB) {
              return scoreB - scoreA;
            }

            return nombreA.localeCompare(
              nombreB,
              'es',
              {
                sensitivity: 'base'
              }
            );

          }
        );

      if (cancelado) return;

      /*
       * Mostrar máximo 20 resultados.
       */

      setResults(
        resultadosOrdenados.slice(
          0,
          20
        )
      );

    } catch (error) {

      console.error(
        'Error buscando competidor:',
        error
      );

      if (!cancelado) {
        setResults([]);
      }

    } finally {

      if (!cancelado) {
        setLoading(false);
      }

    }

  };

  buscar();

  /*
   * Si el usuario escribe otra cosa antes
   * de que termine la consulta anterior,
   * esa consulta anterior ya no podrá
   * modificar los resultados.
   */

  return () => {
    cancelado = true;
  };

}, [debouncedSearch]);

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
      field === "Fecha Nac." &&
      typeof value === "number"
    ) {
      const excelDate =
        XLSX.SSF.parse_date_code(
          value
        );

      if (excelDate) {

        const day =
          String(
            excelDate.d
          ).padStart(2, "0");

        const month =
          String(
            excelDate.m
          ).padStart(2, "0");

        const year =
          excelDate.y;

        return `${day}/${month}/${year}`;
      }
    }

    return String(
      value ?? "-"
    );
  };

  /*
   * ==========================================
   * LIMPIAR BÚSQUEDA
   * ==========================================
   */

  const limpiarBusqueda = () => {
    setSearch("");
    setDebouncedSearch("");
    setResults([]);
  };

  /*
   * ==========================================
   * LOADING CONFIGURACIÓN
   * ==========================================
   */

  if (loadingConfig) {
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
          text-center
        ">

          <div className="
            w-12
            h-12
            mx-auto
            mb-5
            rounded-full
            border-4
            border-white/10
            border-t-dh-purple
            animate-spin
          " />

          <p className="
            text-white/60
          ">

            Cargando evento...

          </p>

        </div>

      </div>
    );
  }

  /*
   * ==========================================
   * EVENTO NO PUBLICADO
   * ==========================================
   */

  if (!eventExists) {
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
            🏃
          </div>

          <h1 className="
            text-3xl
            font-black
            mb-3
          ">

            Evento no disponible

          </h1>

          <p className="
            text-white/60
            leading-relaxed
          ">

            Actualmente no hay un evento
            publicado para consulta de
            competidores.

          </p>

        </div>

      </div>
    );
  }

  /*
   * ==========================================
   * PÁGINA
   * ==========================================
   */

  return (
    <div className="
      min-h-screen
      bg-dh-bg
      text-white
      p-4
      md:p-6
    ">

      <div className="
        max-w-6xl
        mx-auto
      ">

        {/* ================================= */}
        {/* BANNER */}
        {/* ================================= */}

        {bannerUrl && (

          <div className="
            relative
            mb-8
            md:mb-10
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
                h-[220px]
                md:h-[300px]
                object-cover
              "
            />

            <div className="
              absolute
              inset-0
              bg-black/55
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
                    w-24
                    h-24
                    md:w-28
                    md:h-28
                    object-contain
                    rounded-2xl
                    bg-white/10
                    backdrop-blur-md
                    p-2
                    mb-4
                    shadow-2xl
                  "
                />

              )}

              <h1 className="
                text-3xl
                md:text-5xl
                font-black
                text-white
              ">

                {tituloEvento ||
                  "Buscar Competidor"}

              </h1>

              <p className="
                text-white/80
                mt-3
                max-w-2xl
                text-sm
                md:text-base
              ">

                Consulta tu información
                de inscripción, número,
                ruta y categoría.

              </p>

            </div>

          </div>

        )}

        {/* ================================= */}
        {/* HEADER SIN BANNER */}
        {/* ================================= */}

        {!bannerUrl && (

          <div className="
            text-center
            py-8
            md:py-12
          ">

            {logoUrl && (

              <img
                src={logoUrl}
                alt="Logo del evento"
                className="
                  w-24
                  h-24
                  object-contain
                  rounded-2xl
                  mx-auto
                  mb-5
                  bg-white/5
                  p-2
                "
              />

            )}

            <h1 className="
              text-3xl
              md:text-5xl
              font-black
            ">

              {tituloEvento ||
                "Buscar Competidor"}

            </h1>

            <p className="
              text-white/60
              mt-3
            ">

              Consulta tu información
              de inscripción.

            </p>

          </div>

        )}

        {/* ================================= */}
        {/* BUSCADOR */}
        {/* ================================= */}

        <div className="
          relative
          mb-8
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
              Busca por nombre, número,
              equipo, ciudad o cualquier
              dato disponible...
            "
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            className="
              w-full
              pl-14
              pr-14
              py-5
              text-base
              md:text-lg
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
              text-white
              placeholder:text-white/35
            "
          />

          {search && (

            <button
              type="button"
              onClick={
                limpiarBusqueda
              }
              className="
                absolute
                right-4
                top-1/2
                -translate-y-1/2
                w-8
                h-8
                rounded-full
                bg-white/10
                hover:bg-white/20
                text-white/70
                transition
              "
              aria-label="Limpiar búsqueda"
            >

              ×

            </button>

          )}

        </div>

        {/* ================================= */}
        {/* AYUDA */}
        {/* ================================= */}

        {!search && (

          <div className="
            mb-8
            text-center
            text-white/40
            text-sm
          ">

            Escribe al menos 2 caracteres
            para comenzar la búsqueda.

          </div>

        )}

        {/* ================================= */}
        {/* LOADING */}
        {/* ================================= */}

        {loading && (

          <div className="
            space-y-4
          ">

            {[1, 2, 3].map(
              (item) => (

                <div
                  key={item}
                  className="
                    h-40
                    rounded-3xl
                    border
                    border-white/5
                    bg-white/[0.03]
                    animate-pulse
                  "
                />

              )
            )}

          </div>

        )}

        {/* ================================= */}
        {/* SIN RESULTADOS */}
        {/* ================================= */}

        {!loading &&
          results.length === 0 &&
          debouncedSearch.length >= 2 && (

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
                que coincidan con:

              </p>

              <p className="
                text-white
                font-semibold
                mt-2
              ">

                "{search}"

              </p>

              <p className="
                text-white/40
                text-sm
                mt-4
              ">

                Intenta con el nombre,
                número de competidor,
                equipo o ciudad.

              </p>

            </div>

          )}

        {/* ================================= */}
        {/* RESULTADOS */}
        {/* ================================= */}

        {!loading &&
          results.length > 0 && (

            <div className="
              space-y-4
            ">

              <div className="
                flex
                items-center
                justify-between
                px-1
                mb-3
              ">

                <p className="
                  text-sm
                  text-white/50
                ">

                  {results.length}{' '}
                  {results.length === 1
                    ? "resultado"
                    : "resultados"}

                </p>

              </div>

              {results.map(
                (competidor) => (

                  <div
                    key={
                      competidor.id
                    }
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

                    {/* ===================== */}
                    {/* CABECERA */}
                    {/* ===================== */}

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

                          #
                          {competidor.Bib ||
                            "---"}

                        </div>

                        <h2 className="
                          text-xl
                          md:text-2xl
                          tracking-tight
                          font-black
                          leading-tight
                        ">

                          {competidor.Participant ||
                            "Sin nombre"}

                        </h2>

                      </div>

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

                    {/* ===================== */}
                    {/* INFORMACIÓN */}
                    {/* ===================== */}

                    {visibleFields.length > 0 && (

                      <div className="
                        flex
                        flex-wrap
                        gap-x-4
                        gap-y-2
                        mt-5
                      ">

                        {visibleFields
                          .filter(
                            (field) =>
                              ![
                                "Participant",
                                "Bib",
                                "RouteName",
                                "CategoryName",
                              ].includes(
                                field
                              )
                          )
                          .map(
                            (field) => {

                              const value =
                                competidor[
                                  field
                                ];

                              /*
                               * No mostramos
                               * campos vacíos.
                               */

                              if (
                                value ===
                                  undefined ||
                                value ===
                                  null ||
                                String(
                                  value
                                ).trim() === ""
                              ) {
                                return null;
                              }

                              const Icon =
                                fieldIcons[
                                  field
                                ];

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

                                    <Icon
                                      className="
                                        w-4
                                        h-4
                                        text-dh-purple
                                        shrink-0
                                      "
                                    />

                                  )}

                                  <span className="
                                    text-dh-muted
                                    text-xs
                                  ">

                                    {fieldLabels[
                                      field
                                    ] || field}:

                                  </span>

                                  <span className="
                                    font-semibold
                                    text-sm
                                  ">

                                    {formatValue(
                                      field,
                                      value
                                    )}

                                  </span>

                                </div>

                              );

                            }
                          )}

                      </div>

                    )}

                  </div>

                )
              )}

            </div>

          )}

      </div>

      {/* ================================= */}
      {/* FOOTER */}
      {/* ================================= */}

      <div className="
        max-w-6xl
        mx-auto
        text-center
        py-8
        text-xs
        text-white/25
      ">

        Consulta de competidores

      </div>

    </div>
  );
}