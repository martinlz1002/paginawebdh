import { ReactNode } from "react";
import Header from "./header";
import Footer from "./Footer";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      {/* reduce pt-16 a pt-8 para menos espacio bajo el header */}
      <main className="pt-6 px-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}