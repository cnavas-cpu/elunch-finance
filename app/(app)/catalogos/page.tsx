import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Catálogos — eLunch Finanzas",
};

export default function CatalogosPage() {
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
        Catálogos — Sprint 2
      </h2>
      <p className="text-text-muted text-sm max-w-xs">
        ABM de proveedores, unidades de negocio, formas de pago y más. Disponible en el Sprint 2.
      </p>
    </div>
  );
}
