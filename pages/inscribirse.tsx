// pages/inscribirse.tsx
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { app, db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { registrarInscripcion } from "@/lib/Inscripciones";

interface Carrera {
  id: string;
  titulo: string; 
  categorias: { nombre: string; minAge: number; maxAge: number }[];
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

  // 2) Carga de perfiles del usuario
  useEffect(() => {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    (async () => {
      const snap = await getDocs(
        collection(db, "usuarios", user.uid, "perfiles")
      );
      setPerfiles(
        snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }))
      );
    })();
  }, []);

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
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    const edad = calcEdad(nuevoPerfil.fechaNacimiento);
    await addDoc(collection(db, "usuarios", user.uid, "perfiles"), {
      ...nuevoPerfil,
      edad,
      creado: serverTimestamp(),
    });
    // recarga perfiles
    const snap = await getDocs(
      collection(db, "usuarios", user.uid, "perfiles")
    );
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    setPerfiles(list);
    setShowNewPerfilForm(false);
    setPerfilSeleccionado(list[list.length - 1].id);
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
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{carrera?.titulo}</h1>

        {/* Selección de perfil */}
        <div>
          <label className="block font-medium">Selecciona tu perfil</label>
          <select
            className="mt-1 border p-2 rounded w-full"
            value={perfilSeleccionado}
            onChange={(e) => setPerfilSeleccionado(e.target.value)}
          >
            <option value="">-- Elige un perfil --</option>
            {perfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.apellidoPaterno} ({p.edad} años)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowNewPerfilForm((v) => !v)}
            className="mt-2 text-blue-600 hover:underline"
          >
            {showNewPerfilForm ? "Cancelar" : "+ Crear nuevo perfil"}
          </button>
        </div>

        {/* Formulario completo de nuevo perfil */}
        {showNewPerfilForm && (
          <div ref={scrollToFormRef} className="border-t pt-4">
            <h2 className="font-semibold mb-2">Nuevo perfil</h2>
            <form
              onSubmit={handleNewPerfilSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <input
                name="nombre"
                placeholder="Nombre"
                value={nuevoPerfil.nombre}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, nombre: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="apellidoPaterno"
                placeholder="Apellido paterno"
                value={nuevoPerfil.apellidoPaterno}
                onChange={(e) =>
                  setNuevoPerfil({
                    ...nuevoPerfil,
                    apellidoPaterno: e.target.value,
                  })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="apellidoMaterno"
                placeholder="Apellido materno"
                value={nuevoPerfil.apellidoMaterno}
                onChange={(e) =>
                  setNuevoPerfil({
                    ...nuevoPerfil,
                    apellidoMaterno: e.target.value,
                  })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="email"
                type="email"
                placeholder="Correo electrónico"
                value={nuevoPerfil.email}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, email: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="celular"
                type="tel"
                placeholder="Celular"
                value={nuevoPerfil.celular}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, celular: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="pais"
                placeholder="País"
                value={nuevoPerfil.pais}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, pais: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="estado"
                placeholder="Estado"
                value={nuevoPerfil.estado}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, estado: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="ciudad"
                placeholder="Ciudad"
                value={nuevoPerfil.ciudad}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, ciudad: e.target.value })
                }
                required
                className="border p-2 rounded"
              />
              <input
                name="club"
                placeholder="Club (opcional)"
                value={nuevoPerfil.club}
                onChange={(e) =>
                  setNuevoPerfil({ ...nuevoPerfil, club: e.target.value })
                }
                className="border p-2 rounded"
              />
              <input
                name="fechaNacimiento"
                type="date"
                value={nuevoPerfil.fechaNacimiento}
                onChange={(e) =>
                  setNuevoPerfil({
                    ...nuevoPerfil,
                    fechaNacimiento: e.target.value,
                  })
                }
                required
                className="border p-2 rounded"
              />
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
              onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            >
              <option value="">-- Elige categoría --</option>
              {carrera.categorias
                .filter((cat) => {
                  const p = perfiles.find((x) => x.id === perfilSeleccionado)!;
                  return p.edad >= cat.minAge && p.edad <= cat.maxAge;
                })
                .map((cat) => (
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

        {mensaje && <p className="mt-4 text-center">{mensaje}</p>}
      </div>
    </ProtectedRoute>
  );
}