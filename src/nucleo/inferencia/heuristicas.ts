import type { IdNodo, RedBayesiana } from '../dominio/tipos';
import type { Factor } from '../factor/tipos';
import { obtenerMapaHijos, obtenerOrdenTopologico } from '../grafo/dag';
import type {
  EstrategiaEliminacion,
  MetricaAlcancePaso,
  MetricasSimulacionOrden,
} from './tipos';

/**
 * Construye un grafo no dirigido de interacción sobre todas las variables activas que coexisten en `alcances`.
 */
function construirGrafoInteraccion(
  alcances: readonly (readonly IdNodo[])[],
): Map<IdNodo, Set<IdNodo>> {
  const adyacencia = new Map<IdNodo, Set<IdNodo>>();

  for (const alcance of alcances) {
    for (const u of alcance) {
      if (!adyacencia.has(u)) {
        adyacencia.set(u, new Set<IdNodo>());
      }
    }
    for (let i = 0; i < alcance.length; i += 1) {
      const u = alcance[i]!;
      for (let j = i + 1; j < alcance.length; j += 1) {
        const v = alcance[j]!;
        if (u !== v) {
          adyacencia.get(u)!.add(v);
          adyacencia.get(v)!.add(u);
        }
      }
    }
  }

  return adyacencia;
}

/**
 * Cuenta cuántas aristas de relleno nuevas se agregarían entre los vecinos de `candidato` al eliminarlo.
 */
function contarAristasRelleno(
  adyacencia: ReadonlyMap<IdNodo, ReadonlySet<IdNodo>>,
  candidato: IdNodo,
): number {
  const vecinos = Array.from(adyacencia.get(candidato) ?? []);
  let relleno = 0;
  for (let i = 0; i < vecinos.length; i += 1) {
    const vecinosU = adyacencia.get(vecinos[i]!);
    for (let j = i + 1; j < vecinos.length; j += 1) {
      if (!vecinosU?.has(vecinos[j]!)) {
        relleno += 1;
      }
    }
  }
  return relleno;
}

/**
 * Calcula un orden de eliminación π sobre `variablesOcultas` mediante una de las 3 estrategias automáticas:
 * - `minimo-relleno`: minimiza aristas nuevas añadidas al grafo de interacción (desempate: mínimo grado, peso de estados, topológico).
 * - `minimo-grado`: minimiza la cantidad de vecinos en el grafo de interacción (desempate: peso de estados, mínimo relleno, topológico).
 * - `practico-clase`: regla práctica del curso (raíces con <= 1 hijo y variables presentes en <= 2 factores con alcance pequeño primero).
 */
export function calcularOrdenEliminacion(
  red: RedBayesiana,
  factoresIniciales: readonly Factor[],
  variablesOcultas: readonly IdNodo[],
  estrategia: Exclude<EstrategiaEliminacion, 'manual'>,
): IdNodo[] {
  if (variablesOcultas.length <= 1) {
    return [...variablesOcultas];
  }

  const cardinalidades = new Map<IdNodo, number>(
    red.nodos.map((nodo) => [nodo.id, nodo.estados.length]),
  );
  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const mapaHijos = obtenerMapaHijos(red.nodos);

  const ordenTopo = obtenerOrdenTopologico(red.nodos);
  const rangoTopologico = new Map<IdNodo, number>(
    ordenTopo.map((id, indice) => [id, indice]),
  );

  let alcancesActivos: IdNodo[][] = factoresIniciales.map((factor) => [
    ...factor.variables,
  ]);
  const restantes = new Set<IdNodo>(variablesOcultas);
  const orden: IdNodo[] = [];

  while (restantes.size > 0) {
    const adyacencia = construirGrafoInteraccion(alcancesActivos);
    for (const oculta of restantes) {
      if (!adyacencia.has(oculta)) {
        adyacencia.set(oculta, new Set<IdNodo>());
      }
    }

    const candidatos = Array.from(restantes);
    candidatos.sort((a, b) => {
      const vecinosA = Array.from(adyacencia.get(a) ?? []);
      const vecinosB = Array.from(adyacencia.get(b) ?? []);
      const gradoA = vecinosA.length;
      const gradoB = vecinosB.length;
      const rellenoA = contarAristasRelleno(adyacencia, a);
      const rellenoB = contarAristasRelleno(adyacencia, b);

      const pesoA =
        (cardinalidades.get(a) ?? 2) *
        vecinosA.reduce((acum, vecino) => acum * (cardinalidades.get(vecino) ?? 2), 1);
      const pesoB =
        (cardinalidades.get(b) ?? 2) *
        vecinosB.reduce((acum, vecino) => acum * (cardinalidades.get(vecino) ?? 2), 1);

      if (estrategia === 'minimo-relleno') {
        if (rellenoA !== rellenoB) return rellenoA - rellenoB;
        if (gradoA !== gradoB) return gradoA - gradoB;
        if (pesoA !== pesoB) return pesoA - pesoB;
      } else if (estrategia === 'minimo-grado') {
        if (gradoA !== gradoB) return gradoA - gradoB;
        if (pesoA !== pesoB) return pesoA - pesoB;
        if (rellenoA !== rellenoB) return rellenoA - rellenoB;
      } else {
        // practico-clase: priorizar variables en <= 2 factores y alcance pequeño creado,
        // favoreciendo raíces con un solo hijo o extremos de cadena
        const cantidadFactoresA = alcancesActivos.filter((alcance) =>
          alcance.includes(a),
        ).length;
        const cantidadFactoresB = alcancesActivos.filter((alcance) =>
          alcance.includes(b),
        ).length;
        const esExtremoSimpleA =
          ((nodosPorId.get(a)?.padres.length ?? 0) === 0 &&
            (mapaHijos.get(a)?.length ?? 0) <= 1) ||
          cantidadFactoresA <= 2
            ? 0
            : 1;
        const esExtremoSimpleB =
          ((nodosPorId.get(b)?.padres.length ?? 0) === 0 &&
            (mapaHijos.get(b)?.length ?? 0) <= 1) ||
          cantidadFactoresB <= 2
            ? 0
            : 1;

        if (gradoA !== gradoB) return gradoA - gradoB;
        if (esExtremoSimpleA !== esExtremoSimpleB) {
          return esExtremoSimpleA - esExtremoSimpleB;
        }
        if (cantidadFactoresA !== cantidadFactoresB) {
          return cantidadFactoresA - cantidadFactoresB;
        }
        if (rellenoA !== rellenoB) return rellenoA - rellenoB;
      }

      return (rangoTopologico.get(a) ?? 0) - (rangoTopologico.get(b) ?? 0);
    });

    const elegida = candidatos[0]!;
    orden.push(elegida);
    restantes.delete(elegida);

    const conElegida = alcancesActivos.filter((alcance) => alcance.includes(elegida));
    const sinElegida = alcancesActivos.filter((alcance) => !alcance.includes(elegida));
    const nuevoAlcance = Array.from(new Set(conElegida.flat())).filter(
      (v) => v !== elegida,
    );
    alcancesActivos = [...sinElegida, nuevoAlcance];
  }

  return orden;
}

/**
 * Simula un orden de eliminación π sin materializar tablas completas de factores,
 * devolviendo los tamaños exactos de factor creado por paso, ancho máximo inducido y conteo exacto de multiplicaciones.
 */
export function simularOrdenEliminacion(
  red: RedBayesiana,
  factoresIniciales: readonly Factor[],
  variablesConsulta: readonly IdNodo[],
  orden: readonly IdNodo[],
  estrategia: EstrategiaEliminacion,
): MetricasSimulacionOrden {
  const cardinalidades = new Map<IdNodo, number>(
    red.nodos.map((nodo) => [nodo.id, nodo.estados.length]),
  );

  let alcancesActivos: IdNodo[][] = factoresIniciales.map((factor) => [
    ...factor.variables,
  ]);
  let maxTamanoAlcanceFactorFormado = Math.max(
    variablesConsulta.length,
    ...alcancesActivos.map((alcance) => alcance.length),
  );
  let maxTamanoAlcanceFactorCreado = 0;
  let totalMultiplicaciones = 0;
  const pasos: MetricaAlcancePaso[] = [];

  for (const variable of orden) {
    const conZ = alcancesActivos.filter((alcance) => alcance.includes(variable));
    const sinZ = alcancesActivos.filter((alcance) => !alcance.includes(variable));

    const variablesUnion = Array.from(new Set(conZ.flat()));
    const variablesCreadas = variablesUnion.filter((v) => v !== variable);

    const filasSalida = variablesCreadas.reduce(
      (acum, v) => acum * (cardinalidades.get(v) ?? 2),
      1,
    );
    const cantidadEstadosZ = cardinalidades.get(variable) ?? 2;
    const m = conZ.length;
    const multiplicacionesPaso = m >= 2 ? filasSalida * cantidadEstadosZ * (m - 1) : 0;

    maxTamanoAlcanceFactorFormado = Math.max(
      maxTamanoAlcanceFactorFormado,
      variablesUnion.length,
    );
    maxTamanoAlcanceFactorCreado = Math.max(
      maxTamanoAlcanceFactorCreado,
      variablesCreadas.length,
    );
    totalMultiplicaciones += multiplicacionesPaso;

    pasos.push({
      variable,
      tamanoAlcanceCreado: variablesCreadas.length,
      tamanoAlcancePrevioSuma: variablesUnion.length,
      cantidadFactoresInvolucrados: m,
      multiplicaciones: multiplicacionesPaso,
    });

    alcancesActivos = [...sinZ, variablesCreadas];
  }

  const filasConsulta = variablesConsulta.reduce(
    (acum, idQ) => acum * (cardinalidades.get(idQ) ?? 2),
    1,
  );
  const r = alcancesActivos.length;
  const multiplicacionesPaso6 = r >= 2 ? filasConsulta * (r - 1) : 0;
  totalMultiplicaciones += multiplicacionesPaso6;

  return {
    estrategia,
    orden: [...orden],
    pasos,
    maxTamanoAlcanceFactorCreado,
    maxTamanoAlcanceFactorFormado,
    totalMultiplicaciones,
  };
}
