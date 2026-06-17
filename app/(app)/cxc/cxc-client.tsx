"use client";
// app/(app)/cxc/cxc-client.tsx — UI de Cuentas por Cobrar (Sprint 5)
// Gemela visual de cxp-client.tsx. Usa los mismos tokens de marca y el patrón
// native-select para cambio de estado (feedback_cxp_ux — sin dropdowns custom).
// Agrega: diálogo de evidencia (num_oc, num_factura, notas).

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { CxcDisplay } from "@/lib/db/cxc";
import type { CuentaBancaria } from "@/lib/db/catalogos";
import { formatUSD, parseCentavos } from "@/lib/finance/cierre";
import {
  calcularSaldo,
  totalAbonado,
  estadoAging,
  resumenCxc,
  transicionesDisponibles,
  etiquetaEstado,
  type EstadoCxc,
  type EstadoAging,
} from "@/lib/finance/cxc";
import {
  registrarCobroCxcAction,
  cambiarEstadoCxcAction,
  actualizarEvidenciaCxcAction,
} from "./actions";
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

// ── Íconos SVG inline ─────────────────────────────────────────────

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

// ── Badge de estado CXC ───────────────────────────────────────────
// Nunca usa coral (brand-coral) para estado — solo semáforos de status.

const ESTADO_STYLE: Record<string, string> = {
  "Generada":        "bg-border/30 text-text-muted border-border/50",
  "OC Recibida":     "bg-status-info/10 text-status-info border-status-info/25",
  "Facturada":       "bg-status-info/15 text-status-info border-status-info/30",
  "Programada Pago": "bg-status-info/10 text-status-info border-status-info/25",
  "Pagada":          "bg-status-ok/15 text-status-ok border-status-ok/25",
  "En Recuperacion": "bg-status-danger/15 text-status-danger border-status-danger/25",
  "Incobrable":      "bg-brand-cocoa/10 text-brand-cocoa border-brand-cocoa/25",
};

function EstadoCxcBadge({ estado }: { estado: string }) {
  return (
    <span className={cn(
      "text-xs px-1.5 py-0.5 rounded border font-medium whitespace-nowrap",
      ESTADO_STYLE[estado] ?? "bg-border/20 text-text-muted border-border/30"
    )}>
      {etiquetaEstado(estado as EstadoCxc)}
    </span>
  );
}

// ── Badge de aging / semáforo ─────────────────────────────────────

function AgingBadge({ fechaEsperada, aging, dias }: {
  fechaEsperada: string | null;
  aging:         EstadoAging;
  dias:          number;
}) {
  if (!fechaEsperada) {
    return <span className="text-xs text-text-muted">Sin fecha</span>;
  }

  const [, m, d] = fechaEsperada.split("-");
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

// ── Tarjeta de resumen ────────────────────────────────────────────

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
        <span className={cn(
          "w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0",
          colorClass.includes("danger")
            ? "bg-status-danger/10"
            : colorClass.includes("amber") || colorClass.includes("7a5100")
              ? "bg-status-warn/10"
              : "bg-border/20"
        )}>
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

// ── Fila de cobro (dentro del diálogo) ───────────────────────────

function CobroFila({ pago }: { pago: CxcDisplay["pagos"][number] }) {
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

// ── Diálogo de cobro ──────────────────────────────────────────────

function CobroDialog({ cxc, cuentas, hoy, onClose, onSuccess }: {
  cxc:       CxcDisplay;
  cuentas:   CuentaBancaria[];
  hoy:       string;
  onClose:   () => void;
  onSuccess: (cxcId: string, estado: string, nuevoCobro: { id: string; monto_centavos: number }) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [monto, setMonto]         = useState("");
  const [cuentaId, setCuentaId]   = useState("");
  const [fecha, setFecha]         = useState(hoy);
  const [notas, setNotas]         = useState("");
  const [error, setError]         = useState<string | null>(null);
  const montoRef = useRef<HTMLInputElement>(null);

  const saldo   = calcularSaldo(cxc.monto_centavos, cxc.pagos);
  const abonado = totalAbonado(cxc.pagos);

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
      const result = await registrarCobroCxcAction({
        cxc_id: cxc.id, fecha, cuenta_id: cuentaId,
        monto_centavos: montoCentavos, notas: notas || null,
      });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Cobro registrado");
      const rpcData = result.data as { estado: string; pago_id: string } | undefined;
      onSuccess(cxc.id, rpcData?.estado ?? cxc.estado, {
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
            Registrar cobro
          </DialogTitle>
        </DialogHeader>

        {/* Info de la CXC */}
        <div className="bg-surface-muted rounded-lg px-3 py-2.5 text-sm space-y-1">
          <p className="font-medium text-foreground">
            {cxc.clientes_corporativos?.nombre ?? "—"}
          </p>
          {cxc.transacciones?.descripcion && (
            <p className="text-xs text-text-muted">{cxc.transacciones.descripcion}</p>
          )}
          <div className="flex flex-wrap gap-3 text-xs pt-0.5">
            <span className="text-text-muted">
              Total:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {formatUSD(cxc.monto_centavos)}
              </span>
            </span>
            {abonado > 0 && (
              <span className="text-text-muted">
                Cobrado:{" "}
                <span className="font-semibold text-status-ok tabular-nums">
                  {formatUSD(abonado)}
                </span>
              </span>
            )}
            <span className="text-text-muted">
              Saldo:{" "}
              <span className="font-semibold text-status-danger tabular-nums">
                {formatUSD(saldo)}
              </span>
            </span>
          </div>
        </div>

        {/* Cobros previos */}
        {cxc.pagos.length > 0 && (
          <div className="max-h-28 overflow-y-auto border border-border/40 rounded-md px-3 py-1">
            <p className="text-[11px] text-text-muted uppercase tracking-wide py-1 font-medium">
              Cobros previos
            </p>
            {cxc.pagos.map(p => <CobroFila key={p.id} pago={p} />)}
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
              {cuentas.filter(c => c.estado === "activa").map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
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
              placeholder="Ej: transferencia BAC, cheque #1234..."
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
              {pending ? "Registrando…" : "Registrar cobro"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Diálogo de evidencia ──────────────────────────────────────────

function EvidenciaDialog({ cxc, onClose, onSuccess }: {
  cxc:       CxcDisplay;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [numOc, setNumOc]           = useState(cxc.num_oc ?? "");
  const [numFac, setNumFac]         = useState(cxc.num_factura ?? "");
  const [notas, setNotas]           = useState(cxc.notas ?? "");
  const [error, setError]           = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await actualizarEvidenciaCxcAction({
        cxc_id:      cxc.id,
        num_oc:      numOc || null,
        num_factura: numFac || null,
        notas:       notas || null,
      });
      if (!result.ok) { setError(result.error); return; }
      toast.success("Evidencia actualizada");
      onSuccess();
    });
  };

  const inputCls = "h-10 w-full px-3 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral transition-shadow duration-150";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-brand-forest dark:text-foreground">
            Evidencia de la CXC
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-text-muted">
          {cxc.clientes_corporativos?.nombre ?? "—"} —{" "}
          <span className="tabular-nums">{formatUSD(cxc.monto_centavos)}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
              N° de OC <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={numOc}
              onChange={e => setNumOc(e.target.value)}
              maxLength={60}
              placeholder="OC-20260615"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
              N° de factura <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={numFac}
              onChange={e => setNumFac(e.target.value)}
              maxLength={60}
              placeholder="FAC-001234"
              className={inputCls}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-brand-cocoa block mb-1.5">
              Notas <span className="text-text-muted font-normal">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Observaciones de la factura, condiciones especiales..."
              className="w-full px-3 py-2 text-sm rounded-md border border-border bg-surface text-foreground placeholder:text-text-muted resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral transition-shadow duration-150"
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
              className="bg-brand-forest hover:bg-brand-forest/90 text-white disabled:opacity-60 transition-colors duration-150 cursor-pointer px-4 py-2"
            >
              {pending ? "Guardando…" : "Guardar evidencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Fila de tabla ─────────────────────────────────────────────────

function CxcRow({ cxc, hoy, onCobrar, onEvidencia, onEstadoChange }: {
  cxc:            CxcDisplay;
  hoy:            string;
  onCobrar:       (cxc: CxcDisplay) => void;
  onEvidencia:    (cxc: CxcDisplay) => void;
  onEstadoChange: (cxcId: string, nuevoEstado: string) => void;
}) {
  const [changingEstado, startEstadoTransition] = useTransition();
  const saldo       = calcularSaldo(cxc.monto_centavos, cxc.pagos);
  const abonado     = totalAbonado(cxc.pagos);
  const aging       = estadoAging(cxc.fecha_esperada, cxc.estado as EstadoCxc, hoy);
  const dias        = cxc.fecha_esperada
    ? Math.ceil(
        (new Date(cxc.fecha_esperada + "T00:00:00").getTime() - new Date(hoy + "T00:00:00").getTime())
        / 86400000
      )
    : Infinity;
  const transiciones = transicionesDisponibles(cxc.estado as EstadoCxc);

  const handleEstado = useCallback((nuevo: string) => {
    startEstadoTransition(async () => {
      const result = await cambiarEstadoCxcAction({
        cxc_id: cxc.id, nuevo_estado: nuevo, estado_actual: cxc.estado,
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Estado: ${etiquetaEstado(nuevo as EstadoCxc)}`);
      onEstadoChange(cxc.id, nuevo);
    });
  }, [cxc.id, cxc.estado, onEstadoChange]);

  const rowBg =
    aging === "vencida"    ? "bg-status-danger/[0.04] hover:bg-status-danger/[0.07]" :
    aging === "por_vencer" ? "bg-status-warn/[0.04] hover:bg-status-warn/[0.07]" :
                             "hover:bg-surface-muted/50";

  // Indicadores de evidencia en la fila
  const tieneOc  = !!cxc.num_oc;
  const tieneFac = !!cxc.num_factura;

  return (
    <tr className={cn("border-b border-border/40 transition-colors duration-150", rowBg)}>
      {/* Cliente */}
      <td className="py-3 px-3 text-sm">
        <p className="font-medium text-foreground leading-tight">
          {cxc.clientes_corporativos?.nombre ?? cxc.unidades_negocio?.nombre ?? "—"}
        </p>
        {cxc.transacciones?.descripcion && (
          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">
            {cxc.transacciones.descripcion}
          </p>
        )}
        {cxc.transacciones?.fecha && (
          <p className="text-[11px] text-text-muted/70 mt-0.5">
            {(() => {
              const [, m, d] = cxc.transacciones!.fecha.split("-");
              const ms = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
              return `Venta ${parseInt(d)} ${ms[parseInt(m) - 1]}`;
            })()}
          </p>
        )}
        {(tieneOc || tieneFac) && (
          <p className="text-[11px] text-text-muted mt-0.5">
            {tieneOc  && <span>OC ✓</span>}
            {tieneOc && tieneFac && " / "}
            {tieneFac && <span>Fac ✓</span>}
          </p>
        )}
      </td>

      {/* Monto */}
      <td className="py-3 px-3 text-sm text-right tabular-nums font-medium text-foreground hidden sm:table-cell">
        {formatUSD(cxc.monto_centavos)}
      </td>

      {/* Cobrado */}
      <td className="py-3 px-3 text-sm text-right tabular-nums hidden md:table-cell">
        {abonado > 0
          ? <span className="text-status-ok">{formatUSD(abonado)}</span>
          : <span className="text-text-muted/50">—</span>
        }
      </td>

      {/* Saldo */}
      <td className="py-3 px-3 text-sm text-right tabular-nums font-semibold">
        {cxc.estado === "Pagada" ? (
          <span className="inline-flex items-center gap-1 text-status-ok text-xs font-medium">
            <IconCheck className="w-3 h-3" />
            Cobrada
          </span>
        ) : cxc.estado === "Incobrable" ? (
          <span className="text-xs text-brand-cocoa font-medium">Incobrable</span>
        ) : (
          <span className="text-status-danger">{formatUSD(saldo)}</span>
        )}
      </td>

      {/* Fecha esperada */}
      <td className="py-3 px-3 hidden lg:table-cell">
        <AgingBadge fechaEsperada={cxc.fecha_esperada} aging={aging} dias={dias} />
      </td>

      {/* Estado */}
      <td className="py-3 px-3">
        <EstadoCxcBadge estado={cxc.estado} />
      </td>

      {/* Acciones */}
      <td className="py-3 px-3">
        <div className="flex flex-col items-end gap-2">
          {/* Botón cobrar: disponible mientras haya saldo y no sea Incobrable */}
          {cxc.estado !== "Pagada" && cxc.estado !== "Incobrable" && saldo > 0 && (
            <button
              onClick={() => onCobrar(cxc)}
              className="min-h-[34px] text-xs px-3 py-1.5 rounded-md bg-brand-coral text-[#1c1712] hover:bg-brand-coral/90 active:scale-[0.97] transition-all duration-150 cursor-pointer font-semibold whitespace-nowrap"
            >
              Cobrar
            </button>
          )}

          {/* Botón evidencia */}
          {cxc.estado !== "Pagada" && cxc.estado !== "Incobrable" && (
            <button
              onClick={() => onEvidencia(cxc)}
              className="min-h-[30px] text-xs px-3 py-1 rounded-md border border-border text-text-muted hover:border-brand-cocoa/50 hover:text-foreground active:scale-[0.97] transition-all duration-150 cursor-pointer whitespace-nowrap"
            >
              Evidencia
            </button>
          )}

          {/* Select de estado — patrón native-select (feedback_cxp_ux) */}
          {transiciones.length > 0 && (
            <select
              value=""
              disabled={changingEstado}
              aria-label="Cambiar estado de esta cuenta por cobrar"
              onChange={e => {
                if (e.target.value) handleEstado(e.target.value);
                (e.target as HTMLSelectElement).value = "";
              }}
              className="text-xs rounded-md border border-border/60 px-2 py-1.5 bg-surface text-text-muted hover:border-brand-cocoa/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral cursor-pointer disabled:opacity-40 w-full transition-colors duration-150"
            >
              <option value="">{changingEstado ? "Cambiando…" : "Mover estado…"}</option>
              {transiciones.map(t => (
                <option key={t} value={t}>{etiquetaEstado(t)}</option>
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

// ── Componente principal ──────────────────────────────────────────

export function CxcClient({ hoy, cxcsIniciales, cuentas }: {
  hoy:           string;
  cxcsIniciales: CxcDisplay[];
  cuentas:       CuentaBancaria[];
}) {
  const router = useRouter();
  const [, startRefreshTransition] = useTransition();

  const [cxcs, setCxcs]                   = useState<CxcDisplay[]>(cxcsIniciales);
  const [search, setSearch]               = useState("");
  const [filtroEstado, setFiltroEstado]   = useState<string>("todos");
  const [soloVencidas, setSoloVencidas]   = useState(false);
  const [dialogCobrar, setDialogCobrar]   = useState<CxcDisplay | null>(null);
  const [dialogEvidencia, setDialogEvidencia] = useState<CxcDisplay | null>(null);

  const resumen = useMemo(() => resumenCxc(
    cxcs.map(c => ({
      monto_centavos: c.monto_centavos,
      fecha_esperada: c.fecha_esperada,
      estado:         c.estado as EstadoCxc,
      pagos:          c.pagos,
    })),
    hoy
  ), [cxcs, hoy]);

  const cxcsFiltradas = useMemo(() => cxcs.filter(cxc => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !cxc.clientes_corporativos?.nombre?.toLowerCase().includes(q) &&
        !cxc.transacciones?.descripcion?.toLowerCase().includes(q) &&
        !cxc.unidades_negocio?.nombre?.toLowerCase().includes(q)
      ) return false;
    }
    if (filtroEstado !== "todos" && cxc.estado !== filtroEstado) return false;
    if (soloVencidas && estadoAging(cxc.fecha_esperada, cxc.estado as EstadoCxc, hoy) !== "vencida") return false;
    return true;
  }), [cxcs, search, filtroEstado, soloVencidas, hoy]);

  const handleCobroSuccess = (
    cxcId: string,
    nuevoEstado: string,
    cobro: { id: string; monto_centavos: number }
  ) => {
    setCxcs(prev => prev.map(c => c.id !== cxcId ? c : {
      ...c,
      estado: nuevoEstado,
      pagos: [...c.pagos, {
        id: cobro.id, fecha: hoy,
        monto_centavos: cobro.monto_centavos,
        cuenta_id: null, notas: null, cuentas_bancarias: null,
      }],
    }));
    setDialogCobrar(null);
    startRefreshTransition(() => router.refresh());
  };

  const handleEstadoChange = (cxcId: string, nuevoEstado: string) => {
    setCxcs(prev => prev.map(c => c.id === cxcId ? { ...c, estado: nuevoEstado } : c));
    startRefreshTransition(() => router.refresh());
  };

  const handleEvidenciaSuccess = () => {
    setDialogEvidencia(null);
    startRefreshTransition(() => router.refresh());
  };

  const ESTADOS_FILTRO = [
    "todos", "Generada", "OC Recibida", "Facturada",
    "Programada Pago", "En Recuperacion", "Pagada", "Incobrable",
  ];

  return (
    <div className="min-h-full bg-background">
      {/* Cabecera */}
      <div className="px-4 sm:px-6 py-5 border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Finanzas</p>
            <h1 className="font-display text-2xl text-brand-forest dark:text-foreground">
              Cuentas por Cobrar
            </h1>
          </div>
          {resumen.totalPorCobrar > 0 && (
            <div className="text-right">
              <p className="text-xs text-text-muted">Total pendiente</p>
              <p className="text-xl tabular-nums font-bold text-status-danger">
                {formatUSD(resumen.totalPorCobrar)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 py-5 space-y-5">
        {/* Tarjetas resumen */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ResumenCard
            label="Total por cobrar"
            valor={resumen.totalPorCobrar}
            sub={`${cxcs.filter(c => c.estado !== "Pagada" && c.estado !== "Incobrable").length} facturas vivas`}
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
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar cliente..." />

          {ESTADOS_FILTRO.map(e => {
            const label = e === "todos" ? "Todas" : etiquetaEstado(e as EstadoCxc);
            const count = e !== "todos" ? resumen.countPorEstado[e as EstadoCxc] ?? 0 : 0;
            return (
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
                {label}
                {e !== "todos" && count > 0 && (
                  <span className="ml-1.5 opacity-60 tabular-nums">{count}</span>
                )}
              </button>
            );
          })}

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

        {/* Tabla */}
        <TableShell
          empty={
            cxcsFiltradas.length === 0
              ? <EmptyState mensaje={
                  cxcs.length === 0
                    ? "No hay cuentas por cobrar. Se generan al registrar ventas a crédito en el Cierre Diario."
                    : "Ninguna CXC coincide con los filtros seleccionados."
                } />
              : undefined
          }
        >
          {cxcsFiltradas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-muted border-b border-border text-xs text-text-muted">
                  <th className="py-2.5 px-3 text-left font-medium">Cliente / Venta</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden sm:table-cell">Monto</th>
                  <th className="py-2.5 px-3 text-right font-medium hidden md:table-cell">Cobrado</th>
                  <th className="py-2.5 px-3 text-right font-medium">Saldo</th>
                  <th className="py-2.5 px-3 text-left font-medium hidden lg:table-cell">Fecha esperada</th>
                  <th className="py-2.5 px-3 text-left font-medium">Estado</th>
                  <th className="py-2.5 px-3 text-right font-medium w-36">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cxcsFiltradas.map(cxc => (
                  <CxcRow
                    key={cxc.id}
                    cxc={cxc}
                    hoy={hoy}
                    onCobrar={setDialogCobrar}
                    onEvidencia={setDialogEvidencia}
                    onEstadoChange={handleEstadoChange}
                  />
                ))}
              </tbody>
              {cxcsFiltradas.length > 1 && (
                <tfoot>
                  <tr className="bg-surface-muted border-t border-border">
                    <td className="py-2 px-3 text-xs text-text-muted" colSpan={3}>
                      {cxcsFiltradas.length} facturas
                    </td>
                    <td className="py-2 px-3 text-right text-sm font-semibold tabular-nums text-status-danger" colSpan={4}>
                      {formatUSD(cxcsFiltradas
                        .filter(c => c.estado !== "Pagada" && c.estado !== "Incobrable")
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

      {/* Diálogo de cobro */}
      {dialogCobrar && (
        <CobroDialog
          cxc={dialogCobrar}
          cuentas={cuentas}
          hoy={hoy}
          onClose={() => setDialogCobrar(null)}
          onSuccess={handleCobroSuccess}
        />
      )}

      {/* Diálogo de evidencia */}
      {dialogEvidencia && (
        <EvidenciaDialog
          cxc={dialogEvidencia}
          onClose={() => setDialogEvidencia(null)}
          onSuccess={handleEvidenciaSuccess}
        />
      )}
    </div>
  );
}
