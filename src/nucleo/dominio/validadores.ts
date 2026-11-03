import { construirClaveAsignacion, generarCombinacionesPadres } from './cpt';
import {
  EPSILON_SUMA_PROBABILIDAD,
  MAX_NODOS_RED,
  MIN_NODOS_RED,
  type IdNodo,
  type NodoBayes,
  type ProblemaValidacion,
  type RedBayesiana,
  type ValorEstado,
} from './tipos';

const REGEX_ID_NODO_VALIDO = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * Valida que la red contenga entre 3 y 10 nodos inclusive.
 */
export function validarConteoNodos(nodos: readonly NodoBayes[]): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];
  if (nodos.length < MIN_NODOS_RED) {
    problemas.push({
      codigo: 'RED_MINIMO_NODOS',
      severidad: 'error',
      mensaje: `La red tiene ${nodos.length} nodo(s); el mínimo requerido es ${MIN_NODOS_RED} nodos.`,
      detalles: { cantidad: nodos.length, minimo: MIN_NODOS_RED },
    });
  } else if (nodos.length > MAX_NODOS_RED) {
    problemas.push({
      codigo: 'RED_MAXIMO_NODOS',
      severidad: 'error',
      mensaje: `La red tiene ${nodos.length} nodos; el máximo permitido es ${MAX_NODOS_RED} nodos.`,
      detalles: { cantidad: nodos.length, maximo: MAX_NODOS_RED },
    });
  }
  return problemas;
}

/**
 * Valida la Tabla de Probabilidad Condicional (CPT) de un nodo frente a sus estados y los dominios de sus padres.
 */
export function validarCptNodo(
  nodo: NodoBayes,
  nodosPorId: ReadonlyMap<IdNodo, NodoBayes>,
  epsilon: number = EPSILON_SUMA_PROBABILIDAD,
): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];

  if (nodo.estados.length < 2) {
    return problemas;
  }

  const dominiosPadres: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const idPadre of nodo.padres) {
    const nodoPadre = nodosPorId.get(idPadre);
    if (!nodoPadre || nodoPadre.estados.length < 2) {
      // No se pueden validar combinaciones de la CPT hasta que las referencias y estados de los padres sean válidos
      return problemas;
    }
    dominiosPadres[idPadre] = nodoPadre.estados;
  }

  const combinacionesEsperadas = generarCombinacionesPadres(nodo.padres, dominiosPadres);
  if (nodo.cpt.length !== combinacionesEsperadas.length) {
    problemas.push({
      codigo: 'CPT_CONTEO_FILAS_INVALIDO',
      severidad: 'error',
      idNodo: nodo.id,
      mensaje: `La CPT del nodo "${nodo.id}" tiene ${nodo.cpt.length} fila(s), pero debe tener exactamente ${combinacionesEsperadas.length} fila(s) según la cardinalidad de sus padres.`,
      detalles: {
        filasActuales: nodo.cpt.length,
        filasEsperadas: combinacionesEsperadas.length,
      },
    });
  }

  const clavesVistas = new Set<string>();
  const clavesValidas = new Set(
    combinacionesEsperadas.map((combinacion) =>
      construirClaveAsignacion(nodo.padres, combinacion),
    ),
  );

  for (let indiceFila = 0; indiceFila < nodo.cpt.length; indiceFila += 1) {
    const fila = nodo.cpt[indiceFila]!;
    const clavesCuando = Object.keys(fila.cuando);

    const tieneClavesExactasPadres =
      clavesCuando.length === nodo.padres.length &&
      nodo.padres.every((padre) =>
        Object.prototype.hasOwnProperty.call(fila.cuando, padre),
      );

    const claveFila = construirClaveAsignacion(nodo.padres, fila.cuando);
    if (
      !tieneClavesExactasPadres ||
      !clavesValidas.has(claveFila) ||
      clavesVistas.has(claveFila)
    ) {
      problemas.push({
        codigo: 'CPT_COMBINACION_FALTANTE',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `La fila #${indiceFila + 1} de la CPT de "${nodo.id}" contiene una combinación de padres inválida o duplicada.`,
        detalles: { indiceFila, cuando: fila.cuando },
      });
    } else {
      clavesVistas.add(claveFila);
    }

    let sumaFila = 0;
    let tieneErrorRangoOEstadoFaltante = false;

    const clavesProbabilidades = Object.keys(fila.probabilidades);
    if (clavesProbabilidades.length !== nodo.estados.length) {
      tieneErrorRangoOEstadoFaltante = true;
      problemas.push({
        codigo: 'CPT_PROBABILIDAD_FUERA_DE_RANGO',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `La fila #${indiceFila + 1} de la CPT de "${nodo.id}" no declara probabilidades exactas para todos sus estados (${nodo.estados.join(', ')}).`,
        detalles: {
          indiceFila,
          estadosDeclarados: clavesProbabilidades,
          estadosEsperados: nodo.estados,
        },
      });
    }

    for (const estado of nodo.estados) {
      const probabilidad = fila.probabilidades[estado];
      if (
        probabilidad === undefined ||
        !Number.isFinite(probabilidad) ||
        probabilidad < 0 ||
        probabilidad > 1
      ) {
        tieneErrorRangoOEstadoFaltante = true;
        problemas.push({
          codigo: 'CPT_PROBABILIDAD_FUERA_DE_RANGO',
          severidad: 'error',
          idNodo: nodo.id,
          mensaje: `En el nodo "${nodo.id}" (fila #${indiceFila + 1}, estado "${estado}"), la probabilidad ${String(probabilidad)} debe estar en el rango [0, 1].`,
          detalles: { indiceFila, estado, probabilidad },
        });
      } else {
        sumaFila += probabilidad;
      }
    }

    if (!tieneErrorRangoOEstadoFaltante && Math.abs(sumaFila - 1.0) > epsilon) {
      problemas.push({
        codigo: 'CPT_SUMA_FILA_INVALIDA',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `En el nodo "${nodo.id}" (fila #${indiceFila + 1}), las probabilidades suman ${sumaFila.toFixed(6)} en lugar de 1.0 (tolerancia ±${epsilon}).`,
        detalles: { indiceFila, suma: sumaFila, cuando: fila.cuando },
      });
    }
  }

  for (const esperada of combinacionesEsperadas) {
    const clave = construirClaveAsignacion(nodo.padres, esperada);
    if (!clavesVistas.has(clave)) {
      const descripcion = nodo.padres
        .map((padre) => `${padre}=${esperada[padre]}`)
        .join(', ');
      problemas.push({
        codigo: 'CPT_COMBINACION_FALTANTE',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `Falta en la CPT de "${nodo.id}" la combinación condicional (${descripcion || 'raíz'}).`,
        detalles: { combinacionFaltante: esperada },
      });
    }
  }

  return problemas;
}

/**
 * Valida las invariantes de dominio de una Red Bayesiana:
 * conteo de nodos [3..10], identificadores únicos válidos, >= 2 estados únicos por nodo,
 * referencias de padres existentes y distribuciones de probabilidad válidas en cada CPT.
 */
export function validarDominioRed(
  red: RedBayesiana,
  epsilon: number = EPSILON_SUMA_PROBABILIDAD,
): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [...validarConteoNodos(red.nodos)];

  const nodosPorId = new Map<IdNodo, NodoBayes>();
  for (const nodo of red.nodos) {
    if (!REGEX_ID_NODO_VALIDO.test(nodo.id)) {
      problemas.push({
        codigo: 'ID_NODO_INVALIDO',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `El identificador "${nodo.id}" no es válido; debe iniciar con letra y contener solo caracteres alfanuméricos o guion bajo.`,
      });
    }

    if (nodosPorId.has(nodo.id)) {
      problemas.push({
        codigo: 'ID_NODO_DUPLICADO',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `Existe más de un nodo con el identificador "${nodo.id}".`,
      });
    } else {
      nodosPorId.set(nodo.id, nodo);
    }

    const estadosRecortados = nodo.estados
      .map((estado) => estado.trim())
      .filter((estado) => estado.length > 0);
    const estadosUnicos = new Set(estadosRecortados);
    if (
      nodo.estados.length < 2 ||
      estadosRecortados.length !== nodo.estados.length ||
      estadosUnicos.size !== nodo.estados.length
    ) {
      problemas.push({
        codigo: 'ESTADOS_NODO_INVALIDOS',
        severidad: 'error',
        idNodo: nodo.id,
        mensaje: `El nodo "${nodo.id}" debe declarar al menos 2 estados únicos no vacíos.`,
        detalles: { estados: nodo.estados },
      });
    }
  }

  for (const nodo of red.nodos) {
    const padresVistos = new Set<IdNodo>();
    for (const idPadre of nodo.padres) {
      if (padresVistos.has(idPadre)) {
        problemas.push({
          codigo: 'ID_PADRE_DUPLICADO',
          severidad: 'error',
          idNodo: nodo.id,
          mensaje: `El nodo "${nodo.id}" declara al padre "${idPadre}" más de una vez.`,
        });
      }
      padresVistos.add(idPadre);

      if (idPadre === nodo.id) {
        problemas.push({
          codigo: 'CICLO_DAG_DETECTADO',
          severidad: 'error',
          idNodo: nodo.id,
          mensaje: `Auto-bucle detectado: el nodo "${nodo.id}" no puede ser padre de sí mismo.`,
          detalles: { ciclo: [nodo.id, nodo.id] },
        });
      } else if (!nodosPorId.has(idPadre)) {
        problemas.push({
          codigo: 'ID_PADRE_DESCONOCIDO',
          severidad: 'error',
          idNodo: nodo.id,
          mensaje: `El nodo "${nodo.id}" referencia a un padre inexistente "${idPadre}".`,
          detalles: { idPadreDesconocido: idPadre },
        });
      }
    }

    problemas.push(...validarCptNodo(nodo, nodosPorId, epsilon));
  }

  return problemas;
}
