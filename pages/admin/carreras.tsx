import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase"; // Importa tu instancia de Firebase

export default function CrearCarrera() {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [mensaje, setMensaje] = useState("");

  const handleCrearCarrera = async () => {
    try {
      const functions = getFunctions(app);
      const crearCarrera = httpsCallable(functions, "crearCarrera");

      await crearCarrera({ titulo, descripcion, ubicacion, fecha, imagenUrl });

      setMensaje("Carrera creada exitosamente.");
    } catch (error) {
      setMensaje("Error al crear la carrera.");
      console.error(error);
    }
  };

  return (
    <div>
      <h2>Crear Carrera</h2>
      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título"
      />
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="Descripción"
      />
      <input
        type="text"
        value={ubicacion}
        onChange={(e) => setUbicacion(e.target.value)}
        placeholder="Ubicación"
      />
      <input
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />
      <input
        type="text"
        value={imagenUrl}
        onChange={(e) => setImagenUrl(e.target.value)}
        placeholder="URL de la imagen"
      />
      <button onClick={handleCrearCarrera}>Crear Carrera</button>
      <p>{mensaje}</p>
    </div>
  );
}