import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";

interface UserData {
  id?: string;
  nombre: string;
  apPaterno: string;
  apMaterno: string;
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
  const [profiles, setProfiles] = useState<UserData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserData | null>(null);
  const [newProfile, setNewProfile] = useState<UserData>({
    nombre: "",
    apPaterno: "",
    apMaterno: "",
    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const auth = getAuth(app);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/login");
      setUser(u);
      // principal
      const mainRef = doc(db, "usuarios", u.uid);
      const mainSnap = await getDoc(mainRef);
      if (mainSnap.exists()) {
        const data = mainSnap.data() as any;
        const mainData: UserData = {
          id: u.uid,
          nombre: data.nombre,
          apPaterno: data.apPaterno,
          apMaterno: data.apMaterno,
          email: data.email,
          celular: data.celular,
          pais: data.pais,
          estado: data.estado,
          ciudad: data.ciudad,
          club: data.club,
          fechaNacimiento: data.fechaNacimiento,
          edad: data.edad,
        };
        setUserData(mainData);
        setSelectedProfile(mainData);
      }
      // sub-perfiles
      const snap = await getDocs(collection(db, "usuarios", u.uid, "perfiles"));
      const saved = snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserData) }));
      setProfiles(saved);
      setLoading(false);
    });
    return () => unsub();
  }, [auth, router]);

  const calcAge = (date: string) => {
    const today = new Date();
    const birth = new Date(date);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const profileWithAge = { ...newProfile, edad: calcAge(newProfile.fechaNacimiento) } as any;
    if (editingProfile?.id) {
      // update existing
      const path =
        editingProfile.id === user.uid
          ? doc(db, "usuarios", user.uid)
          : doc(db, "usuarios", user.uid, "perfiles", editingProfile.id);
      await updateDoc(path, profileWithAge);
      setEditingProfile(null);
    } else {
      await addDoc(collection(db, "usuarios", user.uid, "perfiles"), profileWithAge);
    }
    // reset form and reload
    setNewProfile({ nombre: "", apPaterno: "", apMaterno: "", email: "", celular: "", pais: "", estado: "", ciudad: "", club: "", fechaNacimiento: "" });
    setShowForm(false);
    const snap = await getDocs(collection(db, "usuarios", user.uid, "perfiles"));
    setProfiles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserData) })));
  };

  const startEdit = (p: UserData) => {
    setEditingProfile(p);
    setNewProfile(p);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm("¿Eliminar este perfil?")) return;
    await deleteDoc(doc(db, "usuarios", user.uid, "perfiles", id));
    setProfiles(profiles.filter((x) => x.id !== id));
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !userData) {
    return <p className="text-center mt-10 text-gray-800">Cargando perfil…</p>;
  }

  return (
    <AuthGuard>
      <div className="max-w-5xl mx-auto p-6 space-y-8 text-gray-800">
        {/* Mi Perfil Card */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h1 className="text-3xl font-bold text-green-800">Mi Perfil</h1>
            <button onClick={logout} className="text-red-500 hover:text-red-700">
              Cerrar sesión
            </button>
          </div>
          <div className="px-6 py-8 space-y-6">
            {/* Ver como */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Ver como:
              </label>
              <select
                className="w-full border rounded-md p-2"
                value={selectedProfile?.id || userData.id}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === userData.id) setSelectedProfile(userData);
                  else
                    setSelectedProfile(
                      profiles.find((x) => x.id === val) || null
                    );
                }}
              >
                <option value={userData.id}>
                  Titular: {userData.nombre} {userData.apPaterno}
                </option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} {p.apPaterno}
                  </option>
                ))}
              </select>
            </div>

            {/* Datos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <p className="text-gray-700">
                <span className="font-medium">Nombre:</span>{" "}
                {selectedProfile?.nombre} {selectedProfile?.apPaterno}{" "}
                {selectedProfile?.apMaterno}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Email:</span>{" "}
                {selectedProfile?.email || "-"}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Celular:</span>{" "}
                {selectedProfile?.celular || "-"}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Ubicación:</span>{" "}
                {selectedProfile?.ciudad || "-"}, {selectedProfile?.estado || "-"},{" "}
                {selectedProfile?.pais || "-"}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Nacimiento:</span>{" "}
                {selectedProfile?.fechaNacimiento}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Edad:</span>{" "}
                {selectedProfile?.edad}
              </p>
              {selectedProfile?.club && (
                <p className="text-gray-700">
                  <span className="font-medium">Club:</span>{" "}
                  {selectedProfile.club}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Formulario y Lista */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="bg-white rounded-2xl shadow-md p-6" ref={formRef}>
            <button
              onClick={() => {
                setShowForm((prev) => !prev);
                setEditingProfile(null);
              }}
              className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
            >
              {showForm ? "Cancelar" : "Agregar Perfil"}
            </button>

            {showForm && (
              <form onSubmit={handleSave} className="mt-4 space-y-4">
                {/* inputs… */}
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
                >
                  {editingProfile ? "Actualizar" : "Guardar"}
                </button>
              </form>
            )}
          </div>

          {/* Lista de perfiles */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-md p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Perfiles Guardados
            </h2>
            <ul className="space-y-4">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between items-center border-b pb-3"
                >
                  <span className="text-gray-800">
                    {p.nombre} {p.apPaterno} {p.apMaterno}
                  </span>
                  <div className="space-x-4">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-green-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id!)}
                      className="text-red-600 hover:underline"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}