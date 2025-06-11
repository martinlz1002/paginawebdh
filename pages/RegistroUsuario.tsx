import { useState } from "react";
import { registrarUsuario } from "@/lib/usuarios";
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
    celular: "",
    pais: "",
    estado: "",
    ciudad: "",
    club: "",
    fechaNacimiento: "",
  });

  const [mensaje, setMensaje] = useState("");
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const auth = getAuth(app);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      const uid = userCredential.user.uid;
      const edad = calcularEdad(formData.fechaNacimiento);

      const usuario = {
        uid,
        nombre: formData.nombre,
        apPaterno: formData.apellidoPaterno,
        apMaterno: formData.apellidoMaterno,
        email: formData.email,
        celular: formData.celular,
        pais: formData.pais,
        estado: formData.estado,
        ciudad: formData.ciudad,
        club: formData.club,
        fechaNacimiento: formData.fechaNacimiento,
        edad,
      };

      await registrarUsuario(usuario);
      router.push("/perfil");
    } catch (error: any) {
      setMensaje("Error: " + error.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Registro de Usuario</h1>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        {Object.entries(formData).map(([key, value]) => (
          <input
            key={key}
            type={key === "password" ? "password" : key === "fechaNacimiento" ? "date" : "text"}
            name={key}
            placeholder={key}
            value={value}
            onChange={handleChange}
            className="border p-2 rounded"
            required={key !== "club"}
          />
        ))}
        <button type="submit" className="bg-green-600 text-white py-2 rounded">
          Registrarse
        </button>
      </form>
      {mensaje && <p className="mt-4 text-red-500">{mensaje}</p>}
    </div>
  );
}
