-- 007_flujo_caja.sql — Índice para Flujo de Caja real (Sprint 7)
-- La query de flujo real filtra pagos por rango de fecha; sin índice es seq scan.
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha);
