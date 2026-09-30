import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

import {
  getAuth,
  onAuthStateChanged,
  signOut,
  User,
} from "firebase/auth";

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

import {
  Country,
  State,
  City,
} from "country-state-city";


type Rama = "Femenil" | "Varonil" | "";


interface UserData {
  id?: string;

  nombre: string;
  apPaterno: string;
  apMaterno: string;

  email?: string;
  celular?: string;
  telefonoEmergencia?: string;

  pais?: string;
  estado?: string;
  ciudad?: string;

  club?: string;

  rama?: Rama | string;

  tallaPlayera?: string;

  fechaNacimiento: string;
  edad?: number;
}


/* =========================================================
   ESTILOS
========================================================= */

const inputClass =
  "w-full bg-[#1f1f24] text-white border border-white/10 rounded-xl px-4 py-3 outline-none transition placeholder:text-gray-400 focus:ring-2 focus:ring-dh-purple/30 focus:border-dh-purple";

const labelClass =
  "block text-sm font-semibold text-gray-200 mb-2";


/* =========================================================
   FECHA
========================================================= */

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
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

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


/* =========================================================
   EDAD
========================================================= */

function calcAge(dateYYYYMMDD: string) {
  if (!dateYYYYMMDD) return undefined;

  const today = new Date();

  const birth = new Date(
    dateYYYYMMDD + "T00:00:00"
  );

  if (isNaN(birth.getTime())) {
    return undefined;
  }

  let age =
    today.getFullYear() -
    birth.getFullYear();

  const m =
    today.getMonth() -
    birth.getMonth();

  if (
    m < 0 ||
    (
      m === 0 &&
      today.getDate() < birth.getDate()
    )
  ) {
    age--;
  }

  return age;
}


/* =========================================================
   RAMA
========================================================= */

function normalizeRama(v: any): Rama | string {
  const raw = (v ?? "")
    .toString()
    .trim();

  if (!raw) return "";

  const low = raw.toLowerCase();

  if (
    low === "f" ||
    low === "femenil" ||
    low === "mujer" ||
    low === "female"
  ) {
    return "Femenil";
  }

  if (
    low === "m" ||
    low === "varonil" ||
    low === "hombre" ||
    low === "male"
  ) {
    return "Varonil";
  }

  return raw;
}


function displayRama(
  v: any
): "Femenil" | "Varonil" | "Pendiente" {
  const n = normalizeRama(v);

  if (n === "Femenil") return "Femenil";

  if (n === "Varonil") return "Varonil";

  return "Pendiente";
}


/* =========================================================
   NORMALIZAR PERFIL
========================================================= */

function normalizeProfile(
  id: string | undefined,
  data: any
): UserData {

  const apPaterno =
    data?.apPaterno ??
    data?.apellidoPaterno ??
    data?.apP ??
    data?.paterno ??
    "";

  const apMaterno =
    data?.apMaterno ??
    data?.apellidoMaterno ??
    data?.apM ??
    data?.materno ??
    "";

  const fechaNacimiento =
    toDateStringYYYYMMDD(
      data?.fechaNacimiento ??
      data?.birthDate ??
      data?.birthdate
    );

  const rama =
    normalizeRama(
      data?.rama ??
      data?.sexo
    );

  return {
    id,

    nombre: data?.nombre ?? "",

    apPaterno:
      apPaterno ?? "",

    apMaterno:
      apMaterno ?? "",

    email:
      data?.email ?? "",

    celular:
      data?.celular ?? "",

    telefonoEmergencia:
      data?.telefonoEmergencia ?? "",

    pais:
      data?.pais ?? "",

    estado:
      data?.estado ?? "",

    ciudad:
      data?.ciudad ?? "",

    club:
      data?.club ?? "",

    rama,

    tallaPlayera:
      data?.tallaPlayera ?? "",

    fechaNacimiento,

    edad:
      typeof data?.edad === "number"
        ? data.edad
        : calcAge(fechaNacimiento),
  };
}


/* =========================================================
   FORMULARIO VACÍO
========================================================= */

function emptyForm(): UserData {
  return {
    nombre: "",
    apPaterno: "",
    apMaterno: "",

    email: "",
    celular: "",
    telefonoEmergencia: "",

    pais: "",
    estado: "",
    ciudad: "",

    club: "",

    rama: "",

    tallaPlayera: "",

    fechaNacimiento: "",
  };
}


/* =========================================================
   PÁGINA
========================================================= */

export default function PerfilPage() {

  const [user, setUser] =
    useState<User | null>(null);

  const [userData, setUserData] =
    useState<UserData | null>(null);

  const [profiles, setProfiles] =
    useState<UserData[]>([]);

  const [selectedProfile, setSelectedProfile] =
    useState<UserData | null>(null);


  const [showForm, setShowForm] =
    useState(false);

  const [editingProfile, setEditingProfile] =
    useState<UserData | null>(null);


  const [formData, setFormData] =
    useState<UserData>(
      emptyForm()
    );


  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);


  const formRef =
    useRef<HTMLDivElement>(null);


  const router =
    useRouter();

  const auth =
    getAuth(app);


  const autoEditDoneRef =
    useRef(false);


  /* =====================================================
     CATÁLOGOS
  ===================================================== */

  const paises =
    Country.getAllCountries();


  const estados =
    formData.pais
      ? State.getStatesOfCountry(
          formData.pais
        )
      : [];


  const ciudades =
    formData.pais &&
    formData.estado
      ? City.getCitiesOfState(
          formData.pais,
          formData.estado
        )
      : [];


  /* =====================================================
     SCROLL AL FORMULARIO
  ===================================================== */

  useEffect(() => {

    if (
      showForm &&
      formRef.current
    ) {
      formRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

  }, [showForm]);


  /* =====================================================
     CARGAR SUBPERFILES
  ===================================================== */

  const reloadSubProfiles =
    async (uid: string) => {

      const snap =
        await getDocs(
          collection(
            db,
            "usuarios",
            uid,
            "perfiles"
          )
        );

      const saved =
        snap.docs.map((d) =>
          normalizeProfile(
            d.id,
            d.data()
          )
        );

      setProfiles(saved);

      return saved;
    };


  /* =====================================================
     RESET
  ===================================================== */

  const resetForm = () => {
    setFormData(
      emptyForm()
    );
  };


  /* =====================================================
     EDITAR PERFIL
  ===================================================== */

  const startEdit =
    (p: UserData) => {

      setEditingProfile(p);

      setFormData({

        id: p.id,

        nombre:
          p.nombre || "",

        apPaterno:
          p.apPaterno || "",

        apMaterno:
          p.apMaterno || "",

        email:
          p.email || "",

        celular:
          p.celular || "",

        telefonoEmergencia:
          p.telefonoEmergencia || "",

        pais:
          p.pais || "",

        estado:
          p.estado || "",

        ciudad:
          p.ciudad || "",

        club:
          p.club || "",

        rama:
          (normalizeRama(
            p.rama
          ) as Rama) || "",

        tallaPlayera:
          p.tallaPlayera || "",

        fechaNacimiento:
          p.fechaNacimiento || "",

        edad:
          p.edad,
      });

      setSelectedProfile(p);

      setShowForm(true);
    };


  /* =====================================================
     AGREGAR PERFIL
  ===================================================== */

  const startAddProfile = () => {

    setEditingProfile(null);

    resetForm();

    setShowForm(true);
  };


  /* =====================================================
     AUTENTICACIÓN Y CARGA
  ===================================================== */

  useEffect(() => {

    const unsub =
      onAuthStateChanged(
        auth,
        async (u) => {

          if (!u) {

            router.push(
              "/login"
            );

            return;
          }


          try {

            setUser(u);


            /* TITULAR */

            const mainRef =
              doc(
                db,
                "usuarios",
                u.uid
              );


            const mainSnap =
              await getDoc(
                mainRef
              );


            let mainData:
              UserData | null =
              null;


            if (
              mainSnap.exists()
            ) {

              mainData =
                normalizeProfile(
                  u.uid,
                  mainSnap.data()
                );


              /*
               * Firebase Auth es la fuente real
               * del correo del titular.
               */

              mainData.email =
                u.email ||
                mainData.email ||
                "";


              setUserData(
                mainData
              );

              setSelectedProfile(
                mainData
              );
            }


            /* SUBPERFILES */

            const subs =
              await reloadSubProfiles(
                u.uid
              );


            /* AUTO EDIT */

            const editId =
              (router.query.edit as string) ||
              "";


            if (
              editId &&
              !autoEditDoneRef.current
            ) {

              const targetSub =
                subs.find(
                  (p) =>
                    p.id === editId
                );


              const targetMain =
                mainData?.id === editId
                  ? mainData
                  : null;


              const target =
                targetSub ||
                targetMain;


              if (target) {

                autoEditDoneRef.current =
                  true;


                setSelectedProfile(
                  target
                );


                startEdit(
                  target
                );


                router.replace(
                  "/perfil",
                  undefined,
                  {
                    shallow: true,
                  }
                );
              }
            }

          } catch (error) {

            console.error(
              "Error cargando perfil:",
              error
            );

          } finally {

            setLoading(false);
          }
        }
      );


    return () =>
      unsub();

  }, [auth, router]);


  /* =====================================================
     CAMBIOS DE CAMPOS
  ===================================================== */

  const handleFieldChange = (
    field: keyof UserData,
    value: string
  ) => {

    setFormData(
      (prev) => ({
        ...prev,
        [field]: value,
      })
    );
  };


  /* =====================================================
     PAÍS
  ===================================================== */

  const handleCountryChange =
    (value: string) => {

      setFormData(
        (prev) => ({
          ...prev,

          pais:
            value,

          estado:
            "",

          ciudad:
            "",
        })
      );
    };


  /* =====================================================
     ESTADO
  ===================================================== */

  const handleStateChange =
    (value: string) => {

      setFormData(
        (prev) => ({
          ...prev,

          estado:
            value,

          ciudad:
            "",
        })
      );
    };


  /* =====================================================
     GUARDAR
  ===================================================== */

  const handleSave =
    async (
      e: React.FormEvent
    ) => {

      e.preventDefault();


      if (
        !user ||
        saving
      ) {
        return;
      }


      /* RAMA */

      const ramaNorm =
        normalizeRama(
          formData.rama
        );


      if (
        displayRama(
          ramaNorm
        ) === "Pendiente"
      ) {

        alert(
          "Selecciona Rama (Femenil o Varonil)."
        );

        return;
      }


      /* NOMBRE */

      if (
        !formData.nombre.trim()
      ) {

        alert(
          "Ingresa el nombre."
        );

        return;
      }


      /* PATERNO */

      if (
        !formData.apPaterno.trim()
      ) {

        alert(
          "Ingresa el apellido paterno."
        );

        return;
      }


      /* MATERNO */

      if (
        !formData.apMaterno.trim()
      ) {

        alert(
          "Ingresa el apellido materno."
        );

        return;
      }


      /* CELULAR */

      if (
        !formData.celular ||
        formData.celular.length !== 10
      ) {

        alert(
          "El celular debe tener 10 dígitos."
        );

        return;
      }


      /* EMERGENCIA */

      if (
        !formData.telefonoEmergencia ||
        formData.telefonoEmergencia.length !== 10
      ) {

        alert(
          "El teléfono de emergencia debe tener 10 dígitos."
        );

        return;
      }


      /* UBICACIÓN */

      if (!formData.pais) {

        alert(
          "Selecciona el país."
        );

        return;
      }


      if (!formData.estado) {

        alert(
          "Selecciona el estado."
        );

        return;
      }


      if (!formData.ciudad) {

        alert(
          "Selecciona la ciudad."
        );

        return;
      }


      /* TALLA */

      if (
        !formData.tallaPlayera
      ) {

        alert(
          "Selecciona la talla de playera."
        );

        return;
      }


      /* NACIMIENTO */

      if (
        !formData.fechaNacimiento
      ) {

        alert(
          "Selecciona la fecha de nacimiento."
        );

        return;
      }


      const edad =
        calcAge(
          formData.fechaNacimiento
        );


      if (
        typeof edad !== "number" ||
        edad < 0
      ) {

        alert(
          "La fecha de nacimiento no es válida."
        );

        return;
      }


      setSaving(true);


      try {

        const payload: any = {

          nombre:
            formData.nombre.trim(),

          apPaterno:
            formData.apPaterno.trim(),

          apMaterno:
            formData.apMaterno.trim(),

          email:
            formData.email?.trim() ||
            "",

          celular:
            formData.celular.trim(),

          telefonoEmergencia:
            formData.telefonoEmergencia.trim(),

          pais:
            formData.pais,

          estado:
            formData.estado,

          ciudad:
            formData.ciudad,

          club:
            formData.club?.trim() ||
            "",

          rama:
            ramaNorm,

          tallaPlayera:
            formData.tallaPlayera,

          fechaNacimiento:
            formData.fechaNacimiento,

          edad,
        };


        /* =============================================
           EDITAR
        ============================================= */

        if (
          editingProfile?.id
        ) {

          const isMainProfile =
            editingProfile.id ===
            user.uid;


          /*
           * No cambiamos el email del titular
           * desde Firestore.
           */

          if (
            isMainProfile
          ) {

            payload.email =
              user.email ||
              formData.email?.trim() ||
              "";
          }


          const path =
            isMainProfile
              ? doc(
                  db,
                  "usuarios",
                  user.uid
                )
              : doc(
                  db,
                  "usuarios",
                  user.uid,
                  "perfiles",
                  editingProfile.id
                );


          await updateDoc(
            path,
            payload
          );


          /* TITULAR */

          if (
            isMainProfile
          ) {

            const mainSnap =
              await getDoc(
                doc(
                  db,
                  "usuarios",
                  user.uid
                )
              );


            if (
              mainSnap.exists()
            ) {

              const mainData =
                normalizeProfile(
                  user.uid,
                  mainSnap.data()
                );


              mainData.email =
                user.email ||
                mainData.email ||
                "";


              setUserData(
                mainData
              );

              setSelectedProfile(
                mainData
              );
            }


          } else {

            /* SUBPERFIL */

            const updatedProfile =
              normalizeProfile(
                editingProfile.id,
                payload
              );


            setProfiles(
              (prev) =>
                prev.map(
                  (p) =>
                    p.id ===
                    editingProfile.id
                      ? updatedProfile
                      : p
                )
            );


            setSelectedProfile(
              updatedProfile
            );
          }


        } else {

          /* ===========================================
             NUEVO SUBPERFIL
          =========================================== */

          const ref =
            await addDoc(
              collection(
                db,
                "usuarios",
                user.uid,
                "perfiles"
              ),
              payload
            );


          const newProfile =
            normalizeProfile(
              ref.id,
              payload
            );


          setProfiles(
            (prev) => [
              ...prev,
              newProfile,
            ]
          );


          setSelectedProfile(
            newProfile
          );
        }


        resetForm();

        setEditingProfile(
          null
        );

        setShowForm(
          false
        );


        await reloadSubProfiles(
          user.uid
        );


      } catch (error: any) {

        console.error(
          "Error guardando perfil:",
          error
        );


        alert(
          "No se pudo guardar el perfil: " +
            (
              error?.message ||
              "Error desconocido"
            )
        );

      } finally {

        setSaving(false);
      }
    };


  /* =====================================================
     ELIMINAR
  ===================================================== */

  const handleDelete =
    async (
      id: string
    ) => {

      if (
        !user ||
        deleting
      ) {
        return;
      }


      if (
        !confirm(
          "¿Eliminar este perfil? Esta acción no se puede deshacer."
        )
      ) {
        return;
      }


      setDeleting(
        true
      );


      try {

        await deleteDoc(
          doc(
            db,
            "usuarios",
            user.uid,
            "perfiles",
            id
          )
        );


        setProfiles(
          (prev) =>
            prev.filter(
              (x) =>
                x.id !== id
            )
        );


        if (
          selectedProfile?.id === id
        ) {

          setSelectedProfile(
            userData
          );
        }

      } catch (error: any) {

        console.error(
          "Error eliminando perfil:",
          error
        );


        alert(
          "No se pudo eliminar el perfil: " +
            (
              error?.message ||
              "Error desconocido"
            )
        );

      } finally {

        setDeleting(
          false
        );
      }
    };


  /* =====================================================
     LOGOUT
  ===================================================== */

  const logout =
    async () => {

      await signOut(
        auth
      );

      router.push(
        "/login"
      );
    };


  /* =====================================================
     NOMBRES DE UBICACIÓN
  ===================================================== */

  const getCountryName =
    (code?: string) => {

      if (!code) {
        return "-";
      }

      return (
        Country.getCountryByCode(
          code
        )?.name ||
        code
      );
    };


  const getStateName =
    (
      countryCode?: string,
      stateCode?: string
    ) => {

      if (
        !countryCode ||
        !stateCode
      ) {
        return "-";
      }

      return (
        State.getStateByCodeAndCountry(
          stateCode,
          countryCode
        )?.name ||
        stateCode
      );
    };


  /* =====================================================
     NOMBRE COMPLETO
  ===================================================== */

  const getFullName =
    (p: UserData | null) => {

      if (!p) {
        return "-";
      }

      return [
        p.nombre,
        p.apPaterno,
        p.apMaterno,
      ]
        .filter(Boolean)
        .join(" ")
        .trim() || "-";
    };


  /* =====================================================
     LOADING
  ===================================================== */

  if (
    loading ||
    !userData
  ) {

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#111116]">

        <p className="text-gray-200 font-medium">
          Cargando perfil…
        </p>

      </div>
    );
  }


  const ramaLabel =
    displayRama(
      selectedProfile?.rama
    );


  const selectedCountry =
    getCountryName(
      selectedProfile?.pais
    );


  const selectedState =
    getStateName(
      selectedProfile?.pais,
      selectedProfile?.estado
    );


  /* =====================================================
     RENDER
  ===================================================== */

  return (

    <AuthGuard>

      <div className="min-h-screen bg-[#111116]">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">


          {/* =================================================
              HEADER
          ================================================= */}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div>

              <p className="text-sm font-semibold text-dh-purple mb-1">
                CUENTA DH TIME
              </p>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white">

                Mi{" "}

                <span className="text-dh-purple">
                  Perfil
                </span>

              </h1>

              <p className="mt-2 text-gray-400">
                Administra tus datos personales y los perfiles de tus acompañantes.
              </p>

            </div>


            <button
              onClick={logout}
              className="self-start sm:self-auto px-4 py-2 rounded-xl border border-red-500/30 bg-[#1f1f24] text-red-400 font-semibold hover:bg-red-50 transition"
            >
              Cerrar sesión
            </button>

          </div>


          {/* =================================================
              SELECTOR
          ================================================= */}

          <div className="rounded-3xl bg-[#1f1f24] border border-white/10 shadow-xl p-5 sm:p-6">

            <div className="flex flex-col lg:flex-row lg:items-end gap-4">

              <div className="flex-1">

                <label className={labelClass}>
                  Perfil seleccionado
                </label>

                <select
                  className={inputClass}
                  value={
                    selectedProfile?.id ||
                    userData.id
                  }
                  onChange={(e) => {

                    const val =
                      e.target.value;


                    if (
                      val ===
                      userData.id
                    ) {

                      setSelectedProfile(
                        userData
                      );

                    } else {

                      const profile =
                        profiles.find(
                          (x) =>
                            x.id === val
                        );


                      if (profile) {

                        setSelectedProfile(
                          profile
                        );
                      }
                    }
                  }}
                >

                  <option
                    value={
                      userData.id
                    }
                  >
                    Titular:{" "}
                    {userData.nombre}{" "}
                    {userData.apPaterno}
                  </option>


                  {profiles.map(
                    (p) => (

                      <option
                        key={p.id}
                        value={p.id}
                      >
                        {p.nombre}{" "}
                        {p.apPaterno}
                      </option>

                    )
                  )}

                </select>

              </div>


              <button
                onClick={() =>
                  selectedProfile &&
                  startEdit(
                    selectedProfile
                  )
                }
                className="px-5 py-3 rounded-xl bg-dh-purple text-white font-bold hover:scale-[1.02] transition"
              >
                ✏️ Editar perfil
              </button>

            </div>

          </div>


          {/* =================================================
              PERFIL
          ================================================= */}

          <div className="relative overflow-hidden rounded-3xl bg-[#1f1f24] border border-white/10 shadow-xl">

            <div className="h-2 bg-gradient-to-r from-dh-purple via-purple-500 to-dh-purpleLight" />

            <div className="p-6 sm:p-8">


              {/* CABECERA DEL PERFIL */}

              <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">

                <div className="w-20 h-20 rounded-2xl bg-dh-purple/10 border border-dh-purple/20 flex items-center justify-center shrink-0">

                  <span className="text-3xl font-black text-dh-purple">

                    {(
                      selectedProfile?.nombre ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase()}

                  </span>

                </div>


                <div className="flex-1">

                  <p className="text-sm font-semibold text-gray-400">

                    {selectedProfile?.id ===
                    userData.id
                      ? "Perfil titular"
                      : "Perfil adicional"}

                  </p>


                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">

                    {getFullName(
                      selectedProfile
                    )}

                  </h2>


                  <div className="flex flex-wrap items-center gap-2 mt-3">

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        ramaLabel ===
                        "Pendiente"
                          ? "bg-red-100 text-red-400"
                          : "bg-dh-purple/10 text-dh-purple"
                      }`}
                    >
                      {ramaLabel}
                    </span>


                    {selectedProfile?.tallaPlayera && (

                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/5 text-gray-200">

                        Playera{" "}
                        {
                          selectedProfile.tallaPlayera
                        }

                      </span>

                    )}


                    {selectedProfile?.id ===
                      userData.id && (

                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400">

                        Cuenta principal

                      </span>

                    )}

                  </div>

                </div>


                <button
                  onClick={() =>
                    selectedProfile &&
                    startEdit(
                      selectedProfile
                    )
                  }
                  className="px-4 py-2 rounded-xl border border-white/10 text-dh-purple font-semibold hover:bg-dh-purple/5 transition"
                >
                  Editar
                </button>

              </div>


              {/* =================================================
                  DATOS
              ================================================= */}

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Nombre completo
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {getFullName(
                      selectedProfile
                    )}
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Correo electrónico
                  </p>

                  <p className="mt-1 font-semibold text-white break-all">
                    {
                      selectedProfile?.email ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Celular
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {
                      selectedProfile?.celular ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Teléfono de emergencia
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {
                      selectedProfile?.telefonoEmergencia ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Fecha de nacimiento
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {
                      selectedProfile?.fechaNacimiento ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Edad
                  </p>

                  <p className="mt-1 font-semibold text-white">

                    {
                      selectedProfile?.edad != null
                        ? `${selectedProfile.edad} años`
                        : "-"
                    }

                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Rama
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {ramaLabel}
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Talla de playera
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {
                      selectedProfile?.tallaPlayera ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Club
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {
                      selectedProfile?.club ||
                      "-"
                    }
                  </p>

                </div>


                <div className="rounded-2xl bg-[#18181d] border border-white/10 p-4 sm:col-span-2 lg:col-span-1">

                  <p className="text-xs uppercase tracking-wide text-gray-400">
                    Ubicación
                  </p>

                  <p className="mt-1 font-semibold text-white">

                    {
                      selectedProfile?.ciudad ||
                      "-"
                    }
                    ,{" "}

                    {selectedState}
                    ,{" "}

                    {selectedCountry}

                  </p>

                </div>

              </div>


              {/* RAMA PENDIENTE */}

              {ramaLabel ===
                "Pendiente" && (

                <div className="mt-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">

                  <div>

                    <p className="font-bold text-red-400">
                      Falta completar la rama
                    </p>

                    <p className="text-sm text-red-400">
                      Selecciona Femenil o Varonil para completar el perfil.
                    </p>

                  </div>


                  <button
                    onClick={() =>
                      selectedProfile &&
                      startEdit(
                        selectedProfile
                      )
                    }
                    className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition"
                  >
                    Completar
                  </button>

                </div>

              )}

            </div>

          </div>


          {/* =================================================
              FORMULARIO + PERFILES
          ================================================= */}

          <div
            ref={formRef}
            className="grid lg:grid-cols-3 gap-8 items-start"
          >


            {/* =================================================
                FORMULARIO
            ================================================= */}

            <div className="lg:col-span-2 rounded-3xl bg-[#1f1f24] border border-white/10 shadow-xl p-6 sm:p-8">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">

                <div>

                  <p className="text-sm font-semibold text-dh-purple">

                    {editingProfile
                      ? "EDITANDO PERFIL"
                      : "NUEVO PERFIL"}

                  </p>


                  <h2 className="text-2xl font-extrabold text-white">

                    {editingProfile
                      ? "Modificar datos"
                      : "Agregar perfil"}

                  </h2>


                  <p className="text-sm text-gray-400 mt-1">
                    Mantén actualizada la información utilizada para tus inscripciones.
                  </p>

                </div>


                {showForm && (

                  <button
                    type="button"
                    onClick={() => {

                      setShowForm(
                        false
                      );

                      setEditingProfile(
                        null
                      );

                      resetForm();
                    }}
                    className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 font-semibold hover:bg-[#111116] transition"
                  >
                    Cancelar
                  </button>

                )}

              </div>


              {!showForm ? (

                <button
                  type="button"
                  onClick={
                    startAddProfile
                  }
                  className="w-full rounded-2xl border-2 border-dashed border-white/10 bg-[#18181d] hover:bg-dh-purple/5 hover:border-dh-purple/30 p-8 text-center transition"
                >

                  <div className="w-14 h-14 mx-auto rounded-2xl bg-dh-purple/10 flex items-center justify-center text-2xl">
                    ＋
                  </div>


                  <p className="mt-4 font-bold text-white">
                    Agregar un perfil
                  </p>


                  <p className="mt-1 text-sm text-gray-400">
                    Útil para registrar familiares o acompañantes.
                  </p>

                </button>

              ) : (

                <form
                  onSubmit={
                    handleSave
                  }
                  className="space-y-8"
                >


                  {/* =================================================
                      INFORMACIÓN PERSONAL
                  ================================================= */}

                  <section>

                    <div className="flex items-center gap-3 mb-4">

                      <div className="w-10 h-10 rounded-xl bg-dh-purple/10 flex items-center justify-center">
                        👤
                      </div>


                      <div>

                        <h3 className="font-bold text-white">
                          Información personal
                        </h3>

                        <p className="text-xs text-gray-400">
                          Datos básicos del participante.
                        </p>

                      </div>

                    </div>


                    <div className="grid sm:grid-cols-2 gap-4">


                      <div>

                        <label className={labelClass}>
                          Nombre *
                        </label>

                        <input
                          value={
                            formData.nombre
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "nombre",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        />

                      </div>


                      <div>

                        <label className={labelClass}>
                          Apellido paterno *
                        </label>

                        <input
                          value={
                            formData.apPaterno
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "apPaterno",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        />

                      </div>


                      <div>

                        <label className={labelClass}>
                          Apellido materno *
                        </label>

                        <input
                          value={
                            formData.apMaterno
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "apMaterno",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        />

                      </div>


                      <div>

                        <label className={labelClass}>
                          Celular *
                        </label>

                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={
                            formData.celular ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "celular",
                              e.target.value
                                .replace(
                                  /\D/g,
                                  ""
                                )
                                .slice(
                                  0,
                                  10
                                )
                            )
                          }
                          className={
                            inputClass
                          }
                          placeholder="10 dígitos"
                          required
                        />

                      </div>


                      <div className="sm:col-span-2">

                        <label className={labelClass}>
                          Correo electrónico
                        </label>

                        <input
                          type="email"
                          value={
                            formData.email ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "email",
                              e.target.value
                            )
                          }
                          className={`${
                            inputClass
                          } ${
                            editingProfile?.id ===
                            user?.uid
                              ? "bg-white/5 text-gray-400 cursor-not-allowed"
                              : ""
                          }`}
                          disabled={
                            editingProfile?.id ===
                            user?.uid
                          }
                        />


                        {editingProfile?.id ===
                          user?.uid && (

                          <p className="text-xs text-gray-400 mt-2">
                            El correo de la cuenta se administra desde Firebase Authentication.
                          </p>

                        )}

                      </div>

                    </div>

                  </section>


                  {/* =================================================
                      DATOS DEPORTIVOS
                  ================================================= */}

                  <section className="border-t border-white/10 pt-7">

                    <div className="flex items-center gap-3 mb-4">

                      <div className="w-10 h-10 rounded-xl bg-dh-purple/10 flex items-center justify-center">
                        🏃
                      </div>


                      <div>

                        <h3 className="font-bold text-white">
                          Datos deportivos
                        </h3>

                        <p className="text-xs text-gray-400">
                          Información utilizada durante las carreras.
                        </p>

                      </div>

                    </div>


                    <div className="grid sm:grid-cols-2 gap-4">


                      {/* RAMA */}

                      <div>

                        <label className={labelClass}>
                          Rama *
                        </label>

                        <select
                          value={
                            (formData.rama as string) ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "rama",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        >

                          <option value="">
                            Selecciona Rama
                          </option>

                          <option value="Femenil">
                            Femenil
                          </option>

                          <option value="Varonil">
                            Varonil
                          </option>

                        </select>

                      </div>


                      {/* TALLA */}

                      <div>

                        <label className={labelClass}>
                          Talla de playera *
                        </label>

                        <select
                          value={
                            formData.tallaPlayera ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "tallaPlayera",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        >

                          <option value="">
                            Selecciona talla
                          </option>

                          <option value="XS">
                            XS
                          </option>

                          <option value="S">
                            S
                          </option>

                          <option value="M">
                            M
                          </option>

                          <option value="L">
                            L
                          </option>

                          <option value="XL">
                            XL
                          </option>

                          <option value="XXL">
                            XXL
                          </option>

                        </select>

                      </div>


                      {/* NACIMIENTO */}

                      <div>

                        <label className={labelClass}>
                          Fecha de nacimiento *
                        </label>

                        <input
                          type="date"
                          value={
                            formData.fechaNacimiento
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "fechaNacimiento",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        />

                      </div>


                      {/* EDAD */}

                      <div>

                        <label className={labelClass}>
                          Edad
                        </label>

                        <div className="w-full bg-white/5 text-gray-200 border border-white/10 rounded-xl px-4 py-3">

                          {formData.fechaNacimiento &&
                          calcAge(
                            formData.fechaNacimiento
                          ) != null

                            ? `${calcAge(
                                formData.fechaNacimiento
                              )} años`

                            : "Se calcula automáticamente"}

                        </div>

                      </div>


                      {/* CLUB */}

                      <div className="sm:col-span-2">

                        <label className={labelClass}>
                          Club
                        </label>

                        <input
                          value={
                            formData.club ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "club",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          placeholder="Club (opcional)"
                        />

                      </div>

                    </div>

                  </section>


                  {/* =================================================
                      UBICACIÓN
                  ================================================= */}

                  <section className="border-t border-white/10 pt-7">

                    <div className="flex items-center gap-3 mb-4">

                      <div className="w-10 h-10 rounded-xl bg-dh-purple/10 flex items-center justify-center">
                        📍
                      </div>


                      <div>

                        <h3 className="font-bold text-white">
                          Ubicación
                        </h3>

                        <p className="text-xs text-gray-400">
                          Selecciona la ubicación desde el catálogo.
                        </p>

                      </div>

                    </div>


                    <div className="grid sm:grid-cols-2 gap-4">


                      {/* PAÍS */}

                      <div>

                        <label className={labelClass}>
                          País *
                        </label>

                        <select
                          value={
                            formData.pais ||
                            ""
                          }
                          onChange={(e) =>
                            handleCountryChange(
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          required
                        >

                          <option value="">
                            Selecciona país
                          </option>


                          {paises.map(
                            (country) => (

                              <option
                                key={
                                  country.isoCode
                                }
                                value={
                                  country.isoCode
                                }
                              >
                                {country.name}
                              </option>

                            )
                          )}

                        </select>

                      </div>


                      {/* ESTADO */}

                      <div>

                        <label className={labelClass}>
                          Estado *
                        </label>

                        <select
                          value={
                            formData.estado ||
                            ""
                          }
                          onChange={(e) =>
                            handleStateChange(
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          disabled={
                            !formData.pais
                          }
                          required
                        >

                          <option value="">

                            {formData.pais
                              ? "Selecciona estado"
                              : "Primero selecciona país"}

                          </option>


                          {estados.map(
                            (state) => (

                              <option
                                key={
                                  state.isoCode
                                }
                                value={
                                  state.isoCode
                                }
                              >
                                {state.name}
                              </option>

                            )
                          )}

                        </select>

                      </div>


                      {/* CIUDAD */}

                      <div className="sm:col-span-2">

                        <label className={labelClass}>
                          Ciudad *
                        </label>

                        <select
                          value={
                            formData.ciudad ||
                            ""
                          }
                          onChange={(e) =>
                            handleFieldChange(
                              "ciudad",
                              e.target.value
                            )
                          }
                          className={
                            inputClass
                          }
                          disabled={
                            !formData.estado
                          }
                          required
                        >

                          <option value="">

                            {formData.estado
                              ? "Selecciona ciudad"
                              : "Primero selecciona estado"}

                          </option>


                          {ciudades.map(
                            (city) => (

                              <option
                                key={
                                  city.name
                                }
                                value={
                                  city.name
                                }
                              >
                                {city.name}
                              </option>

                            )
                          )}

                        </select>

                      </div>

                    </div>

                  </section>


                  {/* =================================================
                      EMERGENCIA
                  ================================================= */}

                  <section className="border-t border-white/10 pt-7">

                    <div className="flex items-center gap-3 mb-4">

                      <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                        🚨
                      </div>


                      <div>

                        <h3 className="font-bold text-white">
                          Contacto de emergencia
                        </h3>

                        <p className="text-xs text-gray-400">
                          Número para contacto en caso de emergencia durante un evento.
                        </p>

                      </div>

                    </div>


                    <div>

                      <label className={labelClass}>
                        Teléfono de emergencia *
                      </label>

                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={
                          formData.telefonoEmergencia ||
                          ""
                        }
                        onChange={(e) =>
                          handleFieldChange(
                            "telefonoEmergencia",
                            e.target.value
                              .replace(
                                /\D/g,
                                ""
                              )
                              .slice(
                                0,
                                10
                              )
                          )
                        }
                        className={
                          inputClass
                        }
                        placeholder="10 dígitos"
                        required
                      />

                    </div>

                  </section>


                  {/* =================================================
                      BOTONES
                  ================================================= */}

                  <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">

                    <button
                      type="button"
                      onClick={() => {

                        setShowForm(
                          false
                        );

                        setEditingProfile(
                          null
                        );

                        resetForm();

                      }}
                      className="px-5 py-3 rounded-xl border border-white/10 text-gray-200 font-semibold hover:bg-[#111116] transition"
                    >
                      Cancelar
                    </button>


                    <button
                      type="submit"
                      disabled={
                        saving
                      }
                      className="px-6 py-3 rounded-xl bg-dh-purple text-white font-bold hover:scale-[1.02] transition disabled:opacity-50 disabled:hover:scale-100"
                    >

                      {saving
                        ? "Guardando..."
                        : editingProfile
                        ? "Guardar cambios"
                        : "Crear perfil"}

                    </button>

                  </div>

                </form>

              )}

            </div>


            {/* =================================================
                PERFILES GUARDADOS
            ================================================= */}

            <div className="rounded-3xl bg-[#1f1f24] border border-white/10 shadow-xl p-6 sm:p-8 lg:sticky lg:top-6">

              <div className="flex items-center justify-between gap-3 mb-6">

                <div>

                  <p className="text-sm font-semibold text-dh-purple">
                    PARTICIPANTES
                  </p>

                  <h2 className="text-2xl font-extrabold text-white">
                    Mis perfiles
                  </h2>

                </div>


                <span className="px-3 py-1 rounded-full bg-white/5 text-gray-200 text-sm font-bold">
                  {
                    profiles.length
                  }
                </span>

              </div>


              {profiles.length === 0 ? (

                <div className="rounded-2xl bg-[#111116] border border-dashed border-white/10 p-6 text-center">

                  <div className="text-3xl mb-3">
                    👥
                  </div>

                  <p className="font-semibold text-white">
                    Aún no tienes perfiles adicionales.
                  </p>

                  <p className="text-sm text-gray-400 mt-1">
                    Puedes crear perfiles para familiares o acompañantes.
                  </p>

                  <button
                    onClick={
                      startAddProfile
                    }
                    className="mt-4 px-4 py-2 rounded-xl bg-dh-purple text-white font-semibold"
                  >
                    Agregar perfil
                  </button>

                </div>

              ) : (

                <div className="space-y-3">

                  {profiles.map(
                    (p) => {

                      const r =
                        displayRama(
                          p.rama
                        );


                      const isSelected =
                        selectedProfile?.id ===
                        p.id;


                      return (

                        <div
                          key={
                            p.id
                          }
                          className={`rounded-2xl border p-4 transition ${
                            isSelected
                              ? "border-dh-purple bg-dh-purple/5"
                              : "border-white/10 bg-[#1f1f24] hover:bg-white/5"
                          }`}
                        >

                          <div className="flex items-start gap-3">

                            <div className="w-11 h-11 rounded-xl bg-dh-purple/10 flex items-center justify-center shrink-0">

                              <span className="font-black text-dh-purple">

                                {(
                                  p.nombre ||
                                  "U"
                                )
                                  .charAt(
                                    0
                                  )
                                  .toUpperCase()}

                              </span>

                            </div>


                            <div className="flex-1 min-w-0">

                              <p className="font-bold text-white truncate">

                                {getFullName(
                                  p
                                )}

                              </p>


                              <div className="flex flex-wrap gap-2 mt-2">

                                <span
                                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                    r ===
                                    "Pendiente"
                                      ? "bg-red-100 text-red-400"
                                      : "bg-dh-purple/10 text-dh-purple"
                                  }`}
                                >
                                  {r}
                                </span>


                                {p.tallaPlayera && (

                                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-white/5 text-gray-200">

                                    {p.tallaPlayera}

                                  </span>

                                )}

                              </div>

                            </div>

                          </div>


                          <div className="flex gap-4 mt-4 pt-3 border-t border-white/10">

                            <button
                              onClick={() =>
                                setSelectedProfile(
                                  p
                                )
                              }
                              className="text-sm font-semibold text-gray-400 hover:text-dh-purple transition"
                            >
                              Ver
                            </button>


                            <button
                              onClick={() =>
                                startEdit(
                                  p
                                )
                              }
                              className="text-sm font-semibold text-dh-purple hover:underline"
                            >
                              Editar
                            </button>


                            <button
                              onClick={() =>
                                handleDelete(
                                  p.id!
                                )
                              }
                              disabled={
                                deleting
                              }
                              className="text-sm font-semibold text-red-400 hover:underline disabled:opacity-50"
                            >
                              Eliminar
                            </button>

                          </div>

                        </div>

                      );

                    }
                  )}

                </div>

              )}


              <button
                onClick={
                  startAddProfile
                }
                className="w-full mt-5 px-4 py-3 rounded-xl border border-dh-purple/30 text-dh-purple font-bold hover:bg-dh-purple/5 transition"
              >
                ＋ Agregar otro perfil
              </button>

            </div>

          </div>

        </div>

      </div>

    </AuthGuard>

  );
}