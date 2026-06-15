import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Reportes P&L — eLunch Finanzas",
};

export default function ReportesPage() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Image
        src="/brand/eLunch-mascota-pollo.png"
        alt="Próximamente"
        width={80}
        height={80}
        className="object-contain mb-5 opacity-80"
      />
      <h2 className="font-display text-xl text-brand-forest mb-2">
        Reportes P&L — Sprint 6
      </h2>
      <p className="text-text-muted text-sm max-w-xs">
        P&L diario, semanal, mensual y margen de contribución por unidad. Disponible en el Sprint 6.
      </p>
    </div>
  );
}
