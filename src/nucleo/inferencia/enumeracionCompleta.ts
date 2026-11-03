import {
  construirClaveAsignacion,
  generarCombinacionesPadres,
  obtenerProbabilidadCondicional,
} from '../dominio/cpt';
import type {
  AsignacionVariables,
  IdNodo,
  RedBayesiana,
  ValorEstado,
} from '../dominio/tipos';
import type { ResultadoEnumeracion } from './tipos';

/**
 * Verificador Secundario de Verdad Fundamental (Ground Truth) por Enumeración de la Conjunta Completa:
 * Evalúa P(X_1, ..., X_N) = ∏_{i=1}^N P(X_i | Pa(X_i)) directamente sobre la red completa sin podar
 * fijando la evidencia E = e, completamente independiente de las operaciones de factores y de la poda del DAG.
 *
 * Métricas exactas de enumeración (idénticas a todos los bloques de "Comprobación" del PDF del curso):
 *   terminosEnumerados = ∏_{X ∉ E} |estados(X)|
 *   multiplicaciones   = terminosEnumerados * (N - 1)
 */
export function enumeracionConjuntaCompleta(
  red: RedBayesiana,
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
): ResultadoEnumeracion {
  const cantidadNodos = red.nodos.length;
  const nodosLibres = red.nodos.filter(
    (nodo) => !Object.prototype.hasOwnProperty.call(evidencia, nodo.id),
  );

  const idsVariablesLibres = nodosLibres.map((nodo) => nodo.id);
  const dominiosLibres: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const nodo of nodosLibres) {
    dominiosLibres[nodo.id] = nodo.estados;
  }

  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const dominiosConsulta: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const idQ of variablesConsulta) {
    const nodoQ = nodosPorId.get(idQ);
    if (!nodoQ) {
      throw new Error(`La variable de consulta "${idQ}" no existe en la red.`);
    }
    dominiosConsulta[idQ] = nodoQ.estados;
  }

  const asignacionesConsulta = generarCombinacionesPadres(
    variablesConsulta,
    dominiosConsulta,
  );
  const acumuladores = new Map<string, number>();
  for (const asignacionQ of asignacionesConsulta) {
    acumuladores.set(construirClaveAsignacion(variablesConsulta, asignacionQ), 0);
  }

  const combinacionesLibres = generarCombinacionesPadres(
    idsVariablesLibres,
    dominiosLibres,
  );
  for (const asignacionLibre of combinacionesLibres) {
    const asignacionCompleta: AsignacionVariables = {
      ...evidencia,
      ...asignacionLibre,
    };

    let terminoConjunto = 1;
    for (const nodo of red.nodos) {
      terminoConjunto *= obtenerProbabilidadCondicional(nodo, asignacionCompleta);
    }

    const claveQ = construirClaveAsignacion(variablesConsulta, asignacionCompleta);
    acumuladores.set(claveQ, (acumuladores.get(claveQ) ?? 0) + terminoConjunto);
  }

  let probabilidadEvidencia = 0;
  const filasNoNormalizadas = asignacionesConsulta.map((asignacion) => {
    const valor =
      acumuladores.get(construirClaveAsignacion(variablesConsulta, asignacion)) ?? 0;
    probabilidadEvidencia += valor;
    return { asignacion, valor };
  });

  const esEvidenciaImposible = probabilidadEvidencia === 0;
  const filasPosteriores = filasNoNormalizadas.map(({ asignacion, valor }) => ({
    asignacion,
    probabilidad: esEvidenciaImposible ? 0 : valor / probabilidadEvidencia,
  }));

  const terminosEnumerados = combinacionesLibres.length;
  const multiplicaciones = terminosEnumerados * Math.max(0, cantidadNodos - 1);

  return {
    variablesConsulta: [...variablesConsulta],
    filasNoNormalizadas,
    filasPosteriores,
    probabilidadEvidencia,
    esEvidenciaImposible,
    terminosEnumerados,
    multiplicaciones,
  };
}
