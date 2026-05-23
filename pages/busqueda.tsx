import { useEffect, useState } from 'react';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  endAt
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

import {
  Search,
  Trophy,
  MapPin,
  Phone,
  Calendar,
  User,
  Timer
} from 'lucide-react';

import { db } from '@/lib/firebase';

export default function BusquedaCompetidor() {

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibleFields, setVisibleFields] = useState<string[]>([]);

  const [logoUrl, setLogoUrl] = useState('');

const [bannerUrl, setBannerUrl] = useState('');

const [tituloEvento, setTituloEvento] = useState('');

const fieldIcons: Record<string, any> = {

  Estado: MapPin,
  Ciudad: MapPin,
  Celular: Phone,
  'Fecha Nac.': Calendar,
  Rama: User

};

  // Debounce
  useEffect(() => {

    const timer = setTimeout(() => {

      setDebouncedSearch(search);

    }, 350);

    return () => clearTimeout(timer);

  }, [search]);

  // Buscar competidores
  useEffect(() => {

    const buscar = async () => {

      if (debouncedSearch.trim().length < 2) {

        setResults([]);
        return;

      }

      try {

        setLoading(true);

        const texto = debouncedSearch.toLowerCase();

        const q = query(

  collection(
    db,
    'busquedaCompetidor',
    'active',
    'competidores'
  ),

  orderBy('participant_search'),

  startAt(texto),
  endAt(texto + '\uf8ff'),

  limit(20)

);

        const snapshot = await getDocs(q);

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        setResults(data);

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);

      }

    };

    buscar();

  }, [debouncedSearch]);

  // Cargar configuración dinámica
  useEffect(() => {

    const cargarConfiguracion = async () => {

      try {

        const ref = doc(
          db,
          'busquedaCompetidor',
          'active'
        );

        const snap = await getDoc(ref);

        if (!snap.exists()) return;

        const data = snap.data();

        setVisibleFields(data.fields || []);

        setLogoUrl(data.logoUrl || '');

        setBannerUrl(data.bannerUrl || '');

        setTituloEvento(data.tituloEvento || '');

      } catch (error) {

        console.error(error);

      }

    };

    cargarConfiguracion();

  }, []);

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

  Country: 'País'

};

const formatValue = (
  field: string,
  value: any,
  
) => {

  if (
    field === 'Fecha Nac.' &&
    typeof value === 'number'
  ) {

    const excelDate =
      XLSX.SSF.parse_date_code(value);

    if (excelDate) {

      const day = String(excelDate.d)
        .padStart(2, '0');

      const month = String(excelDate.m)
        .padStart(2, '0');

      const year = excelDate.y;

      return `${day}/${month}/${year}`;
    }
  }

  return String(value ?? '-');

};

  return (

    <div className="min-h-screen bg-dh-bg text-white p-6">

      <div className="max-w-6xl mx-auto">

        {bannerUrl && (

  <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_60px_rgba(139,92,246,0.15)]">

    <img
      src={bannerUrl}
      alt="Banner evento"
      className="w-full h-[260px] object-cover"
    />

    <div className="absolute inset-0 bg-black/50" />

    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">

      {logoUrl && (

        <img
          src={logoUrl}
          alt="Logo evento"
          className="w-28 h-28 object-contain rounded-2xl bg-white/10 backdrop-blur-md p-2 mb-4"
        />

      )}

      <h1 className="text-4xl md:text-5xl font-black text-white">

        {tituloEvento || 'Buscar Competidor'}

      </h1>

      <p className="text-white/80 mt-3 max-w-2xl">

        Consulta tu información de inscripción,
        número y categoría oficial del evento.

      </p>

    </div>

  </div>

)}

        <div className="relative mb-8">

  <Search
    className="
      absolute
      left-5
      top-1/2
      -translate-y-1/2
      text-white/40
      w-5 h-5
      pointer-events-none
    "
  />

  <input
    type="text"
    placeholder="Buscar por nombre..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="
      w-full
      pl-14
      pr-5
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

</div>

        <div className="mt-8 space-y-4">

          {loading && (

  <div className="space-y-4">

    {[1,2,3].map((item) => (

      <div
        key={item}
        className="
          h-40
          rounded-3xl
          border border-white/5
          bg-white/[0.03]
          animate-pulse
        "
      />

    ))}

  </div>

)}

          {!loading && results.length === 0 && debouncedSearch.length >= 2 && (

            <div className="
  text-center
  py-20
  border border-dashed border-white/10
  rounded-3xl
  bg-white/[0.02]
">

  <div className="text-6xl mb-4">
    🏃
  </div>

  <h3 className="text-2xl font-bold mb-2">
    Sin resultados
  </h3>

  <p className="text-dh-muted">
    No encontramos competidores con ese nombre.
  </p>

</div>

          )}

          {results.map((competidor) => (

  <div
    key={competidor.id}
    className="
      bg-dh-panel
      border border-white/10
      rounded-3xl
      px-5 py-4
      hover:border-dh-purple/50
        hover:-translate-y-1
        hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]
        animate-[fadeIn_.4s_ease]
      transition
    "
  >

    {/* TOP */}
    <div className="
      flex
      flex-col
      md:flex-row
      md:items-center
      md:justify-between
      gap-3
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

          {competidor.Participant}

        </h2>

      </div>

      <div className="flex flex-wrap gap-2">

        {competidor.RouteName && (

          <div className="
          flex items-center gap-2
            px-3 py-1.5 rounded-xl
            bg-dh-purple/20
            backdrop-blur-md
            text-dh-purple
            text-sm font-bold
          ">

            <Timer className="w-4 h-4" /> {competidor.RouteName}

          </div>

        )}

        {competidor.CategoryName && (

          <div className="
          flex items-center gap-2
            px-3 py-1.5 rounded-xl
            bg-white/5
            backdrop-blur-md
            border border-white/10
            text-sm font-semibold
          ">

            <Trophy className="w-4 h-4" /> {competidor.CategoryName}

          </div>

        )}

      </div>

    </div>

    {/* INFO */}
    <div className="
      flex
      flex-wrap
      gap-x-6
      gap-y-2
      mt-4
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

  const Icon = fieldIcons[field];

  return (

    <div
      key={field}
      className="
        flex items-center gap-2
        bg-white/[0.03]
        border border-white/5
        px-3 py-2
        rounded-xl
      "
    >

      {Icon && (

        <Icon className="w-4 h-4 text-dh-purple" />

      )}

      <span className="
        text-dh-muted
        text-xs
      ">

        {fieldLabels[field] || field}:

      </span>

      <span className="font-semibold">

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