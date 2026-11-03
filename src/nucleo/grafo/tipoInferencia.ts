import type {
  AsignacionVariables,
  IdNodo,
  RedBayesiana,
} from '../dominio/tipos';
import { obtenerAncestros, obtenerDescendientes } from './dag';
import {
  calcularMantaMarkov,
  estaMantaMarkovCompletamenteObservada,
} from './mantaMarkov';

export type CategoriaInferencia =
  | 'predictiva-marginal'
  | 'predictiva-causal'
  | 'diagnostica'
  | 'intercausal'
  | 'mixta';

export interface ClasificacionInferencia {
  readonly categoria: CategoriaInferencia;
  readonly etiqueta: string;
  readonly explicacion: string;
  readonly usaAtajoMantaMarkov: boolean;
}

/**
 * Clasifica automáticamente la consulta probabilista P(Q | E = e) de acuerdo con los
 * 4 patrones de razonamiento enseñados en el curso (Predictiva/Causal, Diagnóstica,
 * Intercausal/Explicación alternativa y Mixta) más la detección del atajo por Manta de Markov.
 */
export function clasificarTipoInferencia(
  red: RedBayesiana,
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
): ClasificacionInferencia {
  const idsEvidencia = Object.keys(evidencia);
  const verificacionManta = estaMantaMarkovCompletamenteObservada(
    red,
    variablesConsulta,
    evidencia,
  );
  const usaAtajoMantaMarkov = verificacionManta.aplicable;

  if (idsEvidencia.length === 0) {
    return {
      categoria: 'predictiva-marginal',
      etiqueta: 'Predictiva (marginal sin evidencia)',
      explicacion:
        'No hay variables observadas; la incertidumbre se propaga desde las causas raíz hacia la consulta.',
      usaAtajoMantaMarkov: false,
    };
  }

  const conjuntoConsulta = new Set(variablesConsulta);
  const ancestrosQ = obtenerAncestros(red.nodos, variablesConsulta);
  const descendientesQ = obtenerDescendientes(red.nodos, variablesConsulta);
  for (const idQ of conjuntoConsulta) {
    ancestrosQ.delete(idQ);
    descendientesQ.delete(idQ);
  }

  // 1. Predictiva o causal pura: toda variable observada es ancestro estricto de Q
  if (idsEvidencia.every((idE) => ancestrosQ.has(idE))) {
    return {
      categoria: 'predictiva-causal',
      etiqueta: 'Predictiva o causal',
      explicacion:
        'Toda la evidencia observada se ubica aguas arriba (en las causas/ancestros) y se propaga hacia los efectos consultados.',
      usaAtajoMantaMarkov,
    };
  }

  // 2. Diagnóstica pura desde descendientes directos de Q
  if (idsEvidencia.every((idE) => descendientesQ.has(idE))) {
    return {
      categoria: 'diagnostica',
      etiqueta: 'Diagnóstica',
      explicacion:
        'La evidencia observada corresponde a efectos/síntomas aguas abajo de la consulta; el razonamiento viaja de los efectos hacia las causas.',
      usaAtajoMantaMarkov,
    };
  }

  // Recopilar copadres directos de las variables de consulta
  const copadresQ = new Set<IdNodo>();
  for (const idQ of variablesConsulta) {
    const manta = calcularMantaMarkov(red, idQ);
    for (const copadre of manta.copadres) {
      if (!conjuntoConsulta.has(copadre)) {
        copadresQ.add(copadre);
      }
    }
  }

  const descendientesObservados = idsEvidencia.filter((idE) => descendientesQ.has(idE));
  const evidenciaNoDescendiente = idsEvidencia.filter((idE) => !descendientesQ.has(idE));

  // 3. Intercausal (Explicación alternativa / Explaining-away): se observa al menos un efecto común en Desc(Q)
  // Y las demás variables observadas son copadres que comparten un hijo directo con Q.
  if (
    descendientesObservados.length > 0 &&
    evidenciaNoDescendiente.length > 0 &&
    evidenciaNoDescendiente.every((idE) => copadresQ.has(idE))
  ) {
    return {
      categoria: 'intercausal',
      etiqueta: 'Intercausal (explicación alternativa)',
      explicacion:
        'Se observa un efecto común junto con otra causa alternativa (copadre), activando dependencia condicional entre causas independientes a priori (explaining-away).',
      usaAtajoMantaMarkov,
    };
  }

  // 4. Diagnóstica vía ancestro común no observado (ej. rama hermana P(C | T=1))
  const tieneEvidenciaAguasArriba = idsEvidencia.some((idE) => ancestrosQ.has(idE));
  if (!tieneEvidenciaAguasArriba && descendientesObservados.length === 0) {
    const comparteAncestroNoObservado = idsEvidencia.every((idE) => {
      const ancestrosE = obtenerAncestros(red.nodos, [idE]);
      for (const ancestro of ancestrosE) {
        if (ancestrosQ.has(ancestro)) {
          return true;
        }
      }
      return false;
    });

    if (comparteAncestroNoObservado) {
      return {
        categoria: 'diagnostica',
        etiqueta: 'Diagnóstica',
        explicacion:
          'La evidencia proviene de efectos en una rama hermana que sube diagnósticamente hacia causas comunes no observadas y baja hacia la consulta.',
        usaAtajoMantaMarkov,
      };
    }
  }

  // 5. Inferencia mixta (combinación de evidencia aguas arriba y aguas abajo o ramas paralelas)
  return {
    categoria: 'mixta',
    etiqueta: 'Mixta',
    explicacion:
      'Combina simultáneamente evidencia aguas arriba (causas) y aguas abajo o en ramas paralelas (efectos).',
    usaAtajoMantaMarkov,
  };
}
