import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import { getDoc, doc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import ProtectedRoute from "@/components/ProtectedRoute";

interface UserData {
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

export default function PerfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      if (usuario) {
        setUser(usuario);
        const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data() as UserData);
        }
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !userData) {
    return (
      <ProtectedRoute>
        <p className="text-center mt-10">Cargando perfil...</p>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-xl mx-auto mt-10 p-6 border rounded-2xl shadow">
        <h1 className="text-2xl font-bold mb-4">Perfil de usuario</h1>
        <p><strong>Nombre:</strong> {userData.nombre} {userData.apellidoPaterno} {userData.apellidoMaterno}</p>
        <p><strong>Correo:</strong> {userData.email}</p>
        <p><strong>Celular:</strong> {userData.celular}</p>
        <p><strong>País:</strong> {userData.pais}</p>
        <p><strong>Estado:</strong> {userData.estado}</p>
        <p><strong>Ciudad:</strong> {userData.ciudad}</p>
        {userData.club && <p><strong>Club:</strong> {userData.club}</p>}
        <p><strong>Fecha de nacimiento:</strong> {userData.fechaNacimiento}</p>
        <p><strong>Edad:</strong> {userData.edad}</p>

        <button
          onClick={handleLogout}
          className="mt-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Cerrar sesión
        </button>
      </div>
    </ProtectedRoute>
  );
}