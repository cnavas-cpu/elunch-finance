"use client";

import { useState, useTransition, useRef, useCallback, useId, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CatalogosCierre, TransaccionDisplay, FormaPagoOpc } from "@/lib/db/cierre";
import { calcularResumenDia, formatUSD, parseCentavos } from "@/lib/finance/cierre";
import { registrarVentaAction, registrarSalidaAction, eliminarTransaccionAction } from "./actions";

function Badge({ label, variant }: { label: string; variant: "cash" | "cxc" | "cxp" | "neutral" }) {
  const styles = {
    cash:    "bg-status-ok/15 text-status-ok border-status-ok/25",
    cxc:     "bg-status-info/15 text-status-info border-status-info/25",
    cxp:     "bg-status-warn/15 text-status-warn border-status-warn/25",
    neutral: "bg-border/20 text-text-muted border-border/30",
  };
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded border font-medium", styles[variant])}>
      {label}
    </span>
  );
}

function badgeParaFormaPago(fp: FormaPagoOpc, tipo: "venta" | "salida") {
  if (fp.genera_cxc_cxp) {
    return tipo === "venta"
      ? <Badge label="CXC" variant="cxc" />
      : <Badge label="CXP" variant="cxp" />;
  }
  if (fp.afecta_cash) return <Badge label="Cash" variant="cash" />;
  return <Badge label={fp.nombre.slice(0, 6)} variant="neutral" />;
}

// ── Select nativo con estilos consistentes ───────────────────

function Select({
  id, name, value, onChange, required, placeholder, children, className,
}: {
  id?: string; name?: string; value: string;
  onChange: (v: string) => void; required?: boolean;
  placeholder?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      className={cn(
        "h-9 px-2 text-sm rounded-md border border-border bg-surface text-foreground",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0",
        "disabled:opacity-50 transition-shadow duration-150",
        className
      )}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
}

function Input({
  id, name, value, onChange, type = "text", placeholder, required, min, step, autoFocus, inputRef, className,
}: {
  id?: string; name?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
  min?: string; step?: string; autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement | null>; className?: string;
}) {
  return (
    <input
      ref={inputRef}
      id={id} name={name} type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      min={min} step={step} autoFocus={autoFocus}
      className={cn(
        "h-9 px-3 text-sm rounded-md border border-border bg-surface text-foreground",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0",
        "placeholder:text-text-muted transition-shadow duration-150",
        className
      )}
    />
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium text-brand-cocoa block mb-1">
      {children}
    </label>
  );
}

// ── Formulario de Venta ──────────────────────────────────────

function VentaForm({
  fecha,
  catalogos,
  onSuccess,
}: {
  fecha: string;
  catalogos: CatalogosCierre;
  onSuccess: (tx: TransaccionDisplay) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [unidadId, setUnidadId]       = useState("");
  const [monto, setMonto]             = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [cuentaId, setCuentaId]       = useState("");
  const [clienteId, setClienteId]     = useState("");
  const [fechaEsperada, setFechaEsperada] = useState("");  // Sprint 5
  const uid = useId();
  const montoRef = useRef<HTMLInputElement>(null);

  const fp = catalogos.formasPago.find(f => f.id === formaPagoId);
  const mostrarCuenta  = fp?.afecta_cash === true;
  const mostrarCliente = fp?.genera_cxc_cxp === true;

  // Auto-prefill fecha esperada desde días de crédito del cliente (Sprint 5)
  useEffect(() => {
    if (!mostrarCliente || !clienteId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFechaEsperada("");
      return;
    }
    const cliente = catalogos.clientes.find(c => c.id === clienteId);
    if (!cliente || cliente.dias_credito <= 0) return;
    // Calcular sin problemas UTC: parsear con hora local
    const base = new Date(fecha + "T00:00:00");
    base.setDate(base.getDate() + cliente.dias_credito);
    const yyyy = base.getFullYear();
    const mm   = String(base.getMonth() + 1).padStart(2, "0");
    const dd   = String(base.getDate()).padStart(2, "0");
    setFechaEsperada(`${yyyy}-${mm}-${dd}`);
  }, [clienteId, mostrarCliente, fecha, catalogos.clientes]);

  // Ventas: solo formas de pago de ingreso o ambos
  const formasPagoVenta = catalogos.formasPago.filter(
    f => !f.tipo || f.tipo === "Ingreso" || f.tipo === "Ingreso/Egreso"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const montoCentavos = parseCentavos(monto);
    if (montoCentavos <= 0) {
      toast.error("El monto debe ser mayor que $0.00");
      return;
    }

    startTransition(async () => {
      const result = await registrarVentaAction({
        fecha,
        unidad_id:       unidadId,
        monto_centavos:  montoCentavos,
        forma_pago_id:   formaPagoId,
        cuenta_id:       mostrarCuenta  ? cuentaId   || null : null,
        cliente_id:      mostrarCliente ? clienteId  || null : null,
        fecha_esperada:  mostrarCliente ? fechaEsperada || null : null,  // Sprint 5
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Venta registrada");
      onSuccess(result.data);
      setMonto("");
      setFechaEsperada("");  // Sprint 5
      // Re-focus para entrada rápida
      setTimeout(() => montoRef.current?.focus(), 50);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${uid}-unidad`}>Unidad</Label>
          <Select
            id={`${uid}-unidad`}
            value={unidadId}
            onChange={setUnidadId}
            required
            placeholder="Seleccionar..."
            className="w-full"
          >
            {catalogos.unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${uid}-fp`}>Forma de pago</Label>
          <Select
            id={`${uid}-fp`}
            value={formaPagoId}
            onChange={v => { setFormaPagoId(v); setCuentaId(""); setClienteId(""); }}
            required
            placeholder="Seleccionar..."
            className="w-full"
          >
            {formasPagoVenta.map(f => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${uid}-monto`}>Monto (USD)</Label>
          <Input
            id={`${uid}-monto`}
            inputRef={montoRef}
            type="number"
            value={monto}
            onChange={setMonto}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            className="w-full tabular-nums"
          />
        </div>

        {mostrarCuenta && (
          <div>
            <Label htmlFor={`${uid}-cuenta`}>Cuenta</Label>
            <Select
              id={`${uid}-cuenta`}
              value={cuentaId}
              onChange={setCuentaId}
              placeholder="Seleccionar..."
              className="w-full"
            >
              {catalogos.cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>
        )}

        {mostrarCliente && (
          <div>
            <Label htmlFor={`${uid}-cliente`}>Cliente (CXC)</Label>
            <p className="text-[11px] text-text-muted -mt-0.5 mb-1">
              Esta venta no entra a caja — se registra como Cuenta por Cobrar hasta que el cliente pague.
            </p>
            <Select
              id={`${uid}-cliente`}
              value={clienteId}
              onChange={setClienteId}
              placeholder="Seleccionar..."
              className="w-full"
            >
              {catalogos.clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>
        )}

        {mostrarCliente && (
          <div>
            <Label htmlFor={`${uid}-fecha-esp`}>Fecha esperada (CXC)</Label>
            <Input
              id={`${uid}-fecha-esp`}
              type="date"
              value={fechaEsperada}
              onChange={setFechaEsperada}
              className="w-full"
            />
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full h-9 bg-brand-coral text-[#1c1712] text-sm font-medium rounded-md hover:bg-brand-coral/90 disabled:opacity-60 transition-colors duration-150 cursor-pointer"
      >
        {pending ? "Registrando..." : "+ Registrar venta"}
      </button>
    </form>
  );
}

// ── Formulario de Salida ──────────────────────────────────────

function SalidaForm({
  fecha,
  catalogos,
  onSuccess,
}: {
  fecha: string;
  catalogos: CatalogosCierre;
  onSuccess: (tx: TransaccionDisplay) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto]             = useState("");
  const [formaPagoId, setFormaPagoId] = useState("");
  const [cuentaId, setCuentaId]       = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [asignacion, setAsignacion]   = useState<"pool" | "directa">("pool");
  const [unidadId, setUnidadId]       = useState("");
  const [fechaVenc, setFechaVenc]     = useState("");
  const uid = useId();
  const descRef = useRef<HTMLInputElement>(null);

  const fp = catalogos.formasPago.find(f => f.id === formaPagoId);
  const mostrarCuenta   = fp?.afecta_cash === true;
  const mostrarVenc     = fp?.genera_cxc_cxp === true;

  // Auto-prefill fecha de vencimiento desde días de crédito del proveedor
  useEffect(() => {
    if (!mostrarVenc || !proveedorId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFechaVenc("");
      return;
    }
    const prov = catalogos.proveedores.find(p => p.id === proveedorId);
    if (!prov || prov.dias_credito <= 0) return;
    // Calcular fecha sin problemas UTC: parse con hora local
    const base = new Date(fecha + "T00:00:00");
    base.setDate(base.getDate() + prov.dias_credito);
    const yyyy = base.getFullYear();
    const mm   = String(base.getMonth() + 1).padStart(2, "0");
    const dd   = String(base.getDate()).padStart(2, "0");
    setFechaVenc(`${yyyy}-${mm}-${dd}`);
  }, [proveedorId, mostrarVenc, fecha, catalogos.proveedores]);

  const formasPagoSalida = catalogos.formasPago.filter(
    f => !f.tipo || f.tipo === "Egreso" || f.tipo === "Ingreso/Egreso"
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const montoCentavos = parseCentavos(monto);
    if (montoCentavos <= 0) {
      toast.error("El monto debe ser mayor que $0.00");
      return;
    }

    startTransition(async () => {
      const result = await registrarSalidaAction({
        fecha,
        descripcion,
        monto_centavos:     montoCentavos,
        forma_pago_id:      formaPagoId,
        asignacion,
        unidad_id:          asignacion === "directa" ? unidadId || null : null,
        categoria_gasto_id: categoriaId || null,
        proveedor_id:       proveedorId || null,
        cuenta_id:          mostrarCuenta ? cuentaId || null : null,
        fecha_vencimiento:  mostrarVenc && fechaVenc ? fechaVenc : null,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Salida registrada");
      onSuccess(result.data);
      setDescripcion("");
      setMonto("");
      setFechaVenc("");
      setTimeout(() => descRef.current?.focus(), 50);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label htmlFor={`${uid}-desc`}>Descripción</Label>
          <Input
            id={`${uid}-desc`}
            inputRef={descRef}
            value={descripcion}
            onChange={setDescripcion}
            placeholder="Ej: Compra Sigma, Gasolina..."
            required
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor={`${uid}-monto`}>Monto (USD)</Label>
          <Input
            id={`${uid}-monto`}
            type="number"
            value={monto}
            onChange={setMonto}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            className="w-full tabular-nums"
          />
        </div>
        <div>
          <Label htmlFor={`${uid}-fp`}>Forma de pago</Label>
          <Select
            id={`${uid}-fp`}
            value={formaPagoId}
            onChange={v => { setFormaPagoId(v); setCuentaId(""); setFechaVenc(""); }}
            required
            placeholder="Seleccionar..."
            className="w-full"
          >
            {formasPagoSalida.map(f => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`${uid}-cat`}>Categoría</Label>
          <Select
            id={`${uid}-cat`}
            value={categoriaId}
            onChange={setCategoriaId}
            placeholder="(opcional)"
            className="w-full"
          >
            {catalogos.categorias.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`${uid}-prov`}>Proveedor</Label>
          <Select
            id={`${uid}-prov`}
            value={proveedorId}
            onChange={setProveedorId}
            placeholder="(opcional)"
            className="w-full"
          >
            {catalogos.proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {mostrarCuenta && (
          <div>
            <Label htmlFor={`${uid}-cuenta`}>Cuenta</Label>
            <Select
              id={`${uid}-cuenta`}
              value={cuentaId}
              onChange={setCuentaId}
              placeholder="Seleccionar..."
              className="w-full"
            >
              {catalogos.cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>
        )}

        {mostrarVenc && (
          <div>
            <Label htmlFor={`${uid}-venc`}>Vence (CXP)</Label>
            <p className="text-[11px] text-text-muted -mt-0.5 mb-1">
              Esta compra no sale de caja — se registra como Cuenta por Pagar hasta que pagues al proveedor.
            </p>
            <Input
              id={`${uid}-venc`}
              type="date"
              value={fechaVenc}
              onChange={setFechaVenc}
              className="w-full"
            />
          </div>
        )}
      </div>

      {/* Asignación */}
      <div>
        <Label>Asignación</Label>
        <div className="flex gap-2">
          {(["pool", "directa"] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAsignacion(a)}
              className={cn(
                "flex-1 py-1.5 px-2 text-xs rounded-md border transition-colors duration-150 cursor-pointer",
                asignacion === a
                  ? "bg-brand-coral text-[#1c1712] border-brand-coral"
                  : "bg-surface border-border text-text-muted hover:border-brand-cocoa/40"
              )}
            >
              <>
                <span className="block text-xs font-medium leading-tight">
                  {a === "pool" ? "Pool común" : "Directa a unidad"}
                </span>
                <span className={cn(
                  "block text-[10px] leading-tight mt-0.5",
                  asignacion === a ? "opacity-70" : "text-text-muted/70"
                )}>
                  {a === "pool"
                    ? "Gasto compartido entre todas las unidades"
                    : "Solo para una cafetería específica"}
                </span>
              </>
            </button>
          ))}
        </div>
        {asignacion === "directa" && (
          <div className="mt-2">
            <Label htmlFor={`${uid}-unidad`}>Unidad de negocio</Label>
            <Select
              id={`${uid}-unidad`}
              value={unidadId}
              onChange={setUnidadId}
              placeholder="Seleccionar unidad..."
              className="w-full"
            >
              {catalogos.unidades.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full h-9 bg-brand-coral text-[#1c1712] text-sm font-medium rounded-md hover:bg-brand-coral/90 disabled:opacity-60 transition-colors duration-150 cursor-pointer"
      >
        {pending ? "Registrando..." : "+ Registrar salida"}
      </button>
    </form>
  );
}

// ── Fila de transacción ──────────────────────────────────────

function TxRow({
  tx,
  onDelete,
}: {
  tx: TransaccionDisplay;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    clearTimeout(timer.current);
    setDeleting(true);
    const result = await eliminarTransaccionAction(tx.id);
    if (!result.ok) {
      toast.error(result.error ?? "Error al eliminar");
      setDeleting(false);
      setConfirming(false);
      return;
    }
    onDelete(tx.id);
    toast.success("Eliminado");
  };

  const nombreUnidad   = tx.unidades_negocio?.nombre ?? "—";
  const nombreCategoria = tx.categorias_gasto?.nombre ?? null;
  const nombreProveedor = tx.proveedores?.nombre     ?? null;
  const nombreCuenta   = tx.cuentas_bancarias?.nombre ?? null;

  return (
    <tr className="border-b border-border/40 hover:bg-surface-muted/40 transition-colors duration-100">
      <td className="py-2 px-3 text-sm">
        <p className="text-foreground font-medium leading-tight">
          {tx.tipo === "venta" ? nombreUnidad : (tx.descripcion ?? "—")}
        </p>
        {tx.tipo === "salida" && (nombreCategoria || nombreProveedor) && (
          <p className="text-xs text-text-muted mt-0.5">
            {[nombreCategoria, nombreProveedor].filter(Boolean).join(" · ")}
          </p>
        )}
      </td>
      <td className="py-2 px-3 text-sm text-right tabular-nums font-medium text-foreground">
        {formatUSD(tx.monto_centavos)}
      </td>
      <td className="py-2 px-3 text-sm hidden sm:table-cell">
        <div className="flex flex-col gap-0.5">
          {badgeParaFormaPago(tx.formas_pago, tx.tipo)}
          {nombreCuenta && (
            <span className="text-xs text-text-muted">{nombreCuenta}</span>
          )}
        </div>
      </td>
      {tx.tipo === "salida" && (
        <td className="py-2 px-3 text-xs text-text-muted hidden md:table-cell">
          {tx.asignacion === "directa" ? (
            <span className="text-status-info">Directa</span>
          ) : (
            <span>Pool</span>
          )}
        </td>
      )}
      <td className="py-2 px-2 text-right">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "text-xs px-2 py-1 rounded transition-colors duration-150 cursor-pointer",
            confirming
              ? "bg-status-danger text-white dark:text-[#1c1712] hover:bg-status-danger/80"
              : "text-text-muted hover:text-status-danger hover:bg-status-danger/10",
            deleting ? "opacity-50 cursor-not-allowed" : ""
          )}
        >
          {deleting ? "..." : confirming ? "¿Confirmar?" : "Eliminar"}
        </button>
      </td>
    </tr>
  );
}

// ── Fila del resumen (fuera del render para evitar re-creación) ──

function LineaResumen({ label, valor, colorClass }: { label: string; valor: number; colorClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={cn("text-sm tabular-nums font-medium", colorClass ?? "text-foreground")}>
        {formatUSD(valor)}
      </span>
    </div>
  );
}

// ── Panel de Resumen ──────────────────────────────────────────

function ResumenPanel({
  ventas,
  salidas,
  cuentas,
}: {
  ventas:  TransaccionDisplay[];
  salidas: TransaccionDisplay[];
  cuentas: Array<{ id: string; nombre: string }>;
}) {
  const resumen = calcularResumenDia(
    ventas.map(v => ({
      monto_centavos: v.monto_centavos,
      forma_pago:     v.formas_pago,
      cuenta_id:      v.cuenta_id,
    })),
    salidas.map(s => ({
      monto_centavos: s.monto_centavos,
      forma_pago:     s.formas_pago,
      cuenta_id:      s.cuenta_id,
    }))
  );

  const diffPos = resumen.diff >= 0;

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-muted">
        <h3 className="font-display text-sm text-brand-forest dark:text-foreground">Resumen del día</h3>
      </div>

      <div className="px-4 py-2 space-y-0.5">
        <p className="text-[10px] text-text-muted uppercase tracking-wide pt-1 pb-0.5">Ventas</p>
        <LineaResumen label="Cash cobrado" valor={resumen.totalVentasCash} colorClass="text-status-ok" />
        {resumen.totalVentasCredito > 0 && (
          <LineaResumen label="Crédito (CXC)" valor={resumen.totalVentasCredito} colorClass="text-status-info" />
        )}
        <p className="text-[10px] text-text-muted uppercase tracking-wide pt-2 pb-0.5">Salidas</p>
        <LineaResumen label="Cash pagado" valor={resumen.totalSalidasCash} colorClass="text-status-danger" />
        {resumen.totalSalidasCredito > 0 && (
          <LineaResumen label="Crédito (CXP)" valor={resumen.totalSalidasCredito} colorClass="text-status-warn" />
        )}
      </div>

      <div className="mx-4 my-2 border-t border-border" />

      <div className="px-4 pb-3">
        <div className="flex justify-between items-center py-1">
          <span className="text-xs font-medium text-brand-cocoa">Cash neto</span>
          <span className={cn(
            "text-sm tabular-nums font-semibold",
            resumen.cashNeto >= 0 ? "text-status-ok" : "text-status-danger"
          )}>
            {formatUSD(resumen.cashNeto)}
          </span>
        </div>
        <div className="flex justify-between items-center py-1.5 mt-1 bg-surface-muted rounded-md px-2">
          <div>
            <p className="text-xs font-semibold text-brand-cocoa">DIFF</p>
            <p className="text-[10px] text-text-muted leading-tight">
              Cash cobrado + lo que te deben (CXC) − lo que debes (CXP)
            </p>
          </div>
          <span className={cn(
            "text-base tabular-nums font-bold",
            diffPos ? "text-status-ok" : "text-status-danger"
          )}>
            {formatUSD(resumen.diff)}
          </span>
        </div>
      </div>

      {/* Saldos por cuenta */}
      {Object.keys(resumen.saldosPorCuenta).length > 0 && (
        <>
          <div className="mx-4 mb-2 border-t border-border" />
          <div className="px-4 pb-3">
            <p className="text-[10px] text-text-muted uppercase tracking-wide pb-1">Cuentas afectadas</p>
            {Object.entries(resumen.saldosPorCuenta).map(([cuentaId, saldo]) => {
              const cuenta = cuentas.find(c => c.id === cuentaId);
              return (
                <div key={cuentaId} className="flex justify-between items-center py-1">
                  <span className="text-xs text-text-muted truncate max-w-[120px]">
                    {cuenta?.nombre ?? cuentaId}
                  </span>
                  <span className={cn(
                    "text-xs tabular-nums font-medium",
                    saldo >= 0 ? "text-status-ok" : "text-status-danger"
                  )}>
                    {saldo >= 0 ? "+" : ""}{formatUSD(saldo)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Sección con título plegable ───────────────────────────────

function Seccion({
  titulo,
  count,
  children,
}: {
  titulo: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-muted border-b border-border hover:bg-surface-muted/80 transition-colors duration-150 cursor-pointer"
      >
        <h2 className="font-display text-sm text-brand-forest dark:text-foreground">{titulo}</h2>
        <div className="flex items-center gap-2">
          {count > 0 && (
            <span className="text-xs bg-brand-coral/15 text-brand-coral border border-brand-coral/25 rounded-full px-2 py-0.5 font-medium">
              {count}
            </span>
          )}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn("w-4 h-4 text-text-muted transition-transform duration-200", !open && "-rotate-90")}
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────

export function CierreClient({
  fecha,
  fechaHoy,
  catalogos,
  ventasIniciales,
  salidasIniciales,
}: {
  fecha:            string;
  fechaHoy:         string;
  catalogos:        CatalogosCierre;
  ventasIniciales:  TransaccionDisplay[];
  salidasIniciales: TransaccionDisplay[];
}) {
  const router = useRouter();
  const [ventas,  setVentas]  = useState<TransaccionDisplay[]>(ventasIniciales);
  const [salidas, setSalidas] = useState<TransaccionDisplay[]>(salidasIniciales);

  const handleFechaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nueva = e.target.value;
    if (nueva) router.push(`/cierre?fecha=${nueva}`);
  };

  const addVenta   = useCallback((tx: TransaccionDisplay) => setVentas(p  => [...p,  tx]), []);
  const addSalida  = useCallback((tx: TransaccionDisplay) => setSalidas(p => [...p,  tx]), []);
  const delVenta   = useCallback((id: string) => setVentas(p  => p.filter(t => t.id !== id)), []);
  const delSalida  = useCallback((id: string) => setSalidas(p => p.filter(t => t.id !== id)), []);

  const esHoy = fecha === fechaHoy;

  return (
    <div className="min-h-full bg-background">
      {/* Cabecera */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {!esHoy && (
            <span className="text-xs bg-status-warn/15 text-status-warn border border-status-warn/30 rounded px-2 py-0.5">
              Vista histórica
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="fecha-cierre" className="text-xs text-text-muted">Fecha:</label>
          <input
            id="fecha-cierre"
            type="date"
            value={fecha}
            onChange={handleFechaChange}
            max={fechaHoy}
            className="h-8 px-2 text-sm rounded-md border border-border bg-surface text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
          />
          {!esHoy && (
            <button
              onClick={() => router.push("/cierre")}
              className="h-8 px-3 text-xs rounded-md bg-brand-coral text-[#1c1712] hover:bg-brand-coral/90 transition-colors duration-150 cursor-pointer"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Layout principal */}
      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        {/* Columna izquierda: VENTAS + SALIDAS */}
        <div className="space-y-5">
          {/* VENTAS */}
          <Seccion titulo="Ventas del día" count={ventas.length}>
            <VentaForm fecha={fecha} catalogos={catalogos} onSuccess={addVenta} />

            {ventas.length > 0 && (
              <div className="mt-4 border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                      <th className="py-2 px-3 text-left font-medium">Unidad</th>
                      <th className="py-2 px-3 text-right font-medium">Monto</th>
                      <th className="py-2 px-3 text-left font-medium hidden sm:table-cell">Pago</th>
                      <th className="py-2 px-2 text-right font-medium w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventas.map(v => (
                      <TxRow key={v.id} tx={v} onDelete={delVenta} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-muted border-t border-border">
                      <td className="py-2 px-3 text-xs font-medium text-text-muted">Total ventas</td>
                      <td className="py-2 px-3 text-right text-sm font-semibold tabular-nums text-foreground" colSpan={3}>
                        {formatUSD(ventas.reduce((s, v) => s + v.monto_centavos, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Seccion>

          {/* SALIDAS */}
          <Seccion titulo="Salidas del día" count={salidas.length}>
            <SalidaForm fecha={fecha} catalogos={catalogos} onSuccess={addSalida} />

            {salidas.length > 0 && (
              <div className="mt-4 border border-border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                      <th className="py-2 px-3 text-left font-medium">Descripción</th>
                      <th className="py-2 px-3 text-right font-medium">Monto</th>
                      <th className="py-2 px-3 text-left font-medium hidden sm:table-cell">Pago</th>
                      <th className="py-2 px-3 text-left font-medium hidden md:table-cell">Asignación</th>
                      <th className="py-2 px-2 text-right font-medium w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {salidas.map(s => (
                      <TxRow key={s.id} tx={s} onDelete={delSalida} />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-surface-muted border-t border-border">
                      <td className="py-2 px-3 text-xs font-medium text-text-muted">Total salidas</td>
                      <td className="py-2 px-3 text-right text-sm font-semibold tabular-nums text-foreground" colSpan={4}>
                        {formatUSD(salidas.reduce((s, v) => s + v.monto_centavos, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Seccion>
        </div>

        {/* Columna derecha: RESUMEN sticky */}
        <div className="lg:sticky lg:top-[57px]">
          <ResumenPanel
            ventas={ventas}
            salidas={salidas}
            cuentas={catalogos.cuentas}
          />
        </div>
      </div>
    </div>
  );
}
