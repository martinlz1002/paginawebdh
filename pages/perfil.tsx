// pages/perfil.tsx
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
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

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
  const [profiles, setProfiles] = useState<UserData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserData | null>(null);
  const [editingProfile, setEditingProfile] = useState<UserData | null>(null);

  const router = useRouter();
  const auth = getAuth(app);

  // Scroll al formulario si aparece
  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm]);

  // Carga datos de usuario y perfiles
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);

      // Perfil principal
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

      // Sub-perfiles
      const snap = await getDocs(collection(db, "usuarios", u.uid, "perfiles"));
      setProfiles(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserData) }))
      );
      setLoading(false);
    });
    return () => unsub();
  }, [auth, router]);

  // Calcula edad
  const calcAge = (date: string) => {
    const today = new Date();
    const birth = new Date(date);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Guarda o actualiza perfil
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const profileWithAge = {
      ...newProfile,
      edad: calcAge(newProfile.fechaNacimiento),
    } as any;

    if (editingProfile?.id) {
      if (editingProfile.id === user.uid) {
        // actualizar perfil principal
        await updateDoc(doc(db, "usuarios", user.uid), profileWithAge);
      } else {
        // actualizar sub-perfil
        await updateDoc(
          doc(db, "usuarios", user.uid, "perfiles", editingProfile.id),
          profileWithAge
        );
      }
      setEditingProfile(null);
    } else {
      // crear nuevo sub-perfil
      await addDoc(collection(db, "usuarios", user.uid, "perfiles"), profileWithAge);
    }

    // reset
    setNewProfile({
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
    setShowForm(false);

    // recarga lista
    const snap = await getDocs(collection(db, "usuarios", user.uid, "perfiles"));
    setProfiles(snap.docs.map((d) => ({ id: d.id, ...(d.data() as UserData) })));
  };

  // Inicia edición
  const startEdit = (p: UserData) => {
    setEditingProfile(p);
    setNewProfile(p);
    setShowForm(true);
  };

  // Elimina perfil
  const handleDelete = async (id: string) => {
    if (!user || !confirm("¿Eliminar este perfil?")) return;
    await deleteDoc(doc(db, "usuarios", user.uid, "perfiles", id));
    setProfiles(profiles.filter((x) => x.id !== id));
  };

  // Cerrar sesión
  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !userData) {
    return <p className="text-center mt-10">Cargando perfil…</p>;
  }

  return (
    <AuthGuard>
      <div className="max-w-4xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
        {/* Top */}
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sección principal */}
          <div className="flex-1 bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Mi Perfil</h2>
              <button
                onClick={logout}
                className="text-red-500 hover:text-red-700 transition"
              >
                Cerrar sesión
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Ver como:</label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <p>
                <span className="font-medium">Nombre:</span> {selectedProfile?.nombre}{" "}
                {selectedProfile?.apPaterno} {selectedProfile?.apMaterno}
              </p>
              <p>
                <span className="font-medium">Email:</span> {selectedProfile?.email}
              </p>
              <p>
                <span className="font-medium">Celular:</span> {selectedProfile?.celular}
              </p>
              <p>
                <span className="font-medium">Ubicación:</span> {selectedProfile?.ciudad}, {selectedProfile?.estado}, {selectedProfile?.pais}
              </p>
              <p>
                <span className="font-medium">Nacimiento:</span> {selectedProfile?.fechaNacimiento}
              </p>
              <p>
                <span className="font-medium">Edad:</span> {selectedProfile?.edad}
              </p>
              {selectedProfile?.club && (
                <p>
                  <span className="font-medium">Club:</span> {selectedProfile.club}
                </p>
              )}
            </div>
          </div>

          {/* Formulario perfiles */}
          <div className="w-full md:w-1/3 bg-white rounded-lg shadow-md p-6">
            <button
              onClick={() => {
                setShowForm((prev) => !prev);
                setEditingProfile(null);
              }}
              className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition"
            >
              {showForm ? "Cancelar" : "Agregar Perfil"}
            </button>

            {showForm && (
              <div ref={formRef} className="mt-4 space-y-3">
                <form onSubmit={handleSave} className="space-y-4">
                  {[
                    "nombre",
                    "apPaterno",
                    "apMaterno",
                    "email",
                    "celular",
                    "pais",
                    "estado",
                    "ciudad",
                    "club",
                  ].map((field) => (
                    <input
                      key={field}
                      type={field === "email" ? "email" : "text"}
                      placeholder={
                        field.charAt(0).toUpperCase() + field.slice(1)
                      }
                      value={(newProfile as any)[field] || ""}
                      onChange={(e) =>
                        setNewProfile((prev) => ({
                          ...prev,
                          [field]: e.target.value,
                        }))
                      }
                      className="w-full border rounded-md p-2"
                      required={field !== "club"}
                    />
                  ))}
                  <input
                    type="date"
                    value={newProfile.fechaNacimiento}
                    onChange={(e) =>
                      setNewProfile((prev) => ({
                        ...prev,
                        fechaNacimiento: e.target.value,
                      }))
                    }
                    className="w-full border rounded-md p-2"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition"
                  >
                    {editingProfile ? "Actualizar" : "Guardar"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Lista de perfiles */}
        {profiles.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Perfiles Guardados</h3>
            <ul className="space-y-3">
              {profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between items-center border-b pb-2"
                >
                  <span>
                    {p.nombre} {p.apPaterno} {p.apMaterno}
                  </span>
                  <div className="space-x-4">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-blue-500 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p.id!)}
                      className="text-red-500 hover:underline"
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
    </AuthGuard>
  );
}
