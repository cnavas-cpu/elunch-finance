"use client";

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CxpDisplay, CuentaBancariaOpc } from "@/lib/db/cxp";
import {
  formatUSD,
  parseCentavos,
} from "@/lib/finance/cierre";
import {
  calcularSaldo,
  totalAbonado,
  estadoAging,
  resumenCxp,
  transicionesDisponibles,
  type EstadoCxp,
  type EstadoAging,
} from "@/lib/finance/cxp";
import { registrarPagoCxpAction, cambiarEstadoCxpAction } from "./actions";
import {
  SearchBar,
  TableShell,
  EmptyState,
} from "@/components/catalogo-table-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Badge de estado ───────────────────────────────────────────

const ESTADO_STYLE: Record<string, string> = {
  Pendiente:    "bg-border/30 text-text-muted border-border/50",
  Programada:   "bg-status-info/10 text-status-info border-status-info/25",
  Pagada:       "bg-status-ok/15 text-status-ok border-status-ok/25",
  Vencida:      "bg-status-danger/15 text-status-danger border-status-danger/25",
  "En disputa": "bg-status-warn/15 text-[#7a5100] dark:text-brand-amber border-status-warn/30",
};

function EstadoCxpBadge({ estado }: { estado: string }) {
  return (
    <span className={cn(
      "text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap",
      ESTADO_STYLE[estado] ?? "bg-border/20 text-text-muted border-border/30"
    )}>
      {estado}
    </span>
  );
}

// ── Badge de aging / semáforo ─────────────────────────────────

function AgingBadge({
  fechaVenc,
  aging,
  dias,
}: {
  fechaVenc: string | null;
  aging:     EstadoAging;
  dias:      number;
}) {
  if (!fechaVenc) {
    return <span className="text-xs text-text-muted">Sin fecha</span>;
  }

  // Formato "17 jun"
  const [, m, d] = fechaVenc.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const label = `${parseInt(d)} ${meses[parseInt(m) - 1]}`;

  const colorClass =
    aging === "vencida"    ? "text-status-danger" :
    aging === "por_vencer" ? "text-[#7a5100] dark:text-brand-amber" :
                             "text-text-muted";

  const sublabel =
    aging === "vencida"    ? `Venció hace ${Math.abs(dias)} días` :
    aging === "por_vencer" ? (dias === 0 ? "Vence hoy" : `Vence en ${dias} días`) :
                             `Faltan ${dias} días`;

  return (
    <div>
      <p className={cn("text-xs font-medium tabular-nums", colorClass)}>{label}</p>
      <p className={cn("text-[10px]", colorClass)}>{sublabel}</p>
    </div>
  );
}

// ── Tarjeta de resumen ────────────────────────────────────────

function ResumenCard({
  label,
  valor,
  sub,
  colorClass,
  borderClass,
}: {
  label:       string;
  valor:       number;
  sub?:        string;
  colorClass:  string;
  borderClass: string;
}) {
  return (
    <div className={cn(
      "bg-surface rounded-lg border p-4",
      borderClass
    )}>
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={cn("text-xl tabular-nums font-bold", colorClass)}>
        {formatUSD(valor)}
      </p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Fila de abono (dentro del diálogo) ───────────────────────

function PagoFila({
  pago,
}: {
  pago: CxpDisplay["pagos"][number];
}) {
  const [, m, d] = pago.fecha.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fechaLabel = `${parseInt(d)} ${meses[parseInt(m) - 1]}`;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <div>
        <p className="text-xs font-medium text-foreground">{fechaLabel}</p>
        {pago.cuentas_bancarias && (
          <p className="text-[10px] text-text-muted">{pago.cuentas_bancarias.nombre}</p>
        )}
        {pago.notas && (
          <p className="text-[10px] text-text-muted italic">{pago.notas}</p>
        )}
      </div>
      <span className="text-sm tabular-nums font-semibold text-status-ok">
        {formatUSD(pago.monto_centavos)}
      </span>
    </div>
  );
}

// ── Diálogo de abono ──────────────────────────────────────────

function AbonoDialog({
  cxp,
  cuentas,
  hoy,
  onClose,
  onSuccess,
}: {
  cxp:      CxpDisplay;
  cuentas:  CuentaBancariaOpc[];
  hoy:      string;
  onClose:  () => void;
  onSuccess: (cxpId: string, estado: string, nuevoAbono: { id: string; monto_centavos: number }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [monto, setMonto]         = useState("");
  const [cuentaId, setCuentaId]   = useState("");
  const [fecha, setFecha]         = useState(hoy);
  const [notas, setNotas]         = useState("");
  const [error, setError]         = useState<string | null>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  const saldo = calcularSaldo(cxp.monto_centavos, cxp.pagos);
  const abonado = totalAbonado(cxp.pagos);

  // Prefill monto con saldo
  useEffect(() => {
    const saldoDollars = (saldo / 100).toFixed(2);
    setMonto(saldoDollars);
    setTimeout(() => montoRef.current?.select(), 60);
  }, [saldo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const montoCentavos = parseCentavos(monto);
    if (montoCentavos <= 0) {
      setError("El monto debe ser mayor que $0.00");
      return;
    }
    if (!cuentaId) {
      setError("Selecciona una cuenta bancaria");
      return;
    }
    startTransition(async () => {
      const result = await registrarPagoCxpAction({
        cxp_id:         cxp.id,
        fecha,
        cuenta_id:      cuentaId,
        monto_centavos: montoCentavos,
        notas:          notas || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success("Abono registrado");
      // Extraer resultado del RPC para actualizar estado local
      const rpcData = result.data as { estado: string; pago_id: string } | undefined;
      onSuccess(cxp.id, rpcData?.estado ?? cxp.estado, {
        id:              rpcData?.pago_id ?? "",
        monto_centavos: montoCentavos,
      });
    });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-brand-forest dark:text-foreground">
            Registrar abono
          </DialogTitle>
        </DialogHeader>

        {/* Info de la CXP */}
        <div className="bg-surface-muted rounded-md px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium text-foreground">{cxp.proveedores?.nombre ?? "—"}</p>
          {cxp.transacciones?.descripcion && (
            <p className="text-xs text-text-muted">{cxp.transacciones.descripcion}</p>
          )}
          <div className="flex gap-4 text-xs pt-0.5">
            <span className="text-text-muted">Total: <span className="font-medium text-foreground tabular-nums">{formatUSD(cxp.monto_centavos)}</span></span>
            {abonado > 0 && (
              <span className="text-text-muted">Abonado: <span className="font-medium text-status-ok tabular-nums">{formatUSD(abonado)}</span></span>
            )}
            <span className="text-text-muted">Saldo: <span className="font-medium text-status-danger tabular-nums">{formatUSD(saldo)}</span></span>
          </div>
        </div>

        {/* Abonos previos */}
        {cxp.pagos.length > 0 && (
          <div className="max-h-28 overflow-y-auto border border-border/40 rounded-md px-3 py-1">
            <p className="text-[10px] text-text-muted uppercase tracking-wide py-1">
              Abonos previos
            </p>
            {cxp.pagos.map(p => <PagoFila key={p.id} pago={p} />)}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-brand-cocoa block mb-1">
                Fecha <span className="text-status-danger">*</span>
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                max={hoy}
                required
                className="h-9 w-full px-2 text-sm rounded-md border border-border bg-surface text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-brand-cocoa block mb-1">
                Monto (USD) <span className="text-status-danger">*</span>
              </label>
              <input
                ref={montoRef}
                type="number"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                step="0.01"
                min="0.01"
                required
                className="h-9 w-full px-3 text-sm rounded-md border border-border bg-surface text-foreground tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1">
              Cuenta bancaria <span className="text-status-danger">*</span>
            </label>
            <select
              value={cuentaId}
              onChange={e => setCuentaId(e.target.value)}
              required
              className="h-9 w-full px-2 text-sm rounded-md border border-border bg-surface text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
            >
              <option value="">Seleccionar...</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              maxLength={300}
              placeholder="Ej: cheque #1234, transferencia BAC..."
              className="h-9 w-full px-3 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-status-danger bg-status-danger/5 border border-status-danger/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="pt-1 gap-2">
            <DialogClose
              disabled={pending}
              className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand-cocoa bg-surface hover:bg-brand-cream/60 dark:hover:bg-white/10 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="bg-brand-coral hover:bg-brand-coral/90 text-[#1c1712] disabled:opacity-60 transition-colors duration-150 cursor-pointer"
            >
              {pending ? "Registrando..." : "Registrar abono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Fila de tabla ─────────────────────────────────────────────

function CxpRow({
  cxp,
  hoy,
  onAbonar,
  onEstadoChange,
}: {
  cxp:            CxpDisplay;
  hoy:            string;
  onAbonar:       (cxp: CxpDisplay) => void;
  onEstadoChange: (cxpId: string, nuevoEstado: string) => void;
}) {
  const [changingEstado, startEstadoTransition] = useTransition();
  const saldo   = calcularSaldo(cxp.monto_centavos, cxp.pagos);
  const abonado = totalAbonado(cxp.pagos);
  const aging   = estadoAging(cxp.fecha_vencimiento, cxp.estado as EstadoCxp, hoy);
  const dias    = cxp.fecha_vencimiento
    ? Math.ceil(
        (new Date(cxp.fecha_vencimiento).getTime() - new Date(hoy).getTime()) /
        (1000 * 60 * 60 * 24)
      )
    : Infinity;
  const transiciones = transicionesDisponibles(cxp.estado as EstadoCxp);

  const handleEstado = useCallback((nuevo: string) => {
    startEstadoTransition(async () => {
      const result = await cambiarEstadoCxpAction({
        cxp_id:        cxp.id,
        nuevo_estado:  nuevo,
        estado_actual: cxp.estado,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Estado: ${nuevo}`);
      onEstadoChange(cxp.id, nuevo);
    });
  }, [cxp.id, cxp.estado, onEstadoChange]);

  const rowBg =
    aging === "vencida"    ? "bg-status-danger/5 hover:bg-status-danger/8" :
    aging === "por_vencer" ? "bg-status-warn/5 hover:bg-status-warn/8" :
                             "hover:bg-surface-muted/40";

  return (
    <tr className={cn("border-b border-border/40 transition-colors duration-100", rowBg)}>
      {/* Proveedor */}
      <td className="py-2.5 px-3 text-sm">
        <p className="font-medium text-foreground leading-tight">
          {cxp.proveedores?.nombre ?? "—"}
        </p>
        {cxp.transacciones?.descripcion && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
            {cxp.transacciones.descripcion}
          </p>
        )}
        {cxp.transacciones?.fecha && (
          <p className="text-[10px] text-text-muted">
            {(() => {
              const [,m,d] = cxp.transacciones!.fecha.split("-");
              const ms = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
              return `Compra ${parseInt(d)} ${ms[parseInt(m)-1]}`;
            })()}
          </p>
        )}
      </td>

      {/* Monto total */}
      <td className="py-2.5 px-3 text-sm text-right tabular-nums font-medium text-foreground hidden sm:table-cell">
        {formatUSD(cxp.monto_centavos)}
      </td>

      {/* Abonado */}
      <td className="py-2.5 px-3 text-sm text-right tabular-nums hidden md:table-cell">
        {abonado > 0
          ? <span className="text-status-ok">{formatUSD(abonado)}</span>
          : <span className="text-text-muted">—</span>
        }
      </td>

      {/* Saldo */}
      <td className="py-2.5 px-3 text-sm text-right tabular-nums font-semibold">
        {cxp.estado === "Pagada"
          ? <span className="text-status-ok text-xs font-medium">Pagado ✓</span>
          : <span className="text-status-danger">{formatUSD(saldo)}</span>
        }
      </td>

      {/* Vencimiento */}
      <td className="py-2.5 px-3 hidden lg:table-cell">
        <AgingBadge fechaVenc={cxp.fecha_vencimiento} aging={aging} dias={dias} />
      </td>

      {/* Estado */}
      <td className="py-2.5 px-3">
        <EstadoCxpBadge estado={cxp.estado} />
      </td>

      {/* Acciones */}
      <td className="py-2.5 px-3">
        <div className="flex flex-col items-end gap-1.5">
          {/* Abonar — siempre visible cuando hay saldo */}
          {cxp.estado !== "Pagada" && saldo > 0 && (
            <button
              onClick={() => onAbonar(cxp)}
              className="text-xs px-2.5 py-1 rounded-md bg-brand-coral text-[#1c1712] hover:bg-brand-coral/90 transition-colors duration-150 cursor-pointer font-medium whitespace-nowrap"
            >
              Abonar
            </button>
          )}

          {/* Cambiar estado — select nativo, sin problemas de overflow */}
          {transiciones.length > 0 && (
            <select
              value=""
              disabled={changingEstado}
              onChange={e => {
                if (e.target.value) handleEstado(e.target.value);
                (e.target as HTMLSelectElement).value = "";
              }}
              className="text-xs rounded-md border border-border/60 px-2 py-1 bg-surface text-text-muted hover:border-brand-cocoa/50 focus:outline-none focus:ring-1 focus:ring-brand-coral cursor-pointer disabled:opacity-50 w-full"
            >
              <option value="">Mover estado…</option>
              {transiciones.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────

export function CxpClient({
  hoy,
  cxpsIniciales,
  cuentas,
}: {
  hoy:           string;
  cxpsIniciales: CxpDisplay[];
  cuentas:       CuentaBancariaOpc[];
}) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();

  const [cxps, setCxps] = useState<CxpDisplay[]>(cxpsIniciales);
  const [search, setSearch]             = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [dialogAbonar, setDialogAbonar] = useState<CxpDisplay | null>(null);

  // Resumen (memoizado)
  const resumen = useMemo(() => resumenCxp(
    cxps.map(c => ({
      monto_centavos:    c.monto_centavos,
      fecha_vencimiento: c.fecha_vencimiento,
      estado:            c.estado as EstadoCxp,
      pagos:             c.pagos,
    })),
    hoy
  ), [cxps, hoy]);

  // Filtros
  const cxpsFiltradas = useMemo(() => {
    return cxps.filter(cxp => {
      // Búsqueda por proveedor o descripción
      if (search) {
        const q = search.toLowerCase();
        const matchProv = cxp.proveedores?.nombre?.toLowerCase().includes(q);
        const matchDesc = cxp.transacciones?.descripcion?.toLowerCase().includes(q);
        if (!matchProv && !matchDesc) return false;
      }
      // Filtro por estado
      if (filtroEstado !== "todos" && cxp.estado !== filtroEstado) return false;
      // Solo vencidas
      if (soloVencidas) {
        const aging = estadoAging(cxp.fecha_vencimiento, cxp.estado as EstadoCxp, hoy);
        if (aging !== "vencida") return false;
      }
      return true;
    });
  }, [cxps, search, filtroEstado, soloVencidas, hoy]);

  // Actualiza el estado local tras un abono exitoso
  const handleAbonoSuccess = (
    cxpId: string,
    nuevoEstado: string,
    abono: { id: string; monto_centavos: number }
  ) => {
    setCxps(prev => prev.map(c => {
      if (c.id !== cxpId) return c;
      return {
        ...c,
        estado: nuevoEstado,
        pagos:  [...c.pagos, {
          id:               abono.id,
          fecha:            hoy,
          monto_centavos:   abono.monto_centavos,
          cuenta_id:        null,
          notas:            null,
          cuentas_bancarias: null,
        }],
      };
    }));
    setDialogAbonar(null);
    // Refresh silencioso en background para sincronizar datos reales
    startRefreshTransition(() => router.refresh());
  };

  // Actualiza estado local tras un cambio de estado
  const handleEstadoChange = (cxpId: string, nuevoEstado: string) => {
    setCxps(prev => prev.map(c =>
      c.id === cxpId ? { ...c, estado: nuevoEstado } : c
    ));
    startRefreshTransition(() => router.refresh());
  };

  const ESTADOS_FILTRO = ["todos", "Pendiente", "Programada", "En disputa", "Pagada"];

  return (
    <div className="min-h-full bg-background">
      {/* Cabecera */}
      <div className="px-4 sm:px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Finanzas</p>
            <h1 className="font-display text-2xl text-brand-forest dark:text-foreground">
              Cuentas por Pagar
            </h1>
          </div>
          {resumen.totalPorPagar > 0 && (
            <div className="text-right">
              <p className="text-xs text-text-muted">Total pendiente</p>
              <p className="text-xl tabular-nums font-bold text-status-danger">
                {formatUSD(resumen.totalPorPagar)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-3 gap-3">
          <ResumenCard
            label="Total por pagar"
            valor={resumen.totalPorPagar}
            sub={`${cxps.filter(c => c.estado !== "Pagada").length} facturas vivas`}
            colorClass="text-foreground"
            borderClass="border-border"
          />
          <ResumenCard
            label="Vencido"
            valor={resumen.totalVencido}
            sub={resumen.countVencidas > 0 ? `${resumen.countVencidas} factura${resumen.countVencidas > 1 ? "s" : ""}` : "Ninguna"}
            colorClass={resumen.totalVencido > 0 ? "text-status-danger" : "text-text-muted"}
            borderClass={resumen.totalVencido > 0 ? "border-status-danger/30" : "border-border"}
          />
          <ResumenCard
            label="Vence ≤ 3 días"
            valor={resumen.totalPorVencer}
            sub={resumen.countPorVencer > 0 ? `${resumen.countPorVencer} factura${resumen.countPorVencer > 1 ? "s" : ""}` : "Ninguna"}
            colorClass={resumen.totalPorVencer > 0 ? "text-[#7a5100] dark:text-brand-amber" : "text-text-muted"}
            borderClass={resumen.totalPorVencer > 0 ? "border-brand-amber/40" : "border-border"}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar proveedor..."
          />
          {ESTADOS_FILTRO.map(e => (
            <button
              key={e}
              onClick={() => { setFiltroEstado(e); setSoloVencidas(false); }}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-colors duration-150 cursor-pointer",
                filtroEstado === e && !soloVencidas
                  ? "bg-brand-cocoa text-[#fff6e2] border-brand-cocoa"
                  : "bg-surface border-border text-text-muted hover:border-brand-cocoa/30"
              )}
            >
              {e === "todos" ? "Todas" : e}
              {e !== "todos" && resumen.countPorEstado[e as EstadoCxp] > 0 && (
                <span className="ml-1.5 opacity-60">
                  {resumen.countPorEstado[e as EstadoCxp]}
                </span>
              )}
            </button>
          ))}
          {resumen.countVencidas > 0 && (
            <button
              onClick={() => { setSoloVencidas(v => !v); setFiltroEstado("todos"); }}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-colors duration-150 cursor-pointer",
                soloVencidas
                  ? "bg-status-danger text-white border-status-danger"
                  : "border-status-danger/40 text-status-danger hover:bg-status-danger/10"
              )}
            >
              🔴 Vencidas ({resumen.countVencidas})
            </button>
          )}
        </div>

        {/* Tabla */}
        <TableShell
          empty={
            cxpsFiltradas.length === 0
              ? <EmptyState
                  mensaje={
                    cxps.length === 0
                      ? "No hay cuentas por pagar. Se generan automáticamente al registrar compras a crédito en el Cierre Diario."
                      : "Ninguna CXP coincide con los filtros."
                  }
                />
              : undefined
          }
        >
          {cxpsFiltradas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                  <th className="py-2 px-3 text-left font-medium">Proveedor / Compra</th>
                  <th className="py-2 px-3 text-right font-medium hidden sm:table-cell">Monto</th>
                  <th className="py-2 px-3 text-right font-medium hidden md:table-cell">Abonado</th>
                  <th className="py-2 px-3 text-right font-medium">Saldo</th>
                  <th className="py-2 px-3 text-left font-medium hidden lg:table-cell">Vencimiento</th>
                  <th className="py-2 px-3 text-left font-medium">Estado</th>
                  <th className="py-2 px-2 text-right font-medium w-36">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cxpsFiltradas.map(cxp => (
                  <CxpRow
                    key={cxp.id}
                    cxp={cxp}
                    hoy={hoy}
                    onAbonar={setDialogAbonar}
                    onEstadoChange={handleEstadoChange}
                  />
                ))}
              </tbody>
              {/* Pie: totales de la vista filtrada */}
              {cxpsFiltradas.length > 1 && (
                <tfoot>
                  <tr className="bg-surface-muted border-t border-border">
                    <td className="py-2 px-3 text-xs font-medium text-text-muted" colSpan={3}>
                      {cxpsFiltradas.length} facturas
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-semibold tabular-nums text-status-danger" colSpan={4}>
                      {formatUSD(cxpsFiltradas
                        .filter(c => c.estado !== "Pagada")
                        .reduce((s, c) => s + calcularSaldo(c.monto_centavos, c.pagos), 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </TableShell>
      </div>

      {/* Diálogo de abono */}
      {dialogAbonar && (
        <AbonoDialog
          cxp={dialogAbonar}
          cuentas={cuentas}
          hoy={hoy}
          onClose={() => setDialogAbonar(null)}
          onSuccess={handleAbonoSuccess}
        />
      )}
    </div>
  );
}
