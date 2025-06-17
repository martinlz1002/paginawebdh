import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { app, db } from "@/lib/firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { registrarInscripcion } from "@/lib/Inscripciones";
import AuthGuard from "@/components/AuthGuard";

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
  email: string;
  celular: string;
  pais: string;
  estado: string;
  ciudad: string;
  club?: string;
  fechaNacimiento: string;
  edad: number;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const scrollToFormRef = useRef<HTMLDivElement>(null);

  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<string>("");
  const [showNewPerfilForm, setShowNewPerfilForm] = useState(false);
  const [nuevoPerfil, setNuevoPerfil] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");
  const [mensaje, setMensaje] = useState("");

  const auth = getAuth(app);

  // 1) Carga de la carrera y sus categorías
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const dc = await getDoc(doc(db, "carreras", carreraId as string));
      if (dc.exists()) {
        const data = dc.data()!;
        setCarrera({
          id: dc.id,
          titulo: data.titulo,
          categorias: data.categorias || [],
        });
      } else {
        setMensaje("Carrera no encontrada");
      }
    })();
  }, [carreraId]);

  // 2) Suscribirse al estado de auth y luego cargar perfiles
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) {
        router.push("/login");
      } else {
        loadPerfiles(user.uid);
      }
    });
    return unsubscribe;
  }, []);

  // Función para cargar perfiles de un uid dado
  const loadPerfiles = async (uid: string) => {
    const lista: Perfil[] = [];

    // a) Perfil principal
    const userDoc = await getDoc(doc(db, "usuarios", uid));
    if (userDoc.exists()) {
      const d = userDoc.data() as any;
      lista.push({
        id: uid,
        nombre: d.nombre,
        apellidoPaterno: d.apPaterno,
        apellidoMaterno: d.apMaterno,
        email: d.email,
        celular: d.celular,
        pais: d.pais,
        estado: d.estado,
        ciudad: d.ciudad,
        club: d.club,
        fechaNacimiento: d.fechaNacimiento,
        edad: d.edad,
      });
    }

    // b) Perfiles secundarios
    const snap = await getDocs(
      collection(db, "usuarios", uid, "perfiles")
    );
    snap.docs.forEach(d => {
      const p = d.data() as any;
      lista.push({
        id: d.id,
        nombre: p.nombre,
        apellidoPaterno: p.apellidoPaterno,
        apellidoMaterno: p.apellidoMaterno,
        email: p.email,
        celular: p.celular,
        pais: p.pais,
        estado: p.estado,
        ciudad: p.ciudad,
        club: p.club,
        fechaNacimiento: p.fechaNacimiento,
        edad: p.edad,
      });
    });

    setPerfiles(lista);
    // Seleccionar automáticamente el primero (principal) si no hay selección
    if (!perfilSeleccionado && lista.length > 0) {
      setPerfilSeleccionado(lista[0].id);
    }
  };

  // 3) Scroll al formulario cuando se abre
  useEffect(() => {
    if (showNewPerfilForm && scrollToFormRef.current) {
      scrollToFormRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [showNewPerfilForm]);

  const calcEdad = (fecha: string) => {
    const hoy = new Date();
    const n = new Date(fecha);
    let edad = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--;
    return edad;
  };

  // 4) Guardar nuevo perfil
  const handleNewPerfilSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const edad = calcEdad(nuevoPerfil.fechaNacimiento);
    await addDoc(collection(db, "usuarios", user.uid, "perfiles"), {
      ...nuevoPerfil,
      edad,
      creado: serverTimestamp(),
    });

    // recargar la lista y seleccionar el último creado
    const uid = user.uid;
    await loadPerfiles(uid);
    setShowNewPerfilForm(false);

    // encontrar el último perfil (el recién añadido)
    const listaActualizada = perfiles; // ya actualizado por loadPerfiles
    if (listaActualizada.length > 1) {
      setPerfilSeleccionado(listaActualizada[listaActualizada.length - 1].id);
    }
  };

  // 5) Enviar inscripción
  const handleInscribir = async () => {
    if (!perfilSeleccionado || !categoriaSeleccionada) {
      setMensaje("Selecciona perfil y categoría");
      return;
    }
    try {
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

  return (
    <ProtectedRoute>
      <AuthGuard>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera?.titulo}</h1>

        {/* Selección de perfil */}
        <div>
          <label className="block font-medium">Selecciona tu perfil</label>
          <select
            className="mt-1 border p-2 rounded w-full"
            value={perfilSeleccionado}
            onChange={e => setPerfilSeleccionado(e.target.value)}
          >
            <option value="">-- Elige un perfil --</option>
            {perfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellidoPaterno} ({p.edad} años)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewPerfilForm(v => !v)}
            className="mt-2 text-blue-600 hover:underline"
          >
            {showNewPerfilForm ? "Cancelar" : "+ Crear nuevo perfil"}
          </button>
        </div>

        {/* Formulario de nuevo perfil */}
        {showNewPerfilForm && (
          <div ref={scrollToFormRef} className="border-t pt-4">
            <h2 className="font-semibold mb-2">Nuevo perfil</h2>
            <form
              onSubmit={handleNewPerfilSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {[
                { name: "nombre", label: "Nombre", type: "text" },
                { name: "apellidoPaterno", label: "Apellido paterno", type: "text" },
                { name: "apellidoMaterno", label: "Apellido materno", type: "text" },
                { name: "email", label: "Correo electrónico", type: "email" },
                { name: "celular", label: "Celular", type: "tel" },
                { name: "pais", label: "País", type: "text" },
                { name: "estado", label: "Estado", type: "text" },
                { name: "ciudad", label: "Ciudad", type: "text" },
                { name: "club", label: "Club (opcional)", type: "text", required: false },
                { name: "fechaNacimiento", label: "Fecha de nacimiento", type: "date" },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium">{field.label}</label>
                  <input
                    name={field.name}
                    type={field.type}
                    value={(nuevoPerfil as any)[field.name]}
                    onChange={e =>
                      setNuevoPerfil(prev => ({ ...prev, [field.name]: e.target.value }))
                    }
                    required={field.required !== false}
                    className="mt-1 block w-full border p-2 rounded"
                  />
                </div>
              ))}
              <button className="col-span-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
                Guardar perfil
              </button>
            </form>
          </div>
        )}

        {/* Selección de categoría e inscripción */}
        {perfilSeleccionado && carrera && (
          <div>
            <label className="block font-medium">Selecciona categoría</label>
            <select
              className="mt-1 border p-2 rounded w-full"
              value={categoriaSeleccionada}
              onChange={e => setCategoriaSeleccionada(e.target.value)}
            >
              <option value="">-- Elige categoría --</option>
              {carrera.categorias
                .filter(cat => {
                  const p = perfiles.find(x => x.id === perfilSeleccionado)!;
                  return p.edad >= cat.minAge && p.edad <= cat.maxAge;
                })
                .map(cat => (
                  <option key={cat.nombre} value={cat.nombre}>
                    {cat.nombre} ({cat.minAge}–{cat.maxAge} años)
                  </option>
                ))}
            </select>
            <button
              onClick={handleInscribir}
              className="mt-4 bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700"
            >
              Inscribirme
            </button>
          </div>
        )}

        {mensaje && <p className="mt-4 text-center text-green-700">{mensaje}</p>}
      </div>
      </AuthGuard>
    </ProtectedRoute>
  );
}