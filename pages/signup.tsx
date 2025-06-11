import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

const schema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellidoPaterno: z.string().min(1, "Apellido paterno requerido"),
  apellidoMaterno: z.string().min(1, "Apellido materno requerido"),
  fechaNacimiento: z.string().min(1, "Fecha de nacimiento requerida"),
  email: z.string().email("Correo inválido"),
  celular: z.string().min(10, "Teléfono inválido"),
  pais: z.string().min(1, "País requerido"),
  estado: z.string().min(1, "Estado requerido"),
  ciudad: z.string().min(1, "Ciudad requerida"),
  club: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function Signup() {
  const [edad, setEdad] = useState<number | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema)
  });

  const calcularEdad = (fecha: string) => {
    const hoy = new Date();
    const nacimiento = new Date(fecha);
    let edadCalculada = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edadCalculada--;
    }
    setEdad(edadCalculada);
    return edadCalculada;
  };

  const onSubmit = async (data: FormData) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.celular); // usar celular como clave por defecto
      const user = userCredential.user;
      const edadFinal = calcularEdad(data.fechaNacimiento);

      await setDoc(doc(db, "usuarios", user.uid), {
        ...data,
        edad: edadFinal,
        uid: user.uid
      });

      alert("Usuario registrado exitosamente");
    } catch (error: any) {
      console.error("Error registrando usuario:", error.message);
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <div className="bg-white shadow-xl rounded-2xl p-6 border border-softPurple">
        <h2 className="text-2xl font-semibold mb-4 text-softPurple">Registro de Usuario</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input {...register("nombre")} placeholder="Nombre" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.nombre?.message}</p>

          <input {...register("apellidoPaterno")} placeholder="Apellido Paterno" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.apellidoPaterno?.message}</p>

          <input {...register("apellidoMaterno")} placeholder="Apellido Materno" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.apellidoMaterno?.message}</p>

          <input type="date" {...register("fechaNacimiento")} className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.fechaNacimiento?.message}</p>
          {edad !== null && <p className="text-green-700">Edad: {edad} años</p>}

          <input {...register("email")} placeholder="Correo electrónico" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.email?.message}</p>

          <input {...register("celular")} placeholder="Teléfono (clave provisional)" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.celular?.message}</p>

          <input {...register("pais")} placeholder="País" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.pais?.message}</p>

          <input {...register("estado")} placeholder="Estado" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.estado?.message}</p>

          <input {...register("ciudad")} placeholder="Ciudad" className="w-full p-2 border rounded" />
          <p className="text-red-500 text-sm">{errors.ciudad?.message}</p>

          <input {...register("club")} placeholder="Club (opcional)" className="w-full p-2 border rounded" />

          <button type="submit" className="w-full bg-softPurple text-white py-2 rounded mt-4 hover:bg-purple-400">
            Registrarse
          </button>
        </form>
      </div>
    </div>
  );
}
