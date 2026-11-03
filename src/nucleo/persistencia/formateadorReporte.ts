import type { RedBayesiana } from '../dominio/tipos';
import { formatearNumeroAcademico } from '../factor/operaciones';
import type { Factor } from '../factor/tipos';
import type { TrazaEliminacionVariables } from '../inferencia/tipos';

function renderizarTablaMarkdownFactor(
  factor: Factor,
  encabezadoValor: string,
  incluirCalculo: boolean,
): string {
  if (factor.variables.length === 0) {
    const valor = factor.filas[0]?.valor ?? 1;
    return `> **${factor.id}** = \`${formatearNumeroAcademico(valor)}\` *(factor constante escalar)*`;
  }

  const encabezados = [
    ...factor.variables,
    ...(incluirCalculo ? ['Cálculo'] : []),
    encabezadoValor,
  ];
  const separador = encabezados.map(() => '---');

  const lineas: string[] = [
    `| ${encabezados.join(' | ')} |`,
    `| ${separador.join(' | ')} |`,
  ];

  for (const fila of factor.filas) {
    const celdasVariables = factor.variables.map((v) =>
      String(fila.asignacion[v] ?? ''),
    );
    const celdaCalculo = incluirCalculo ? [`\`${fila.textoCalculo ?? ''}\``] : [];
    const celdaValor = formatearNumeroAcademico(fila.valor);
    lineas.push(`| ${[...celdasVariables, ...celdaCalculo, celdaValor].join(' | ')} |`);
  }

  return lineas.join('\n');
}

/**
 * Generador Puro de Reportes en Markdown para Manual de Usuario, Memoria Técnica y exportación.
 * Formatea la topología completa del DAG, tablas CPT y (cuando se proporciona) la traza completa
 * de 6 pasos de Eliminación de Variables incluyendo factores intermedios g_k y verificación Ground Truth.
 */
export function formatearReporteMarkdown(
  red: RedBayesiana,
  traza?: TrazaEliminacionVariables,
): string {
  const secciones: string[] = [];

  secciones.push(`# Reporte de Red Bayesiana: ${red.metadatos.titulo}`);
  if (red.metadatos.descripcion) {
    secciones.push(`> ${red.metadatos.descripcion}`);
  }

  const elementosMeta: string[] = [`- **ID:** \`${red.metadatos.id}\``];
  if (red.metadatos.dominio) {
    elementosMeta.push(`- **Dominio:** ${red.metadatos.dominio}`);
  }
  if (red.metadatos.autor) {
    elementosMeta.push(`- **Autor:** ${red.metadatos.autor}`);
  }
  elementosMeta.push(`- **Número de nodos:** ${red.nodos.length}`);
  secciones.push(elementosMeta.join('\n'));

  // 1. Diccionario de Variables
  secciones.push('## 1. Estructura del DAG y Diccionario de Variables');
  const lineasDiccionario = [
    '| ID | Nombre | Estados | Padres Directos | Significado |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const nodo of red.nodos) {
    const textoPadres = nodo.padres.length > 0 ? nodo.padres.join(', ') : '—';
    const textoDescripcion = nodo.descripcion ?? nodo.nombre;
    lineasDiccionario.push(
      `| \`${nodo.id}\` | ${nodo.nombre} | ${nodo.estados.join(', ')} | ${textoPadres} | ${textoDescripcion} |`,
    );
  }
  secciones.push(lineasDiccionario.join('\n'));

  // 2. CPTs
  secciones.push('## 2. Tablas de Probabilidad Condicional (CPTs)');
  for (const nodo of red.nodos) {
    const titulo =
      nodo.padres.length > 0
        ? `### Nodo \`${nodo.id}\` (${nodo.nombre}) — $P(${nodo.id} \\mid ${nodo.padres.join(', ')})$`
        : `### Nodo \`${nodo.id}\` (${nodo.nombre}) — $P(${nodo.id})$`;

    const encabezados = [
      ...nodo.padres,
      ...nodo.estados.map((estado) => `P(${nodo.id}=${estado})`),
    ];
    const lineasTabla = [
      titulo,
      '',
      `| ${encabezados.join(' | ')} |`,
      `| ${encabezados.map(() => '---').join(' | ')} |`,
    ];

    for (const fila of nodo.cpt) {
      const valoresPadres = nodo.padres.map((padre) => fila.cuando[padre] ?? '');
      const probabilidades = nodo.estados.map((estado) =>
        formatearNumeroAcademico(fila.probabilidades[estado] ?? 0),
      );
      lineasTabla.push(`| ${[...valoresPadres, ...probabilidades].join(' | ')} |`);
    }
    secciones.push(lineasTabla.join('\n'));
  }

  if (!traza) {
    return `${secciones.join('\n\n')}\n`;
  }

  // 3. Traza de 6 Pasos de Eliminación de Variables
  secciones.push('---');
  secciones.push(
    '## 3. Inferencia Exacta por Eliminación de Variables (Traza de 6 Pasos)',
  );

  // Paso 1
  const entradasEvidencia = Object.entries(traza.paso1.evidencia);
  const textoEvidencia =
    entradasEvidencia.length > 0
      ? entradasEvidencia.map(([clave, valor]) => `${clave}=${valor}`).join(', ')
      : 'Ninguna (consulta marginal)';

  secciones.push(
    [
      '### Paso 1. Plantear la consulta',
      `- **Variables de consulta ($Q$):** \`${traza.paso1.variablesConsulta.join(', ')}\``,
      `- **Evidencia observada ($E=e$):** \`${textoEvidencia}\``,
      `- **Variables ocultas iniciales ($Y$):** \`${traza.paso1.todasVariablesOcultas.join(', ') || 'Ninguna'}\``,
      `- **Tipo de inferencia:** **${traza.paso1.clasificacion.etiqueta}** — ${traza.paso1.clasificacion.explicacion}`,
      '',
      `$$${traza.paso1.latexSimbolico}$$`,
    ].join('\n'),
  );

  // Paso 2
  const idsPodados = traza.paso2.nodosPodados.map((nodo) => nodo.id);
  const lineasPaso2 = [
    '### Paso 2. Podar variables irrelevantes',
    idsPodados.length > 0
      ? `- **Nodos podados (no son ancestros de $Q \\cup E$):** \`${idsPodados.join(', ')}\``
      : '- **Nodos podados:** Ninguno (todas las variables son ancestros de la consulta o de la evidencia).',
    `- **Variables activas tras la poda:** \`${traza.paso2.nodosActivos.map((nodo) => nodo.id).join(', ')}\``,
    '',
    `$$${traza.paso2.latexSimbolicoReducido}$$`,
  ];
  if (
    traza.paso2.atajoMantaMarkov.aplicable &&
    traza.paso2.atajoMantaMarkov.latexProporcional
  ) {
    lineasPaso2.push(
      '',
      `> **Atajo por Manta de Markov detectado:** Toda la manta de Markov está observada: $$${traza.paso2.atajoMantaMarkov.latexProporcional}$$`,
    );
  }
  secciones.push(lineasPaso2.join('\n'));

  // Paso 3
  const bloquesPaso3 = ['### Paso 3. Factores iniciales y restricción por evidencia'];
  for (const entrada of traza.paso3.entradas) {
    bloquesPaso3.push(
      `#### Factor \`${entrada.factor.id}\` (${entrada.factor.etiquetaOrigen})`,
      renderizarTablaMarkdownFactor(entrada.factor, entrada.factor.id, false),
    );
  }
  secciones.push(bloquesPaso3.join('\n\n'));

  // Paso 4
  secciones.push(
    [
      '### Paso 4. Orden de eliminación ($\\pi$)',
      `- **Estrategia seleccionada:** \`${traza.paso4.estrategia}\``,
      `- **Orden de eliminación:** \`${traza.paso4.ordenEliminacion.join(' → ') || '(sin variables ocultas)'}\``,
      `- **Ancho máximo de factor creado ($\\omega_g$):** ${traza.paso4.metricas.maxTamanoAlcanceFactorCreado} variable(s)`,
      `- **Tamaño del factor más grande formado:** ${traza.paso4.metricas.maxTamanoAlcanceFactorFormado} variable(s)`,
    ].join('\n'),
  );

  // Paso 5
  const bloquesPaso5 = ['### Paso 5. Ciclo de Eliminación (Suma-Producto)'];
  if (traza.paso5.subPasos.length === 0) {
    bloquesPaso5.push(
      '_No quedan variables ocultas activas por eliminar; se pasa directamente a la multiplicación final._',
    );
  } else {
    for (const subPaso of traza.paso5.subPasos) {
      bloquesPaso5.push(
        [
          `#### Paso ${subPaso.etiquetaSubPaso}. Eliminar \`${subPaso.variable}\``,
          `- **Factores que contienen a \`${subPaso.variable}\`:** ${subPaso.etiquetasFactoresInvolucrados.map((etiqueta) => `\`${etiqueta}\``).join(', ')}`,
          `- **Multiplicaciones en este paso:** ${subPaso.multiplicaciones}`,
          '',
          `$$${subPaso.latexSimbolico}$$`,
          '',
          renderizarTablaMarkdownFactor(
            subPaso.nuevoFactor,
            subPaso.nuevoFactor.id,
            true,
          ),
          '',
          `- **Factores que quedan:** ${subPaso.etiquetasFactoresRestantes.map((etiqueta) => `\`${etiqueta}\``).join(', ')}`,
        ].join('\n'),
      );
    }
  }
  secciones.push(bloquesPaso5.join('\n\n'));

  // Paso 6
  const bloquesPaso6 = [
    '### Paso 6. Multiplicación final, Normalización y Verificación',
    '#### Producto no normalizado de factores restantes',
    renderizarTablaMarkdownFactor(
      traza.paso6.factorNoNormalizado,
      'No normalizado',
      true,
    ),
    traza.paso6.esEvidenciaImposible
      ? '> **Evidencia imposible:** $P(\\mathbf{e}) = 0$. La combinación observada tiene probabilidad conjunta nula en el modelo.'
      : `- **Probabilidad de la evidencia $P(\\mathbf{e})$:** \`${formatearNumeroAcademico(traza.paso6.probabilidadEvidencia)}\`\n- **Constante de normalización $\\alpha = 1 / P(\\mathbf{e})$:** \`${formatearNumeroAcademico(traza.paso6.alfa ?? 0)}\``,
    '#### Distribución Condicional Posterior Normalizada',
    renderizarTablaMarkdownFactor(
      traza.paso6.factorPosterior,
      traza.paso6.factorPosterior.id,
      false,
    ),
  ];

  if (traza.paso6.verdadFundamental) {
    const vf = traza.paso6.verdadFundamental;
    bloquesPaso6.push(
      [
        '#### Comprobación Automática (Verdad Fundamental por Enumeración de la Conjunta Completa)',
        `- **Estado de verificación:** ${vf.verificado ? 'VERIFICADO (coincidencia exacta)' : 'DISCREPANCIA DETECTADA'}`,
        `- **Diferencia absoluta máxima:** \`${vf.diferenciaAbsolutaMaxima.toExponential(3)}\``,
        `- **Multiplicaciones Eliminación de Variables:** **${vf.multiplicacionesEliminacionVariables}**`,
        `- **Multiplicaciones Enumeración Completa (${vf.terminosEnumerados} términos):** **${vf.multiplicacionesEnumeracion}**`,
        `- **Ahorro computacional:** **${vf.multiplicacionesAhorradas}** multiplicaciones ahorradas (${vf.porcentajeAhorro.toFixed(1)}%)`,
      ].join('\n'),
    );
  }

  secciones.push(bloquesPaso6.join('\n\n'));

  return `${secciones.join('\n\n')}\n`;
}
