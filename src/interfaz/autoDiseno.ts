import dagre from '@dagrejs/dagre';
import type { IdNodo, NodoBayes } from '../nucleo';

export type OrientacionDiseno = 'TB' | 'LR';

export interface CoordenadaLienzo {
  readonly x: number;
  readonly y: number;
}

export const ANCHO_NODO = 200;
export const ALTO_NODO = 110;

/**
 * Calcula posiciones jerárquicas libres de ciclos para los nodos de la Red Bayesiana usando Dagre.
 * Extraído de la UI para desacoplar el estado y cálculo de diseño del renderizado React Flow.
 */
export function calcularAutoDiseno(
  nodos: readonly NodoBayes[],
  orientacion: OrientacionDiseno = 'TB',
): Record<IdNodo, CoordenadaLienzo> {
  if (nodos.length === 0) return {};

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: orientacion,
    nodesep: 50,
    ranksep: 75,
    marginx: 40,
    marginy: 40,
  });

  const ids = new Set(nodos.map((n) => n.id));
  for (const n of nodos) {
    g.setNode(n.id, { width: ANCHO_NODO, height: ALTO_NODO });
  }

  for (const n of nodos) {
    for (const p of n.padres) {
      if (ids.has(p) && p !== n.id) {
        g.setEdge(p, n.id);
      }
    }
  }

  dagre.layout(g);

  const posiciones: Record<IdNodo, CoordenadaLienzo> = {};
  for (const n of nodos) {
    const pos = g.node(n.id);
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      posiciones[n.id] = {
        x: Math.round(pos.x - ANCHO_NODO / 2),
        y: Math.round(pos.y - ALTO_NODO / 2),
      };
    } else {
      posiciones[n.id] = { x: n.posicion.x, y: n.posicion.y };
    }
  }

  return posiciones;
}
