-- 006_reportes_pnl.sql — Índices para Reportes P&L (Sprint 6)
-- Aplicar en Supabase SQL Editor (copy/paste).
-- Permite consultas por rango de fechas en < 2s con 30-50k filas.

CREATE INDEX IF NOT EXISTS idx_transacciones_fecha
  ON transacciones(fecha);

CREATE INDEX IF NOT EXISTS idx_transacciones_fecha_tipo
  ON transacciones(fecha, tipo);
