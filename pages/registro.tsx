import { useState } from "react";
import { registrarUsuario, Usuario } from "@/lib/usuarios";
import { useRouter } from "next/router";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { app } from "@/lib/firebase";

function calcularEdad(fechaNacimiento: string): number {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
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
  const [mensaje, setMensaje] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMensaje(null);

    // Validaciones de contraseña
    if (formData.password.length < 6) {
      setMensaje({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setMensaje({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    try {
      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const uid = userCredential.user.uid;
      const edad = calcularEdad(formData.fechaNacimiento);

      const usuario: Usuario = {
        uid,
        nombre: formData.nombre,
        apPaterno: formData.apellidoPaterno,
        apMaterno: formData.apellidoMaterno,
        email: formData.email,
        celular: formData.celular,
        pais: formData.pais,
        estado: formData.estado,
        ciudad: formData.ciudad,
        club: formData.club || undefined,
        fechaNacimiento: formData.fechaNacimiento,
        edad,
      };

      await registrarUsuario(usuario);
      setMensaje({ type: "success", text: "Registro exitoso. Redirigiendo..." });
      setTimeout(() => router.push("/perfil"), 2000);
    } catch (error: any) {
      setMensaje({ type: "error", text: "Error: " + error.message });
    }
  };

  return (
    <div className="max-w-lg mx-auto mt-12 p-8 bg-white rounded-xl shadow-md">
      <h1 className="text-3xl font-bold mb-6 text-center">Crear Cuenta</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
        {/* Nombre */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            value={formData.nombre}
            onChange={handleChange}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>

        {/* Apellidos */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="apellidoPaterno" className="block text-sm font-medium">Apellido Paterno</label>
            <input
              id="apellidoPaterno"
              name="apellidoPaterno"
              type="text"
              value={formData.apellidoPaterno}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
          <div>
            <label htmlFor="apellidoMaterno" className="block text-sm font-medium">Apellido Materno</label>
            <input
              id="apellidoMaterno"
              name="apellidoMaterno"
              type="text"
              value={formData.apellidoMaterno}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
        </div>

        {/* Email y celular */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Correo Electrónico</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>
        <div>
          <label htmlFor="celular" className="block text-sm font-medium">Celular</label>
          <input
            id="celular"
            name="celular"
            type="tel"
            value={formData.celular}
            onChange={handleChange}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>

        {/* Contraseña */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            minLength={6}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium">Confirmar Contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>

        {/* Ubicación */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pais" className="block text-sm font-medium">País</label>
            <input
              id="pais"
              name="pais"
              type="text"
              value={formData.pais}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
          <div>
            <label htmlFor="estado" className="block text-sm font-medium">Estado</label>
            <input
              id="estado"
              name="estado"
              type="text"
              value={formData.estado}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="ciudad" className="block text-sm font-medium">Ciudad</label>
            <input
              id="ciudad"
              name="ciudad"
              type="text"
              value={formData.ciudad}
              onChange={handleChange}
              required
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
          <div>
            <label htmlFor="club" className="block text-sm font-medium">Club (opcional)</label>
            <input
              id="club"
              name="club"
              type="text"
              value={formData.club}
              onChange={handleChange}
              className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
            />
          </div>
        </div>

        {/* Fecha de nacimiento */}
        <div>
          <label htmlFor="fechaNacimiento" className="block text-sm font-medium">Fecha de Nacimiento</label>
          <input
            id="fechaNacimiento"
            name="fechaNacimiento"
            type="date"
            value={formData.fechaNacimiento}
            onChange={handleChange}
            required
            className="mt-1 block w-full border p-2 rounded focus:ring focus:border-blue-300"
          />
        </div>

        <button
          type="submit"
          className="mt-4 bg-purple-600 text-white py-2 px-4 rounded hover:bg-purple-700 transition"
        >
          Registrarse
        </button>
      </form>

      {mensaje && (
        <p className={`mt-4 text-sm ${mensaje.type === "error" ? "text-red-600" : "text-green-600"}`}>
          {mensaje.text}
        </p>
      )}
    </div>
  );
}