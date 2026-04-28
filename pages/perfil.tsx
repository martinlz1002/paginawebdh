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
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-extrabold text-dh-ink">
          Mi <span className="text-dh-purple">Perfil</span>
        </h1>
      </div>

      {/* PERFIL PRINCIPAL */}
      <div className="card p-8 space-y-8">

        {/* Selector */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-dh-muted">
            Ver como:
          </label>

          <select
            className="w-full bg-white text-gray-900 border border-dh-border rounded-xl px-3 py-2"
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

        {/* DATOS */}
        <div className="grid sm:grid-cols-2 gap-6 text-sm">

          <div>
            <p className="text-dh-muted">Nombre</p>
            <p className="font-semibold text-dh-ink">
              {selectedProfile?.nombre} {selectedProfile?.apPaterno} {selectedProfile?.apMaterno}
            </p>
          </div>

          <div>
            <p className="text-dh-muted">Rama</p>
            <div className="flex items-center gap-3 mt-1">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  ramaLabel === "Pendiente"
                    ? "bg-red-100 text-red-600"
                    : "bg-dh-green/20 text-dh-green"
                }`}
              >
                {ramaLabel}
              </span>

              {ramaLabel === "Pendiente" && (
                <button
                  onClick={() => selectedProfile?.id && startEdit(selectedProfile)}
                  className="text-xs font-semibold text-dh-purple hover:underline"
                >
                  Completar
                </button>
              )}
            </div>
          </div>

          <div>
            <p className="text-dh-muted">Email</p>
            <p className="font-semibold">{selectedProfile?.email || "-"}</p>
          </div>

          <div>
            <p className="text-dh-muted">Celular</p>
            <p className="font-semibold">{selectedProfile?.celular || "-"}</p>
          </div>

          <div>
            <p className="text-dh-muted">Ubicación</p>
            <p className="font-semibold">
              {selectedProfile?.ciudad || "-"}, {selectedProfile?.estado || "-"}, {selectedProfile?.pais || "-"}
            </p>
          </div>

          <div>
            <p className="text-dh-muted">Nacimiento</p>
            <p className="font-semibold">{selectedProfile?.fechaNacimiento || "-"}</p>
          </div>

          <div>
            <p className="text-dh-muted">Edad</p>
            <p className="font-semibold">{selectedProfile?.edad ?? "-"}</p>
          </div>

          {selectedProfile?.club && (
            <div>
              <p className="text-dh-muted">Club</p>
              <p className="font-semibold">{selectedProfile.club}</p>
            </div>
          )}
        </div>
      </div>

      {/* GRID FORM + LISTA */}
      <div className="grid lg:grid-cols-3 gap-8">

        {/* FORM */}
        <div className="card p-6 space-y-5" ref={formRef}>
          <button
            onClick={() => {
              setShowForm((prev) => !prev);
              setEditingProfile(null);
              resetForm();
            }}
            className="btn-primary"
          >
            {showForm ? "Cancelar" : "Agregar Perfil"}
          </button>

          {showForm && (
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
                  name={field}
                  placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                  value={(formData as any)[field] || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  className="w-full bg-white text-gray-900 border border-dh-border rounded-xl px-3 py-2"
                  required={field !== "club"}
                />
              ))}

              <select
                name="rama"
                value={(formData.rama as any) || ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    rama: e.target.value,
                  }))
                }
                className="w-full bg-white text-gray-900 border border-dh-border rounded-xl px-3 py-2"
                required
              >
                <option value="">Selecciona Rama</option>
                <option value="Femenil">Femenil</option>
                <option value="Varonil">Varonil</option>
              </select>

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
                className="w-full bg-white text-gray-900 border border-dh-border rounded-xl px-3 py-2"
                required
              />

              <button
                type="submit"
                className="btn-success"
              >
                {editingProfile ? "Actualizar Perfil" : "Guardar Perfil"}
              </button>
            </form>
          )}
        </div>

        {/* LISTA */}
        <div className="lg:col-span-2 card p-6 space-y-6">
          <h2 className="text-2xl font-bold text-dh-ink">
            Perfiles Guardados
          </h2>

          {profiles.length === 0 && (
            <p className="text-dh-muted">
              Aún no tienes subperfiles.
            </p>
          )}

          <ul className="space-y-4">
            {profiles.map((p) => {
              const r = displayRama(p.rama);

              return (
                <li
                  key={p.id}
                  className="flex justify-between items-center border-b border-dh-border pb-4"
                >
                  <div>
                    <p className="font-semibold text-dh-ink">
                      {p.nombre} {p.apPaterno} {p.apMaterno}
                    </p>

                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        r === "Pendiente"
                          ? "bg-red-100 text-red-600"
                          : "bg-dh-green/20 text-dh-green"
                      }`}
                    >
                      {r}
                    </span>
                  </div>

                  <div className="flex gap-5 text-sm font-semibold">
                    <button
                      onClick={() => startEdit(p)}
                      className="text-dh-purple hover:underline"
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
        </div>

      </div>
    </div>
  </AuthGuard>
)};
