import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import { app, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { registrarInscripcion } from "@/lib/Inscripciones";
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";

// Tipos
interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;
}

type AgeBasis = 'endOfYear' | 'eventDate';

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string; // ISO date YYYY-MM-DD
  horaSalida?: string;
  bannerUrl?: string;
  categorias: Categoria[];
  ageBasis: AgeBasis;
}

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  birthDate: Date;
}

// Calcula edad dado nacimiento y fecha de corte
function computeAge(birthDate: Date, basisDate: Date): number {
  let age = basisDate.getFullYear() - birthDate.getFullYear();
  const m = basisDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && basisDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [competitorNumber, setCompetitorNumber] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const auth = getAuth(app);

  // Carga de datos de la carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      const d: any = snap.data();
      setCarrera({
        id: snap.id,
        titulo: d.titulo,
        descripcion: d.descripcion,
        lugar: d.lugar || d.ubicacion,
        fecha: d.fecha instanceof Timestamp
          ? d.fecha.toDate().toISOString().split('T')[0]
          : d.fecha,
        horaSalida: d.horaSalida,
        bannerUrl: d.bannerUrl,
        categorias: (d.categorias || []).map((cat: any) => ({
          nombre: cat.nombre,
          minAge: cat.minAge,
          maxAge: cat.maxAge,
          price: typeof cat.price === "number" ? cat.price : 0,
        })),
        ageBasis: d.ageBasis || 'endOfYear',
      });
    })();
  }, [carreraId]);

  // Carga de perfiles
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return router.replace("/login");
      loadPerfiles(user.uid);
    });
    return () => unsub();
  }, []);

  async function loadPerfiles(uid: string) {
    setLoadingPerfiles(true);
    const lista: Perfil[] = [];
    const udoc = await getDoc(doc(db, "usuarios", uid));
    if (udoc.exists()) {
      const ud: any = udoc.data();
      const bd = ud.fechaNacimiento instanceof Timestamp
        ? ud.fechaNacimiento.toDate()
        : new Date(ud.fechaNacimiento);
      lista.push({ id: uid, nombre: ud.nombre, apellidoPaterno: ud.apPaterno || ud.apellidoPaterno, apellidoMaterno: ud.apMaterno || ud.apellidoMaterno, birthDate: bd });
    }
    const snap = await getDocs(collection(db, "usuarios", uid, "perfiles"));
    snap.docs.forEach((d) => {
      const p: any = d.data();
      const bd = p.fechaNacimiento instanceof Timestamp
        ? p.fechaNacimiento.toDate()
        : new Date(p.fechaNacimiento);
      lista.push({ id: d.id, nombre: p.nombre, apellidoPaterno: p.apellidoPaterno || p.apPaterno, apellidoMaterno: p.apellidoMaterno || p.apMaterno, birthDate: bd });
    });
    setPerfiles(lista);
    if (lista.length) setPerfilSeleccionado(lista[0].id);
    setLoadingPerfiles(false);
  }

  useEffect(() => {
    setCategoriaSeleccionada("");
    setCompetitorNumber(null);
  }, [perfilSeleccionado]);

  const handlePagar = async () => {
    setMensaje("");
    if (!perfilSeleccionado || !categoriaSeleccionada) {
      setMensaje("Selecciona perfil y categoría");
      return;
    }
    if (!carrera) return;
    const user = auth.currentUser;
    if (!user) return;

    // Evitar duplicados
    const dupAny = await getDocs(
      query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera.id),
        where("perfilId", "==", perfilSeleccionado),
        where("perfilOwner", "==", user.uid)
      )
    );
    if (!dupAny.empty) {
      setMensaje("Ya estás inscrito en esta carrera.");
      return;
    }

    setProcesandoPago(true);
    try {
      // Crear sesión de pago en backend
      const catObj = carrera.categorias.find(c => c.nombre === categoriaSeleccionada)!;
      const resp = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId: perfilSeleccionado,
          categoria: categoriaSeleccionada,
          price: catObj.price,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { url, sessionId } = await resp.json();

      // Registrar inscripción con sessionId
      await registrarInscripcion({
        carreraId: carrera.id,
        carreraTitulo: carrera.titulo,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
        sessionId,
      });

      // Obtener número asignado mediante sessionId
      const insQuery = query(
        collection(db, "inscripciones"),
        where("sessionId", "==", sessionId)
      );
      const insSnap = await getDocs(insQuery);
      if (!insSnap.empty) {
        const docSnap = insSnap.docs[0];
        const data: any = docSnap.data();
        setCompetitorNumber(data.competitorNumber ?? null);
      }

      // Redirigir al checkout
      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (e: any) {
      console.error(e);
      setMensaje(`Error al iniciar pago: ${e.message}`);
      setProcesandoPago(false);
    }
  };

  if (!carrera) return <AuthGuard><p className="text-center mt-10">{mensaje || "Cargando…"}</p></AuthGuard>;

  // Fecha de corte según tipo
  const eventYear = new Date(carrera.fecha as string).getFullYear();
  const basisDate = carrera.ageBasis === 'endOfYear' ? new Date(eventYear, 11, 31) : new Date(carrera.fecha as string);

  // Edad y categorías permitidas
  const perfilData = perfiles.find((p) => p.id === perfilSeleccionado);
  const perfilAge = perfilData ? computeAge(perfilData.birthDate, basisDate) : 0;
  const categoriasPermitidas = carrera.categorias.filter((cat) => perfilAge >= cat.minAge && perfilAge <= cat.maxAge);
  const precioSeleccionado = categoriasPermitidas.find((c) => c.nombre === categoriaSeleccionada)?.price ?? 0;

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow overflow-hidden">
        {carrera.bannerUrl && <div className="h-56 bg-cover bg-center" style={{ backgroundImage: `url(${carrera.bannerUrl})` }} />}
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
          {carrera.descripcion && <p className="text-gray-700">{carrera.descripcion}</p>}

          {/* Tabla completa de categorías */}
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
              <ClipboardIcon className="w-6 h-6 text-green-700" />
              <span>Categorías y precios</span>
            </h2>
            <table className="w-full table-auto border text-gray-700">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Nombre</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                  <th className="border px-4 py-2">Precio (MXN)</th>
                </tr>
              </thead>
              <tbody>
                {carrera.categorias.map((cat) => (
                  <tr key={cat.nombre} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{cat.nombre}</td>
                    <td className="border px-4 py-2">{cat.minAge}</td>
                    <td className="border px-4 py-2">{cat.maxAge}</td>
                    <td className="border px-4 py-2">${cat.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mostrar edad y categorías para verificación */}
          <div className="p-4 bg-gray-100 rounded">
            <p className="font-medium">Edad calculada: {perfilAge} años</p>
            <p className="text-sm text-gray-600">
              Según {carrera.ageBasis === 'endOfYear' ? `corte al 31/12/${eventYear}` : `fecha del evento (${carrera.fecha})`}
            </p>
            <p className="text-sm mt-2">Categorías disponibles: {categoriasPermitidas.map(c => c.nombre).join(', ') || 'Ninguna'}</p>
          </div>

          {/* Campo Número de Competidor */}
          {competitorNumber !== null && (
            <div>
              <label className="block font-medium">Número de competidor</label>
              <input type="text" value={competitorNumber} readOnly className="w-full p-2 border rounded bg-gray-100" />
            </div>
          )}

          {/* Formulario de inscripción */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1"><UserIcon className="w-5 h-5 text-green-600" /><span>Tu perfil</span></label>
              {loadingPerfiles ? <p>Cargando perfiles…</p> : (
                <select className="w-full border p-2 rounded" value={perfilSeleccionado} onChange={(e) => setPerfilSeleccionado(e.target.value)}>
                  {perfiles.map((p) => (
                    <option key={p.id} value={p.id}>{`${p.nombre} ${p.apellidoPaterno} ${p.apellidoMaterno} (${computeAge(p.birthDate, basisDate)} años)`}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1"><ClipboardIcon className="w-5 h-5 text-purple-700" /><span>Categoría</span></label>
              <select className="w-full border p-2 rounded disabled:opacity-50" value={categoriaSeleccionada} onChange={(e) => setCategoriaSeleccionada(e.target.value)} disabled={!categoriasPermitidas.length}>
                <option value="">-- Selecciona categoría --</option>
                {categoriasPermitidas.map((cat) => (
                  <option key={cat.nombre} value={cat.nombre}>{cat.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          {categoriaSeleccionada && <div className="text-lg font-medium">Precio seleccionado: ${precioSeleccionado.toFixed(2)}</div>}

          <button onClick={handlePagar} disabled={!perfilSeleccionado || !categoriaSeleccionada || procesandoPago} className={`w-full py-3 rounded text-white transition ${perfilSeleccionado && categoriaSeleccionada ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-400 cursor-not-allowed"}`}>
            {procesandoPago ? "Procesando..." : "Inscribirme y Pagar"}
          </button>
          {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
        </div>
      </div>
    </AuthGuard>
  );
}
