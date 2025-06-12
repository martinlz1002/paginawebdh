import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

interface UserData {
  id?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email?: string;
  celular?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  club?: string;
  fechaNacimiento: string;
  edad?: number;
}

interface Categoria {
  id: string;
  nombre: string;
  edadMinima: number;
  edadMaxima: number;
}

interface CarreraData {
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: Timestamp;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { id } = router.query;

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [perfilTitular, setPerfilTitular] = useState<UserData | null>(null);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<UserData | null>(null);
  const [perfiles, setPerfiles] = useState<UserData[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("");
  const [yaInscrito, setYaInscrito] = useState(false);
  const [carrera, setCarrera] = useState<CarreraData | null>(null);
  const [carreraActiva, setCarreraActiva] = useState(true);

  const auth = getAuth(app);

  useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
    setAuthLoading(false); // Ya terminó la verificación de auth

    if (!usuario) {
      router.push("/login");
      return;
    }

    if (!id) return;

    setUser(usuario);

    try {
      const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
      const titular = userDoc.data() as UserData;
      setPerfilTitular(titular);
      setPerfilSeleccionado(titular);

      const perfilesSnapshot = await getDocs(
        collection(db, "usuarios", usuario.uid, "perfiles")
      );
      const perfilesList = perfilesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserData[];
      setPerfiles(perfilesList);

      const carreraDoc = await getDoc(doc(db, "carreras", id as string));
      if (carreraDoc.exists()) {
        const data = carreraDoc.data() as CarreraData;
        setCarrera(data);
        const fechaCarrera = data.fecha.toDate();
        if (fechaCarrera < new Date()) {
          setCarreraActiva(false);
        }
      }

      const categoriasSnapshot = await getDocs(
        collection(db, "carreras", id as string, "categorias")
      );
      const categoriasList = categoriasSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Categoria[];
      setCategorias(categoriasList);
    } catch (error) {
      console.error("Error al cargar datos de inscripción:", error);
    }
  });

  return () => unsubscribe();
}, [id]);

  useEffect(() => {
    const validarInscripcion = async () => {
      if (!user || !perfilSeleccionado || !id) return;
      const inscripcionesQuery = query(
        collection(db, "inscripciones"),
        where("carreraId", "==", id),
        where("perfilId", "==", perfilSeleccionado.id || "titular")
      );
      const inscripcionesSnapshot = await getDocs(inscripcionesQuery);
      if (!inscripcionesSnapshot.empty) {
        setYaInscrito(true);
      }
    };
    validarInscripcion();
  }, [perfilSeleccionado, id, user]);

  const handleInscribirse = async () => {
    if (!perfilSeleccionado) {
      alert("Selecciona un perfil para continuar.");
      return;
    }

    if (!categoriaSeleccionada) {
      alert("Selecciona una categoría para poder inscribirte.");
      return;
    }

    if (yaInscrito) {
      alert("Ya estás inscrito a esta carrera con este perfil.");
      return;
    }

    try {
      await addDoc(collection(db, "inscripciones"), {
        carreraId: id,
        categoriaId: categoriaSeleccionada,
        perfilId: perfilSeleccionado.id || "titular",
        usuarioId: user.uid,
        creado: new Date(),
      });
      alert("Inscripción realizada con éxito");
      router.push("/mis-inscripciones");
    } catch (error) {
      console.error("Error al inscribir:", error);
      alert("Ocurrió un error al intentar inscribirte.");
    }
  };

  if (authLoading || !carrera) return <p className="p-6">Cargando datos...</p>;

  if (!carreraActiva) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">{carrera.titulo}</h1>
        <p className="mb-4">Esta carrera ya ha concluido.</p>
      </div>
    );
  }

  const categoriasFiltradas = categorias.filter((cat) => {
    const edad = perfilSeleccionado?.edad || 0;
    return edad >= cat.edadMinima && edad <= cat.edadMaxima;
  });

  return (
    <ProtectedRoute>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Inscribirse a {carrera.titulo}</h1>

        <p className="mb-2 text-gray-600">
          <strong>Ubicación:</strong> {carrera.ubicacion} <br />
          <strong>Fecha:</strong> {carrera.fecha.toDate().toLocaleDateString()}
        </p>

        <label className="block mb-1 font-semibold">Selecciona un perfil:</label>
        <select
          value={perfilSeleccionado?.id || "titular"}
          onChange={(e) => {
            const seleccion = e.target.value;
            if (seleccion === "titular") {
              setPerfilSeleccionado(perfilTitular);
            } else {
              const perfil = perfiles.find((p) => p.id === seleccion);
              setPerfilSeleccionado(perfil || null);
            }
          }}
          className="border p-2 rounded w-full mb-4"
        >
          <option value="titular">Titular: {perfilTitular?.nombre}</option>
          {perfiles.map((perfil) => (
            <option key={perfil.id} value={perfil.id}>
              {perfil.nombre} {perfil.apellidoPaterno} {perfil.apellidoMaterno}
            </option>
          ))}
        </select>

        <label className="block mb-1 font-semibold">Categoría:</label>
        <select
          value={categoriaSeleccionada}
          onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          className="border p-2 rounded w-full mb-4"
        >
          <option value="">Seleccione una categoría</option>
          {categoriasFiltradas.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre} ({cat.edadMinima}-{cat.edadMaxima} años)
            </option>
          ))}
        </select>

        <button
          disabled={!categoriaSeleccionada || yaInscrito}
          onClick={handleInscribirse}
          className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {yaInscrito ? "Ya inscrito" : "Confirmar inscripción"}
        </button>
      </div>
    </ProtectedRoute>
  );
}