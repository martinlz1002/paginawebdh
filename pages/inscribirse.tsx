import { useRouter } from "next/router";
import { useEffect, useState, useRef } from "react";
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
  const scrollToFormRef = useRef<HTMLDivElement>(null);

  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loadingPerfiles, setLoadingPerfiles] = useState(true);

  const auth = getAuth(app);

  // 1) Cargar carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const dc = await getDoc(doc(db, "carreras", carreraId as string));
      if (dc.exists()) {
        const d = dc.data()!;
        setCarrera({
          id: dc.id,
          titulo: d.titulo,
          categorias: d.categorias || [],
        });
      } else {
        setMensaje("Carrera no encontrada");
      }
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

    // a) Perfil principal
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

    // b) Subperfiles
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
    if (lista.length > 0) setPerfilSeleccionado(lista[0].id);
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
      // Evitar duplicados
      const dupQ = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", carrera!.id),
        where("perfilId", "==", perfilSeleccionado)
      );
      const dupSnap = await getDocs(dupQ);
      if (!dupSnap.empty) {
        setMensaje("Ya estás inscrito con este perfil.");
        return;
      }
      // Registrar la inscripción
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
        <p className="text-center mt-10">{mensaje || "Cargando…"}</p>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera.titulo}</h1>

        {/* Perfiles */}
        <div>
          <label className="block font-medium">Selecciona tu perfil</label>
          {loadingPerfiles ? (
            <p>Cargando perfiles…</p>
          ) : (
            <select
              className="mt-1 border p-2 rounded w-full"
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

        {/* Categorías */}
        <div>
          <label className="block font-medium">Selecciona categoría</label>
          <select
            className="mt-1 border p-2 rounded w-full"
            value={categoriaSeleccionada}
            onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          >
            <option value="">-- Elige categoría --</option>
            {carrera.categorias
              .filter((cat) => {
                const p = perfiles.find((x) => x.id === perfilSeleccionado);
                return p ? p.edad >= cat.minAge && p.edad <= cat.maxAge : false;
              })
              .map((cat) => (
                <option key={cat.nombre} value={cat.nombre}>
                  {cat.nombre} ({cat.minAge}–{cat.maxAge} años)
                </option>
              ))}
          </select>
        </div>

        {/* Botón Inscribir */}
        <button
          onClick={handleInscribir}
          className={`w-full py-2 rounded text-white transition ${
            perfilSeleccionado && categoriaSeleccionada
              ? "bg-purple-600 hover:bg-purple-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          disabled={!perfilSeleccionado || !categoriaSeleccionada}
        >
          Inscribirme
        </button>

        {mensaje && <p className="mt-4 text-center text-red-600">{mensaje}</p>}
      </div>
    </AuthGuard>
  );
}