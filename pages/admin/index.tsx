// pages/admin/index.tsx
import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import AdminCarrerasForm from "@/components/AdminCarrerasForm";
import MisInscripcionesAdmin from "@/components/MisInscripcionesAdmin";

export default function AdminPage() {
  const [user, setUser] = useState<any>(undefined);
  const [section, setSection] = useState<"crear" | "inscripciones">("crear");
  const router = useRouter();

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        router.push("/login");
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [router]);

  // Mientras esperamos al auth
  if (user === undefined) {
    return <p className="p-6 text-center">Cargando…</p>;
  }

  return (
    <>
      <Head>
        <title>Panel Admin - DHTime</title>
      </Head>

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <nav className="w-64 bg-gray-800 text-white p-6">
          <h2 className="text-2xl font-bold mb-6">Panel Admin</h2>
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => setSection("crear")}
                className={`w-full text-left px-4 py-2 rounded ${
                  section === "crear" ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
              >
                Crear Carrera
              </button>
            </li>
            <li>
              <button
                onClick={() => setSection("inscripciones")}
                className={`w-full text-left px-4 py-2 rounded ${
                  section === "inscripciones" ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
              >
                Ver Inscripciones
              </button>
            </li>
          </ul>
        </nav>

        {/* Contenido */}
        <main className="flex-1 p-8 bg-gray-100">
          {section === "crear" && (
            <>
              <h1 className="text-3xl font-bold mb-6">Crear Nueva Carrera</h1>
              <AdminCarrerasForm />
            </>
          )}
          {section === "inscripciones" && (
            <>
              <h1 className="text-3xl font-bold mb-6">Inscripciones</h1>
              <MisInscripcionesAdmin />
            </>
          )}
        </main>
      </div>
    </>
  );
}