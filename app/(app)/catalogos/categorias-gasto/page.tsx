import type { Metadata } from "next";
import { getCategoriasGasto } from "@/lib/db/catalogos";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Categorías de Gasto — eLunch Finanzas",
};

const NATURALEZA_COLOR: Record<string, string> = {
  Fijo:            "bg-brand-forest/10 text-brand-forest border-brand-forest/20",
  Operativo:       "bg-brand-amber/10 text-brand-amber border-brand-amber/20",
  Variable:        "bg-brand-coral/10 text-brand-coral border-brand-coral/20",
  "Costo Directo Unidad": "bg-status-danger/10 text-status-danger border-status-danger/20",
  Financiero:      "bg-status-info/10 text-status-info border-status-info/20",
  Activo:          "bg-status-ok/10 text-status-ok border-status-ok/20",
  Otros:           "bg-border/40 text-text-muted border-border/40",
};

export default async function CategoriasGastoPage() {
  const categorias = await getCategoriasGasto();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Categorías de Gasto</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Categorías de Gasto</h2>
        <p className="text-sm text-text-muted">
          {categorias.length} categorías vigentes para clasificar los egresos operativos.
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-40">Naturaleza</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Descripción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map((c) => (
              <TableRow key={c.id} className="hover:bg-brand-cream/30">
                <TableCell className="text-xs font-mono text-text-muted">{c.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{c.nombre}</TableCell>
                <TableCell>
                  {c.naturaleza ? (
                    <Badge
                      variant="outline"
                      className={`text-xs px-2 py-0.5 border ${NATURALEZA_COLOR[c.naturaleza] ?? "bg-border/20 text-text-muted"}`}
                    >
                      {c.naturaleza}
                    </Badge>
                  ) : (
                    <span className="text-xs text-text-muted">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-text-muted">{c.descripcion ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-text-muted mt-3">
        Para agregar o renombrar categorías, aplica una nueva migración SQL.
      </p>
    </div>
  );
}
