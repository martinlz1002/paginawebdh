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
  Timestamp,
} from "firebase/firestore";
import { app, db } from "@/lib/firebase";
import AuthGuard from "@/components/AuthGuard";

type Rama = "Femenil" | "Varonil" | "";

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

  rama?: Rama | string;

  fechaNacimiento: string; // YYYY-MM-DD
  edad?: number;
}

function toDateStringYYYYMMDD(value: any): string {
  if (!value) return "";
  if (value instanceof Timestamp) {
    const d = value.toDate();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  } catch {}
  return "";
}

function calcAge(dateYYYYMMDD: string) {
  if (!dateYYYYMMDD) return undefined;
  const today = new Date();
  const birth = new Date(dateYYYYMMDD + "T00:00:00");
  if (isNaN(birth.getTime())) return undefined;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function normalizeRama(v: any): Rama | string {
  const raw = (v ?? "").toString().trim();
  if (!raw) return "";
  const low = raw.toLowerCase();
  if (low === "f" || low === "femenil" || low === "mujer" || low === "female")
    return "Femenil";
  if (low === "m" || low === "varonil" || low === "hombre" || low === "male")
    return "Varonil";
  return raw;
}

function displayRama(v: any): "Femenil" | "Varonil" | "Pendiente" {
  const n = normalizeRama(v);
  if (n === "Femenil" || n === "Varonil") return n;
  return "Pendiente";
}

function normalizeProfile(id: string | undefined, data: any): UserData {
  const apPaterno =
    data?.apPaterno ?? data?.apellidoPaterno ?? data?.apP ?? data?.paterno ?? "";
  const apMaterno =
    data?.apMaterno ?? data?.apellidoMaterno ?? data?.apM ?? data?.materno ?? "";

  const fechaNacimiento = toDateStringYYYYMMDD(
    data?.fechaNacimiento ?? data?.birthDate ?? data?.birthdate
  );

  const rama = normalizeRama(data?.rama ?? data?.sexo);

  return {
    id,
    nombre: data?.nombre ?? "",
    apPaterno: apPaterno ?? "",
    apMaterno: apMaterno ?? "",
    email: data?.email ?? "",
    celular: data?.celular ?? "",
    pais: data?.pais ?? "",
    estado: data?.estado ?? "",
    ciudad: data?.ciudad ?? "",
    club: data?.club ?? "",
    rama,
    fechaNacimiento,
    edad: typeof data?.edad === "number" ? data.edad : calcAge(fechaNacimiento),
  };
}

export default function PerfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [profiles, setProfiles] = useState<UserData[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserData | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserData | null>(null);

  const [formData, setFormData] = useState<UserData>({
    nombre: "",
    apPaterno: "",
    apMaterno: "",
    email: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    rama: "",
    fechaNacimiento: "",
  });

  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const auth = getAuth(app);

  // ✅ evita doble auto-edit por renders/reloads
  const autoEditDoneRef = useRef(false);

  useEffect(() => {
    if (showForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [showForm]);

  const reloadSubProfiles = async (uid: string) => {
    const snap = await getDocs(collection(db, "usuarios", uid, "perfiles"));
    const saved = snap.docs.map((d) => normalizeProfile(d.id, d.data()));
    setProfiles(saved);
    return saved; // <- útil para auto-edit
  };

  const resetForm = () => {
    setFormData({
      nombre: "",
      apPaterno: "",
      apMaterno: "",
      email: "",
      celular: "",
      pais: "",
      estado: "",
      ciudad: "",
      club: "",
      rama: "",
      fechaNacimiento: "",
    });
  };

  const startEdit = (p: UserData) => {
    setEditingProfile(p);
    setFormData({
      id: p.id,
      nombre: p.nombre || "",
      apPaterno: p.apPaterno || "",
      apMaterno: p.apMaterno || "",
      email: p.email || "",
      celular: p.celular || "",
      pais: p.pais || "",
      estado: p.estado || "",
      ciudad: p.ciudad || "",
      club: p.club || "",
      rama: (normalizeRama(p.rama) as any) || "",
      fechaNacimiento: p.fechaNacimiento || "",
      edad: p.edad,
    });
    setShowForm(true);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return router.push("/login");
      setUser(u);

      // principal
      const mainRef = doc(db, "usuarios", u.uid);
      const mainSnap = await getDoc(mainRef);
      let mainData: UserData | null = null;

      if (mainSnap.exists()) {
        mainData = normalizeProfile(u.uid, mainSnap.data());
        setUserData(mainData);
        setSelectedProfile(mainData);
      }

      const subs = await reloadSubProfiles(u.uid);

      // ✅ AUTO EDIT desde query: /perfil?edit=<id>
      const editId = (router.query.edit as string) || "";
      if (editId && !autoEditDoneRef.current) {
        const targetSub = subs.find((p) => p.id === editId);
        const targetMain = mainData?.id === editId ? mainData : null;
        const target = targetSub || targetMain;

        if (target) {
          autoEditDoneRef.current = true;
          setSelectedProfile(target);
          startEdit(target);

          // limpia el query para que no se re-dispare
          router.replace("/perfil", undefined, { shallow: true });
        }
      }

      setLoading(false);
    });

    return () => unsub();
    // ojo: router.query.edit se leerá al entrar; no lo pongo en deps para evitar loops
  }, [auth, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const ramaNorm = normalizeRama(formData.rama);
    const ramaShown = displayRama(ramaNorm);
    if (ramaShown === "Pendiente") {
      alert("Selecciona Rama (Femenil o Varonil).");
      return;
    }

    const edad = calcAge(formData.fechaNacimiento);

    const payload: any = {
      ...formData,
      rama: ramaNorm,
      edad: typeof edad === "number" ? edad : null,
    };
    delete payload.id;

    if (editingProfile?.id) {
      const path =
        editingProfile.id === user.uid
          ? doc(db, "usuarios", user.uid)
          : doc(db, "usuarios", user.uid, "perfiles", editingProfile.id);

      await updateDoc(path, payload);

      // si editaste titular, refresca userData
      if (editingProfile.id === user.uid) {
        const mainSnap = await getDoc(doc(db, "usuarios", user.uid));
        if (mainSnap.exists()) {
          const mainData = normalizeProfile(user.uid, mainSnap.data());
          setUserData(mainData);
          setSelectedProfile(mainData);
        }
      }

      setEditingProfile(null);
    } else {
      await addDoc(collection(db, "usuarios", user.uid, "perfiles"), payload);
    }

    resetForm();
    setShowForm(false);
    await reloadSubProfiles(user.uid);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm("¿Eliminar este perfil?")) return;
    await deleteDoc(doc(db, "usuarios", user.uid, "perfiles", id));
    setProfiles((prev) => prev.filter((x) => x.id !== id));
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading || !userData) {
    return <p className="text-center mt-10 text-gray-800">Cargando perfil…</p>;
  }

  const ramaLabel = displayRama(selectedProfile?.rama);

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
                  else setSelectedProfile(profiles.find((x) => x.id === val) || null);
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

              <p className="text-gray-700 flex items-center gap-2">
                <span className="font-medium">Rama:</span>{" "}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    ramaLabel === "Pendiente"
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-800"
                  }`}
                >
                  {ramaLabel}
                </span>
                {ramaLabel === "Pendiente" && (
                  <button
                    className="text-sm text-purple-600 hover:underline"
                    onClick={() => {
                      if (selectedProfile?.id) startEdit(selectedProfile);
                    }}
                  >
                    Completar
                  </button>
                )}
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
                {selectedProfile?.fechaNacimiento || "-"}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Edad:</span>{" "}
                {selectedProfile?.edad ?? "-"}
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
                resetForm();
              }}
              className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
            >
              {showForm ? "Cancelar" : "Agregar Perfil"}
            </button>

            {showForm && (
              <form onSubmit={handleSave} className="mt-4 space-y-4">
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
                    name={field}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    value={(formData as any)[field] || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                    className="w-full border rounded-md px-3 py-2 text-gray-900 placeholder-gray-400"
                    required={field !== "club"}
                  />
                ))}

                {/* Rama */}
                <select
                  name="rama"
                  value={(formData.rama as any) || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      rama: e.target.value,
                    }))
                  }
                  className="w-full border rounded-md px-3 py-2 text-gray-900"
                  required
                >
                  <option value="">-- Selecciona Rama --</option>
                  <option value="Femenil">Femenil</option>
                  <option value="Varonil">Varonil</option>
                </select>

                {/* Fecha de nacimiento */}
                <input
                  type="date"
                  name="fechaNacimiento"
                  value={formData.fechaNacimiento}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      fechaNacimiento: e.target.value,
                    }))
                  }
                  className="w-full border rounded-md px-3 py-2 text-gray-900 placeholder-gray-400"
                  required
                />

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
              {profiles.map((p) => {
                const r = displayRama(p.rama);
                return (
                  <li
                    key={p.id}
                    className="flex justify-between items-center border-b pb-3"
                  >
                    <span className="text-gray-800">
                      {p.nombre} {p.apPaterno} {p.apMaterno}{" "}
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r === "Pendiente"
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {r}
                      </span>
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
                );
              })}
            </ul>

            {profiles.length === 0 && (
              <p className="text-gray-500">Aún no tienes subperfiles.</p>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
