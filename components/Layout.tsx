import { ReactNode } from "react";
import Header from "./header";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      {/* reduce pt-16 a pt-8 para menos espacio bajo el header */}
      <main className="pt-8 px-4">
        {children}
      </main>
    </div>
  );
}