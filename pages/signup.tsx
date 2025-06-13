import { useState } from "react";
import { getAuth, createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { app, db } from "@/lib/firebase";
import { setDoc, doc } from "firebase/firestore";
import { useRouter } from "next/router";

export default function SignupPage() {
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

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const router = useRouter();
  const auth = getAuth(app);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");  // Limpiar mensaje de error
    setSuccessMessage("");  // Limpiar mensaje de éxito

    try {
      const { email, password, fechaNacimiento, ...rest } = formData;

      // Validación de contraseña mínima
      if (password.length < 6) {
        setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
        return;
      }

      // Crear nuevo usuario
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const edad = calcularEdad(fechaNacimiento);  // Calcular edad con la fecha de nacimiento

      // Guardar información del usuario en Firestore
      await setDoc(doc(db, "usuarios", user.uid), { ...rest, uid: user.uid, edad });

      // Enviar verificación de correo
      await sendEmailVerification(user);

      // Mostrar mensaje de éxito
      setSuccessMessage("¡Registro exitoso! Te hemos enviado un correo de verificación.");
      
      // Redirigir al perfil después de 3 segundos
      setTimeout(() => router.push("/perfil"), 3000);

    } catch (error: any) {
      // Mostrar errores si hay
      setErrorMessage(error.message);
    }
  };

  const calcularEdad = (fechaNacimiento: string) => {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    return hoy.getFullYear() - nacimiento.getFullYear();
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 border rounded-2xl shadow">
      <h1 className="text-2xl font-bold mb-4">Registro de Usuario</h1>
      <form onSubmit={handleSignup} className="grid grid-cols-1 gap-4">
        {[ // Mapeamos los campos del formulario
          { name: "nombre", label: "Nombre" },
          { name: "apellidoPaterno", label: "Apellido paterno" },
          { name: "apellidoMaterno", label: "Apellido materno" },
          { name: "email", label: "Correo electrónico", type: "email" },
          { name: "password", label: "Contraseña", type: "password" },
          { name: "celular", label: "Celular" },
          { name: "pais", label: "País" },
          { name: "estado", label: "Estado" },
          { name: "ciudad", label: "Ciudad" },
          { name: "club", label: "Club (opcional)", required: false },
          { name: "fechaNacimiento", label: "Fecha de nacimiento", type: "date" },
        ].map((field) => (
          <div key={field.name}>
            <label className="block text-sm font-medium">{field.label}</label>
            <input
              type={field.type || "text"}
              name={field.name}
              value={formData[field.name as keyof typeof formData]}
              onChange={handleChange}
              className="w-full border p-2 rounded mt-1"
              required={field.required !== false}
            />
          </div>
        ))}
        <button
          type="submit"
          className="bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
        >
          Registrarse
        </button>
      </form>

      {errorMessage && (
        <p className="mt-4 text-red-600">{errorMessage}</p> // Mostrar mensaje de error
      )}

      {successMessage && (
        <p className="mt-4 text-green-600">{successMessage}</p> // Mostrar mensaje de éxito
      )}
    </div>
  );
}