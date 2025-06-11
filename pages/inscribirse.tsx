import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, getDocs, addDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

interface Categoria {
  id: string;
  nombre: string;
  edadMinima: number;
  edadMaxima: number;
}

interface Perfil {
  id?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  fechaNacimiento: string;
  edad: number;
  club?: string;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { id: carreraId } = router.query;
  const [user, setUser] = useState<any>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<Perfil | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("");

  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      if (usuario && carreraId) {
        setUser(usuario);

        const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
        const titular = userDoc.data();
        const titularEdad = titular?.edad || 0;

        const perfilTitular: Perfil = {
          nombre: titular?.nombre,
          apellidoPaterno: titular?.apellidoPaterno,
          apellidoMaterno: titular?.apellidoMaterno,
          fechaNacimiento: titular?.fechaNacimiento,
          edad: titularEdad,
          club: titular?.club,
        };

        const perfilesSnap = await getDocs(collection(db, "usuarios", usuario.uid, "perfiles"));
        const perfilesSecundarios = perfilesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Perfil[];

        setPerfiles([perfilTitular, ...perfilesSecundarios]);
        setPerfilSeleccionado(perfilTitular);

        const categoriasSnap = await getDocs(collection(db, "carreras", String(carreraId), "categorias"));
        const categoriasData = categoriasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Categoria[];
        setCategorias(categoriasData);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [carreraId]);

  const handleInscripcion = async () => {
    if (!perfilSeleccionado || !categoriaSeleccionada || !user) return;

    await addDoc(collection(db, "inscripciones"), {
      carreraId,
      uid: user.uid,
      perfil: perfilSeleccionado,
      categoriaId: categoriaSeleccionada,
      fecha: new Date(),
    });

    alert("Inscripción realizada con éxito");
    router.push("/");
  };

  const categoriasDisponibles = categorias.filter(cat => {
    return perfilSeleccionado && perfilSeleccionado.edad >= cat.edadMinima && perfilSeleccionado.edad <= cat.edadMaxima;
  });

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Inscripción a carrera</h1>

      {perfiles.length > 0 && (
        <div className="mb-4">
          <label className="font-semibold">Selecciona un perfil:</label>
          <select
            className="block w-full border p-2 rounded"
            onChange={(e) => {
              const seleccion = perfiles.find(p => p.id === e.target.value || !p.id);
              if (seleccion) setPerfilSeleccionado(seleccion);
            }}
          >
            {perfiles.map((p, i) => (
              <option key={p.id || i} value={p.id || "titular"}>
                {p.nombre} {p.apellidoPaterno} {p.apellidoMaterno}
              </option>
            ))}
          </select>
        </div>
      )}

      {categoriasDisponibles.length > 0 ? (
        <div className="mb-4">
          <label className="font-semibold">Selecciona una categoría:</label>
          <select
            className="block w-full border p-2 rounded"
            onChange={(e) => setCategoriaSeleccionada(e.target.value)}
          >
            <option value="">Selecciona una categoría</option>
            {categoriasDisponibles.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.nombre} ({cat.edadMinima}-{cat.edadMaxima} años)
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p>No hay categorías disponibles para la edad del perfil seleccionado.</p>
      )}

      <button
        onClick={handleInscripcion}
        disabled={!categoriaSeleccionada || !perfilSeleccionado}
        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
      >
        Confirmar inscripción
      </button>
    </div>
  );
}