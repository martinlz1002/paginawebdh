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
import {
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  ClipboardIcon,
  CreditCardIcon,
} from "@heroicons/react/24/outline";
import { registrarInscripcion } from "@/lib/Inscripciones";

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
  price: number;      // ← Ahora cada categoría trae su precio
}

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string;
  horaSalida?: string;
  bannerUrl?: string;
  categorias: Categoria[];
}

interface Perfil {
  id: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  edad: number;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [precioSeleccionado, setPrecioSeleccionado] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const auth = getAuth(app);

  // 1) Cargo la carrera y sus categorías (con precios)
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const snap = await getDoc(doc(db, "carreras", carreraId as string));
      if (!snap.exists()) {
        setMensaje("Carrera no encontrada");
        return;
      }
      const data = snap.data() as any;
      setCarrera({
        id: snap.id,
        titulo: data.titulo,
        descripcion: data.descripcion,
        lugar: data.lugar || data.ubicacion,
        fecha:
          data.fecha instanceof Timestamp
            ? data.fecha.toDate().toLocaleDateString()
            : data.fecha,
        horaSalida: data.horaSalida,
        bannerUrl: data.bannerUrl,
        categorias: data.categorias || [],  // se espera que cada item tenga { nombre, minAge, maxAge, price }
      });
    })();
  }, [carreraId]);

  // 2) Autenticación y carga de perfiles
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
      const d: any = udoc.data();
      lista.push({
        id: uid,
        nombre: d.nombre,
        apellidoPaterno: d.apPaterno || d.apellidoPaterno,
        apellidoMaterno: d.apMaterno || d.apellidoMaterno,
        edad: d.edad,
      });
    }
    const snap = await getDocs(collection(db, "usuarios", uid, "perfiles"));
    snap.docs.forEach((d) => {
      const p: any = d.data();
      lista.push({
        id: d.id,
        nombre: p.nombre,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        edad: p.edad,
      });
    });
    setPerfiles(lista);
    if (lista.length) setPerfilSeleccionado(lista[0].id);
    setLoadingPerfiles(false);
  }

  // 3) Cuando cambia la categoría seleccionada, actualizo el precio
  useEffect(() => {
    if (!carrera) return;
    const cat = carrera.categorias.find(c => c.nombre === categoriaSeleccionada);
    setPrecioSeleccionado(cat ? cat.price : 0);
  }, [categoriaSeleccionada, carrera]);

  // 4) Iniciar pago Stripe + registro en Firestore
  const handlePagar = async () => {
    setMensaje("");
    if (!perfilSeleccionado || !categoriaSeleccionada) {
      setMensaje("Selecciona perfil y categoría");
      return;
    }
    if (!carrera) return;

    // Prevengo duplicados
    const user = auth.currentUser!;
    const dupQ = query(
      collection(db, "inscripciones"),
      where("carreraId", "==", carrera.id),
      where("perfilId", "==", perfilSeleccionado),
      where("perfilOwner", "==", user.uid)
    );
    const dupSnap = await getDocs(dupQ);
    if (!dupSnap.empty) {
      setMensaje("Ya estás inscrito con ese perfil.");
      return;
    }

    setProcesandoPago(true);
    try {
      const res = await fetch("/api/checkout_sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carreraId: carrera.id,
          perfilId: perfilSeleccionado,
          categoria: categoriaSeleccionada,
          precio: precioSeleccionado,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} — ${text}`);
      }
      const { url, sessionId } = await res.json();

      // Registro la inscripción con sessionId y estado pending
      await registrarInscripcion({
        carreraId: carrera.id,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
        sessionId,
      });

      // Abro Stripe en pestaña nueva y redirijo actual a mis-inscripciones
      window.open(url, "_blank")?.focus();
      router.push("/mis-inscripciones");
    } catch (err: any) {
      console.error("Error al iniciar pago:", err);
      setMensaje(`Error al iniciar pago: ${err.message}`);
      setProcesandoPago(false);
    }
  };

  if (!carrera) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">{mensaje || "Cargando…"}</p>
      </AuthGuard>
    );
  }

  // Filtro categorías según edad del perfil
  const perfilActual = perfiles.find(p => p.id === perfilSeleccionado);
  const categoriasPermitidas = carrera.categorias.filter(cat =>
    perfilActual
      ? perfilActual.edad >= cat.minAge && perfilActual.edad <= cat.maxAge
      : false
  );

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {carrera.bannerUrl && (
          <div
            className="h-56 bg-cover bg-center"
            style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
          />
        )}
        <div className="p-6 space-y-6">
          <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
          {carrera.descripcion && (
            <p className="text-gray-700">{carrera.descripcion}</p>
          )}

          {/* Info básica */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-600">
            {carrera.lugar && (
              <div className="flex items-center space-x-2">
                <MapPinIcon className="w-5 h-5 text-gray-500" />
                <span>{carrera.lugar}</span>
              </div>
            )}
            {carrera.fecha && (
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                <span>{carrera.fecha}</span>
              </div>
            )}
            {carrera.horaSalida && (
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-5 h-5 text-purple-600" />
                <span>{carrera.horaSalida}</span>
              </div>
            )}
          </div>

          {/* Tabla de categorías con precios */}
          <div>
            <h2 className="text-xl font-semibold mb-2 flex items-center space-x-2">
              <ClipboardIcon className="w-6 h-6 text-green-700" />
              <span>Categorías y Precios</span>
            </h2>
            <table className="w-full table-auto border-collapse text-gray-700">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Nombre</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                  <th className="border px-4 py-2">Precio (MXN)</th>
                </tr>
              </thead>
              <tbody>
                {carrera.categorias.map(cat => (
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

          {/* Formulario de inscripción */}
          <div className="pt-6 border-t space-y-4">
            {/* Selección de perfil */}
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1">
                <UserIcon className="w-5 h-5 text-green-600" />
                <span>Tu perfil</span>
              </label>
              {loadingPerfiles ? (
                <p>Cargando perfiles…</p>
              ) : (
                <select
                  className="w-full border p-2 rounded"
                  value={perfilSeleccionado}
                  onChange={e => setPerfilSeleccionado(e.target.value)}
                >
                  {perfiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.apellidoPaterno} ({p.edad} años)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selección de categoría */}
            <div>
              <label className="block font-medium mb-1 flex items-center space-x-1">
                <ClipboardIcon className="w-5 h-5 text-purple-700" />
                <span>Categoría</span>
              </label>
              <select
                className="w-full border p-2 rounded disabled:opacity-50"
                value={categoriaSeleccionada}
                onChange={e => setCategoriaSeleccionada(e.target.value)}
                disabled={!categoriasPermitidas.length}
              >
                <option value="">-- Selecciona categoría --</option>
                {categoriasPermitidas.map(cat => (
                  <option key={cat.nombre} value={cat.nombre}>
                    {cat.nombre} — ${cat.price.toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            {/* Precio elegido */}
            {categoriaSeleccionada && (
              <div className="text-2xl font-semibold flex items-center space-x-2">
                <CreditCardIcon className="w-6 h-6 text-green-600" />
                <span>Precio: ${precioSeleccionado.toFixed(2)}</span>
              </div>
            )}

            {/* Botón pago */}
            <button
              onClick={handlePagar}
              disabled={
                !perfilSeleccionado ||
                !categoriaSeleccionada ||
                procesandoPago
              }
              className={`w-full flex justify-center items-center py-3 rounded text-white transition ${
                perfilSeleccionado && categoriaSeleccionada
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {procesandoPago ? "Procesando..." : "Inscribirme y Pagar"}
            </button>

            {mensaje && (
              <p className="text-center text-red-600">{mensaje}</p>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}