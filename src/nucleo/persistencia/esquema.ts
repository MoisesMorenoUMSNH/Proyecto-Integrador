// Esquema Zod v4 de validación en frontera para archivos JSON de Redes Bayesianas
// Fuente oficial: https://zod.dev/basics
import { z } from 'zod';
import type {
  ConsultaPredefinida,
  FilaCPT,
  NodoBayes,
  ProblemaValidacion,
  RedBayesiana,
  Resultado,
} from '../dominio/tipos';
import { validarRedBayesiana } from '../grafo/dag';

export const EsquemaFilaCptJson = z.object({
  cuando: z.record(z.string(), z.string()),
  probabilidades: z.record(z.string(), z.number().finite()),
});

export const EsquemaNodoBayesJson = z.object({
  id: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  estados: z.array(z.string()).min(1),
  etiquetasEstados: z.record(z.string(), z.string()).optional(),
  padres: z.array(z.string()),
  posicion: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  cpt: z.array(EsquemaFilaCptJson),
  esLatente: z.boolean().optional(),
});

export const EsquemaConsultaPredefinidaJson = z.object({
  id: z.string().min(1),
  etiqueta: z.string().min(1),
  descripcion: z.string().optional(),
  variablesConsulta: z.array(z.string()).min(1),
  evidencia: z.record(z.string(), z.string()),
  ordenSugerido: z.array(z.string()).optional(),
  posteriorEsperada: z.record(z.string(), z.number().finite()).optional(),
});

export const EsquemaRedJson = z.object({
  versionEsquema: z.literal('1.0'),
  metadatos: z.object({
    id: z.string().min(1),
    titulo: z.string().min(1).max(200),
    descripcion: z.string().optional(),
    autor: z.string().optional(),
    dominio: z.string().optional(),
    actualizadoEn: z.string().optional(),
  }),
  // Nota: Los límites exactos [3..10] se validan enseguida con códigos específicos RED_MINIMO_NODOS / RED_MAXIMO_NODOS
  nodos: z.array(EsquemaNodoBayesJson),
  consultasPredefinidas: z.array(EsquemaConsultaPredefinidaJson).optional(),
});

function formatearRutaZod(ruta: readonly PropertyKey[]): string {
  if (ruta.length === 0) return '(raíz)';
  return ruta
    .map((segmento, indice) =>
      typeof segmento === 'number'
        ? `[${segmento}]`
        : indice === 0
          ? String(segmento)
          : `.${String(segmento)}`,
    )
    .join('');
}

function extraerIdNodoDeCrudo(
  crudo: unknown,
  ruta: readonly PropertyKey[],
): string | undefined {
  if (
    ruta[0] === 'nodos' &&
    typeof ruta[1] === 'number' &&
    typeof crudo === 'object' &&
    crudo !== null &&
    'nodos' in crudo &&
    Array.isArray((crudo as { nodos?: unknown }).nodos)
  ) {
    const candidato = (crudo as { nodos: unknown[] }).nodos[ruta[1]];
    if (
      typeof candidato === 'object' &&
      candidato !== null &&
      'id' in candidato &&
      typeof (candidato as { id?: unknown }).id === 'string'
    ) {
      return (candidato as { id: string }).id;
    }
  }
  return undefined;
}

/**
 * Normaliza un objeto validado por Zod en una entidad inmutable `RedBayesiana` compatible
 * con `exactOptionalPropertyTypes: true` (omitiendo llaves opcionales con valor `undefined`).
 */
function normalizarRedParseada(
  parseada: z.infer<typeof EsquemaRedJson>,
): RedBayesiana {
  const nodos: NodoBayes[] = parseada.nodos.map((nodo) => {
    const cpt: FilaCPT[] = nodo.cpt.map((fila) => ({
      cuando: { ...fila.cuando },
      probabilidades: { ...fila.probabilidades },
    }));

    return {
      id: nodo.id,
      nombre: nodo.nombre,
      ...(nodo.descripcion !== undefined ? { descripcion: nodo.descripcion } : {}),
      estados: [...nodo.estados],
      ...(nodo.etiquetasEstados !== undefined
        ? { etiquetasEstados: { ...nodo.etiquetasEstados } }
        : {}),
      padres: [...nodo.padres],
      posicion: { x: nodo.posicion.x, y: nodo.posicion.y },
      cpt,
      ...(nodo.esLatente !== undefined ? { esLatente: nodo.esLatente } : {}),
    };
  });

  const consultasPredefinidas: ConsultaPredefinida[] | undefined =
    parseada.consultasPredefinidas?.map((consulta) => ({
      id: consulta.id,
      etiqueta: consulta.etiqueta,
      ...(consulta.descripcion !== undefined
        ? { descripcion: consulta.descripcion }
        : {}),
      variablesConsulta: [...consulta.variablesConsulta],
      evidencia: { ...consulta.evidencia },
      ...(consulta.ordenSugerido !== undefined
        ? { ordenSugerido: [...consulta.ordenSugerido] }
        : {}),
      ...(consulta.posteriorEsperada !== undefined
        ? { posteriorEsperada: { ...consulta.posteriorEsperada } }
        : {}),
    }));

  return {
    versionEsquema: '1.0',
    metadatos: {
      id: parseada.metadatos.id,
      titulo: parseada.metadatos.titulo,
      ...(parseada.metadatos.descripcion !== undefined
        ? { descripcion: parseada.metadatos.descripcion }
        : {}),
      ...(parseada.metadatos.autor !== undefined
        ? { autor: parseada.metadatos.autor }
        : {}),
      ...(parseada.metadatos.dominio !== undefined
        ? { dominio: parseada.metadatos.dominio }
        : {}),
      ...(parseada.metadatos.actualizadoEn !== undefined
        ? { actualizadoEn: parseada.metadatos.actualizadoEn }
        : {}),
    },
    nodos,
    ...(consultasPredefinidas !== undefined ? { consultasPredefinidas } : {}),
  };
}

/**
 * Valida un objeto externo no confiable en la frontera de persistencia:
 * 1) Verificación estructural y sintáctica con Zod v4 `.safeParse()`
 * 2) Verificación semántica completa: aciclicidad del DAG, límites [3..10] nodos y suma de filas CPT [1.0 ± 1e-6].
 */
export function validarObjetoRedCrudo(crudo: unknown): Resultado<RedBayesiana> {
  const parseado = EsquemaRedJson.safeParse(crudo);
  if (!parseado.success) {
    const errores: ProblemaValidacion[] = parseado.error.issues.map((problemaZod) => {
      const rutaFormateada = formatearRutaZod(problemaZod.path);
      const idNodo = extraerIdNodoDeCrudo(crudo, problemaZod.path);
      return {
        codigo: 'ERROR_VALIDACION_ESQUEMA',
        severidad: 'error',
        ...(idNodo !== undefined ? { idNodo } : {}),
        mensaje: `Error de esquema JSON en "${rutaFormateada}": ${problemaZod.message}`,
        detalles: { ruta: rutaFormateada, codigoZod: problemaZod.code },
      };
    });
    return { exito: false, errores };
  }

  const red = normalizarRedParseada(parseado.data);
  const problemasDominioYDag = validarRedBayesiana(red);

  if (problemasDominioYDag.length > 0) {
    return { exito: false, errores: problemasDominioYDag };
  }

  return { exito: true, valor: red };
}
