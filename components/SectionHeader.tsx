import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export default function SectionHeader({
  title,
  subtitle,
  children,
}: SectionHeaderProps) {
  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-extrabold text-green-800">{title}</h1>
      {subtitle && (
        <p className="mt-2 text-lg text-gray-600 max-w-xl mx-auto">{subtitle}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}