import type { Metadata } from "next";
import { getTiposCosto } from "@/lib/db/catalogos";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Tipos de Costo — eLunch Finanzas",
};

export default async function TiposCostoPage() {
  const tipos = await getTiposCosto();
  const grupos = [...new Set(tipos.map((t) => t.grupo ?? "Sin grupo"))].sort();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Tipos de Costo</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Tipos de Costo</h2>
        <p className="text-sm text-text-muted">
          Tags de clasificación para proveedores y transacciones. {tipos.length} tipos en {grupos.length} grupos.
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Tag</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Grupo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.map((t) => (
              <TableRow key={t.id} className="hover:bg-brand-cream/30">
                <TableCell className="text-xs font-mono text-text-muted">{t.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{t.tag}</TableCell>
                <TableCell className="text-xs text-text-muted">{t.grupo ?? "—"}</TableCell>
                <TableCell className="text-xs text-text-muted">{t.descripcion ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-text-muted mt-3">
        Para modificar tipos de costo, aplica una nueva migración SQL (afecta relaciones con proveedores).
      </p>
    </div>
  );
}
