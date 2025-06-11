import { useEffect, useState } from "react";
import { collection, getDocs, Timestamp } from "firebase/firestore";
import { db, app } from "@/lib/firebase";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";

interface Carrera {
  id: string;
  titulo: string;
  descripcion: string;
  ubicacion: string;
  fecha: Date;
}

export default function HomePage() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const auth = getAuth(app);

  useEffect(() => {
    setIsClient(true);

    const unsubscribe = onAuthStateChanged(auth, (usuario) => {
      setUser(usuario);
    });

    const cargarCarreras = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "carreras"));
        const carrerasData: Carrera[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            titulo: data.titulo,
            descripcion: data.descripcion,
            ubicacion: data.ubicacion,
            fecha: (data.fecha instanceof Timestamp)
              ? data.fecha.toDate()
              : new Date(data.fecha),
          };
        });
        setCarreras(carrerasData);
      } catch (error) {
        console.error("Error cargando carreras:", error);
      }
    };

    cargarCarreras();
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
  };

  if (!isClient) return null;

  return (
    <div className="min-h-screen bg-white p-4">
      <header className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Cronometraje App</h2>
        <div className="space-x-4">
          {user ? (
            <>
              <a href="/perfil" className="text-green-700 hover:underline">Mi perfil</a>
              <button onClick={handleLogout} className="text-red-600 hover:underline">
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="text-blue-600 hover:underline">Iniciar sesión</a>
              <a href="/signup" className="text-purple-600 hover:underline">Registrarse</a>
            </>
          )}
        </div>
      </header>

      <h1 className="text-3xl font-bold text-center mb-8">Carreras disponibles</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {carreras.map((carrera) => (
          <div
            key={carrera.id}
            className="p-4 border rounded-2xl shadow hover:shadow-md transition"
          >
            <h2 className="text-xl font-semibold mb-1">{carrera.titulo}</h2>
            <p className="text-gray-700 mb-1">{carrera.descripcion}</p>
            <p className="text-gray-600 text-sm mb-1">{carrera.ubicacion}</p>
            <p className="text-gray-500 text-sm">
              Fecha: {carrera.fecha.toLocaleDateString()}
            </p>
            <a
              href={`/inscribirse?id=${carrera.id}`}
              className="inline-block mt-3 text-green-600 hover:underline"
            >
              Inscribirse →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}