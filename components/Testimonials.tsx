import SectionHeader from "./SectionHeader";

interface Testimonial {
  id: string;
  author: string;
  text: string;
  avatarUrl?: string;
}

export default function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <section className="space-y-6">
      <SectionHeader title="Testimonios de Corredores" />
      <div className="space-y-4">
        {items.map((t) => (
          <div key={t.id} className="bg-white rounded-2xl shadow-sm p-6 flex gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center overflow-hidden">
              {t.avatarUrl ? (
                <img src={t.avatarUrl} alt={t.author} className="w-full h-full object-cover" />
              ) : (
                <span className="text-purple-600 font-bold">{t.author.charAt(0)}</span>
              )}
            </div>
            <div>
              <p className="italic text-gray-700">“{t.text}”</p>
              <p className="mt-2 font-medium text-gray-800">— {t.author}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}