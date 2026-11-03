/**
 * Contratos reservados para la extensibilidad hacia la Parte 2:
 * Aprendizaje de Parámetros con Variables Latentes/Ocultas mediante Esperanza-Maximización (EM)
 * (Pasos 0..5 de "Algoritmo EM en redes bayesianas", Prof. Mauricio Reyes).
 */
import type {
  AsignacionVariables,
  IdNodo,
  RedBayesiana,
  ValorEstado,
} from '../dominio/tipos';

/** Patrón de datos observados con conteo de multiplicidad n_j (variable latente H faltante). */
export interface PatronConjuntoDatos {
  readonly idPatron: string;
  readonly asignacionObservada: AsignacionVariables;
  readonly conteo: number;
}

/** Instantánea de una iteración del algoritmo EM: θ^(t) -> θ^(t+1). */
export interface InstantaneaIteracionEM {
  readonly iteracion: number;
  readonly parametrosRed: RedBayesiana;
  /** Responsabilidad r_j = P(H = 1 | patrón j; θ^(t)) o distribución sobre estados de H por patrón. */
  readonly responsabilidadesPorPatron: Readonly<
    Record<string, Readonly<Record<ValorEstado, number>>>
  >;
  /** Log-verosimilitud l(θ^(t)) = ∑_j n_j ln P(patrón j; θ^(t)). */
  readonly logVerosimilitud: number;
}

export interface ConfiguracionAprendizajeEM {
  readonly idNodoLatente: IdNodo;
  readonly maxIteraciones: number;
  readonly toleranciaConvergencia: number;
}

export interface TrazaEM {
  readonly configuracion: ConfiguracionAprendizajeEM;
  readonly patrones: readonly PatronConjuntoDatos[];
  readonly iteraciones: readonly InstantaneaIteracionEM[];
  readonly convergio: boolean;
}
