"use client";

import { useState } from "react";
import type { ClienteCorporativo } from "@/lib/db/catalogos";
import { upsertCliente, deleteCliente } from "@/app/actions/catalogos";
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

const EMPTY: ClienteCorporativo = {
  id: "", nombre: "", alias: null, relacion: null, estado: "activo", notas: null,
};

export default function ClientesClient({ clientes: initial }: { clientes: ClienteCorporativo[] }) {
  const [clientes, setClientes] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<ClienteCorporativo | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertCliente, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteCliente(id);
    if (error) toast.error(error);
    else { toast.success("Cliente eliminado."); setClientes((p) => p.filter((c) => c.id !== id)); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-white h-8 text-xs"
        >
          + Nuevo cliente
        </Button>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60 dark:bg-surface-muted dark:hover:bg-surface-muted">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Alias</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Relación</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-28">Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((c) => (
              <TableRow
                key={c.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(c); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{c.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{c.nombre}</TableCell>
                <TableCell className="text-xs text-text-muted">{c.alias ?? "—"}</TableCell>
                <TableCell className="text-xs text-text-muted max-w-xs truncate">{c.relacion ?? "—"}</TableCell>
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
        titulo={isNuevo ? "Nuevo cliente" : "Editar cliente"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="CL-008" />
              <div className="space-y-1.5">
                <Label htmlFor="estado" className="text-xs font-medium text-brand-cocoa">Estado</Label>
                <select id="estado" name="estado" defaultValue={editando.estado}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="programado">Programado</option>
                </select>
              </div>
            </div>
            <FormField label="Nombre" name="nombre" defaultValue={editando.nombre} required />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Alias" name="alias" defaultValue={editando.alias} placeholder="Abreviación" />
              <FormField label="Relación" name="relacion" defaultValue={editando.relacion} placeholder="Tipo de contrato" />
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
