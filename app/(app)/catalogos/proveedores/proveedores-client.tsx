"use client";

import { useState, useMemo } from "react";
import type { Proveedor } from "@/lib/db/catalogos";
import { upsertProveedor, deleteProveedor } from "@/app/actions/catalogos";
import {
  EstadoBadge,
  DeleteButton,
  FormField,
  CatalogoDialog,
  useServerAction,
  SearchBar,
} from "@/components/catalogo-table-shell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const EMPTY: Proveedor = {
  id: "",
  nombre: "",
  tag_tipo: null,
  dias_credito: 0,
  estado: "activo",
  notas: null,
  contacto: null,
};

export default function ProveedoresClient({
  proveedores: initial,
  tagOptions,
}: {
  proveedores: Proveedor[];
  tagOptions: string[];
}) {
  const [proveedores, setProveedores] = useState(initial);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "activo" | "inactivo">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);

  const isNuevo = !editando?.id;

  const { state, busy, run, reset } = useServerAction(upsertProveedor, () => {
    setDialogOpen(false);
    setEditando(null);
    window.location.reload();
  });

  const rows = useMemo(() => {
    return proveedores
      .filter((p) => {
        const matchSearch =
          p.nombre.toLowerCase().includes(search.toLowerCase()) ||
          (p.tag_tipo ?? "").toLowerCase().includes(search.toLowerCase());
        const matchEstado = filtroEstado === "todos" || p.estado === filtroEstado;
        return matchSearch && matchEstado;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [proveedores, search, filtroEstado]);

  const openNuevo = () => {
    reset();
    setEditando(EMPTY);
    setDialogOpen(true);
  };

  const openEditar = (p: Proveedor) => {
    reset();
    setEditando(p);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteProveedor(id);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Proveedor eliminado.");
      setProveedores((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleSubmit = (fd: FormData) => {
    fd.set("_accion", isNuevo ? "nuevo" : "editar");
    run(fd);
  };

  return (
    <>
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nombre o tag..."
          />
          <div className="flex gap-1">
            {(["todos", "activo", "inactivo"] as const).map((e) => (
              <button
                key={e}
                onClick={() => setFiltroEstado(e)}
                className={[
                  "text-xs px-3 py-1 rounded-full border transition-colors",
                  filtroEstado === e
                    ? "bg-brand-forest text-brand-cream border-brand-forest"
                    : "border-border text-text-muted hover:border-brand-forest/40",
                ].join(" ")}
              >
                {e === "todos" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{rows.length} resultados</span>
          <Button
            size="sm"
            onClick={openNuevo}
            className="bg-brand-coral hover:bg-brand-coral/90 text-white h-8 text-xs"
          >
            + Nuevo proveedor
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-border rounded-lg overflow-hidden bg-surface">
        <Table>
          <TableHeader>
            <TableRow className="bg-brand-cream/60 hover:bg-brand-cream/60">
              <TableHead className="text-xs font-semibold text-brand-cocoa w-24">ID</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Nombre</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa">Tipo</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa text-right w-28">Crédito</TableHead>
              <TableHead className="text-xs font-semibold text-brand-cocoa w-28">Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-text-muted py-12">
                  Sin resultados
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow
                  key={p.id}
                  className="hover:bg-brand-cream/30 transition-colors cursor-pointer"
                  onClick={() => openEditar(p)}
                >
                  <TableCell className="text-xs font-mono text-text-muted">{p.id}</TableCell>
                  <TableCell className="text-sm font-medium text-brand-cocoa">{p.nombre}</TableCell>
                  <TableCell className="text-xs text-text-muted">{p.tag_tipo ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right font-mono">
                    {p.dias_credito === 0 ? (
                      <span className="text-text-muted">Contado</span>
                    ) : (
                      `${p.dias_credito}d`
                    )}
                  </TableCell>
                  <TableCell>
                    <EstadoBadge estado={p.estado} />
                  </TableCell>
                  <TableCell
                    onClick={(e) => e.stopPropagation()}
                    className="text-right"
                  >
                    <DeleteButton
                      onConfirm={() => handleDelete(p.id)}
                      label="Eliminar"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de creación / edición */}
      <CatalogoDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditando(null); reset(); }}
        titulo={isNuevo ? "Nuevo proveedor" : "Editar proveedor"}
        onSubmit={handleSubmit}
        busy={busy}
        error={state?.error}
      >
        {editando && (
          <>
            <input type="hidden" name="id" defaultValue={editando.id} />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="ID"
                name="id"
                defaultValue={editando.id}
                required
                placeholder="PR-046"
                hint={isNuevo ? "Ej: PR-046" : undefined}
              />
              <div className="space-y-1.5">
                <Label htmlFor="estado" className="text-xs font-medium text-brand-cocoa">
                  Estado
                </Label>
                <select
                  id="estado"
                  name="estado"
                  defaultValue={editando.estado}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </div>
            </div>
            <FormField
              label="Nombre"
              name="nombre"
              defaultValue={editando.nombre}
              required
              placeholder="Nombre del proveedor"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tag_tipo" className="text-xs font-medium text-brand-cocoa">
                  Tipo de costo
                </Label>
                <select
                  id="tag_tipo"
                  name="tag_tipo"
                  defaultValue={editando.tag_tipo ?? ""}
                  className="w-full h-9 px-3 text-sm rounded-md border border-border bg-surface text-brand-cocoa focus:outline-none focus:ring-2 focus:ring-brand-coral"
                >
                  <option value="">— Sin tipo —</option>
                  {tagOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <FormField
                label="Días de crédito"
                name="dias_credito"
                defaultValue={String(editando.dias_credito)}
                type="number"
                placeholder="0"
                hint="0 = contado"
              />
            </div>
            <FormField
              label="Contacto"
              name="contacto"
              defaultValue={editando.contacto}
              placeholder="Nombre / teléfono / correo"
            />
            <div className="space-y-1.5">
              <Label htmlFor="notas" className="text-xs font-medium text-brand-cocoa">
                Notas
              </Label>
              <textarea
                id="notas"
                name="notas"
                defaultValue={editando.notas ?? ""}
                rows={2}
                placeholder="Observaciones opcionales"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-brand-cocoa resize-none focus:outline-none focus:ring-2 focus:ring-brand-coral"
              />
            </div>
          </>
        )}
      </CatalogoDialog>
    </>
  );
}
