"use client";

import { useState } from "react";
import type { CategoriaGasto } from "@/lib/db/catalogos";
import { upsertCategoriaGasto, deleteCategoriaGasto } from "@/app/actions/catalogos";
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

const NATURALEZA_COLOR: Record<string, string> = {
  Fijo:            "bg-brand-forest/10 text-brand-forest border-brand-forest/20",
  Operativo:       "bg-brand-amber/10 text-brand-amber border-brand-amber/20",
  Variable:        "bg-brand-coral/10 text-brand-coral border-brand-coral/20",
  "Costo Directo Unidad": "bg-status-danger/10 text-status-danger border-status-danger/20",
  Financiero:      "bg-status-info/10 text-status-info border-status-info/20",
  Activo:          "bg-status-ok/10 text-status-ok border-status-ok/20",
};

const EMPTY: CategoriaGasto = { id: "", nombre: "", naturaleza: null, descripcion: null };

export default function CategoriasGastoClient({ categorias: initial }: { categorias: CategoriaGasto[] }) {
  const [categorias, setCategorias] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<CategoriaGasto | null>(null);
  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertCategoriaGasto, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const handleDelete = async (id: string) => {
    const { error } = await deleteCategoriaGasto(id);
    if (error) toast.error(error);
    else { toast.success("Categoría eliminada."); setCategorias((p) => p.filter((c) => c.id !== id)); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => { reset(); setEditando(EMPTY); setDialogOpen(true); }}
          className="bg-brand-coral hover:bg-brand-coral/90 text-white h-8 text-xs"
        >
          + Nueva categoría
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-20">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-40">Naturaleza</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Descripción</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {categorias.map((c) => (
              <TableRow
                key={c.id}
                className="hover:bg-brand-cream/30 cursor-pointer"
                onClick={() => { reset(); setEditando(c); setDialogOpen(true); }}
              >
                <TableCell className="text-xs font-mono text-text-muted">{c.id}</TableCell>
                <TableCell className="text-sm font-medium text-brand-cocoa">{c.nombre}</TableCell>
                <TableCell>
                  {c.naturaleza ? (
                    <Badge variant="outline" className={`text-xs px-2 py-0.5 border ${NATURALEZA_COLOR[c.naturaleza] ?? "bg-border/20 text-text-muted"}`}>
                      {c.naturaleza}
                    </Badge>
                  ) : <span className="text-xs text-text-muted">—</span>}
                </TableCell>
                <TableCell className="text-xs text-text-muted">{c.descripcion ?? "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                  <DeleteButton onConfirm={() => handleDelete(c.id)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nueva categoría de gasto" : "Editar categoría"}
        onSubmit={(fd) => { fd.set("_accion", isNuevo ? "nuevo" : "editar"); run(fd); }}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField label="ID" name="id" defaultValue={editando.id} required placeholder="GA-25" />
              <FormField label="Naturaleza" name="naturaleza" defaultValue={editando.naturaleza} placeholder="Fijo, Operativo, Variable…" />
            </div>
            <FormField label="Nombre" name="nombre" defaultValue={editando.nombre} required />
            <FormField label="Descripción" name="descripcion" defaultValue={editando.descripcion} placeholder="Opcional" />
          </>
        )}
      </CatalogoDialog>
    </>
  );
}
