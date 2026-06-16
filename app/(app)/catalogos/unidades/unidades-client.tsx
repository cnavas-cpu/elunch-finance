"use client";

import { useState } from "react";
import type { UnidadNegocio, FuenteIngreso, ClienteCorporativo } from "@/lib/db/catalogos";
import { upsertUnidad, deleteUnidad } from "@/app/actions/catalogos";
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

const EMPTY: UnidadNegocio = {
  id: "", nombre: "", fuente_ingreso_id: null, cliente_corp_id: null,
  ubicacion: null, estado: "activa", fecha_inicio: null, notas: null,
};

export default function UnidadesClient({
  unidades: initial,
  fuentes,
  clientes,
}: {
  unidades: UnidadNegocio[];
  fuentes: FuenteIngreso[];
  clientes: ClienteCorporativo[];
}) {
  const [unidades, setUnidades] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<UnidadNegocio | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertUnidad, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteUnidad(id);
    if (error) toast.error(error);
    else { toast.success("Unidad eliminada."); setUnidades((p) => p.filter((u) => u.id !== id)); }
  };

  const fuenteNombre = (id: string | null) =>
    fuentes.find((f) => f.id === id)?.nombre ?? id ?? "—";
  const clienteNombre = (id: string | null) =>
    clientes.find((c) => c.id === id)?.nombre ?? id ?? "—";

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-[#1c1712] h-8 text-xs"
        >
          + Nueva unidad
        </Button>
      </div>

      <TableShell>
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60 dark:bg-surface-muted dark:hover:bg-surface-muted">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Fuente</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Cliente</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-28">Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {unidades.map((u) => (
              <TableRow
                key={u.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(u); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{u.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{u.nombre}</TableCell>
                <TableCell className="text-xs text-text-muted">{fuenteNombre(u.fuente_ingreso_id)}</TableCell>
                <TableCell className="text-xs text-text-muted">{clienteNombre(u.cliente_corp_id)}</TableCell>
                <TableCell><EstadoBadge estado={u.estado} /></TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <DeleteButton onConfirm={() => handleDelete(u.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableShell>

      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nueva unidad de negocio" : "Editar unidad de negocio"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="UN-011" />
              <div className="space-y-1.5">
                <Label htmlFor="estado" className="text-xs font-medium text-brand-cocoa">Estado</Label>
                <select id="estado" name="estado" defaultValue={editando.estado}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="activa">Activa</option>
                  <option value="inactiva">Inactiva</option>
                  <option value="programada">Programada</option>
                </select>
              </div>
            </div>
            <FormField label="Nombre" name="nombre" defaultValue={editando.nombre} required />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fuente_ingreso_id" className="text-xs font-medium text-brand-cocoa">Fuente de ingreso</Label>
                <select id="fuente_ingreso_id" name="fuente_ingreso_id" defaultValue={editando.fuente_ingreso_id ?? ""}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="">— Ninguna —</option>
                  {fuentes.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cliente_corp_id" className="text-xs font-medium text-brand-cocoa">Cliente corporativo</Label>
                <select id="cliente_corp_id" name="cliente_corp_id" defaultValue={editando.cliente_corp_id ?? ""}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral">
                  <option value="">— Ninguno —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ubicación" name="ubicacion" defaultValue={editando.ubicacion} placeholder="Sede o dirección" />
              <FormField label="Fecha inicio" name="fecha_inicio" defaultValue={editando.fecha_inicio} type="date" />
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
