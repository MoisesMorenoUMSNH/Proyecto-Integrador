import {
  construirClaveAsignacion,
  generarCombinacionesPadres,
  obtenerProbabilidadCondicional,
} from '../dominio/cpt';
import type {
  AsignacionVariables,
  IdNodo,
  NodoBayes,
  RedBayesiana,
  ValorEstado,
} from '../dominio/tipos';
import type { Factor, FilaFactor, ResultadoOperacionEliminacion } from './tipos';

/**
 * Formatea valores numéricos respetando la convención académica de los apuntes del Prof. Mauricio Reyes:
 * - Por defecto 4 decimales (ej. 0.3000, 0.0960).
 * - Para probabilidades positivas muy pequeñas < 10^(-(decimales - 1)) (como 0.000991106 en el Ej. 5.1),
 *   conserva 3 cifras significativas en notación decimal fija ("0.000991") en lugar de truncar a "0.0010" o "0.0000".
 */
export function formatearNumeroAcademico(valor: number, decimales: number = 4): string {
  if (!Number.isFinite(valor)) {
    return String(valor);
  }
  const absoluto = Math.abs(valor);
  if (absoluto === 0) {
    return (0).toFixed(decimales);
  }
  if (absoluto < 1e-10) {
    return valor.toExponential(4);
  }
  const umbral = 10 ** -(decimales - 1);
  if (absoluto < umbral) {
    const cerosIniciales = Math.max(0, Math.floor(-Math.log10(absoluto)));
    const decimalesAdaptativos = Math.min(10, cerosIniciales + 3);
    const formateado = valor.toFixed(decimalesAdaptativos).replace(/0+$/, '');
    return formateado.endsWith('.') ? formateado.slice(0, -1) : formateado;
  }
  return valor.toFixed(decimales);
}

/**
 * Ordena una lista de variables conforme a `ordenCanonico` cuando se proporciona,
 * anexando al final cualquier variable adicional en su orden original de aparición.
 */
function ordenarVariablesCanonicamente(
  variables: readonly IdNodo[],
  ordenCanonico?: readonly IdNodo[],
): IdNodo[] {
  const unicas = Array.from(new Set(variables));
  if (!ordenCanonico || ordenCanonico.length === 0) {
    return unicas;
  }
  const rango = new Map<IdNodo, number>();
  ordenCanonico.forEach((id, indice) => rango.set(id, indice));

  return [...unicas].sort((a, b) => {
    const rangoA = rango.get(a);
    const rangoB = rango.get(b);
    if (rangoA !== undefined && rangoB !== undefined) return rangoA - rangoB;
    if (rangoA !== undefined) return -1;
    if (rangoB !== undefined) return 1;
    return 0;
  });
}

function construirMapaBusquedaFactor(factor: Factor): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const fila of factor.filas) {
    mapa.set(construirClaveAsignacion(factor.variables, fila.asignacion), fila.valor);
  }
  return mapa;
}

/**
 * Proyecta una asignación (posiblemente sobre un superconjunto de variables) al subconjunto `variables`.
 */
function proyectarAsignacion(
  variables: readonly IdNodo[],
  asignacion: AsignacionVariables,
): AsignacionVariables {
  const proyectada: Record<IdNodo, ValorEstado> = {};
  for (const variable of variables) {
    const valor = asignacion[variable];
    if (valor === undefined) {
      throw new Error(`Falta el valor de la variable "${variable}" al evaluar el factor.`);
    }
    proyectada[variable] = valor;
  }
  return proyectada;
}

/**
 * Evalúa un factor sobre cualquier asignación que contenga a `factor.variables`
 * (incluyendo factores constantes escalares donde `variables = []`).
 */
export function obtenerValorFactor(
  factor: Factor,
  asignacion: AsignacionVariables,
): number {
  if (factor.variables.length === 0) {
    return factor.filas[0]?.valor ?? 1;
  }
  const claveObjetivo = construirClaveAsignacion(factor.variables, asignacion);
  for (const fila of factor.filas) {
    if (construirClaveAsignacion(factor.variables, fila.asignacion) === claveObjetivo) {
      return fila.valor;
    }
  }
  throw new Error(
    `No se encontró una fila compatible en el factor "${factor.id}" para la asignación solicitada.`,
  );
}

/**
 * Convierte la CPT P(X_i | Pa(X_i)) de un nodo en su factor inicial f_{X_i},
 * ordenando sus variables canónicamente según `red.nodos` para que las columnas coincidan con las tablas de clase.
 */
export function cptAFactor(nodo: NodoBayes, red: RedBayesiana): Factor {
  const ordenCanonico = red.nodos.map((n) => n.id);
  const nodosPorId = new Map(red.nodos.map((n) => [n.id, n]));

  const variablesAlcance = ordenarVariablesCanonicamente(
    [...nodo.padres, nodo.id],
    ordenCanonico,
  );

  const dominios: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const variable of variablesAlcance) {
    const nodoVariable = nodosPorId.get(variable);
    if (!nodoVariable) {
      throw new Error(
        `Variable "${variable}" no encontrada en la red al construir f_${nodo.id}.`,
      );
    }
    dominios[variable] = nodoVariable.estados;
  }

  const asignaciones = generarCombinacionesPadres(variablesAlcance, dominios);
  const filas: FilaFactor[] = asignaciones.map((asignacion) => ({
    asignacion,
    valor: obtenerProbabilidadCondicional(nodo, asignacion),
  }));

  const etiquetaOrigen =
    nodo.padres.length > 0
      ? `P(${nodo.id} | ${nodo.padres.join(', ')})`
      : `P(${nodo.id})`;

  return {
    id: `f_${nodo.id}`,
    etiquetaOrigen,
    variables: variablesAlcance,
    dominios,
    filas,
  };
}

/**
 * Operación Elemental sobre Factores 1: `restringirFactor(factor, variable, valorObservado)`
 * Conserva únicamente las filas compatibles con `variable = valorObservado` y elimina `variable` del alcance.
 * Si un factor univariado es restringido, se convierte en un factor constante escalar válido (`variables = []`).
 */
export function restringirFactor(
  factor: Factor,
  variable: IdNodo,
  valorObservado: ValorEstado,
): Factor {
  if (!factor.variables.includes(variable)) {
    return factor;
  }

  const estadosPermitidos = factor.dominios[variable];
  if (!estadosPermitidos || !estadosPermitidos.includes(valorObservado)) {
    throw new Error(
      `El valor observado "${valorObservado}" no pertenece al dominio de "${variable}" en el factor "${factor.id}".`,
    );
  }

  const siguientesVariables = factor.variables.filter((v) => v !== variable);
  const siguientesDominios: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const v of siguientesVariables) {
    siguientesDominios[v] = factor.dominios[v]!;
  }

  const siguientesFilas: FilaFactor[] = factor.filas
    .filter((fila) => fila.asignacion[variable] === valorObservado)
    .map((fila) => ({
      asignacion: proyectarAsignacion(siguientesVariables, fila.asignacion),
      valor: fila.valor,
    }));

  const nuevaEtiqueta = factor.etiquetaOrigen.includes('restringido a')
    ? `${factor.etiquetaOrigen}, ${variable}=${valorObservado}`
    : `${factor.etiquetaOrigen} restringido a ${variable}=${valorObservado}`;

  return {
    id: factor.id,
    etiquetaOrigen: nuevaEtiqueta,
    variables: siguientesVariables,
    dominios: siguientesDominios,
    filas: siguientesFilas,
  };
}

/**
 * Operación Elemental sobre Factores 2: `multiplicarFactores(factorA, factorB, ordenCanonico?)`
 * Producto punto a punto sobre la unión de alcances Z = vars(A) ∪ vars(B) emparejando asignaciones compatibles.
 */
export function multiplicarFactores(
  factorA: Factor,
  factorB: Factor,
  ordenCanonico?: readonly IdNodo[],
): Factor {
  const variablesUnion = ordenarVariablesCanonicamente(
    [...factorA.variables, ...factorB.variables],
    ordenCanonico,
  );

  const dominiosUnion: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const variable of variablesUnion) {
    const dominio = factorA.dominios[variable] ?? factorB.dominios[variable];
    if (!dominio) {
      throw new Error(
        `No se encontró dominio para la variable "${variable}" al multiplicar factores.`,
      );
    }
    dominiosUnion[variable] = dominio;
  }

  const mapaA = construirMapaBusquedaFactor(factorA);
  const mapaB = construirMapaBusquedaFactor(factorB);
  const asignaciones = generarCombinacionesPadres(variablesUnion, dominiosUnion);

  const filas: FilaFactor[] = asignaciones.map((asignacion) => {
    const valorA = mapaA.get(construirClaveAsignacion(factorA.variables, asignacion))!;
    const valorB = mapaB.get(construirClaveAsignacion(factorB.variables, asignacion))!;
    return {
      asignacion,
      valor: valorA * valorB,
      textoCalculo: `${formatearNumeroAcademico(valorA)} · ${formatearNumeroAcademico(valorB)}`,
    };
  });

  return {
    id: `${factorA.id}·${factorB.id}`,
    etiquetaOrigen: `${factorA.id} · ${factorB.id}`,
    variables: variablesUnion,
    dominios: dominiosUnion,
    filas,
  };
}

/**
 * Operación Elemental sobre Factores 3: `marginalizarFactor(factor, variable)`
 * Suma todos los estados discretos de `variable` produciendo un nuevo factor sin `variable` en su alcance.
 */
export function marginalizarFactor(
  factor: Factor,
  variable: IdNodo,
  nuevoId?: string,
): Factor {
  if (!factor.variables.includes(variable)) {
    throw new Error(
      `No se puede marginalizar "${variable}" porque no pertenece al alcance del factor "${factor.id}".`,
    );
  }

  const estadosVariable = factor.dominios[variable]!;
  const variablesRestantes = factor.variables.filter((v) => v !== variable);
  const dominiosRestantes: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const v of variablesRestantes) {
    dominiosRestantes[v] = factor.dominios[v]!;
  }

  const mapaBusqueda = construirMapaBusquedaFactor(factor);
  const asignacionesDestino = generarCombinacionesPadres(
    variablesRestantes,
    dominiosRestantes,
  );

  const filas: FilaFactor[] = asignacionesDestino.map((asignacionBase) => {
    let suma = 0;
    const sumandos: string[] = [];

    for (const estado of estadosVariable) {
      const extendida: AsignacionVariables = { ...asignacionBase, [variable]: estado };
      const valor = mapaBusqueda.get(
        construirClaveAsignacion(factor.variables, extendida),
      )!;
      suma += valor;
      sumandos.push(formatearNumeroAcademico(valor));
    }

    return {
      asignacion: asignacionBase,
      valor: suma,
      textoCalculo: sumandos.join(' + '),
    };
  });

  return {
    id: nuevoId ?? `sum_${variable}(${factor.id})`,
    etiquetaOrigen: `∑_${variable} ${factor.id}`,
    variables: variablesRestantes,
    dominios: dominiosRestantes,
    filas,
  };
}

/**
 * Operador Académico Suma-Producto para el Paso 5.k:
 * Multiplica los m >= 1 factores que contienen a `variable` y marginaliza `variable` en una sola pasada exacta
 * para que `textoCalculo` coincida fila por fila con las tablas del Prof. Mauricio Reyes incluso cuando m >= 3,
 * contabilizando con precisión las multiplicaciones escalares ejecutadas:
 *   multiplicaciones = (m >= 2) ? |filas(g_k)| * |estados(Z_k)| * (m - 1) : 0
 */
export function eliminarVariableConTraza(
  factoresConZ: readonly Factor[],
  variable: IdNodo,
  indicePaso: number,
  ordenCanonico?: readonly IdNodo[],
): ResultadoOperacionEliminacion {
  if (factoresConZ.length === 0) {
    throw new Error(
      `No hay factores que contengan a la variable "${variable}" en el paso 5.${indicePaso}.`,
    );
  }

  const variablesPreviasMarginalizacion = ordenarVariablesCanonicamente(
    factoresConZ.flatMap((factor) => factor.variables),
    ordenCanonico,
  );

  if (!variablesPreviasMarginalizacion.includes(variable)) {
    throw new Error(
      `La variable "${variable}" no aparece en los factores seleccionados para el paso 5.${indicePaso}.`,
    );
  }

  const todosLosDominios: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const v of variablesPreviasMarginalizacion) {
    const propietario = factoresConZ.find((factor) => factor.dominios[v] !== undefined);
    if (!propietario) {
      throw new Error(
        `Dominio no encontrado para "${v}" durante eliminación de "${variable}".`,
      );
    }
    todosLosDominios[v] = propietario.dominios[v]!;
  }

  const estadosZ = todosLosDominios[variable]!;
  const variablesSalida = variablesPreviasMarginalizacion.filter((v) => v !== variable);
  const dominiosSalida: Record<IdNodo, readonly ValorEstado[]> = {};
  for (const v of variablesSalida) {
    dominiosSalida[v] = todosLosDominios[v]!;
  }

  const mapasBusqueda = factoresConZ.map((factor) => ({
    variables: factor.variables,
    mapa: construirMapaBusquedaFactor(factor),
  }));

  const asignacionesSalida = generarCombinacionesPadres(variablesSalida, dominiosSalida);
  const m = factoresConZ.length;

  const filas: FilaFactor[] = asignacionesSalida.map((asignacionSalida) => {
    let sumaTotal = 0;
    const terminosSumaTexto: string[] = [];

    for (const valorZ of estadosZ) {
      const asignacionCompleta: AsignacionVariables = {
        ...asignacionSalida,
        [variable]: valorZ,
      };
      let valorProducto = 1;
      const factoresProductoTexto: string[] = [];

      for (const elemento of mapasBusqueda) {
        const valor = elemento.mapa.get(
          construirClaveAsignacion(elemento.variables, asignacionCompleta),
        )!;
        valorProducto *= valor;
        factoresProductoTexto.push(formatearNumeroAcademico(valor));
      }

      sumaTotal += valorProducto;
      terminosSumaTexto.push(factoresProductoTexto.join(' · '));
    }

    return {
      asignacion: asignacionSalida,
      valor: sumaTotal,
      textoCalculo: terminosSumaTexto.join(' + '),
    };
  });

  const multiplicaciones =
    m >= 2 ? asignacionesSalida.length * estadosZ.length * (m - 1) : 0;
  const nombresFactores = factoresConZ.map((factor) => factor.id).join(' · ');

  return {
    factor: {
      id: `g_${indicePaso}`,
      etiquetaOrigen: `∑_${variable} ${nombresFactores}`,
      variables: variablesSalida,
      dominios: dominiosSalida,
      filas,
    },
    multiplicaciones,
    variablesPreviasMarginalizacion,
  };
}

/**
 * Operador de Producto Final del Paso 6:
 * Multiplica todos los factores restantes (que dependen solo de subconjuntos de Q o son constantes escalares)
 * sobre el producto cartesiano completo de Q, registrando la traza aritmética y el conteo de multiplicaciones.
 */
export function multiplicarFactoresFinalesConTraza(
  factoresRestantes: readonly Factor[],
  variablesConsulta: readonly IdNodo[],
  dominiosConsulta: Readonly<Record<IdNodo, readonly ValorEstado[]>>,
): { readonly factor: Factor; readonly multiplicaciones: number } {
  const asignacionesConsulta = generarCombinacionesPadres(
    variablesConsulta,
    dominiosConsulta,
  );
  const mapasBusqueda = factoresRestantes.map((factor) => ({
    variables: factor.variables,
    mapa: construirMapaBusquedaFactor(factor),
  }));

  const filas: FilaFactor[] = asignacionesConsulta.map((asignacionQ) => {
    if (mapasBusqueda.length === 0) {
      return {
        asignacion: asignacionQ,
        valor: 1,
        textoCalculo: '1.0000',
      };
    }

    let producto = 1;
    const partesTexto: string[] = [];
    for (const elemento of mapasBusqueda) {
      const valor = elemento.mapa.get(
        construirClaveAsignacion(elemento.variables, asignacionQ),
      )!;
      producto *= valor;
      partesTexto.push(formatearNumeroAcademico(valor));
    }

    return {
      asignacion: asignacionQ,
      valor: producto,
      textoCalculo: partesTexto.join(' · '),
    };
  });

  const r = factoresRestantes.length;
  const multiplicaciones = r >= 2 ? asignacionesConsulta.length * (r - 1) : 0;

  return {
    factor: {
      id: 'f_final',
      etiquetaOrigen: factoresRestantes.map((factor) => factor.id).join(' · ') || '1',
      variables: [...variablesConsulta],
      dominios: { ...dominiosConsulta },
      filas,
    },
    multiplicaciones,
  };
}
