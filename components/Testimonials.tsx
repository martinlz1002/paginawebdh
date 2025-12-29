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
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || res.statusText);
      }

      setNewText("");
      fetchTestimonials();
    } catch (e) {
      console.error("POST /api/testimonials:", e);
    }
  };

  const shell =
    "rounded-2xl border border-white/10 bg-white/5 backdrop-blur shadow-dh";

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Testimonios de Corredores"
        subtitle="Lo que dicen los que ya corrieron con DHTime"
      />

      {/* Composer */}
      {user && (
        <form onSubmit={handleSubmit} className={`${shell} p-5 space-y-3`}>
          <div className="flex items-center justify-between">
            <p className="text-sm text-dh-ink/80">
              Comparte tu experiencia 👟
            </p>
            <span className="text-xs text-dh-ink/50">
              {newText.trim().length}/280
            </span>
          </div>

          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value.slice(0, 280))}
            placeholder="Escribe tu testimonio..."
            className={[
              "w-full rounded-xl p-3 resize-none",
              "bg-dh-dark/60 text-dh-ink placeholder-white/40",
              "border border-white/10",
              "focus:outline-none focus:ring-2 focus:ring-dh-green/40 focus:border-dh-green/40",
            ].join(" ")}
            rows={3}
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-dh-ink/45">
              Se publica con tu usuario:{" "}
              <span className="text-dh-ink/70">{user.displayName || user.email}</span>
            </p>

            <button
              type="submit"
              disabled={!newText.trim()}
              className={[
                "px-4 py-2 rounded-xl font-semibold transition shadow",
                "bg-dh-green text-dh-dark hover:bg-dh-green/90",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              Enviar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className={`${shell} p-6`}>
          <p className="text-dh-ink/70">Cargando testimonios…</p>
        </div>
      ) : items.length === 0 ? (
        <div className={`${shell} p-6`}>
          <p className="text-dh-ink/70">
            No hay testimonios aún.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => {
            const initial = (t.author || "?").trim().charAt(0).toUpperCase();

            return (
              <div
                key={t.id}
                className={[
                  shell,
                  "p-5 flex flex-col gap-4",
                  "transition hover:bg-white/10 hover:border-white/15",
                ].join(" ")}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-gradient-to-br from-dh-purple/50 to-dh-green/40 flex items-center justify-center">
                    {t.avatarUrl ? (
                      <img
                        src={t.avatarUrl}
                        alt={t.author}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-dh-ink font-extrabold">
                        {initial}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="font-semibold text-dh-ink truncate">{t.author}</p>
                    <p className="text-xs text-dh-ink/50">Corredor verificado ✅</p>
                  </div>
                </div>

                <p className="text-dh-ink/80 leading-relaxed">
                  <span className="text-dh-green/90 font-bold">“</span>
                  {t.text}
                  <span className="text-dh-green/90 font-bold">”</span>
                </p>

                <div className="mt-auto pt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs text-dh-ink/45">DHTime</span>
                  {/* Si luego quieres fecha, aquí la pintamos */}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}