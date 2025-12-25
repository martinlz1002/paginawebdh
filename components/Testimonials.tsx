import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, User } from "firebase/auth";
import SectionHeader from "./SectionHeader";

interface Testimonial {
  id: string;
  author: string;
  text: string;
  avatarUrl?: string;
  timestamp?: { seconds: number; nanoseconds: number };
}

export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [newText, setNewText] = useState("");

  // Traer testimonios
  const fetchTestimonials = async () => {
    try {
      const res = await fetch("/api/testimonials");
      if (!res.ok) throw new Error(`GET /api/testimonials → ${res.status}`);
      const data: Testimonial[] = await res.json();
      setItems(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTestimonials();
    const auth = getAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newText.trim()) return;
    const author = user.displayName || user.email!.split("@")[0];
    const payload = { author, text: newText.trim(), avatarUrl: user.photoURL || null };

    try {
      const res = await fetch("/api/testimonials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || res.statusText);
      }
      setNewText("");
      fetchTestimonials();
    } catch (e) {
      console.error("POST /api/testimonials:", e);
    }
  };

  return (
    <section className="space-y-6">
      <SectionHeader title="Testimonios de Corredores" />

      {user && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder="Escribe tu testimonio..."
            className="w-full border rounded-xl p-3 resize-none focus:ring-2 focus:ring-dh-purple/50 focus:border-dh-purple text-gray-900 placeholder-gray-400 bg-white"
            rows={3}
          />
          <button
            type="submit"
            className="bg-dh-green hover:bg-dh-green/90 text-dh-dark font-semibold px-4 py-2 rounded-xl transition shadow"
          >
            Enviar Testimonio
          </button>
        </form>
      )}

      {loading ? (
        <p>Cargando testimonios…</p>
      ) : items.length === 0 ? (
        <p>No hay testimonios aún. ¡Sé el primero!</p>
      ) : (
        <div className="space-y-4">
          {items.map(t => (
            <div
              key={t.id}
              className="bg-white rounded-2xl shadow-sm p-6 flex gap-4"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden">
                {t.avatarUrl ? (
                  <img
                    src={t.avatarUrl}
                    alt={t.author}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-purple-600 font-bold">
                    {t.author.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <p className="italic text-gray-700">“{t.text}”</p>
                <p className="mt-2 font-medium text-gray-800">— {t.author}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}