
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  getAuth,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  deleteUser,
} from "firebase/auth";
import { motion } from "framer-motion";
import { app } from "@/lib/firebase";
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Country, State, City } from "country-state-city";
import { Usuario } from "@/lib/usuarios";

type Rama = "Femenil" | "Varonil" | "";

// Calcula la edad exacta considerando mes y día
function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento + "T00:00:00");

  let edad = hoy.getFullYear() - nacimiento.getFullYear();

  const m = hoy.getMonth() - nacimiento.getMonth();

  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }

  return edad;
}

// Genera la fecha máxima permitida para nacimiento (2 años cumplidos)
function obtenerFechaMaximaNacimiento(): string {
  const hoy = new Date();

  hoy.setFullYear(hoy.getFullYear() - 2);

  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");

  return `${año}-${mes}-${dia}`;
}

export default function RegistroUsuarioPage() {
  const router = useRouter();
  const auth = getAuth(app);

  const fechaMaximaNacimiento = obtenerFechaMaximaNacimiento();

  const [formData, setFormData] = useState({
    nombre: "",
    apPaterno: "",
    apMaterno: "",
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
    rama: "" as Rama,
  });

  const [mensaje, setMensaje] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const [paises] = useState(Country.getAllCountries());
  const [estados, setEstados] = useState<any[]>([]);
  const [ciudades, setCiudades] = useState<any[]>([]);

  useEffect(() => {
    if (formData.pais) {
      setEstados(State.getStatesOfCountry(formData.pais));
    } else {
      setEstados([]);
    }

    setFormData((fd) => ({ ...fd, estado: "", ciudad: "" }));
    setCiudades([]);
  }, [formData.pais]);

  useEffect(() => {
    if (formData.pais && formData.estado) {
      setCiudades(City.getCitiesOfState(formData.pais, formData.estado));
    } else {
      setCiudades([]);
    }

    setFormData((fd) => ({ ...fd, ciudad: "" }));
  }, [formData.estado]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    setFormData((p) => ({ ...p, [name]: value }));

    if (name === "fechaNacimiento") {
      setMensaje(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    // Validación de fecha de nacimiento
    if (!formData.fechaNacimiento) {
      return setMensaje({
        type: "error",
        text: "Ingresa tu fecha de nacimiento.",
      });
    }

    // Evitar fechas inválidas o futuras
    const nacimiento = new Date(formData.fechaNacimiento + "T00:00:00");

    if (isNaN(nacimiento.getTime())) {
      return setMensaje({
        type: "error",
        text: "La fecha de nacimiento no es válida.",
      });
    }

    // Validar edad mínima de 2 años
    if (formData.fechaNacimiento > fechaMaximaNacimiento) {
      return setMensaje({
        type: "error",
        text: "El competidor debe tener al menos 2 años de edad para registrarse.",
      });
    }

    if (calcularEdad(formData.fechaNacimiento) < 2) {
      return setMensaje({
        type: "error",
        text: "El competidor debe tener al menos 2 años de edad para registrarse.",
      });
    }

    if (formData.email !== formData.confirmEmail) {
      return setMensaje({
        type: "error",
        text: "Los correos no coinciden.",
      });
    }

    if (formData.password.length < 6) {
      return setMensaje({
        type: "error",
        text: "Mínimo 6 caracteres.",
      });
    }

    if (formData.password !== formData.confirmPassword) {
      return setMensaje({
        type: "error",
        text: "Las contraseñas no coinciden.",
      });
    }

    if (!formData.rama) {
      return setMensaje({
        type: "error",
        text: "Selecciona tu rama.",
      });
    }

    try {
      const methods = await fetchSignInMethodsForEmail(
        auth,
        formData.email
      );

      if (methods.length) {
        return setMensaje({
          type: "error",
          text: "Correo ya registrado.",
        });
      }
    } catch (err: any) {
      return setMensaje({
        type: "error",
        text: err.message,
      });
    }

    let userCred;

    try {
      userCred = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
    } catch (err: any) {
      return setMensaje({
        type: "error",
        text: err.message,
      });
    }

    try {
      await sendEmailVerification(userCred.user);

      const pending: Usuario = {
        uid: userCred.user.uid,
        nombre: formData.nombre,
        apPaterno: formData.apPaterno,
        apMaterno: formData.apMaterno,
        email: formData.email,
        celular: formData.celular,
        pais: formData.pais,
        estado: formData.estado,
        ciudad: formData.ciudad,
        club: formData.club || undefined,
        fechaNacimiento: formData.fechaNacimiento,
        edad: calcularEdad(formData.fechaNacimiento),
        rama: formData.rama,
      } as any;

      localStorage.setItem("pendingUser", JSON.stringify(pending));

      router.push("/verify-email");
    } catch (err: any) {
      await deleteUser(userCred.user);

      return setMensaje({
        type: "error",
        text: err.message,
      });
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0c0c0f] flex items-center justify-center px-6 overflow-hidden">

      {/* Fondo dinámico DH */}
      <div className="absolute inset-0 bg-gradient-to-br from-dh-purple/20 via-black to-dh-purpleDark/20 blur-3xl opacity-40" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative w-full max-w-3xl"
      >
        <div className="backdrop-blur-2xl bg-white/5 border border-white/10 rounded-3xl p-10 shadow-[0_0_60px_rgba(0,0,0,0.4)]">

          <h1 className="text-4xl font-black text-white text-center">
            Crear cuenta
          </h1>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6 text-white">

            {/* Nombre */}
            <div className="grid md:grid-cols-3 gap-4">
              {["nombre", "apPaterno", "apMaterno"].map((n) => (
                <div key={n} className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />

                  <input
                    name={n}
                    placeholder={n}
                    value={(formData as any)[n]}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
                  />
                </div>
              ))}
            </div>

            {/* Email */}
            <div className="grid md:grid-cols-2 gap-4">
              {["email", "confirmEmail"].map((n) => (
                <div key={n} className="relative">
                  <EnvelopeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />

                  <input
                    name={n}
                    type="email"
                    placeholder={n === "email" ? "Correo" : "Confirmar correo"}
                    value={(formData as any)[n]}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
                  />
                </div>
              ))}
            </div>

            {/* Password */}
            <div className="grid md:grid-cols-2 gap-4">
              {["password", "confirmPassword"].map((n) => (
                <div key={n} className="relative">
                  <LockClosedIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />

                  <input
                    name={n}
                    type="password"
                    placeholder={n === "password" ? "Contraseña" : "Confirmar contraseña"}
                    value={(formData as any)[n]}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-dh-purple/50 transition"
                  />
                </div>
              ))}
            </div>

            {/* Datos personales */}
            <div className="grid md:grid-cols-2 gap-4">

              <input
                name="celular"
                placeholder="Celular"
                value={formData.celular}
                onChange={handleChange}
                required
                className="bg-white/10 border border-white/10 rounded-2xl py-3 px-4"
              />

              <div className="flex flex-col">
                <label className="text-white/70 text-sm mb-2">
                  Fecha de nacimiento
                </label>

                <input
                  type="date"
                  name="fechaNacimiento"
                  value={formData.fechaNacimiento}
                  onChange={handleChange}
                  max={fechaMaximaNacimiento}
                  required
                  className="bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-white"
                />

                <p className="text-xs text-white/50 mt-2">
                  Debes tener al menos 2 años de edad.
                </p>
              </div>

            </div>

            {/* Rama */}
            <select
              name="rama"
              value={formData.rama}
              onChange={handleChange}
              required
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-white [&>option]:text-black [&>option]:bg-white"
            >
              <option value="">Selecciona Rama</option>
              <option value="Femenil">Femenil</option>
              <option value="Varonil">Varonil</option>
            </select>

            {/* Ubicación */}
            <div className="grid md:grid-cols-3 gap-4">

              <select
                name="pais"
                value={formData.pais}
                onChange={handleChange}
                required
                className="bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-white [&>option]:text-black [&>option]:bg-white"
              >
                <option value="">País</option>

                {paises.map((c) => (
                  <option key={c.isoCode} value={c.isoCode}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                name="estado"
                value={formData.estado}
                onChange={handleChange}
                required
                disabled={!formData.pais}
                className="bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-white [&>option]:text-black [&>option]:bg-white"
              >
                <option value="">Estado</option>

                {estados.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                name="ciudad"
                value={formData.ciudad}
                onChange={handleChange}
                required
                disabled={!formData.estado}
                className="bg-white/10 border border-white/10 rounded-2xl py-3 px-4 text-white [&>option]:text-black [&>option]:bg-white"
              >
                <option value="">Ciudad</option>

                {ciudades.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>

            </div>

            {/* Club */}
            <input
              name="club"
              placeholder="Club (opcional)"
              value={formData.club}
              onChange={handleChange}
              className="w-full bg-white/10 border border-white/10 rounded-2xl py-3 px-4"
            />

            {/* Botón */}
            <button
              type="submit"
              className="w-full mt-6 bg-dh-purple text-black font-bold py-4 rounded-2xl hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(0,255,120,0.4)] transition-all"
            >
              Crear cuenta
            </button>

          </form>

          {mensaje && (
            <p
              className={`mt-6 text-center ${
                mensaje.type === "error"
                  ? "text-red-400"
                  : "text-purple-400"
              }`}
            >
              {mensaje.text}
            </p>
          )}

        </div>
      </motion.div>
    </div>
  );
}
