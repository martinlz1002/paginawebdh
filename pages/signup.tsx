// pages/signup.tsx
import React, { useState } from "react";
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
  GlobeAltIcon,
  CalendarIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

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
    apellidoPaterno: "",
    apellidoMaterno: "",
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
  const [mensaje, setMensaje] = useState<
    { type: "error" | "success"; text: string } | null
  >(null);
  const router = useRouter();
  const auth = getAuth(app);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    // 1) Validaciones de contraseña
    if (formData.password.length < 6) {
      return setMensaje({
        type: "error",
        text: "La contraseña debe tener al menos 6 caracteres.",
      });
    }
    if (formData.password !== formData.confirmPassword) {
      return setMensaje({
        type: "error",
        text: "Las contraseñas no coinciden.",
      });
    }

    // 2) Verificar si el email ya existe
    try {
      const methods = await fetchSignInMethodsForEmail(
        auth,
        formData.email
      );
      if (methods.length > 0) {
        return setMensaje({
          type: "error",
          text: "Este correo ya está registrado.",
        });
      }
    } catch (err: any) {
      return setMensaje({
        type: "error",
        text: `Error comprobando email: ${err.message}`,
      });
    }

    // 3) Crear usuario en Auth
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
        text: `Error en Auth: ${err.message}`,
      });
    }

    // 4) Enviar correo de verificación (configuración por defecto)
    try {
      await sendEmailVerification(userCred.user);
      setMensaje({
        type: "success",
        text: "Te hemos enviado un correo de verificación. Revisa tu bandeja y confirma tu email.",
      });
      router.push("/verify-email");
    } catch (err: any) {
      // si falla, eliminar usuario de Auth
      await deleteUser(userCred.user);
      return setMensaje({
        type: "error",
        text: `Error enviando verificación: ${err.message}`,
      });
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg">
      <h1 className="text-3xl font-bold mb-6 text-center text-purple-600">
        Crear Cuenta
      </h1>
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
            className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {/* Apellidos */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="apellidoPaterno"
              placeholder="Apellido Paterno"
              value={formData.apellidoPaterno}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="relative">
            <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="apellidoMaterno"
              placeholder="Apellido Materno"
              value={formData.apellidoMaterno}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
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
            className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {/* Contraseña */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="password"
              type="password"
              placeholder="Contraseña"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="relative">
            <LockClosedIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="confirmPassword"
              type="password"
              placeholder="Confirmar Contraseña"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>
        {/* Resto de campos (celular, ubicación, club, fecha)… */}
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
            className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        {/* País, estado, ciudad, club */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <GlobeAltIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="pais"
              placeholder="País"
              value={formData.pais}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="relative">
            <GlobeAltIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="estado"
              placeholder="Estado"
              value={formData.estado}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="relative">
            <GlobeAltIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="ciudad"
              placeholder="Ciudad"
              value={formData.ciudad}
              onChange={handleChange}
              required
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
          <div className="relative">
            <BuildingOffice2Icon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              name="club"
              placeholder="Club (opcional)"
              value={formData.club}
              onChange={handleChange}
              className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>
        {/* Fecha de nacimiento */}
        <div className="relative">
          <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="fechaNacimiento"
            type="date"
            value={formData.fechaNacimiento}
            onChange={handleChange}
            required
            className="w-full pl-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition"
        >
          Registrarse
        </button>
      </form>
      {mensaje && (
        <p
          className={`mt-4 text-center text-sm ${
            mensaje.type === "error" ? "text-red-600" : "text-green-600"
          }`}
        >
          {mensaje.text}
        </p>
      )}
    </div>
  );
}