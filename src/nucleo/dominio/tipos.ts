/**
 * Contratos puros del dominio de Redes Bayesianas (0% dependencias de UI o DOM).
 * Diseñados para la Parte 1 (Inferencia Exacta por Eliminación de Variables) y
 * directamente extensibles a la Parte 2 (Aprendizaje de Parámetros EM con variables latentes).
 */

/** Identificador corto y único de un nodo en la red (ej. "P", "Le", "Pl"). */
export type IdNodo = string;

/** Valor discreto de estado de una variable aleatoria (ej. "1", "0", "PS5", "Xbox", "Switch 2"). */
export type ValorEstado = string;

/** Asignación parcial o completa de variables a sus estados discretos: { P: "1", V: "0" }. */
export type AsignacionVariables = Readonly<Record<IdNodo, ValorEstado>>;

/** Orden canónico de estados en los apuntes del curso para variables binarias (1 = Sí primero, 0 = No segundo). */
export const ESTADOS_BINARIOS_CANONICOS: readonly [ValorEstado, ValorEstado] = ['1', '0'] as const;

/** Tolerancia numérica de punto flotante para la suma de cada fila de una CPT (|suma - 1.0| <= 1e-6). */
export const EPSILON_SUMA_PROBABILIDAD = 1e-6;

/** Límites obligatorios de cardinalidad de nodos de la red según la especificación del proyecto. */
export const MIN_NODOS_RED = 3;
export const MAX_NODOS_RED = 10;

/** Fila condicional explícita de una Tabla de Probabilidad Condicional: P(X = estado | Pa(X) = cuando). */
export interface FilaCPT {
  /** Asignación de valores para cada padre en nodo.padres ({} para nodos raíz sin padres). */
  readonly cuando: AsignacionVariables;
  /** Mapa exhaustivo estado -> probabilidad en [0, 1] cuya suma es 1.0 ± 1e-6. */
  readonly probabilidades: Readonly<Record<ValorEstado, number>>;
}

/** Definición completa e inmutable de un nodo en una Red Bayesiana. */
export interface NodoBayes {
  readonly id: IdNodo;
  readonly nombre: string;
  readonly descripcion?: string;
  /** Lista ordenada de >= 2 estados únicos. Binario canónico: ["1", "0"]. */
  readonly estados: readonly ValorEstado[];
  /** Etiquetas legibles opcionales por estado, ej. { "1": "Sí", "0": "No" }. */
  readonly etiquetasEstados?: Readonly<Record<ValorEstado, string>>;
  /** Identificadores ordenados de los nodos padres directos en el DAG. */
  readonly padres: readonly IdNodo[];
  /** Coordenadas visuales en el lienzo preservadas sin pérdida al importar/exportar JSON. */
  readonly posicion: { readonly x: number; readonly y: number };
  /** Tabla de Probabilidad Condicional P(X | Pa(X)) con prod(|estados(P)|) filas. */
  readonly cpt: readonly FilaCPT[];
  /** Bandera opcional reservada para la Parte 2 (variables latentes/ocultas en aprendizaje EM). */
  readonly esLatente?: boolean;
}

/** Consulta predefinida opcional incluida en los archivos .json de ejemplo. */
export interface ConsultaPredefinida {
  readonly id: string;
  readonly etiqueta: string;
  readonly descripcion?: string;
  readonly variablesConsulta: readonly IdNodo[];
  readonly evidencia: AsignacionVariables;
  readonly ordenSugerido?: readonly IdNodo[];
  /** Distribución posterior esperada para verificación automatizada y pruebas TDD. */
  readonly posteriorEsperada?: Readonly<Record<string, number>>;
}

/** Entidad raíz inmutable que representa una Red Bayesiana completa. */
export interface RedBayesiana {
  readonly versionEsquema: '1.0';
  readonly metadatos: {
    readonly id: string;
    readonly titulo: string;
    readonly descripcion?: string;
    readonly autor?: string;
    readonly dominio?: string;
    readonly actualizadoEn?: string;
  };
  readonly nodos: readonly NodoBayes[];
  readonly consultasPredefinidas?: readonly ConsultaPredefinida[];
}

export type CodigoErrorValidacion =
  | 'RED_MINIMO_NODOS'
  | 'RED_MAXIMO_NODOS'
  | 'ID_NODO_DUPLICADO'
  | 'ID_NODO_INVALIDO'
  | 'ESTADOS_NODO_INVALIDOS'
  | 'ID_PADRE_DESCONOCIDO'
  | 'ID_PADRE_DUPLICADO'
  | 'CICLO_DAG_DETECTADO'
  | 'CPT_CONTEO_FILAS_INVALIDO'
  | 'CPT_COMBINACION_FALTANTE'
  | 'CPT_PROBABILIDAD_FUERA_DE_RANGO'
  | 'CPT_SUMA_FILA_INVALIDA'
  | 'ERROR_VALIDACION_ESQUEMA';

/** Estructura uniforme de diagnóstico para errores sintácticos, topológicos o matemáticos. */
export interface ProblemaValidacion {
  readonly codigo: CodigoErrorValidacion;
  readonly severidad: 'error' | 'advertencia';
  readonly idNodo?: IdNodo;
  readonly mensaje: string;
  readonly detalles?: Readonly<Record<string, unknown>>;
}

/** Unión discriminada de resultado para operaciones de frontera y persistencia. */
export type Resultado<T, E = readonly ProblemaValidacion[]> =
  | { readonly exito: true; readonly valor: T }
  | { readonly exito: false; readonly errores: E };
