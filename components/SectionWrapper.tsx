import { ReactNode } from 'react';

export default function SectionWrapper({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="text-3xl font-bold text-accent mb-6">{title}</h2>
      {children}
    </section>
  );
}