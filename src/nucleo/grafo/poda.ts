import type {
  AsignacionVariables,
  IdNodo,
  NodoBayes,
  RedBayesiana,
} from '../dominio/tipos';

export interface ResultadoPoda {
  /** Nodos que pertenecen a Q ∪ E o son ancestros de Q ∪ E, en el orden canónico de la red. */
  readonly nodosActivos: readonly NodoBayes[];
  /** Nodos irrelevantes (no ancestros de Q ∪ E) eliminados en el Paso 2 porque ∑_x P(x|Pa) = 1. */
  readonly nodosPodados: readonly NodoBayes[];
  /** Variables ocultas activas restantes tras la poda: nodosActivos \ (Q ∪ E). */
  readonly variablesOcultasActivas: readonly IdNodo[];
}

/**
 * Paso 2 de Eliminación de Variables: búsqueda inversa (BFS) desde Q ∪ E hacia los padres
 * para identificar y podar todas las variables que no son ancestros de la consulta ni de la evidencia.
 */
export function podarNodosIrrelevantes(
  red: RedBayesiana,
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
): ResultadoPoda {
  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const conjuntoConsulta = new Set(variablesConsulta);
  const idsEvidencia = Object.keys(evidencia);
  const conjuntoEvidencia = new Set(idsEvidencia);

  const idsRelevantes = new Set<IdNodo>([...variablesConsulta, ...idsEvidencia]);
  const cola: IdNodo[] = [...idsRelevantes];

  while (cola.length > 0) {
    const idActual = cola.shift()!;
    const nodoActual = nodosPorId.get(idActual);
    if (!nodoActual) continue;

    for (const idPadre of nodoActual.padres) {
      if (!idsRelevantes.has(idPadre) && nodosPorId.has(idPadre)) {
        idsRelevantes.add(idPadre);
        cola.push(idPadre);
      }
    }
  }

  const nodosActivos: NodoBayes[] = [];
  const nodosPodados: NodoBayes[] = [];
  const variablesOcultasActivas: IdNodo[] = [];

  for (const nodo of red.nodos) {
    if (idsRelevantes.has(nodo.id)) {
      nodosActivos.push(nodo);
      if (!conjuntoConsulta.has(nodo.id) && !conjuntoEvidencia.has(nodo.id)) {
        variablesOcultasActivas.push(nodo.id);
      }
    } else {
      nodosPodados.push(nodo);
    }
  }

  return {
    nodosActivos,
    nodosPodados,
    variablesOcultasActivas,
  };
}
