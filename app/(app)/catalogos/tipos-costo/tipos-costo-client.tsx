"use client";

import { useState, useMemo } from "react";
import type { TipoCosto } from "@/lib/db/catalogos";
import { upsertTipoCosto, deleteTipoCosto } from "@/app/actions/catalogos";
import {
  DeleteButton,
  FormField,
  CatalogoDialog,
  TableShell,
  useServerAction,
  SearchBar,
  EmptyState,
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
  const [busqueda, setBusqueda] = useState("");
  const isNuevo = !editando?.id;

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return q ? tipos.filter((t) => t.tag.toLowerCase().includes(q) || (t.grupo ?? "").toLowerCase().includes(q)) : tipos;
  }, [tipos, busqueda]);

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

  const openNew = () => { reset(); setEditando(EMPTY); setDialogOpen(true); };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <SearchBar value={busqueda} onChange={setBusqueda} placeholder="Buscar tipo..." />
        <Button
          size="sm"
          onClick={openNew}
          className="bg-brand-coral hover:bg-brand-coral/90 text-[#1c1712] h-8 text-xs"
        >
          + Nuevo tipo
        </Button>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60 dark:bg-surface-muted dark:hover:bg-surface-muted">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Tag</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Grupo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Descripción</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((t) => (
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
                  <DeleteButton onConfirm={() => handleDelete(t.id)} label="Eliminar" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtrados.length === 0 && (
          <EmptyState
            mensaje={busqueda ? `Sin resultados para "${busqueda}".` : "No hay tipos de costo."}
            onNew={busqueda ? undefined : openNew}
          />
        )}
      </TableShell>
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
