"use client";

import { useState } from "react";
import type { TipoCosto } from "@/lib/db/catalogos";
import { upsertTipoCosto, deleteTipoCosto } from "@/app/actions/catalogos";
import {
  DeleteButton,
  FormField,
  CatalogoDialog,
  useServerAction,
} from "@/components/catalogo-table-shell";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const EMPTY: TipoCosto = { id: "", tag: "", grupo: null, descripcion: null };

export default function TiposCostoClient({ tipos: initial }: { tipos: TipoCosto[] }) {
  const [tipos, setTipos] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<TipoCosto | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertTipoCosto, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteTipoCosto(id);
    if (error) toast.error(error);
    else { toast.success("Tipo eliminado."); setTipos((p) => p.filter((t) => t.id !== id)); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-white h-8 text-xs"
        >
          + Nuevo tipo
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Tag</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Grupo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Descripción</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.map((t) => (
              <TableRow
                key={t.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(t); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{t.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{t.tag}</TableCell>
                <TableCell className="text-xs text-text-muted">{t.grupo ?? "—"}</TableCell>
                <TableCell className="text-xs text-text-muted">{t.descripcion ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <DeleteButton
                    onConfirm={() => handleDelete(t.id)}
                    label="Eliminar"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-text-muted mt-2">
        Si eliminas un tipo usado por algún proveedor, la app te avisará con un error.
      </p>

      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nuevo tipo de costo" : "Editar tipo de costo"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="TC-23" />
              <FormField label="Grupo" name="grupo" defaultValue={editando.grupo} placeholder="Proteína, Bebidas…" />
            </div>
            <FormField label="Tag" name="tag" defaultValue={editando.tag} required placeholder="Nombre del tipo" />
            <FormField label="Descripción" name="descripcion" defaultValue={editando.descripcion} placeholder="Opcional" />
          </>
        )}
      </CatalogoDialog>
    </>
  );
}
