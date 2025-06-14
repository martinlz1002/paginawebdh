"use client";

import { useState } from "react";
import { getAuth } from "firebase/auth";

export default function AdminCarrerasForm() {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setArchivo(e.target.files?.[0] || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !fecha || !archivo) {
      setMensaje("Debe completar título, fecha y elegir una imagen.");
      return;
    }

    setCargando(true);
    setMensaje(null);

    try {
      // 1) Convertir imagen a Base64
      const reader = new FileReader();
      const base64: string = await new Promise((res, rej) => {
        reader.onload = () => {
          const result = reader.result as string;
          // quitamos el prefijo "data:*;base64,"
          res(result.split(",")[1]);
        };
        reader.onerror = err => rej(err);
        reader.readAsDataURL(archivo);
      });

      // 2) Obtener token de Firebase para autenticación
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) throw new Error("Usuario no autenticado.");
      const token = await user.getIdToken();

      // 3) Llamar a la función HTTP
      const res = await fetch(
        "https://us-central1-webdh-730dc.cloudfunctions.net/api/crearCarrera",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            titulo,
            descripcion,
            ubicacion,
            fecha,
            imagenBase64: base64,
            nombreArchivo: archivo.name,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error desconocido");
      }

      setMensaje("🏁 Carrera creada correctamente.");
      // limpiar
      setTitulo("");
      setDescripcion("");
      setUbicacion("");
      setFecha("");
      setArchivo(null);
    } catch (err: any) {
      console.error("Error creando carrera:", err);
      setMensaje("❌ " + (err.message || "Error al crear carrera"));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-lg shadow-md max-w-md mx-auto space-y-4"
    >
      {mensaje && (
        <p
          className={`p-2 rounded ${
            mensaje.startsWith("🏁")
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {mensaje}
        </p>
      )}
      <div>
        <label className="block font-medium">Título</label>
        <input
          type="text"
          value={titulo}
          onChange={e => setTitulo(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block font-medium">Descripción</label>
        <textarea
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          rows={3}
        />
      </div>

      <div>
        <label className="block font-medium">Ubicación</label>
        <input
          type="text"
          value={ubicacion}
          onChange={e => setUbicacion(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
        />
      </div>

      <div>
        <label className="block font-medium">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="mt-1 block w-full border p-2 rounded"
          required
        />
      </div>

      <div>
        <label className="block font-medium">Imagen</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mt-1 block w-full"
          required
        />
      </div>

      <button
        type="submit"
        disabled={cargando}
        className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {cargando ? "Creando…" : "Crear Carrera"}
      </button>
    </form>
  );
}