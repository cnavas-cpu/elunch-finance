"use client";

import { useState } from "react";
import type { FormaPago } from "@/lib/db/catalogos";
import { upsertFormaPago, deleteFormaPago } from "@/app/actions/catalogos";
import {
  DeleteButton,
  FormField,
  CatalogoDialog,
  useServerAction,
} from "@/components/catalogo-table-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

function CheckIcon({ active }: { active: boolean | null }) {
  if (active === null) return <span className="text-text-muted text-xs">?</span>;
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

const EMPTY: FormaPago = { id: "", nombre: "", tipo: null, afecta_cash: null, genera_cxc_cxp: false, notas: null };

export default function FormasPagoClient({ formas: initial }: { formas: FormaPago[] }) {
  const [formas, setFormas] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<FormaPago | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertFormaPago, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteFormaPago(id);
    if (error) toast.error(error);
    else { toast.success("Forma de pago eliminada."); setFormas((p) => p.filter((f) => f.id !== id)); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-white h-8 text-xs"
        >
          + Nueva forma de pago
        </Button>
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
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {formas.map((f) => (
              <TableRow
                key={f.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(f); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{f.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{f.nombre}</TableCell>
                <TableCell>
                  {f.tipo ? (
                    <Badge variant="outline" className="text-xs border-border text-text-muted">{f.tipo}</Badge>
                  ) : <span className="text-xs text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center"><CheckIcon active={f.afecta_cash} /></div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex justify-center"><CheckIcon active={f.genera_cxc_cxp} /></div>
                </TableCell>
                <TableCell className="text-xs text-text-muted">{f.notas ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <DeleteButton onConfirm={() => handleDelete(f.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nueva forma de pago" : "Editar forma de pago"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="FP-09" />
              <FormField label="Tipo" name="tipo" defaultValue={editando.tipo} placeholder="Contado, Crédito…" />
            </div>
            <FormField label="Nombre" name="nombre" defaultValue={editando.nombre} required />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-cocoa mb-1">Afecta Cash</label>
                <select
                  name="afecta_cash"
                  defaultValue={editando.afecta_cash === null ? "" : String(editando.afecta_cash)}
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral/30"
                >
                  <option value="">No definido</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-cocoa mb-1">Genera CXC/CXP</label>
                <select
                  name="genera_cxc_cxp"
                  defaultValue={String(editando.genera_cxc_cxp)}
                  className="w-full h-8 rounded-md border border-input bg-background px-3 text-xs text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral/30"
                >
                  <option value="false">No</option>
                  <option value="true">Sí</option>
                </select>
              </div>
            </div>
            <FormField label="Notas" name="notas" defaultValue={editando.notas} placeholder="Opcional" />
          </>
        )}
      </CatalogoDialog>
    </>
  );
}
