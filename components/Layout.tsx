// components/Layout.tsx
import { ReactNode } from "react";
import Header from "./header";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div>
      <Header />
      <main className="pt-16 px-4">{children}</main>
    </div>
  );
}