import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  getAuth,
  fetchSignInMethodsForEmail,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  deleteUser,
} from "firebase/auth";
import { app } from "@/lib/firebase";
import {
  UserIcon,
  EnvelopeIcon,
  LockClosedIcon,
  PhoneIcon,
  CalendarIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { Country, State, City } from "country-state-city";
import { Usuario } from "@/lib/usuarios";

type Estado = ReturnType<typeof State.getStatesOfCountry>[number];
type Ciudad = ReturnType<typeof City.getCitiesOfState>[number];

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

export default function RegistroUsuarioPage() {
  const [formData, setFormData] = useState({
    nombre: "",
    apPaterno: "",
    apMaterno: "",
    email: "",
    password: "",
    confirmPassword: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });
  const [mensaje, setMensaje] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();
  const auth = getAuth(app);

  // Listas dinámicas
  const [paises, setPaises] = useState(Country.getAllCountries());
  const [estados, setEstados] = useState<Estado[]>([]);
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);

  // Cuando cambia el país, cargamos sus estados y limpiamos abajo
  useEffect(() => {
    if (formData.pais) {
      setEstados(State.getStatesOfCountry(formData.pais));
    } else {
      setEstados([]);
    }
    setFormData(fd => ({ ...fd, estado: "", ciudad: "" }));
    setCiudades([]);
  }, [formData.pais]);

  // Cuando cambia el estado, cargamos sus ciudades
  useEffect(() => {
    if (formData.pais && formData.estado) {
      setCiudades(City.getCitiesOfState(formData.pais, formData.estado));
    } else {
      setCiudades([]);
    }
    setFormData(fd => ({ ...fd, ciudad: "" }));
  }, [formData.estado]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(p => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    if (formData.password.length < 6)
      return setMensaje({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
    if (formData.password !== formData.confirmPassword)
      return setMensaje({ type: "error", text: "Las contraseñas no coinciden." });

    try {
      const methods = await fetchSignInMethodsForEmail(auth, formData.email);
      if (methods.length)
        return setMensaje({ type: "error", text: "Este correo ya está registrado." });
    } catch (err: any) {
      return setMensaje({ type: "error", text: `Error comprobando email: ${err.message}` });
    }

    let userCred;
    try {
      userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
    } catch (err: any) {
      return setMensaje({ type: "error", text: `Error en Auth: ${err.message}` });
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
      };
      localStorage.setItem("pendingUser", JSON.stringify(pending));
      setMensaje({ type: "success", text: "Correo de verificación enviado. Revisa tu bandeja." });
      router.push("/verify-email");
    } catch (err: any) {
      await deleteUser(userCred.user);
      return setMensaje({ type: "error", text: `Error enviando verificación: ${err.message}` });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-purple-600">Crear Cuenta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Nombre */}
        <div className="relative">
          <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="nombre"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          />
        </div>
        {/* Apellidos */}
        <div className="grid grid-cols-2 gap-4">
          {["apPaterno","apMaterno"].map(n => (
            <div key={n} className="relative">
              <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name={n}
                placeholder={n === "apPaterno" ? "Apellido Paterno" : "Apellido Materno"}
                value={(formData as any)[n]}
                onChange={handleChange}
                required
                className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
              />
            </div>
          ))}
        </div>
        {/* Email */}
        <div className="relative">
          <EnvelopeIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="email"
            type="email"
            placeholder="Correo Electrónico"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          />
        </div>
        {/* Contraseña */}
        <div className="grid grid-cols-2 gap-4">
          {["password","confirmPassword"].map(n => (
            <div key={n} className="relative">
              <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                name={n}
                type="password"
                placeholder={n === "password" ? "Contraseña" : "Confirmar Contraseña"}
                value={(formData as any)[n]}
                onChange={handleChange}
                required
                className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
              />
            </div>
          ))}
        </div>
        {/* Celular */}
        <div className="relative">
          <PhoneIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="celular"
            type="tel"
            placeholder="Celular"
            value={formData.celular}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          />
        </div>
        {/* País */}
        <div className="relative">
          <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            name="pais"
            value={formData.pais}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          >
            <option value="">Selecciona País</option>
            {paises.map(c => (
              <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
            ))}
          </select>
        </div>
        {/* Estado */}
        <div className="relative">
          <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            name="estado"
            value={formData.estado}
            onChange={handleChange}
            required
            disabled={!formData.pais}
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          >
            <option value="">Selecciona Estado</option>
            {estados.map(s => (
              <option key={s.isoCode} value={s.isoCode}>{s.name}</option>
            ))}
          </select>
        </div>
        {/* Ciudad */}
        <div className="relative">
          <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            name="ciudad"
            value={formData.ciudad}
            onChange={handleChange}
            required
            disabled={!formData.estado}
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          >
            <option value="">Selecciona Ciudad</option>
            {ciudades.map(c => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        {/* Club */}
        <div className="relative">
          <BuildingOffice2Icon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="club"
            placeholder="Club (opcional)"
            value={formData.club}
            onChange={handleChange}
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          />
        </div>
        {/* Fecha de nacimiento */}
        <label className="block text-sm font-medium text-gray-700">
          Ingresa tu fecha de nacimiento
        </label>
        <div className="relative">
          <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="fechaNacimiento"
            type="date"
            value={formData.fechaNacimiento}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:ring-purple-400"
          />
        </div>
        {/* Botón */}
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition"
        >
          Registrarse
        </button>
      </form>
      {mensaje && (
        <p className={`mt-4 text-center ${mensaje.type==="error"?"text-red-600":"text-green-600"}`}>
          {mensaje.text}
        </p>
      )}
    </div>
  );
}