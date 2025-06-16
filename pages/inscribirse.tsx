import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  getAuth,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Carrera {
  id: string;
  titulo: string;
  descripcion?: string;
  ubicacion?: string;
  fecha: Date;
  imagenUrl?: string;
}

interface PerfilData {
  id: string; // id del doc en subcolección "perfiles", o "titular"
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email?: string;
  celular?: string;
  pais?: string;
  estado?: string;
  ciudad?: string;
  club?: string;
  fechaNacimiento: string; // ISO
  edad?: number;
}

export default function InscribirsePage() {
  const router = useRouter();
  const { carreraId } = router.query;
  const [carrera, setCarrera] = useState<Carrera | null>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [perfiles, setPerfiles] = useState<PerfilData[]>([]);
  const [perfilId, setPerfilId] = useState<string>(""); 
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<PerfilData | null>(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevoPerfil, setNuevoPerfil] = useState<Omit<PerfilData, "id">>({
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
    edad: undefined,
  });
  const [mensaje, setMensaje] = useState<string | null>(null);

  // 1) Carga carrera
  useEffect(() => {
    if (!carreraId) return;
    (async () => {
      const docCar = await getDoc(doc(db, "carreras", String(carreraId)));
      if (docCar.exists()) {
        const d = docCar.data();
        setCarrera({
          id: docCar.id,
          titulo: d.titulo,
          descripcion: d.descripcion,
          ubicacion: d.ubicacion,
          fecha: d.fecha.toDate(),
          imagenUrl: d.imagenUrl,
        });
      }
    })();
  }, [carreraId]);

  // 2) Autenticación y carga de perfiles
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/login");
      setUser(u);
      // perfil titular
      const userDoc = await getDoc(doc(db, "usuarios", u.uid));
      if (userDoc.exists()) {
        const data = userDoc.data() as any;
        const titular: PerfilData = {
          id: "titular",
          ...data,
        };
        // subperfiles
        const snap = await getDocs(
          collection(db, "usuarios", u.uid, "perfiles")
        );
        const subs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as PerfilData[];
        setPerfiles([titular, ...subs]);
        setPerfilId("titular");
        setPerfilSeleccionado(titular);
      }
    });
    return () => unsub();
  }, [router]);

  // Actualiza perfilSeleccionado según perfilId
  useEffect(() => {
    if (!perfilId) return;
    const p = perfiles.find((x) => x.id === perfilId) || null;
    setPerfilSeleccionado(p);
    setMostrarNuevo(false);
    setMensaje(null);
  }, [perfilId, perfiles]);

  // Handler para crear inscripción
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !carrera || !perfilSeleccionado) return;
    try {
      await addDoc(collection(db, "inscripciones"), {
        carreraId: carrera.id,
        perfilId: perfilSeleccionado.id,
        ...perfilSeleccionado,
        creado: serverTimestamp(),
      });
      setMensaje("¡Inscripción exitosa!");
    } catch (err) {
      console.error(err);
      setMensaje("Error al inscribirse.");
    }
  };

  if (!carrera || !user || !perfilSeleccionado) {
    return <p className="p-6 text-center">Cargando…</p>;
  }

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Inscribirse: {carrera.titulo}</h1>

      {/* Selección de perfil */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Usar perfil:</label>
        <select
          className="w-full border p-2 rounded"
          value={perfilId}
          onChange={(e) => setPerfilId(e.target.value)}
        >
          {perfiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === "titular"
                ? `Titular: ${p.nombre} ${p.apellidoPaterno}`
                : `${p.nombre} ${p.apellidoPaterno}`}
            </option>
          ))}
          <option value="__nuevo">Crear nuevo perfil…</option>
        </select>
      </div>

      {/* Formulario para nuevo perfil */}
      {perfilId === "__nuevo" && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!user) return;
            // calcula edad
            const edad = Math.floor(
              (Date.now() -
                new Date(nuevoPerfil.fechaNacimiento).getTime()) /
                (1000 * 60 * 60 * 24 * 365)
            );
            const docRef = await addDoc(
              collection(db, "usuarios", user.uid, "perfiles"),
              { ...nuevoPerfil, edad }
            );
            setPerfiles((prev) => [
              ...prev,
              { id: docRef.id, ...nuevoPerfil, edad },
            ]);
            setPerfilId(docRef.id);
          }}
          className="mb-6 grid gap-3"
        >
          {[
            { key: "nombre", label: "Nombre" },
            { key: "apellidoPaterno", label: "Apellido paterno" },
            { key: "apellidoMaterno", label: "Apellido materno" },
            { key: "email", label: "Correo", type: "email" },
            { key: "celular", label: "Celular", type: "tel" },
            { key: "pais", label: "País" },
            { key: "estado", label: "Estado" },
            { key: "ciudad", label: "Ciudad" },
            { key: "club", label: "Club (opcional)", required: false },
            { key: "fechaNacimiento", label: "Fecha nacimiento", type: "date" },
          ].map(({ key, label, type, required = true }) => (
            <div key={key}>
              <label className="block text-sm font-medium">{label}</label>
              <input
                type={type || "text"}
                required={required}
                className="mt-1 w-full border p-2 rounded"
                value={(nuevoPerfil as any)[key]}
                onChange={(e) =>
                  setNuevoPerfil((p) => ({
                    ...p,
                    [key]: e.target.value,
                  }))
                }
              />
            </div>
          ))}
          <button
            type="submit"
            className="bg-green-600 text-white py-2 rounded hover:bg-green-700 w-full"
          >
            Guardar nuevo perfil
          </button>
        </form>
      )}

      {/* Vista previa del perfil seleccionado */}
      <div className="mb-6 p-4 bg-gray-50 rounded">
        <p>
          <strong>Nombre:</strong> {perfilSeleccionado.nombre}{" "}
          {perfilSeleccionado.apellidoPaterno}{" "}
          {perfilSeleccionado.apellidoMaterno}
        </p>
        <p>
          <strong>Email:</strong> {perfilSeleccionado.email}
        </p>
        <p>
          <strong>Celular:</strong> {perfilSeleccionado.celular}
        </p>
        {/* …otros campos… */}
      </div>

      {/* Botón inscribirse */}
      <button
        onClick={handleSubmit}
        className="bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 w-full"
      >
        Confirmar inscripción
      </button>

      {mensaje && (
        <p className="mt-4 text-center text-green-600">{mensaje}</p>
      )}
    </div>
  );
}