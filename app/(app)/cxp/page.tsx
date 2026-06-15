import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Cuentas por Pagar — eLunch Finanzas",
};

export default function CxpPage() {
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
        Cuentas por Pagar — Sprint 4
      </h2>
      <p className="text-text-muted text-sm max-w-xs">
        Gestiona deudas con proveedores y recibe alertas de vencimiento. Disponible en el Sprint 4.
      </p>
    </div>
  );
}
