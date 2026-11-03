import { construirClaveAsignacion } from '../dominio/cpt';
import type {
  AsignacionVariables,
  IdNodo,
  NodoBayes,
  ProblemaValidacion,
  RedBayesiana,
  ValorEstado,
} from '../dominio/tipos';
import {
  cptAFactor,
  eliminarVariableConTraza,
  multiplicarFactoresFinalesConTraza,
  restringirFactor,
} from '../factor/operaciones';
import type { Factor } from '../factor/tipos';
import { validarRedBayesiana } from '../grafo/dag';
import {
  estaMantaMarkovCompletamenteObservada,
  formatearVariableLatex,
} from '../grafo/mantaMarkov';
import { podarNodosIrrelevantes } from '../grafo/poda';
import { clasificarTipoInferencia } from '../grafo/tipoInferencia';
import { enumeracionConjuntaCompleta } from './enumeracionCompleta';
import { calcularOrdenEliminacion, simularOrdenEliminacion } from './heuristicas';
import type {
  EntradaConsulta,
  EntradaFactorInicial,
  EstrategiaEliminacion,
  PasoEliminacion,
  ResultadoConsultaInferencia,
  VerificacionVerdadFundamental,
} from './tipos';

function formatearSimboloFactor(factor: Factor): string {
  const partes = factor.id.split('_');
  const base = partes[0] ?? 'f';
  const subindice = partes.slice(1).join('_');
  const simbolo = subindice ? `${base}_{${formatearVariableLatex(subindice)}}` : base;
  if (factor.variables.length === 0) {
    return simbolo;
  }
  return `${simbolo}(${factor.variables.map(formatearVariableLatex).join(', ')})`;
}

function formatearEtiquetaPlanaFactor(factor: Factor): string {
  if (factor.variables.length === 0) {
    return factor.id;
  }
  return `${factor.id}(${factor.variables.join(', ')})`;
}

function construirLatexConsultaFactorizada(
  nodos: readonly NodoBayes[],
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
  variablesOcultas: readonly IdNodo[],
): string {
  const parteQ = variablesConsulta.map(formatearVariableLatex).join(', ');
  const entradasEvidencia = Object.entries(evidencia);
  const ladoIzquierdo =
    entradasEvidencia.length > 0
      ? `P(${parteQ} \\mid ${entradasEvidencia
          .map(([clave, valor]) => `${formatearVariableLatex(clave)}=\\text{${valor}}`)
          .join(', ')})`
      : `P(${parteQ})`;

  const prefijoSumatoria =
    variablesOcultas.length > 0
      ? `\\sum_{${variablesOcultas.map(formatearVariableLatex).join(', ')}} `
      : '';

  const terminosProducto = nodos
    .map((nodo) =>
      nodo.padres.length > 0
        ? `P(${formatearVariableLatex(nodo.id)} \\mid ${nodo.padres.map(formatearVariableLatex).join(', ')})`
        : `P(${formatearVariableLatex(nodo.id)})`,
    )
    .join(' \\, ');

  return `${ladoIzquierdo} = \\alpha ${prefijoSumatoria}${terminosProducto}`;
}

function validarEntradaConsulta(
  red: RedBayesiana,
  entrada: EntradaConsulta,
): ProblemaValidacion[] {
  const problemas: ProblemaValidacion[] = [];
  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));

  if (entrada.variablesConsulta.length === 0) {
    problemas.push({
      codigo: 'ERROR_VALIDACION_ESQUEMA',
      severidad: 'error',
      mensaje: 'Debe seleccionar al menos una variable de consulta (Q).',
    });
    return problemas;
  }

  const consultasVistas = new Set<IdNodo>();
  for (const idQ of entrada.variablesConsulta) {
    if (consultasVistas.has(idQ)) {
      problemas.push({
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        idNodo: idQ,
        mensaje: `La variable de consulta "${idQ}" está duplicada.`,
      });
    }
    consultasVistas.add(idQ);

    if (!nodosPorId.has(idQ)) {
      problemas.push({
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        idNodo: idQ,
        mensaje: `La variable de consulta "${idQ}" no existe en la red.`,
      });
    }
  }

  for (const [idE, valorE] of Object.entries(entrada.evidencia)) {
    const nodoE = nodosPorId.get(idE);
    if (!nodoE) {
      problemas.push({
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        idNodo: idE,
        mensaje: `La variable de evidencia "${idE}" no existe en la red.`,
      });
      continue;
    }

    if (consultasVistas.has(idE)) {
      problemas.push({
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        idNodo: idE,
        mensaje: `La variable "${idE}" no puede ser simultáneamente variable de consulta y de evidencia.`,
      });
    }

    if (!nodoE.estados.includes(valorE)) {
      problemas.push({
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        idNodo: idE,
        mensaje: `El valor de evidencia "${valorE}" no es un estado válido para el nodo "${idE}" (${nodoE.estados.join(', ')}).`,
      });
    }
  }

  return problemas;
}

/**
 * Ejecuta el Algoritmo Exacto de Eliminación de Variables en sus 6 Pasos Obligatorios
 * conforme a la metodología del curso, verificando automáticamente contra Enumeración de la Conjunta Completa.
 */
export function ejecutarEliminacionVariables(
  red: RedBayesiana,
  entrada: EntradaConsulta,
): ResultadoConsultaInferencia {
  const problemasRed = validarRedBayesiana(red);
  if (problemasRed.length > 0) {
    return { exito: false, errores: problemasRed };
  }

  const problemasConsulta = validarEntradaConsulta(red, entrada);
  if (problemasConsulta.length > 0) {
    return { exito: false, errores: problemasConsulta };
  }

  const ordenCanonicoNodos = red.nodos.map((nodo) => nodo.id);
  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const conjuntoConsulta = new Set(entrada.variablesConsulta);
  const conjuntoEvidencia = new Set(Object.keys(entrada.evidencia));

  // ==========================================================================
  // PASO 1: Plantear la consulta y clasificar el tipo de inferencia
  // ==========================================================================
  const todasVariablesOcultas = ordenCanonicoNodos.filter(
    (id) => !conjuntoConsulta.has(id) && !conjuntoEvidencia.has(id),
  );
  const clasificacion = clasificarTipoInferencia(
    red,
    entrada.variablesConsulta,
    entrada.evidencia,
  );
  const latexSimbolico = construirLatexConsultaFactorizada(
    red.nodos,
    entrada.variablesConsulta,
    entrada.evidencia,
    todasVariablesOcultas,
  );

  // ==========================================================================
  // PASO 2: Podar variables irrelevantes y detectar Manta de Markov
  // ==========================================================================
  const resultadoPoda = podarNodosIrrelevantes(
    red,
    entrada.variablesConsulta,
    entrada.evidencia,
  );
  const latexSimbolicoReducido = construirLatexConsultaFactorizada(
    resultadoPoda.nodosActivos,
    entrada.variablesConsulta,
    entrada.evidencia,
    resultadoPoda.variablesOcultasActivas,
  );
  const atajoMantaMarkov = estaMantaMarkovCompletamenteObservada(
    red,
    entrada.variablesConsulta,
    entrada.evidencia,
  );

  // ==========================================================================
  // PASO 3: Factores iniciales y restricción por evidencia
  // ==========================================================================
  const entradasIniciales: EntradaFactorInicial[] = resultadoPoda.nodosActivos.map(
    (nodo) => {
      let factor = cptAFactor(nodo, red);
      const aplicada: Record<IdNodo, ValorEstado> = {};

      for (const variable of [...factor.variables]) {
        const valorObservado = entrada.evidencia[variable];
        if (valorObservado !== undefined) {
          aplicada[variable] = valorObservado;
          factor = restringirFactor(factor, variable, valorObservado);
        }
      }

      return {
        idNodo: nodo.id,
        evidenciaAplicada: aplicada,
        factor,
        esConstanteEscalar: factor.variables.length === 0,
      };
    },
  );

  const factoresInicialesRestringidos = entradasIniciales.map((elemento) => elemento.factor);

  // ==========================================================================
  // PASO 4: Orden de eliminación (π) y métricas comparativas de ancho (ω)
  // ==========================================================================
  const estrategia: EstrategiaEliminacion = entrada.estrategia ?? 'minimo-relleno';
  const conjuntoOcultasActivas = new Set(resultadoPoda.variablesOcultasActivas);

  let ordenEliminacion: IdNodo[];
  if (estrategia === 'manual') {
    const manualCrudo = entrada.ordenManual ?? [];
    const manualFiltrado = manualCrudo.filter((id) => conjuntoOcultasActivas.has(id));
    const manualUnico = new Set(manualFiltrado);

    if (
      manualFiltrado.length !== resultadoPoda.variablesOcultasActivas.length ||
      manualUnico.size !== resultadoPoda.variablesOcultasActivas.length
    ) {
      return {
        exito: false,
        errores: [
          {
            codigo: 'ERROR_VALIDACION_ESQUEMA',
            severidad: 'error',
            mensaje: `El orden manual [${manualCrudo.join(', ')}] debe contener una permutación exacta de las variables ocultas activas [${resultadoPoda.variablesOcultasActivas.join(', ')}].`,
          },
        ],
      };
    }
    ordenEliminacion = manualFiltrado;
  } else {
    ordenEliminacion = calcularOrdenEliminacion(
      red,
      factoresInicialesRestringidos,
      resultadoPoda.variablesOcultasActivas,
      estrategia,
    );
  }

  const ordenMinimoRelleno = calcularOrdenEliminacion(
    red,
    factoresInicialesRestringidos,
    resultadoPoda.variablesOcultasActivas,
    'minimo-relleno',
  );
  const ordenMinimoGrado = calcularOrdenEliminacion(
    red,
    factoresInicialesRestringidos,
    resultadoPoda.variablesOcultasActivas,
    'minimo-grado',
  );
  const ordenPracticoClase = calcularOrdenEliminacion(
    red,
    factoresInicialesRestringidos,
    resultadoPoda.variablesOcultasActivas,
    'practico-clase',
  );

  const comparaciones = {
    'minimo-relleno': simularOrdenEliminacion(
      red,
      factoresInicialesRestringidos,
      entrada.variablesConsulta,
      ordenMinimoRelleno,
      'minimo-relleno',
    ),
    'minimo-grado': simularOrdenEliminacion(
      red,
      factoresInicialesRestringidos,
      entrada.variablesConsulta,
      ordenMinimoGrado,
      'minimo-grado',
    ),
    'practico-clase': simularOrdenEliminacion(
      red,
      factoresInicialesRestringidos,
      entrada.variablesConsulta,
      ordenPracticoClase,
      'practico-clase',
    ),
  } as const;

  const metricasElegidas = simularOrdenEliminacion(
    red,
    factoresInicialesRestringidos,
    entrada.variablesConsulta,
    ordenEliminacion,
    estrategia,
  );

  // ==========================================================================
  // PASO 5: Ciclo de Eliminación (Suma-Producto)
  // ==========================================================================
  let factoresActuales: Factor[] = [...factoresInicialesRestringidos];
  const subPasos: PasoEliminacion[] = [];
  let multiplicacionesPaso5 = 0;
  let maxAlcanceFormado = Math.max(
    entrada.variablesConsulta.length,
    ...factoresInicialesRestringidos.map((factor) => factor.variables.length),
  );
  let maxAlcanceCreado = 0;

  for (let indice = 0; indice < ordenEliminacion.length; indice += 1) {
    const indicePaso = indice + 1;
    const variableZ = ordenEliminacion[indice]!;
    const factoresConZ = factoresActuales.filter((factor) =>
      factor.variables.includes(variableZ),
    );
    const restantesSinZ = factoresActuales.filter(
      (factor) => !factor.variables.includes(variableZ),
    );

    const resultadoEliminacion = eliminarVariableConTraza(
      factoresConZ,
      variableZ,
      indicePaso,
      ordenCanonicoNodos,
    );

    multiplicacionesPaso5 += resultadoEliminacion.multiplicaciones;
    maxAlcanceFormado = Math.max(
      maxAlcanceFormado,
      resultadoEliminacion.variablesPreviasMarginalizacion.length,
    );
    maxAlcanceCreado = Math.max(
      maxAlcanceCreado,
      resultadoEliminacion.factor.variables.length,
    );

    factoresActuales = [...restantesSinZ, resultadoEliminacion.factor];

    const latexSimbolicoPaso = `${formatearSimboloFactor(resultadoEliminacion.factor)} = \\sum_{${formatearVariableLatex(variableZ)}} ${factoresConZ.map(formatearSimboloFactor).join(' \\cdot ')}`;

    subPasos.push({
      etiquetaSubPaso: `5.${indicePaso}`,
      indicePaso,
      variable: variableZ,
      idsFactoresInvolucrados: factoresConZ.map((factor) => factor.id),
      etiquetasFactoresInvolucrados: factoresConZ.map(formatearEtiquetaPlanaFactor),
      latexSimbolico: latexSimbolicoPaso,
      variablesPreviasMarginalizacion:
        resultadoEliminacion.variablesPreviasMarginalizacion,
      nuevoFactor: resultadoEliminacion.factor,
      multiplicaciones: resultadoEliminacion.multiplicaciones,
      etiquetasFactoresRestantes: factoresActuales.map(formatearEtiquetaPlanaFactor),
    });
  }

  // ==========================================================================
  // PASO 6: Multiplicación final, Normalización y Verificación Ground Truth
  // ==========================================================================
  const dominiosConsulta: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const idQ of entrada.variablesConsulta) {
    dominiosConsulta[idQ] = nodosPorId.get(idQ)!.estados;
  }

  const productoFinal = multiplicarFactoresFinalesConTraza(
    factoresActuales,
    entrada.variablesConsulta,
    dominiosConsulta,
  );

  const factorNoNormalizado = productoFinal.factor;
  const multiplicacionesPaso6 = productoFinal.multiplicaciones;
  const totalMultiplicaciones = multiplicacionesPaso5 + multiplicacionesPaso6;

  const probabilidadEvidencia = factorNoNormalizado.filas.reduce(
    (suma, fila) => suma + fila.valor,
    0,
  );
  const esEvidenciaImposible = probabilidadEvidencia === 0;
  const alfa = esEvidenciaImposible ? null : 1 / probabilidadEvidencia;

  const factorPosterior: Factor = {
    id: `P(${entrada.variablesConsulta.join(', ')}${
      Object.keys(entrada.evidencia).length > 0
        ? ` | ${Object.entries(entrada.evidencia)
            .map(([clave, valor]) => `${clave}=${valor}`)
            .join(', ')}`
        : ''
    })`,
    etiquetaOrigen: 'Distribución posterior normalizada',
    variables: [...entrada.variablesConsulta],
    dominios: dominiosConsulta,
    filas: factorNoNormalizado.filas.map((fila) => ({
      asignacion: fila.asignacion,
      valor: esEvidenciaImposible ? 0 : fila.valor / probabilidadEvidencia,
    })),
  };

  const posteriorPorEstado: Record<ValorEstado, number> = {};
  if (entrada.variablesConsulta.length === 1) {
    const consultaUnica = entrada.variablesConsulta[0]!;
    for (const fila of factorPosterior.filas) {
      posteriorPorEstado[fila.asignacion[consultaUnica]!] = fila.valor;
    }
  } else {
    for (const fila of factorPosterior.filas) {
      const clave = entrada.variablesConsulta
        .map((idQ) => `${idQ}=${fila.asignacion[idQ]}`)
        .join(',');
      posteriorPorEstado[clave] = fila.valor;
    }
  }

  let verdadFundamental: VerificacionVerdadFundamental | undefined;
  if (entrada.verificarConEnumeracionCompleta !== false) {
    const resultadoEnumeracion = enumeracionConjuntaCompleta(
      red,
      entrada.variablesConsulta,
      entrada.evidencia,
    );

    const mapaEnumeracion = new Map<string, number>();
    for (const fila of resultadoEnumeracion.filasPosteriores) {
      mapaEnumeracion.set(
        construirClaveAsignacion(entrada.variablesConsulta, fila.asignacion),
        fila.probabilidad,
      );
    }

    let diferenciaAbsolutaMaxima = 0;
    for (const fila of factorPosterior.filas) {
      const clave = construirClaveAsignacion(entrada.variablesConsulta, fila.asignacion);
      const probabilidadEnum = mapaEnumeracion.get(clave) ?? 0;
      diferenciaAbsolutaMaxima = Math.max(
        diferenciaAbsolutaMaxima,
        Math.abs(fila.valor - probabilidadEnum),
      );
    }

    const multiplicacionesAhorradas =
      resultadoEnumeracion.multiplicaciones - totalMultiplicaciones;
    const porcentajeAhorro =
      resultadoEnumeracion.multiplicaciones > 0
        ? (multiplicacionesAhorradas / resultadoEnumeracion.multiplicaciones) * 100
        : 0;

    verdadFundamental = {
      verificado:
        esEvidenciaImposible === resultadoEnumeracion.esEvidenciaImposible &&
        diferenciaAbsolutaMaxima < 1e-9,
      diferenciaAbsolutaMaxima,
      terminosEnumerados: resultadoEnumeracion.terminosEnumerados,
      multiplicacionesEnumeracion: resultadoEnumeracion.multiplicaciones,
      multiplicacionesEliminacionVariables: totalMultiplicaciones,
      multiplicacionesAhorradas,
      porcentajeAhorro,
      resultadoEnumeracion,
    };
  }

  return {
    exito: true,
    traza: {
      paso1: {
        variablesConsulta: [...entrada.variablesConsulta],
        evidencia: { ...entrada.evidencia },
        todasVariablesOcultas,
        latexSimbolico,
        clasificacion,
      },
      paso2: {
        nodosActivos: resultadoPoda.nodosActivos,
        nodosPodados: resultadoPoda.nodosPodados,
        variablesOcultasActivas: resultadoPoda.variablesOcultasActivas,
        latexSimbolicoReducido,
        atajoMantaMarkov,
      },
      paso3: {
        entradas: entradasIniciales,
      },
      paso4: {
        estrategia,
        ordenEliminacion,
        metricas: metricasElegidas,
        comparaciones,
      },
      paso5: {
        subPasos,
        multiplicacionesPaso5,
      },
      paso6: {
        idsFactoresRestantes: factoresActuales.map((factor) => factor.id),
        etiquetasFactoresRestantes: factoresActuales.map(formatearEtiquetaPlanaFactor),
        factorNoNormalizado,
        multiplicacionesPaso6,
        totalMultiplicaciones,
        maxTamanoAlcanceFactorFormado: maxAlcanceFormado,
        maxTamanoAlcanceFactorCreado: maxAlcanceCreado,
        probabilidadEvidencia,
        alfa,
        esEvidenciaImposible,
        factorPosterior,
        posteriorPorEstado,
        ...(verdadFundamental ? { verdadFundamental } : {}),
      },
    },
  };
}
