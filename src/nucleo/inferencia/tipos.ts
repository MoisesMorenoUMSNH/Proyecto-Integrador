import type {
  AsignacionVariables,
  IdNodo,
  NodoBayes,
  ProblemaValidacion,
  ValorEstado,
} from '../dominio/tipos';
import type { Factor } from '../factor/tipos';
import type { VerificacionAtajoMantaMarkov } from '../grafo/mantaMarkov';
import type { ClasificacionInferencia } from '../grafo/tipoInferencia';

/**
 * Estrategia para determinar el orden de eliminación π de las variables ocultas:
 * - `'minimo-relleno'` (Min-Fill): minimiza aristas nuevas inducidas en el grafo de interacción.
 * - `'minimo-grado'` (Min-Degree): minimiza la cantidad de vecinos actuales en el grafo de interacción.
 * - `'practico-clase'`: regla práctica del curso (raíces de un solo hijo y extremos simples primero).
 * - `'manual'`: permutación explícita elegida por el usuario.
 */
export type EstrategiaEliminacion =
  | 'minimo-relleno'
  | 'minimo-grado'
  | 'practico-clase'
  | 'manual';

export interface EntradaConsulta {
  readonly variablesConsulta: readonly IdNodo[];
  readonly evidencia: AsignacionVariables;
  readonly estrategia?: EstrategiaEliminacion;
  readonly ordenManual?: readonly IdNodo[];
  readonly verificarConEnumeracionCompleta?: boolean;
}

export interface MetricaAlcancePaso {
  readonly variable: IdNodo;
  /** Cantidad de variables en el factor creado g_k después de marginalizar `variable`. */
  readonly tamanoAlcanceCreado: number;
  /** Cantidad de variables en la unión de alcances U_k antes de marginalizar `variable`. */
  readonly tamanoAlcancePrevioSuma: number;
  /** Cantidad de factores multiplicados entre sí en este paso. */
  readonly cantidadFactoresInvolucrados: number;
  /** Multiplicaciones escalares ejecutadas en este paso. */
  readonly multiplicaciones: number;
}

export interface MetricasSimulacionOrden {
  readonly estrategia: EstrategiaEliminacion;
  readonly orden: readonly IdNodo[];
  readonly pasos: readonly MetricaAlcancePaso[];
  /** Máximo |vars(g_k)| a lo largo de los pasos de eliminación (ancho inducido de factor creado). */
  readonly maxTamanoAlcanceFactorCreado: number;
  /** Tamaño máximo de alcance formado en cualquier instante (factores iniciales + productos previos a marginalizar). */
  readonly maxTamanoAlcanceFactorFormado: number;
  /** Total exacto de multiplicaciones escalares (Paso 5 + Paso 6) bajo este ordenamiento. */
  readonly totalMultiplicaciones: number;
}

export interface TrazaPaso1Formulacion {
  readonly variablesConsulta: readonly IdNodo[];
  readonly evidencia: AsignacionVariables;
  readonly todasVariablesOcultas: readonly IdNodo[];
  readonly latexSimbolico: string;
  readonly clasificacion: ClasificacionInferencia;
}

export interface TrazaPaso2Poda {
  readonly nodosActivos: readonly NodoBayes[];
  readonly nodosPodados: readonly NodoBayes[];
  readonly variablesOcultasActivas: readonly IdNodo[];
  readonly latexSimbolicoReducido: string;
  readonly atajoMantaMarkov: VerificacionAtajoMantaMarkov;
}

export interface EntradaFactorInicial {
  readonly idNodo: IdNodo;
  readonly evidenciaAplicada: AsignacionVariables;
  readonly factor: Factor;
  readonly esConstanteEscalar: boolean;
}

export interface TrazaPaso3FactoresIniciales {
  readonly entradas: readonly EntradaFactorInicial[];
}

export interface TrazaPaso4Ordenamiento {
  readonly estrategia: EstrategiaEliminacion;
  readonly ordenEliminacion: readonly IdNodo[];
  readonly metricas: MetricasSimulacionOrden;
  readonly comparaciones: Readonly<
    Record<
      'minimo-relleno' | 'minimo-grado' | 'practico-clase',
      MetricasSimulacionOrden
    >
  >;
}

export interface PasoEliminacion {
  /** Ej. "5.1", "5.2" */
  readonly etiquetaSubPaso: string;
  readonly indicePaso: number;
  readonly variable: IdNodo;
  readonly idsFactoresInvolucrados: readonly string[];
  readonly etiquetasFactoresInvolucrados: readonly string[];
  readonly latexSimbolico: string;
  readonly variablesPreviasMarginalizacion: readonly IdNodo[];
  readonly nuevoFactor: Factor;
  readonly multiplicaciones: number;
  /** Etiquetas formateadas como ["f_R", "f_G(F, G)", "g_1(F)"] equivalentes a "Factores que quedan". */
  readonly etiquetasFactoresRestantes: readonly string[];
}

export interface TrazaPaso5Eliminacion {
  readonly subPasos: readonly PasoEliminacion[];
  readonly multiplicacionesPaso5: number;
}

export interface ResultadoEnumeracion {
  readonly variablesConsulta: readonly IdNodo[];
  readonly filasNoNormalizadas: readonly {
    readonly asignacion: AsignacionVariables;
    readonly valor: number;
  }[];
  readonly filasPosteriores: readonly {
    readonly asignacion: AsignacionVariables;
    readonly probabilidad: number;
  }[];
  readonly probabilidadEvidencia: number;
  readonly esEvidenciaImposible: boolean;
  readonly terminosEnumerados: number;
  readonly multiplicaciones: number;
}

export interface VerificacionVerdadFundamental {
  readonly verificado: boolean;
  readonly diferenciaAbsolutaMaxima: number;
  readonly terminosEnumerados: number;
  readonly multiplicacionesEnumeracion: number;
  readonly multiplicacionesEliminacionVariables: number;
  readonly multiplicacionesAhorradas: number;
  readonly porcentajeAhorro: number;
  readonly resultadoEnumeracion: ResultadoEnumeracion;
}

export interface TrazaPaso6Normalizacion {
  readonly idsFactoresRestantes: readonly string[];
  readonly etiquetasFactoresRestantes: readonly string[];
  readonly factorNoNormalizado: Factor;
  readonly multiplicacionesPaso6: number;
  readonly totalMultiplicaciones: number;
  readonly maxTamanoAlcanceFactorFormado: number;
  readonly maxTamanoAlcanceFactorCreado: number;
  readonly probabilidadEvidencia: number;
  readonly alfa: number | null;
  readonly esEvidenciaImposible: boolean;
  readonly factorPosterior: Factor;
  /**
   * Consulta directa de probabilidades posteriores:
   * - Si |Q| === 1: indexado por valor de estado (ej. { "1": 0.8374..., "0": 0.1626... } o { "PS5": 0.5289... })
   * - Si |Q| >= 2: indexado por "Q1=v1,Q2=v2"
   */
  readonly posteriorPorEstado: Readonly<Record<ValorEstado, number>>;
  readonly verdadFundamental?: VerificacionVerdadFundamental;
}

export interface TrazaEliminacionVariables {
  readonly paso1: TrazaPaso1Formulacion;
  readonly paso2: TrazaPaso2Poda;
  readonly paso3: TrazaPaso3FactoresIniciales;
  readonly paso4: TrazaPaso4Ordenamiento;
  readonly paso5: TrazaPaso5Eliminacion;
  readonly paso6: TrazaPaso6Normalizacion;
}

export type ResultadoConsultaInferencia =
  | { readonly exito: true; readonly traza: TrazaEliminacionVariables }
  | { readonly exito: false; readonly errores: readonly ProblemaValidacion[] };
