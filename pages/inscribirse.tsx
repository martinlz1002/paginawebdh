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

interface Categoria {
  nombre: string;
  minAge: number;
  maxAge: number;
}

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  lugar?: string;
  fecha?: string;
  horaSalida?: string;
  imagenUrl?: string;
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
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);
  const auth = getAuth(app);

  // 1) Carga de la carrera
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
        imagenUrl: data.imagenUrl,
        bannerUrl: data.bannerUrl,
        categorias: data.categorias || [],
      });
    })();
  }, [carreraId]);

  // 2) Autenticación + carga de perfiles
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
        apellidoPaterno: d.apPaterno,
        apellidoMaterno: d.apMaterno,
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

  // 3) Inscribir
  const handleInscribir = async () => {
    setMensaje("");
    if (!perfilSeleccionado || !categoriaSeleccionada) {
      setMensaje("Selecciona perfil y categoría");
      return;
    }
    try {
      const user = auth.currentUser!;
      const dupQ = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera!.id),
        where("perfilId", "==", perfilSeleccionado),
        where("perfilOwner", "==", user.uid)
      );
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) {
        setMensaje("Ya estás inscrito con este perfil.");
        return;
      }
      await registrarInscripcion({
        carreraId: carrera!.id,
        perfilId: perfilSeleccionado,
        categoria: categoriaSeleccionada,
      });
      setMensaje("¡Inscripción exitosa!");
    } catch (err: any) {
      setMensaje("Error al inscribir: " + err.message);
    }
  };

  if (!carrera) {
    return (
      <AuthGuard>
        <p className="text-center mt-10">{mensaje || "Cargando…"} </p>
      </AuthGuard>
    );
  }

  // Perfil actual para filtro
  const perfilActual = perfiles.find((p) => p.id === perfilSeleccionado);
  const categoriasPermitidas = carrera.categorias.filter((cat) =>
    perfilActual
      ? perfilActual.edad >= cat.minAge && perfilActual.edad <= cat.maxAge
      : false
  );

  return (
    <AuthGuard>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Banner */}
        {carrera.bannerUrl && (
          <div
            className="h-56 bg-cover bg-center"
            style={{ backgroundImage: `url(${carrera.bannerUrl})` }}
          />
        )}
        <div className="p-6 space-y-6">
          {/* Título & descripción */}
          <h1 className="text-3xl font-bold">{carrera.titulo}</h1>
          {carrera.descripcion && (
            <p className="text-gray-700">{carrera.descripcion}</p>
          )}

          {/* Datos: lugar, fecha, hora */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-gray-600">
            {carrera.lugar && (
              <div>📍 <span className="font-medium">{carrera.lugar}</span></div>
            )}
            {carrera.fecha && (
              <div>📅 <span className="font-medium">{carrera.fecha}</span></div>
            )}
            {carrera.horaSalida && (
              <div>⏰ <span className="font-medium">{carrera.horaSalida}</span></div>
            )}
          </div>

          {/* Tabla de todas las categorías */}
          <div>
            <h2 className="text-xl font-semibold mb-2">Categorías</h2>
            <table className="w-full table-auto border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-4 py-2">Nombre</th>
                  <th className="border px-4 py-2">Edad mínima</th>
                  <th className="border px-4 py-2">Edad máxima</th>
                </tr>
              </thead>
              <tbody>
                {carrera.categorias.map((cat) => (
                  <tr key={cat.nombre} className="hover:bg-gray-50">
                    <td className="border px-4 py-2">{cat.nombre}</td>
                    <td className="border px-4 py-2">{cat.minAge}</td>
                    <td className="border px-4 py-2">{cat.maxAge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Formulario de inscripción */}
          <div className="pt-4 border-t space-y-4">
            {/* Selección de perfil */}
            <div>
              <label className="block font-medium mb-1">Tu perfil</label>
              {loadingPerfiles ? (
                <p>Cargando perfiles…</p>
              ) : (
                <select
                  className="w-full border p-2 rounded"
                  value={perfilSeleccionado}
                  onChange={(e) => setPerfilSeleccionado(e.target.value)}
                >
                  {perfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} {p.apellidoPaterno} ({p.edad} años)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selección de categoría (solo permitidas) */}
            <div>
              <label className="block font-medium mb-1">Categoría</label>
              <select
                className="w-full border p-2 rounded"
                value={categoriaSeleccionada}
                onChange={(e) => setCategoriaSeleccionada(e.target.value)}
                disabled={!categoriasPermitidas.length}
              >
                <option value="">-- Selecciona categoría --</option>
                {categoriasPermitidas.map((cat) => (
                  <option key={cat.nombre} value={cat.nombre}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* Botón */}
            <button
              onClick={handleInscribir}
              disabled={!perfilSeleccionado || !categoriaSeleccionada}
              className={`w-full py-3 rounded text-white transition ${
                perfilSeleccionado && categoriaSeleccionada
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              Inscribirme
            </button>

            {mensaje && <p className="text-center text-red-600">{mensaje}</p>}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}