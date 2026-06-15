"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ── Badge de estado ──────────────────────────────────────

const ESTADO_STYLE: Record<string, string> = {
  activo:      "bg-status-ok/15 text-status-ok border-status-ok/20",
  activa:      "bg-status-ok/15 text-status-ok border-status-ok/20",
  inactivo:    "bg-border/40 text-text-muted border-border/40",
  inactiva:    "bg-border/40 text-text-muted border-border/40",
  programado:  "bg-brand-amber/15 text-brand-amber border-brand-amber/30",
  programada:  "bg-brand-amber/15 text-brand-amber border-brand-amber/30",
};

export function EstadoBadge({ estado }: { estado: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-xs px-2 py-0.5 font-medium border ${ESTADO_STYLE[estado] ?? "bg-border/20 text-text-muted"}`}
    >
      {estado}
    </Badge>
  );
}

// ── Botón de confirmar eliminación ──────────────────────

export function DeleteButton({
  onConfirm,
  label = "Eliminar",
}: {
  onConfirm: () => Promise<void>;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => { if (timerRef.current !== undefined) clearTimeout(timerRef.current); }, []);

  const handleClick = async () => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    clearTimeout(timerRef.current);
    setConfirming(false);
    setBusy(true);
    await onConfirm();
    setBusy(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className={[
        "text-xs px-2 py-1 rounded transition-colors",
        confirming
          ? "bg-status-danger text-white hover:bg-status-danger/80"
          : "text-text-muted hover:text-status-danger hover:bg-status-danger/10",
        busy ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      {busy ? "..." : confirming ? "¿Confirmar?" : label}
    </button>
  );
}

// ── Campo de formulario base ────────────────────────────

export function FormField({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="text-xs font-medium text-brand-cocoa">
        {label}
        {required && <span className="text-status-danger ml-0.5">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className="h-9 text-sm bg-surface border-border focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0"
      />
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

// ── Wrapper de diálogo de ABM ───────────────────────────

export function CatalogoDialog({
  open,
  onClose,
  titulo,
  children,
  onSubmit,
  busy,
  error,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  children: React.ReactNode;
  onSubmit: (fd: FormData) => void;
  busy: boolean;
  error?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-surface">
        <DialogHeader>
          <DialogTitle className="font-display text-brand-forest">{titulo}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
          className="space-y-4 pt-1"
        >
          {children}

          {error && (
            <p role="alert" className="text-xs text-status-danger">
              {error}
            </p>
          )}

          <DialogFooter className="pt-2 gap-2">
            <DialogClose
              disabled={busy}
              className="inline-flex items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-brand-cocoa bg-surface hover:bg-brand-cream/60 transition-colors disabled:opacity-50"
            >
              Cancelar
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              disabled={busy}
              className="bg-brand-coral hover:bg-brand-coral/90 text-white disabled:opacity-60"
            >
              {busy ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Hook: llama un Server Action y notifica ─────────────

type ActionState = { ok?: boolean; error?: string };

export function useServerAction(
  action: (prev: ActionState | null, fd: FormData) => Promise<ActionState | null>,
  onSuccess?: () => void
) {
  const [state, setState] = useState<ActionState | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fd: FormData) => {
    setBusy(true);
    const next = await action(state, fd);
    setState(next);
    setBusy(false);
    if (next?.ok) {
      toast.success("Guardado correctamente.");
      onSuccess?.();
    }
  };

  return { state, busy, run, reset: () => setState(null) };
}

// ── Barra de búsqueda sencilla ──────────────────────────

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" strokeLinecap="round" />
      </svg>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-sm bg-surface border-border focus-visible:ring-2 focus-visible:ring-brand-coral focus-visible:ring-offset-0 w-56"
      />
    </div>
  );
}
