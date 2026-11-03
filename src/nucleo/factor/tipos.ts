import type { AsignacionVariables, IdNodo, ValorEstado } from '../dominio/tipos';

export interface FilaFactor {
  /** Asignación ordenada de las variables en el alcance del factor ({} cuando es constante escalar). */
  readonly asignacion: AsignacionVariables;
  /** Valor numérico exacto en doble precisión IEEE 754 (nunca redondeado internamente). */
  readonly valor: number;
  /**
   * Traza aritmética explícita idéntica a las tablas de clase,
   * ej. "0.3000 · 0.4000 + 0.7000 · 0.0200" o "0.3007 + 0.0863".
   */
  readonly textoCalculo?: string;
}

export interface Factor {
  /** Identificador simbólico para visualización académica: "f_P", "f_C", "g_1", "g_2", etc. */
  readonly id: string;
  /** Etiqueta legible de procedencia, ej. "P(A | C) restringido a A=1". */
  readonly etiquetaOrigen: string;
  /** Variables ordenadas en el alcance del factor ([] cuando se redujo a constante escalar). */
  readonly variables: readonly IdNodo[];
  /** Dominios discretos ordenados para cada variable en `variables`. */
  readonly dominios: Readonly<Record<IdNodo, readonly ValorEstado[]>>;
  /** Tabla explícita de filas en orden lexicográfico respecto a `variables` y `dominios`. */
  readonly filas: readonly FilaFactor[];
}

export interface ResultadoOperacionEliminacion {
  /** Nuevo factor intermedio g_k creado tras marginalizar Z_k. */
  readonly factor: Factor;
  /** Multiplicaciones escalares exactas ejecutadas en este paso suma-producto. */
  readonly multiplicaciones: number;
  /** Unión de variables de los factores involucrados ANTES de sumar sobre Z_k. */
  readonly variablesPreviasMarginalizacion: readonly IdNodo[];
}
