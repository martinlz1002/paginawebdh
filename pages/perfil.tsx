import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  addDoc,
  getDoc,
  getDocs,
  doc,
  collection,
  updateDoc,
  deleteDoc,
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

export default function PerfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
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
  const [perfiles, setPerfiles] = useState<UserData[]>([]);
  const [perfilSeleccionado, setPerfilSeleccionado] = useState<UserData | null>(null);
  const [editandoPerfil, setEditandoPerfil] = useState<UserData | null>(null);

  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (usuario) => {
      if (usuario) {
        setUser(usuario);
        const userDoc = await getDoc(doc(db, "usuarios", usuario.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserData;
          setUserData(data);
          setPerfilSeleccionado(data);
          const perfilesSnapshot = await getDocs(
            collection(db, "usuarios", usuario.uid, "perfiles")
          );
          const perfilesList = perfilesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as UserData[];
          setPerfiles(perfilesList);
        }
        setLoading(false);
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, []);

  const calcularEdad = (fecha: string) => {
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  const handleAgregarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const perfilConEdad = {
      ...nuevoPerfil,
      edad: calcularEdad(nuevoPerfil.fechaNacimiento),
      creado: new Date(),
    };

    try {
      if (editandoPerfil?.id) {
        await updateDoc(
          doc(db, "usuarios", user.uid, "perfiles", editandoPerfil.id),
          perfilConEdad
        );
        alert("Perfil actualizado");
        setEditandoPerfil(null);
      } else {
        await addDoc(collection(db, "usuarios", user.uid, "perfiles"), perfilConEdad);
        alert("Perfil agregado correctamente");
      }

      setNuevoPerfil({
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

      const perfilesSnapshot = await getDocs(
        collection(db, "usuarios", user.uid, "perfiles")
      );
      const perfilesList = perfilesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserData[];
      setPerfiles(perfilesList);
      setMostrarFormulario(false);
    } catch (error) {
      console.error("Error al agregar/editar perfil:", error);
    }
  };

  const handleEditar = (perfil: UserData) => {
    setEditandoPerfil(perfil);
    setNuevoPerfil({
      nombre: perfil.nombre,
      apellidoPaterno: perfil.apellidoPaterno,
      apellidoMaterno: perfil.apellidoMaterno,
      email: perfil.email || "",
      celular: perfil.celular || "",
      pais: perfil.pais || "",
      estado: perfil.estado || "",
      ciudad: perfil.ciudad || "",
      club: perfil.club || "",
      fechaNacimiento: perfil.fechaNacimiento,
    });
    setMostrarFormulario(true);
  };

  const handleEliminar = async (perfilId: string) => {
    if (!user) return;
    const confirm = window.confirm("¿Seguro que deseas eliminar este perfil?");
    if (!confirm) return;

    await deleteDoc(doc(db, "usuarios", user.uid, "perfiles", perfilId));
    setPerfiles(perfiles.filter((p) => p.id !== perfilId));
    alert("Perfil eliminado");
  };

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
        <div className="mb-6">
          <label className="font-semibold mr-2">Ver perfil de:</label>
          <select
            className="border p-2 rounded"
            onChange={(e) => {
              const seleccion = e.target.value;
              if (seleccion === "titular") {
                setPerfilSeleccionado(userData);
              } else {
                const perfil = perfiles.find((p) => p.id === seleccion);
                setPerfilSeleccionado(perfil || null);
              }
            }}
          >
            <option value="titular">Titular: {userData.nombre}</option>
            {perfiles.map((perfil) => (
              <option key={perfil.id} value={perfil.id}>
                {perfil.nombre} {perfil.apellidoPaterno} {perfil.apellidoMaterno}
              </option>
            ))}
          </select>
        </div>
        <h1 className="text-2xl font-bold mb-4">Perfil de usuario</h1>
        <p>
          <strong>Nombre:</strong> {perfilSeleccionado?.nombre} {perfilSeleccionado?.apellidoPaterno} {perfilSeleccionado?.apellidoMaterno}
        </p>
        <p><strong>Email:</strong> {perfilSeleccionado?.email}</p>
        <p><strong>Celular:</strong> {perfilSeleccionado?.celular}</p>
        <p><strong>País:</strong> {perfilSeleccionado?.pais}</p>
        <p><strong>Estado:</strong> {perfilSeleccionado?.estado}</p>
        <p><strong>Ciudad:</strong> {perfilSeleccionado?.ciudad}</p>
        <p><strong>Fecha de nacimiento:</strong> {perfilSeleccionado?.fechaNacimiento}</p>
        <p><strong>Edad:</strong> {perfilSeleccionado?.edad}</p>
        {perfilSeleccionado?.club && <p><strong>Club:</strong> {perfilSeleccionado.club}</p>}

        <button
          onClick={handleLogout}
          className="mt-6 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="mt-10 border-t pt-6 max-w-xl mx-auto">
        <button
          onClick={() => {
            setMostrarFormulario(!mostrarFormulario);
            setEditandoPerfil(null);
          }}
          className="mb-4 bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
        >
          {mostrarFormulario ? "Cancelar" : "Agregar otro perfil"}
        </button>

        {mostrarFormulario && (
          <form onSubmit={handleAgregarPerfil} className="grid gap-3">
            <input
              type="text"
              placeholder="Nombre"
              value={nuevoPerfil.nombre}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, nombre: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Apellido paterno"
              value={nuevoPerfil.apellidoPaterno}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, apellidoPaterno: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Apellido materno"
              value={nuevoPerfil.apellidoMaterno}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, apellidoMaterno: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="email"
              placeholder="Correo electrónico"
              value={nuevoPerfil.email}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, email: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="tel"
              placeholder="Celular"
              value={nuevoPerfil.celular}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, celular: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="País"
              value={nuevoPerfil.pais}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, pais: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Estado"
              value={nuevoPerfil.estado}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, estado: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Ciudad"
              value={nuevoPerfil.ciudad}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, ciudad: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <input
              type="text"
              placeholder="Club (opcional)"
              value={nuevoPerfil.club}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, club: e.target.value })}
              className="border p-2 rounded"
            />
            <input
              type="date"
              value={nuevoPerfil.fechaNacimiento}
              onChange={(e) => setNuevoPerfil({ ...nuevoPerfil, fechaNacimiento: e.target.value })}
              required
              className="border p-2 rounded"
            />
            <button
              type="submit"
              className="bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              {editandoPerfil ? "Actualizar perfil" : "Guardar perfil"}
            </button>
          </form>
        )}

        {perfiles.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold mb-2">Perfiles existentes:</h3>
            <ul className="space-y-2">
              {perfiles.map((perfil) => (
                <li key={perfil.id} className="border p-3 rounded">
                  <p className="font-medium">
                    {perfil.nombre} {perfil.apellidoPaterno} {perfil.apellidoMaterno}
                  </p>
                  <div className="flex gap-4 mt-2">
                    <button
                      onClick={() => handleEditar(perfil)}
                      className="text-blue-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleEliminar(perfil.id!)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
