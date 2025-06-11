import { useState } from "react";
import { registrarUsuario } from "@/lib/registrarUsuario";

export default function RegistroUsuario() {
  const [formData, setFormData] = useState({
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    email: "",
    password: "",
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });

  const [mensaje, setMensaje] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrarUsuario(formData);
      setMensaje("Usuario registrado correctamente");
    } catch (error: any) {
      setMensaje("Error: " + error.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white shadow rounded-xl mt-10">
      <h2 className="text-xl font-semibold mb-4 text-softGreen">Registro de Usuario</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {[
          { label: "Nombre", name: "nombre" },
          { label: "Apellido Paterno", name: "apellidoPaterno" },
          { label: "Apellido Materno", name: "apellidoMaterno" },
          { label: "Email", name: "email", type: "email" },
          { label: "Contraseña", name: "password", type: "password" },
          { label: "Celular", name: "celular" },
          { label: "País", name: "pais" },
          { label: "Estado", name: "estado" },
          { label: "Ciudad", name: "ciudad" },
          { label: "Club", name: "club", optional: true },
          { label: "Fecha de Nacimiento", name: "fechaNacimiento", type: "date" },
        ].map(({ label, name, type = "text", optional }) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700">{label}{optional ? " (opcional)" : ""}</label>
            <input
              type={type}
              name={name}
              required={!optional}
              value={formData[name as keyof typeof formData]}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-softGreen focus:border-softGreen"
            />
          </div>
        ))}
        <button
          type="submit"
          className="bg-softPurple text-white py-2 px-4 rounded hover:bg-opacity-90"
        >
          Registrar
        </button>
      </form>
      {mensaje && <p className="mt-4 text-center text-sm text-gray-700">{mensaje}</p>}
    </div>
  );
}
