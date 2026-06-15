import type { Metadata } from "next";
import { getFormasPago } from "@/lib/db/catalogos";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Formas de Pago — eLunch Finanzas",
};

function CheckIcon({ active }: { active: boolean | null }) {
  if (active === null) return <span className="text-text-muted">?</span>;
  return active ? (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-status-ok" aria-label="Sí">
      <path d="M3 8l3.5 3.5L13 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-text-muted" aria-label="No">
      <path d="M12 4L4 12M4 4l8 8" strokeLinecap="round" />
    </svg>
  );
}

export default async function FormasPagoPage() {
  const formas = await getFormasPago();

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
          <a href="/catalogos" className="hover:text-brand-coral transition-colors">Catálogos</a>
          <span>/</span>
          <span>Formas de Pago</span>
        </div>
        <h2 className="font-display text-2xl text-brand-forest mb-1">Formas de Pago</h2>
        <p className="text-sm text-text-muted">
          Cómo se mueve el dinero. Las columnas &quot;Cash&quot; y &quot;CXC/CXP&quot; determinan el impacto financiero.
        </p>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-32">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa text-center w-24">Afecta Cash</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa text-center w-28">Genera CXC/CXP</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Notas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formas.map((f) => (
              <TableRow key={f.id} className="hover:bg-brand-cream/30">
                <TableCell className="text-xs font-mono text-text-muted">{f.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{f.nombre}</TableCell>
                <TableCell>
                  {f.tipo && (
                    <Badge variant="outline" className="text-xs border-border text-text-muted">
                      {f.tipo}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <CheckIcon active={f.afecta_cash} />
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center">
                    <CheckIcon active={f.genera_cxc_cxp} />
                  </div>
                </TableCell>
                <TableCell className="text-xs text-text-muted">{f.notas ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-text-muted mt-3">
        Las formas de pago son de referencia. Para modificarlas, aplica una nueva migración SQL.
      </p>
    </div>
  );
}
