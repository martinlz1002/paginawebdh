import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAdminAuth } from "@/hooks/useAdminAuth";

type Competidor = {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  celular: string;
  ciudad: string;
  estado: string;
  pais: string;
  club?: string;
  edad: number;
  pago: boolean;
};

export default function AdminPanel() {
  useAdminAuth(); // protegiendo ruta admin

  const [competidores, setCompetidores] = useState<Competidor[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const querySnapshot = await getDocs(collection(db, "usuarios"));
      const datos: Competidor[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (
          d.nombre &&
          d.apellidoPaterno &&
          d.apellidoMaterno &&
          d.email &&
          d.celular &&
          d.ciudad &&
          d.estado &&
          d.pais &&
          d.edad !== undefined
        ) {
          datos.push({
            nombre: d.nombre,
            apellidoPaterno: d.apellidoPaterno,
            apellidoMaterno: d.apellidoMaterno,
            email: d.email,
            celular: d.celular,
            ciudad: d.ciudad,
            estado: d.estado,
            pais: d.pais,
            club: d.club || "",
            edad: d.edad,
            pago: d.pago ?? false,
          });
        }
      });
      setCompetidores(datos);
    };
    fetchData();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-softGreen mb-6">Panel de Administración</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {competidores.map((comp, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow border border-softPurple">
            <h2 className="text-lg font-semibold">
              {comp.nombre} {comp.apellidoPaterno} {comp.apellidoMaterno}
            </h2>
            <p className="text-sm text-gray-700">Edad: {comp.edad}</p>
            <p className="text-sm text-gray-700">Correo: {comp.email}</p>
            <p className="text-sm text-gray-700">Tel: {comp.celular}</p>
            <p className="text-sm text-gray-700">
              Ciudad: {comp.ciudad}, {comp.estado}, {comp.pais}
            </p>
            {comp.club && (
              <p className="text-sm text-gray-700">Club: {comp.club}</p>
            )}
            <p className="text-sm mt-2">
              <span
                className={`font-bold ${comp.pago ? "text-green-600" : "text-red-600"}`}
              >
                {comp.pago ? "Pago confirmado" : "Pago pendiente"}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
