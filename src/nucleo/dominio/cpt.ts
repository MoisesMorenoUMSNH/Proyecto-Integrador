import type {
  AsignacionVariables,
  FilaCPT,
  IdNodo,
  NodoBayes,
  RedBayesiana,
  ValorEstado,
} from './tipos';

/**
 * Construye una clave canónica determinista para una asignación sobre una lista ordenada de variables.
 * Utiliza caracteres separadores ASCII de unidad/registro para que estados multivaluados con espacios
 * (ej. "Switch 2") jamás colisionen entre sí.
 */
export function construirClaveAsignacion(
  variables: readonly IdNodo[],
  asignacion: AsignacionVariables,
): string {
  if (variables.length === 0) {
    return '__CONSTANTE__';
  }
  return variables
    .map((idVariable) => `${idVariable}\u001f${asignacion[idVariable] ?? ''}`)
    .join('\u001e');
}

/**
 * Genera el producto cartesiano ordenado lexicográficamente de asignaciones sobre `variables`
 * (por ejemplo, todas las combinaciones posibles de estados de los padres de un nodo).
 * Cuando `variables` está vacío, devuelve `[{}]` representando la única fila incondicional o escalar.
 */
export function generarCombinacionesPadres(
  variables: readonly IdNodo[],
  dominios: Readonly<Record<IdNodo, readonly ValorEstado[]>>,
): AsignacionVariables[] {
  if (variables.length === 0) {
    return [{}];
  }

  let resultados: Record<IdNodo, ValorEstado>[] = [{}];

  for (const variable of variables) {
    const estados = dominios[variable];
    if (!estados || estados.length === 0) {
      throw new Error(`Dominio vacío o no definido para la variable "${variable}".`);
    }
    const siguientes: Record<IdNodo, ValorEstado>[] = [];
    for (const prefijo of resultados) {
      for (const estado of estados) {
        siguientes.push({ ...prefijo, [variable]: estado });
      }
    }
    resultados = siguientes;
  }

  return resultados;
}

/**
 * Calcula el complemento binario 1 - p para la edición de filas de CPTs binarias
 * sin introducir ruido de representación decimal IEEE-754
 * (ej. 1 - 0.3 -> 0.7 en lugar de 0.7000000000000001).
 */
export function autocompletarFilaBinaria(probabilidadPrimerEstado: number): number {
  const acotada = Math.min(1, Math.max(0, probabilidadPrimerEstado));
  return Number((1 - acotada).toPrecision(12));
}

/**
 * Construye un mapa de probabilidades uniformes sobre `estados` cuya suma es estrictamente 1.0.
 */
export function construirProbabilidadesUniformes(
  estados: readonly ValorEstado[],
): Record<ValorEstado, number> {
  if (estados.length === 0) {
    throw new Error('Un nodo debe tener al menos 2 estados.');
  }
  const probabilidades: Record<ValorEstado, number> = {};
  const base = Number((1 / estados.length).toFixed(6));
  let acumulado = 0;

  for (let i = 0; i < estados.length; i += 1) {
    const estado = estados[i]!;
    if (i === estados.length - 1) {
      probabilidades[estado] = Number((1 - acumulado).toPrecision(12));
    } else {
      probabilidades[estado] = base;
      acumulado += base;
    }
  }
  return probabilidades;
}

/**
 * Crea una CPT uniforme completa cubriendo todas las combinaciones de estados de los padres.
 */
export function crearCptUniforme(
  estadosNodo: readonly ValorEstado[],
  idsPadres: readonly IdNodo[],
  dominiosPadres: Readonly<Record<IdNodo, readonly ValorEstado[]>>,
): FilaCPT[] {
  const combinaciones = generarCombinacionesPadres(idsPadres, dominiosPadres);
  const uniforme = construirProbabilidadesUniformes(estadosNodo);

  return combinaciones.map((cuando) => ({
    cuando,
    probabilidades: { ...uniforme },
  }));
}

/**
 * Redimensiona la CPT de un nodo cuando cambian sus estados o padres en la interfaz gráfica,
 * conservando las filas condicionales existentes siempre que coincidan los valores de los padres
 * compartidos y la lista de estados del nodo permanezca idéntica.
 */
export function redimensionarCptNodo(
  nodoExistente: NodoBayes,
  nuevosEstados: readonly ValorEstado[],
  nuevosPadres: readonly IdNodo[],
  dominiosPadres: Readonly<Record<IdNodo, readonly ValorEstado[]>>,
): FilaCPT[] {
  const mismosEstados =
    nodoExistente.estados.length === nuevosEstados.length &&
    nodoExistente.estados.every((estado, indice) => estado === nuevosEstados[indice]);

  if (!mismosEstados) {
    return crearCptUniforme(nuevosEstados, nuevosPadres, dominiosPadres);
  }

  const padresCompartidos = nuevosPadres.filter((padre) =>
    nodoExistente.padres.includes(padre),
  );
  const uniforme = construirProbabilidadesUniformes(nuevosEstados);
  const combinaciones = generarCombinacionesPadres(nuevosPadres, dominiosPadres);

  return combinaciones.map((cuando) => {
    const filaCompatible = nodoExistente.cpt.find((fila) =>
      padresCompartidos.every((padre) => fila.cuando[padre] === cuando[padre]),
    );
    return {
      cuando,
      probabilidades: filaCompatible
        ? { ...filaCompatible.probabilidades }
        : { ...uniforme },
    };
  });
}

/**
 * Consulta la probabilidad condicional P(X = asignacion[nodo.id] | Pa(X) = asignacion[Pa(X)]) en la CPT del nodo.
 */
export function obtenerProbabilidadCondicional(
  nodo: NodoBayes,
  asignacion: AsignacionVariables,
): number {
  const estadoObjetivo = asignacion[nodo.id];
  if (estadoObjetivo === undefined) {
    throw new Error(`Falta el valor del nodo "${nodo.id}" en la asignación.`);
  }

  const filaCoincidente = nodo.cpt.find((fila) =>
    nodo.padres.every((idPadre) => fila.cuando[idPadre] === asignacion[idPadre]),
  );

  if (!filaCoincidente) {
    const descripcionPadres = nodo.padres
      .map((padre) => `${padre}=${asignacion[padre] ?? '?'}`)
      .join(', ');
    throw new Error(
      `No se encontró fila CPT en "${nodo.id}" para la combinación de padres (${descripcionPadres}).`,
    );
  }

  const probabilidad = filaCoincidente.probabilidades[estadoObjetivo];
  if (probabilidad === undefined) {
    throw new Error(
      `El estado "${estadoObjetivo}" no existe en la CPT del nodo "${nodo.id}".`,
    );
  }

  return probabilidad;
}

/**
 * Actualización pura e inmutable de la CPT de un nodo (soporta edición en GUI e iteraciones EM de la Parte 2).
 */
export function actualizarCptNodo(
  red: RedBayesiana,
  idNodo: IdNodo,
  nuevaCpt: readonly FilaCPT[],
): RedBayesiana {
  return {
    ...red,
    nodos: red.nodos.map((nodo) =>
      nodo.id === idNodo ? { ...nodo, cpt: [...nuevaCpt] } : nodo,
    ),
  };
}

/**
 * Obtiene el mapa de dominios discretos para una lista de identificadores de padres
 * a partir de la red o de su lista de nodos.
 */
export function obtenerDominiosPadres(
  redONodos: RedBayesiana | readonly NodoBayes[],
  padres: readonly IdNodo[],
): Record<IdNodo, readonly ValorEstado[]> {
  const listaNodos: readonly NodoBayes[] =
    'nodos' in redONodos ? redONodos.nodos : redONodos;
  const nodosPorId = new Map<IdNodo, NodoBayes>(
    listaNodos.map((n) => [n.id, n]),
  );
  const dominiosPadres: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const idPadre of padres) {
    const nodoPadre = nodosPorId.get(idPadre);
    if (nodoPadre) {
      dominiosPadres[idPadre] = nodoPadre.estados;
    }
  }
  return dominiosPadres;
}

/**
 * Normaliza las probabilidades de una fila de CPT para que sumen exactamente 1.0.
 * Si todos los valores son <= 0 o no finitos, aplica una distribución uniforme exacta.
 */
export function normalizarDistribucionFila(
  estados: readonly ValorEstado[],
  probabilidades: Readonly<Record<ValorEstado, number>>,
): Record<ValorEstado, number> {
  const valoresLimpiados = estados.map((est) => {
    const val = probabilidades[est] ?? 0;
    return Number.isFinite(val) && val > 0 ? val : 0;
  });
  const suma = valoresLimpiados.reduce((acc, v) => acc + v, 0);

  if (suma <= 0) {
    return construirProbabilidadesUniformes(estados);
  }

  const siguientesProbs: Record<ValorEstado, number> = {};
  let acum = 0;
  estados.forEach((est, i) => {
    if (i === estados.length - 1) {
      siguientesProbs[est] = Number(Math.max(0, 1 - acum).toPrecision(12));
    } else {
      const norm = Number(((valoresLimpiados[i] ?? 0) / suma).toFixed(6));
      siguientesProbs[est] = norm;
      acum += norm;
    }
  });

  return siguientesProbs;
}

/**
 * Renombra un nodo de manera pura e inmutable en una Red Bayesiana, actualizando su propio ID,
 * las listas de padres de todos los nodos descendientes y las claves de sus filas CPT.
 */
export function renombrarNodoEnRed(
  red: RedBayesiana,
  idActual: IdNodo,
  nuevoId: IdNodo,
): RedBayesiana {
  if (idActual === nuevoId) return red;

  const nodosActualizados: NodoBayes[] = red.nodos.map((nodo) => {
    if (nodo.id === idActual) {
      return { ...nodo, id: nuevoId };
    }
    if (!nodo.padres.includes(idActual)) {
      return nodo;
    }
    const nuevosPadres = nodo.padres.map((p) => (p === idActual ? nuevoId : p));
    const nuevaCpt: FilaCPT[] = nodo.cpt.map((fila) => {
      const nuevoCuando: Record<IdNodo, ValorEstado> = {};
      for (const [clave, valor] of Object.entries(fila.cuando)) {
        nuevoCuando[clave === idActual ? nuevoId : clave] = valor;
      }
      return {
        cuando: nuevoCuando,
        probabilidades: { ...fila.probabilidades },
      };
    });
    return {
      ...nodo,
      padres: nuevosPadres,
      cpt: nuevaCpt,
    };
  });

  return {
    ...red,
    nodos: nodosActualizados,
  };
}
