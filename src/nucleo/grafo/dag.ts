import {
  EPSILON_SUMA_PROBABILIDAD,
  type IdNodo,
  type NodoBayes,
  type ProblemaValidacion,
  type RedBayesiana,
} from '../dominio/tipos';
import { validarDominioRed } from '../dominio/validadores';

export type ResultadoVerificacionArista =
  | { readonly permitida: true }
  | {
      readonly permitida: false;
      readonly razon: string;
      readonly rutaCiclo?: readonly IdNodo[];
    };

/**
 * Construye un mapa de adyacencia padre -> hijos preservando el orden canónico de nodos en la red.
 */
export function obtenerMapaHijos(nodos: readonly NodoBayes[]): Map<IdNodo, IdNodo[]> {
  const mapaHijos = new Map<IdNodo, IdNodo[]>();
  const idsConocidos = new Set(nodos.map((nodo) => nodo.id));

  for (const nodo of nodos) {
    mapaHijos.set(nodo.id, []);
  }

  for (const nodo of nodos) {
    for (const idPadre of nodo.padres) {
      if (idsConocidos.has(idPadre)) {
        mapaHijos.get(idPadre)?.push(nodo.id);
      }
    }
  }

  return mapaHijos;
}

/**
 * Detecta cualquier ciclo dirigido en el grafo mediante búsqueda en profundidad (DFS) tricolor
 * sobre las aristas padre -> hijo.
 * Devuelve la ruta cerrada del ciclo (ej. ["B", "C", "D", "B"] o ["A", "A"]) si existe, o `null` si es un DAG válido.
 */
export function detectarCicloDirigido(nodos: readonly NodoBayes[]): IdNodo[] | null {
  for (const nodo of nodos) {
    if (nodo.padres.includes(nodo.id)) {
      return [nodo.id, nodo.id];
    }
  }

  const mapaHijos = obtenerMapaHijos(nodos);
  // 0 = blanco (no visitado), 1 = gris (en pila de recursión activa), 2 = negro (completado)
  const color = new Map<IdNodo, 0 | 1 | 2>();
  for (const nodo of nodos) {
    color.set(nodo.id, 0);
  }

  const pila: IdNodo[] = [];
  const posicionEnPila = new Map<IdNodo, number>();

  function dfs(actual: IdNodo): IdNodo[] | null {
    color.set(actual, 1);
    posicionEnPila.set(actual, pila.length);
    pila.push(actual);

    const hijos = mapaHijos.get(actual) ?? [];
    for (const siguiente of hijos) {
      const estado = color.get(siguiente) ?? 0;
      if (estado === 1) {
        const indiceInicio = posicionEnPila.get(siguiente) ?? 0;
        return [...pila.slice(indiceInicio), siguiente];
      }
      if (estado === 0) {
        const ciclo = dfs(siguiente);
        if (ciclo) {
          return ciclo;
        }
      }
    }

    pila.pop();
    posicionEnPila.delete(actual);
    color.set(actual, 2);
    return null;
  }

  for (const nodo of nodos) {
    if ((color.get(nodo.id) ?? 0) === 0) {
      const ciclo = dfs(nodo.id);
      if (ciclo) {
        return ciclo;
      }
    }
  }

  return null;
}

/**
 * Busca el camino dirigido más corto desde `idInicio` hasta `idDestino` siguiendo aristas padre -> hijo, o `null`.
 */
function buscarCaminoDirigido(
  nodos: readonly NodoBayes[],
  idInicio: IdNodo,
  idDestino: IdNodo,
): IdNodo[] | null {
  const mapaHijos = obtenerMapaHijos(nodos);
  const cola: IdNodo[] = [idInicio];
  const predecesor = new Map<IdNodo, IdNodo | null>([[idInicio, null]]);

  while (cola.length > 0) {
    const actual = cola.shift()!;
    if (actual === idDestino) {
      const camino: IdNodo[] = [];
      let cursor: IdNodo | null = idDestino;
      while (cursor !== null) {
        camino.push(cursor);
        cursor = predecesor.get(cursor) ?? null;
      }
      return camino.reverse();
    }

    for (const idHijo of mapaHijos.get(actual) ?? []) {
      if (!predecesor.has(idHijo)) {
        predecesor.set(idHijo, actual);
        cola.push(idHijo);
      }
    }
  }

  return null;
}

/**
 * Validador de aristas en tiempo real para el lienzo interactivo del DAG (`idOrigen -> idDestino`).
 * Bloquea auto-bucles, aristas duplicadas, nodos inexistentes y conexiones que cerrarían un ciclo dirigido.
 */
export function puedeAgregarArista(
  red: RedBayesiana,
  idOrigen: IdNodo,
  idDestino: IdNodo,
): ResultadoVerificacionArista {
  const nodoOrigen = red.nodos.find((nodo) => nodo.id === idOrigen);
  const nodoDestino = red.nodos.find((nodo) => nodo.id === idDestino);

  if (!nodoOrigen || !nodoDestino) {
    return {
      permitida: false,
      razon: `Uno de los nodos seleccionados ("${idOrigen}" o "${idDestino}") no existe en la red.`,
    };
  }

  if (idOrigen === idDestino) {
    return {
      permitida: false,
      razon: `Auto-bucle bloqueado: el nodo "${idOrigen}" no puede conectarse consigo mismo.`,
      rutaCiclo: [idOrigen, idDestino],
    };
  }

  if (nodoDestino.padres.includes(idOrigen)) {
    return {
      permitida: false,
      razon: `La relación dirigida ${idOrigen} → ${idDestino} ya existe en la red.`,
    };
  }

  const caminoExistente = buscarCaminoDirigido(red.nodos, idDestino, idOrigen);
  if (caminoExistente) {
    const rutaCiclo = [...caminoExistente, idDestino];
    return {
      permitida: false,
      razon: `Ciclo dirigido bloqueado: agregar ${idOrigen} → ${idDestino} cerraría el ciclo ${rutaCiclo.join(' → ')}.`,
      rutaCiclo,
    };
  }

  return { permitida: true };
}

/**
 * Calcula un ordenamiento topológico determinista de `nodos` mediante el algoritmo de Kahn.
 * Lanza excepción si el grafo contiene algún ciclo dirigido.
 */
export function obtenerOrdenTopologico(nodos: readonly NodoBayes[]): IdNodo[] {
  const mapaHijos = obtenerMapaHijos(nodos);
  const idsConocidos = new Set(nodos.map((nodo) => nodo.id));
  const gradoEntrada = new Map<IdNodo, number>();

  for (const nodo of nodos) {
    const padresValidos = nodo.padres.filter((padre) => idsConocidos.has(padre));
    gradoEntrada.set(nodo.id, padresValidos.length);
  }

  const cola: IdNodo[] = [];
  for (const nodo of nodos) {
    if ((gradoEntrada.get(nodo.id) ?? 0) === 0) {
      cola.push(nodo.id);
    }
  }

  const ordenados: IdNodo[] = [];
  while (cola.length > 0) {
    const actual = cola.shift()!;
    ordenados.push(actual);

    for (const idHijo of mapaHijos.get(actual) ?? []) {
      const siguienteGrado = (gradoEntrada.get(idHijo) ?? 0) - 1;
      gradoEntrada.set(idHijo, siguienteGrado);
      if (siguienteGrado === 0) {
        cola.push(idHijo);
      }
    }
  }

  if (ordenados.length !== nodos.length) {
    const ciclo = detectarCicloDirigido(nodos);
    throw new Error(
      `No existe orden topológico porque el grafo contiene un ciclo dirigido${ciclo ? `: ${ciclo.join(' → ')}` : ''}.`,
    );
  }

  return ordenados;
}

/**
 * Obtiene todos los ancestros estrictos de `idsSemilla` (excluyendo `idsSemilla` salvo que sean alcanzables desde otra semilla).
 */
export function obtenerAncestros(
  nodos: readonly NodoBayes[],
  idsSemilla: readonly IdNodo[],
): Set<IdNodo> {
  const nodosPorId = new Map(nodos.map((nodo) => [nodo.id, nodo]));
  const ancestros = new Set<IdNodo>();
  const cola: IdNodo[] = [...idsSemilla];

  while (cola.length > 0) {
    const actual = cola.shift()!;
    const nodo = nodosPorId.get(actual);
    if (!nodo) continue;

    for (const idPadre of nodo.padres) {
      if (!ancestros.has(idPadre)) {
        ancestros.add(idPadre);
        cola.push(idPadre);
      }
    }
  }

  return ancestros;
}

/**
 * Obtiene todos los descendientes estrictos de `idsSemilla` (excluyendo `idsSemilla` salvo que sean alcanzables desde otra semilla).
 */
export function obtenerDescendientes(
  nodos: readonly NodoBayes[],
  idsSemilla: readonly IdNodo[],
): Set<IdNodo> {
  const mapaHijos = obtenerMapaHijos(nodos);
  const descendientes = new Set<IdNodo>();
  const cola: IdNodo[] = [...idsSemilla];

  while (cola.length > 0) {
    const actual = cola.shift()!;
    for (const idHijo of mapaHijos.get(actual) ?? []) {
      if (!descendientes.has(idHijo)) {
        descendientes.add(idHijo);
        cola.push(idHijo);
      }
    }
  }

  return descendientes;
}

/**
 * Validador integral estructural, matemático y topológico (DAG acíclico) de una Red Bayesiana.
 */
export function validarRedBayesiana(
  red: RedBayesiana,
  epsilon: number = EPSILON_SUMA_PROBABILIDAD,
): ProblemaValidacion[] {
  const problemas = validarDominioRed(red, epsilon);
  const yaTieneProblemaCiclo = problemas.some(
    (problema) => problema.codigo === 'CICLO_DAG_DETECTADO',
  );

  if (!yaTieneProblemaCiclo) {
    const ciclo = detectarCicloDirigido(red.nodos);
    if (ciclo) {
      problemas.push({
        codigo: 'CICLO_DAG_DETECTADO',
        severidad: 'error',
        idNodo: ciclo[0]!,
        mensaje: `La red no es un DAG válido: se detectó el ciclo dirigido ${ciclo.join(' → ')}.`,
        detalles: { ciclo },
      });
    }
  }

  return problemas;
}
