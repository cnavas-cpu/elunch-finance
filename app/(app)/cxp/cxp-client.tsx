"use client";

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CxpDisplay, CuentaBancariaOpc } from "@/lib/db/cxp";
import { formatUSD, parseCentavos } from "@/lib/finance/cierre";
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
import { SearchBar, TableShell, EmptyState } from "@/components/catalogo-table-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ── Íconos SVG inline ─────────────────────────────────────────

function IconDolar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 2v1m0 14v1M7.5 5.5A2.5 2.5 0 0110 4h.5A2 2 0 0112.5 6v.5a2 2 0 01-2 2h-1a2 2 0 00-2 2v.5A2 2 0 009.5 13H10a2.5 2.5 0 002.5-2.5"/>
    </svg>
  );
}

function IconAlerta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M10 3L2.5 16h15L10 3zm0 5v4m0 2.5h.01"/>
    </svg>
  );
}

function IconReloj({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
      className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5"/>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6.5V10l2.5 2.5"/>
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
      className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l3.5 3.5L13 4"/>
    </svg>
  );
}

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

function AgingBadge({ fechaVenc, aging, dias }: {
  fechaVenc: string | null;
  aging:     EstadoAging;
  dias:      number;
}) {
  if (!fechaVenc) {
    return <span className="text-xs text-text-muted">Sin fecha</span>;
  }

  const [, m, d] = fechaVenc.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const label = `${parseInt(d)} ${meses[parseInt(m) - 1]}`;

  const colorClass =
    aging === "vencida"    ? "text-status-danger" :
    aging === "por_vencer" ? "text-[#7a5100] dark:text-brand-amber" :
                             "text-text-muted";

  const sublabel =
    aging === "vencida"    ? `Venció hace ${Math.abs(dias)}d` :
    aging === "por_vencer" ? (dias === 0 ? "Vence hoy" : `Vence en ${dias}d`) :
                             `Faltan ${dias}d`;

  return (
    <div>
      <p className={cn("text-xs font-medium tabular-nums", colorClass)}>{label}</p>
      <p className={cn("text-[11px]", colorClass)}>{sublabel}</p>
    </div>
  );
}

// ── Tarjeta de resumen ────────────────────────────────────────

function ResumenCard({ label, valor, sub, colorClass, borderClass, icon }: {
  label:       string;
  valor:       number;
  sub?:        string;
  colorClass:  string;
  borderClass: string;
  icon:        React.ReactNode;
}) {
  return (
    <div className={cn("bg-surface rounded-lg border p-3 sm:p-4", borderClass)}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-text-muted leading-tight">{label}</p>
        <span className={cn("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0", colorClass.includes("danger") ? "bg-status-danger/10" : colorClass.includes("amber") || colorClass.includes("7a5100") ? "bg-status-warn/10" : "bg-border/20")}>
          {icon}
        </span>
      </div>
      <p className={cn("text-lg sm:text-xl tabular-nums font-bold", colorClass)}>
        {formatUSD(valor)}
      </p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Fila de abono (dentro del diálogo) ───────────────────────

function PagoFila({ pago }: { pago: CxpDisplay["pagos"][number] }) {
  const [, m, d] = pago.fecha.split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const fechaLabel = `${parseInt(d)} ${meses[parseInt(m) - 1]}`;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <div>
        <p className="text-xs font-medium text-foreground">{fechaLabel}</p>
        {pago.cuentas_bancarias && (
          <p className="text-[11px] text-text-muted">{pago.cuentas_bancarias.nombre}</p>
        )}
        {pago.notas && (
          <p className="text-[11px] text-text-muted italic">{pago.notas}</p>
        )}
      </div>
      <span className="text-sm tabular-nums font-semibold text-status-ok">
        {formatUSD(pago.monto_centavos)}
      </span>
    </div>
  );
}

// ── Diálogo de abono ──────────────────────────────────────────

function AbonoDialog({ cxp, cuentas, hoy, onClose, onSuccess }: {
  cxp:       CxpDisplay;
  cuentas:   CuentaBancariaOpc[];
  hoy:       string;
  onClose:   () => void;
  onSuccess: (cxpId: string, estado: string, nuevoAbono: { id: string; monto_centavos: number }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [monto, setMonto]       = useState("");
  const [cuentaId, setCuentaId] = useState("");
  const [fecha, setFecha]       = useState(hoy);
  const [notas, setNotas]       = useState("");
  const [error, setError]       = useState<string | null>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  const saldo   = calcularSaldo(cxp.monto_centavos, cxp.pagos);
  const abonado = totalAbonado(cxp.pagos);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonto((saldo / 100).toFixed(2));
    setTimeout(() => montoRef.current?.select(), 60);
  }, [saldo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const montoCentavos = parseCentavos(monto);
    if (montoCentavos <= 0) { setError("El monto debe ser mayor que $0.00"); return; }
    if (!cuentaId)           { setError("Selecciona una cuenta bancaria");   return; }

    startTransition(async () => {
      const result = await registrarPagoCxpAction({
        cxp_id: cxp.id, fecha, cuenta_id: cuentaId,
        monto_centavos: montoCentavos, notas: notas || null,
      });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Abono registrado");
      const rpcData = result.data as { estado: string; pago_id: string } | undefined;
      onSuccess(cxp.id, rpcData?.estado ?? cxp.estado, {
        id: rpcData?.pago_id ?? "", monto_centavos: montoCentavos,
      });
    });
  };

  const inputCls = "h-10 w-full px-3 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral transition-shadow duration-150";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-brand-forest dark:text-foreground">
            Registrar abono
          </DialogTitle>
        </DialogHeader>

        {/* Info de la CXP */}
        <div className="bg-surface-muted rounded-lg px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium text-foreground">{cxp.proveedores?.nombre ?? "—"}</p>
          {cxp.transacciones?.descripcion && (
            <p className="text-xs text-text-muted">{cxp.transacciones.descripcion}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs pt-0.5">
            <span className="text-text-muted">
              Total: <span className="font-semibold text-foreground tabular-nums">{formatUSD(cxp.monto_centavos)}</span>
            </span>
            {abonado > 0 && (
              <span className="text-text-muted">
                Abonado: <span className="font-semibold text-status-ok tabular-nums">{formatUSD(abonado)}</span>
              </span>
            )}
            <span className="text-text-muted">
              Saldo: <span className="font-semibold text-status-danger tabular-nums">{formatUSD(saldo)}</span>
            </span>
          </div>
        </div>

        {/* Abonos previos */}
        {cxp.pagos.length > 0 && (
          <div className="max-h-28 overflow-y-auto border border-border/40 rounded-md px-3 py-1">
            <p className="text-[11px] text-text-muted uppercase tracking-wide py-1 font-medium">
              Abonos previos
            </p>
            {cxp.pagos.map(p => <PagoFila key={p.id} pago={p} />)}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
                Fecha <span className="text-status-danger">*</span>
              </label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                max={hoy}
                required
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
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
                className={cn(inputCls, "tabular-nums")}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
              Cuenta bancaria <span className="text-status-danger">*</span>
            </label>
            <select
              value={cuentaId}
              onChange={e => setCuentaId(e.target.value)}
              required
              className={cn(inputCls, "cursor-pointer")}
            >
              <option value="">Seleccionar...</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
              Notas <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notas}
              onChange={e => setNotas(e.target.value)}
              maxLength={300}
              placeholder="Ej: cheque #1234, transferencia BAC..."
              className={inputCls}
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-status-danger bg-status-danger/5 border border-status-danger/20 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter className="pt-1 gap-2">
            <DialogClose
              disabled={pending}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-brand-cocoa bg-surface hover:bg-brand-cream/60 dark:hover:bg-white/10 transition-colors duration-150 disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={pending}
              className="bg-brand-coral hover:bg-brand-coral/90 text-[#1c1712] disabled:opacity-60 transition-colors duration-150 cursor-pointer px-4 py-2"
            >
              {pending ? "Registrando…" : "Registrar abono"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Fila de tabla ─────────────────────────────────────────────

function CxpRow({ cxp, hoy, onAbonar, onEstadoChange }: {
  cxp:            CxpDisplay;
  hoy:            string;
  onAbonar:       (cxp: CxpDisplay) => void;
  onEstadoChange: (cxpId: string, nuevoEstado: string) => void;
}) {
  const [changingEstado, startEstadoTransition] = useTransition();
  const saldo       = calcularSaldo(cxp.monto_centavos, cxp.pagos);
  const abonado     = totalAbonado(cxp.pagos);
  const aging       = estadoAging(cxp.fecha_vencimiento, cxp.estado as EstadoCxp, hoy);
  const dias        = cxp.fecha_vencimiento
    ? Math.ceil((new Date(cxp.fecha_vencimiento).getTime() - new Date(hoy).getTime()) / 86400000)
    : Infinity;
  const transiciones = transicionesDisponibles(cxp.estado as EstadoCxp);

  const handleEstado = useCallback((nuevo: string) => {
    startEstadoTransition(async () => {
      const result = await cambiarEstadoCxpAction({
        cxp_id: cxp.id, nuevo_estado: nuevo, estado_actual: cxp.estado,
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Estado: ${nuevo}`);
      onEstadoChange(cxp.id, nuevo);
    });
  }, [cxp.id, cxp.estado, onEstadoChange]);

  const rowBg =
    aging === "vencida"    ? "bg-status-danger/[0.04] hover:bg-status-danger/[0.07]" :
    aging === "por_vencer" ? "bg-status-warn/[0.04] hover:bg-status-warn/[0.07]" :
                             "hover:bg-surface-muted/50";

  return (
    <tr className={cn("border-b border-border/40 transition-colors duration-150", rowBg)}>
      {/* Proveedor */}
      <td className="py-3 px-3 text-sm">
        <p className="font-medium text-foreground leading-tight">
          {cxp.proveedores?.nombre ?? "—"}
        </p>
        {cxp.transacciones?.descripcion && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
            {cxp.transacciones.descripcion}
          </p>
        )}
        {cxp.transacciones?.fecha && (
          <p className="text-[11px] text-text-muted/70 mt-0.5">
            {(() => {
              const [,m,d] = cxp.transacciones!.fecha.split("-");
              const ms = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
              return `Compra ${parseInt(d)} ${ms[parseInt(m)-1]}`;
            })()}
          </p>
        )}
      </td>

      {/* Monto */}
      <td className="py-3 px-3 text-sm text-right tabular-nums font-medium text-foreground hidden sm:table-cell">
        {formatUSD(cxp.monto_centavos)}
      </td>

      {/* Abonado */}
      <td className="py-3 px-3 text-sm text-right tabular-nums hidden md:table-cell">
        {abonado > 0
          ? <span className="text-status-ok">{formatUSD(abonado)}</span>
          : <span className="text-text-muted/50">—</span>
        }
      </td>

      {/* Saldo */}
      <td className="py-3 px-3 text-sm text-right tabular-nums font-semibold">
        {cxp.estado === "Pagada"
          ? (
            <span className="inline-flex items-center gap-1 text-status-ok text-xs font-medium">
              <IconCheck className="w-3 h-3" />
              Pagada
            </span>
          )
          : <span className="text-status-danger">{formatUSD(saldo)}</span>
        }
      </td>

      {/* Vencimiento */}
      <td className="py-3 px-3 hidden lg:table-cell">
        <AgingBadge fechaVenc={cxp.fecha_vencimiento} aging={aging} dias={dias} />
      </td>

      {/* Estado */}
      <td className="py-3 px-3">
        <EstadoCxpBadge estado={cxp.estado} />
      </td>

      {/* Acciones */}
      <td className="py-3 px-3">
        <div className="flex flex-col items-end gap-2">
          {cxp.estado !== "Pagada" && saldo > 0 && (
            <button
              onClick={() => onAbonar(cxp)}
              className="min-h-[34px] text-xs px-3 py-1.5 rounded-md bg-brand-coral text-[#1c1712] hover:bg-brand-coral/90 active:scale-[0.97] transition-all duration-150 cursor-pointer font-semibold whitespace-nowrap"
            >
              Abonar
            </button>
          )}

          {transiciones.length > 0 && (
            <select
              value=""
              disabled={changingEstado}
              aria-label="Cambiar estado de esta cuenta por pagar"
              onChange={e => {
                if (e.target.value) handleEstado(e.target.value);
                (e.target as HTMLSelectElement).value = "";
              }}
              className="text-xs rounded-md border border-border/60 px-2 py-1.5 bg-surface text-text-muted hover:border-brand-cocoa/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral cursor-pointer disabled:opacity-40 w-full transition-colors duration-150"
            >
              <option value="">{changingEstado ? "Cambiando…" : "Mover estado…"}</option>
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

// ── Punto de color SVG (fuera del componente para no recrearse en render) ───

function DotRojo() {
  return (
    <svg viewBox="0 0 8 8" className="w-2 h-2 flex-shrink-0" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill="currentColor"/>
    </svg>
  );
}

// ── Leyenda del pipeline CXP ──────────────────────────────────

function PipelineLeyendaCxp() {
  const pasos = [
    { n: 1, estado: "Pendiente",   desc: "CXP creada al registrar la compra a crédito" },
    { n: 2, estado: "Programada",  desc: "Hay fecha de pago acordada con el proveedor" },
    { n: 3, estado: "Pagada",      desc: "Pago registrado — dinero salió de caja" },
  ];
  return (
    <details className="group bg-surface border border-border/60 rounded-lg">
      <summary className="px-4 py-2.5 cursor-pointer text-xs font-medium text-text-muted hover:text-brand-cocoa flex items-center gap-2 select-none list-none">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          className="w-3.5 h-3.5 shrink-0" aria-hidden="true">
          <circle cx="8" cy="8" r="7"/>
          <path d="M8 7v4M8 5.5h.01" strokeLinecap="round"/>
        </svg>
        ¿Cómo funciona el pipeline de pagos?
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
          className="w-3 h-3 ml-auto transition-transform duration-150 group-open:rotate-180" aria-hidden="true">
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </summary>
      <div className="px-4 pb-4 pt-2 border-t border-border/40">
        <div className="flex flex-wrap gap-3 mt-1">
          {pasos.map((p) => (
            <div key={p.estado} className="flex items-start gap-2 min-w-[160px]">
              <span className={cn(
                "shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5",
                p.n === 3
                  ? "bg-status-ok/15 text-status-ok"
                  : "bg-brand-forest/10 text-brand-forest dark:bg-white/10 dark:text-brand-cream"
              )}>{p.n}</span>
              <div>
                <p className="text-xs font-medium text-foreground leading-tight">{p.estado}</p>
                <p className="text-[11px] text-text-muted leading-tight">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-text-muted mt-3 pt-2 border-t border-border/30">
          <span className="text-status-danger font-medium">Vencida</span> aparece cuando la fecha de pago ya pasó.{" "}
          <span className="text-[#7a5100] dark:text-brand-amber font-medium">En disputa</span> pausa el pago mientras se resuelve.
          El estado <span className="font-medium">Pagada</span> solo se alcanza registrando el abono con el botón "Abonar".
        </p>
      </div>
    </details>
  );
}

// ── Componente principal ──────────────────────────────────────

export function CxpClient({ hoy, cxpsIniciales, cuentas }: {
  hoy:           string;
  cxpsIniciales: CxpDisplay[];
  cuentas:       CuentaBancariaOpc[];
}) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();

  const [cxps, setCxps]                 = useState<CxpDisplay[]>(cxpsIniciales);
  const [search, setSearch]             = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [soloVencidas, setSoloVencidas] = useState(false);
  const [dialogAbonar, setDialogAbonar] = useState<CxpDisplay | null>(null);

  const resumen = useMemo(() => resumenCxp(
    cxps.map(c => ({
      monto_centavos:    c.monto_centavos,
      fecha_vencimiento: c.fecha_vencimiento,
      estado:            c.estado as EstadoCxp,
      pagos:             c.pagos,
    })),
    hoy
  ), [cxps, hoy]);

  const cxpsFiltradas = useMemo(() => cxps.filter(cxp => {
    if (search) {
      const q = search.toLowerCase();
      if (!cxp.proveedores?.nombre?.toLowerCase().includes(q) &&
          !cxp.transacciones?.descripcion?.toLowerCase().includes(q)) return false;
    }
    if (filtroEstado !== "todos" && cxp.estado !== filtroEstado) return false;
    if (soloVencidas && estadoAging(cxp.fecha_vencimiento, cxp.estado as EstadoCxp, hoy) !== "vencida") return false;
    return true;
  }), [cxps, search, filtroEstado, soloVencidas, hoy]);

  const handleAbonoSuccess = (cxpId: string, nuevoEstado: string, abono: { id: string; monto_centavos: number }) => {
    setCxps(prev => prev.map(c => c.id !== cxpId ? c : {
      ...c,
      estado: nuevoEstado,
      pagos: [...c.pagos, { id: abono.id, fecha: hoy, monto_centavos: abono.monto_centavos, cuenta_id: null, notas: null, cuentas_bancarias: null }],
    }));
    setDialogAbonar(null);
    startRefreshTransition(() => router.refresh());
  };

  const handleEstadoChange = (cxpId: string, nuevoEstado: string) => {
    setCxps(prev => prev.map(c => c.id === cxpId ? { ...c, estado: nuevoEstado } : c));
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
        {/* Tarjetas resumen — 1 col en mobile, 3 en sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumenCard
            label="Total por pagar"
            valor={resumen.totalPorPagar}
            sub={`${cxps.filter(c => c.estado !== "Pagada").length} facturas vivas`}
            colorClass="text-foreground"
            borderClass="border-border"
            icon={<IconDolar className="w-4 h-4 text-text-muted" />}
          />
          <ResumenCard
            label="Vencido"
            valor={resumen.totalVencido}
            sub={resumen.countVencidas > 0
              ? `${resumen.countVencidas} factura${resumen.countVencidas > 1 ? "s" : ""}`
              : "Sin vencidas"}
            colorClass={resumen.totalVencido > 0 ? "text-status-danger" : "text-text-muted"}
            borderClass={resumen.totalVencido > 0 ? "border-status-danger/30" : "border-border"}
            icon={<IconAlerta className="w-4 h-4 text-status-danger" />}
          />
          <ResumenCard
            label="Vence ≤ 3 días"
            valor={resumen.totalPorVencer}
            sub={resumen.countPorVencer > 0
              ? `${resumen.countPorVencer} factura${resumen.countPorVencer > 1 ? "s" : ""}`
              : "Sin urgentes"}
            colorClass={resumen.totalPorVencer > 0 ? "text-[#7a5100] dark:text-brand-amber" : "text-text-muted"}
            borderClass={resumen.totalPorVencer > 0 ? "border-brand-amber/40" : "border-border"}
            icon={<IconReloj className="w-4 h-4 text-[#7a5100] dark:text-brand-amber" />}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar proveedor..." />

          {ESTADOS_FILTRO.map(e => (
            <button
              key={e}
              onClick={() => { setFiltroEstado(e); setSoloVencidas(false); }}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-colors duration-150 cursor-pointer whitespace-nowrap",
                filtroEstado === e && !soloVencidas
                  ? "bg-brand-cocoa text-[#fff6e2] border-brand-cocoa"
                  : "bg-surface border-border text-text-muted hover:border-brand-cocoa/30 hover:text-foreground"
              )}
            >
              {e === "todos" ? "Todas" : e}
              {e !== "todos" && resumen.countPorEstado[e as EstadoCxp] > 0 && (
                <span className="ml-1.5 opacity-60 tabular-nums">
                  {resumen.countPorEstado[e as EstadoCxp]}
                </span>
              )}
            </button>
          ))}

          {resumen.countVencidas > 0 && (
            <button
              onClick={() => { setSoloVencidas(v => !v); setFiltroEstado("todos"); }}
              className={cn(
                "h-8 px-3 text-xs rounded-full border transition-colors duration-150 cursor-pointer flex items-center gap-1.5 whitespace-nowrap",
                soloVencidas
                  ? "bg-status-danger text-white border-status-danger"
                  : "border-status-danger/40 text-status-danger hover:bg-status-danger/10"
              )}
            >
              <DotRojo />
              Vencidas ({resumen.countVencidas})
            </button>
          )}
        </div>

        {/* Leyenda del pipeline */}
        <PipelineLeyendaCxp />

        {/* Tabla */}
        <TableShell
          empty={
            cxpsFiltradas.length === 0
              ? <EmptyState
                  mensaje={
                    cxps.length === 0
                      ? "No hay cuentas por pagar aún. Se generan al registrar una compra a crédito en el Cierre Diario."
                      : "Ninguna CXP coincide con los filtros seleccionados."
                  }
                  accion={
                    cxps.length === 0 ? (
                      <a
                        href="/cierre"
                        className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-brand-coral text-[#1c1712] text-sm font-semibold rounded-lg hover:bg-brand-coral/90 active:bg-brand-coral/80 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-2"
                      >
                        Ir al Cierre Diario
                      </a>
                    ) : undefined
                  }
                />
              : undefined
          }
        >
          {cxpsFiltradas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                  <th className="py-2.5 px-3 text-left font-medium">Proveedor / Compra</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden sm:table-cell">Monto</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden md:table-cell">Abonado</th>
                  <th className="py-2.5 px-3 text-right font-medium">Saldo</th>
                  <th className="py-2.5 px-3 text-left font-medium hidden lg:table-cell">Vencimiento</th>
                  <th className="py-2.5 px-3 text-left font-medium">Estado</th>
                  <th className="py-2.5 px-3 text-right font-medium w-36">Acciones</th>
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
              {cxpsFiltradas.length > 1 && (
                <tfoot>
                  <tr className="bg-surface-muted border-t border-border">
                    <td className="py-2 px-3 text-xs text-text-muted" colSpan={3}>
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
