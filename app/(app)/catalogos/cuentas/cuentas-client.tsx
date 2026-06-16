"use client";

import { useState } from "react";
import type { CuentaBancaria } from "@/lib/db/catalogos";
import { upsertCuenta, deleteCuenta } from "@/app/actions/catalogos";
import {
  EstadoBadge,
  DeleteButton,
  FormField,
  CatalogoDialog,
  TableShell,
  useServerAction,
} from "@/components/catalogo-table-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  banco: "Banco",
  tarjeta_credito: "Tarjeta de crédito",
  otro: "Otro",
};

const EMPTY: CuentaBancaria = {
  id: "", nombre: "", tipo: "banco", moneda: "USD", estado: "activa", notas: null,
};

export default function CuentasClient({ cuentas: initial }: { cuentas: CuentaBancaria[] }) {
  const [cuentas, setCuentas] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<CuentaBancaria | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertCuenta, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteCuenta(id);
    if (error) toast.error(error);
    else { toast.success("Cuenta eliminada."); setCuentas((p) => p.filter((c) => c.id !== id)); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-[#1c1712] h-8 text-xs"
        >
          + Nueva cuenta
        </Button>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60 dark:bg-surface-muted dark:hover:bg-surface-muted">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">Moneda</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-28">Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cuentas.map((c) => (
              <TableRow
                key={c.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(c); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{c.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{c.nombre}</TableCell>
                <TableCell className="text-xs text-text-muted">{TIPO_LABEL[c.tipo] ?? c.tipo}</TableCell>
                <TableCell className="text-xs text-text-muted">{c.moneda}</TableCell>
                <TableCell><EstadoBadge estado={c.estado} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <DeleteButton onConfirm={() => handleDelete(c.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nueva cuenta" : "Editar cuenta"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="CB-08" />
              <div className="space-y-1.5">
                <Label htmlFor="estado" className="text-xs font-medium text-brand-cocoa">Estado</Label>
                <select id="estado" name="estado" defaultValue={editando.estado}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                </select>
              </div>
            </div>
            <FormField label="Nombre" name="nombre" defaultValue={editando.nombre} required />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tipo" className="text-xs font-medium text-brand-cocoa">Tipo</Label>
                <select id="tipo" name="tipo" defaultValue={editando.tipo}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="efectivo">Efectivo</option>
                  <option value="banco">Banco</option>
                  <option value="tarjeta_credito">Tarjeta de crédito</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <FormField label="Moneda" name="moneda" defaultValue={editando.moneda} placeholder="USD" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notas" className="text-xs font-medium text-brand-cocoa">Notas</Label>
              <textarea id="notas" name="notas" defaultValue={editando.notas ?? ""} rows={2}
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-brand-cocoa resize-none focus:outline-none focus:ring-2 focus:ring-brand-coral" />
            </div>
          </>
        )}
      </CatalogoDialog>
    </>
  );
}
