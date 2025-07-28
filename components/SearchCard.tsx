import { useState } from "react";
import { CalendarIcon, UserIcon, MapPinIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

export default function SearchCard() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 grid gap-4 md:grid-cols-4 items-end">
      <div className="relative md:col-span-2">
        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar carrera..."
          className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400 text-gray-900 placeholder-gray-400"
        />
      </div>
      <div className="relative">
        <UserIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
        <input
          type="text"
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="Ciudad"
          className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <div className="relative">
        <CalendarIcon className="w-5 h-5 text-gray-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-400"
        />
      </div>
      <button className="md:col-span-1 bg-yellow-400 hover:bg-yellow-500 text-white font-semibold py-2 rounded-xl transition">
        Inscribirse
      </button>
    </div>
  );
}