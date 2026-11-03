import type {
  AsignacionVariables,
  IdNodo,
  RedBayesiana,
} from '../dominio/tipos';
import { obtenerMapaHijos } from './dag';

export interface ResultadoMantaMarkov {
  readonly idNodo: IdNodo;
  readonly padres: readonly IdNodo[];
  readonly hijos: readonly IdNodo[];
  readonly copadres: readonly IdNodo[];
  /** Unión Pa(X) ∪ Ch(X) ∪ CoPa(X) ordenada según el orden canónico de nodos en la red. */
  readonly miembros: readonly IdNodo[];
  readonly formulaLatex: string;
}

export interface VerificacionAtajoMantaMarkov {
  readonly aplicable: boolean;
  readonly manta?: ResultadoMantaMarkov;
  readonly latexProporcional?: string;
}

export function formatearVariableLatex(id: IdNodo): string {
  return id.length > 1 ? `\\mathit{${id}}` : id;
}

/**
 * Calcula la Manta de Markov MB(X) = Padres(X) ∪ Hijos(X) ∪ Copadres(X).
 * Reutilizable tanto en la Parte 1 (GUI y atajo del Paso 2) como en la Parte 2 (Pasos 0 y 2 de EM).
 */
export function calcularMantaMarkov(
  red: RedBayesiana,
  idNodo: IdNodo,
): ResultadoMantaMarkov {
  const nodoObjetivo = red.nodos.find((nodo) => nodo.id === idNodo);
  if (!nodoObjetivo) {
    throw new Error(`El nodo "${idNodo}" no existe en la red.`);
  }

  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const mapaHijos = obtenerMapaHijos(red.nodos);

  const padres = [...nodoObjetivo.padres];
  const hijos = [...(mapaHijos.get(idNodo) ?? [])];

  const conjuntoPadres = new Set(padres);
  const conjuntoHijos = new Set(hijos);
  const conjuntoCopadres = new Set<IdNodo>();

  for (const idHijo of hijos) {
    const nodoHijo = nodosPorId.get(idHijo);
    if (!nodoHijo) continue;
    for (const idOtroPadre of nodoHijo.padres) {
      if (
        idOtroPadre !== idNodo &&
        !conjuntoPadres.has(idOtroPadre) &&
        !conjuntoHijos.has(idOtroPadre)
      ) {
        conjuntoCopadres.add(idOtroPadre);
      }
    }
  }

  const copadres = red.nodos
    .map((nodo) => nodo.id)
    .filter((id) => conjuntoCopadres.has(id));

  const conjuntoUnion = new Set<IdNodo>([...padres, ...hijos, ...copadres]);
  const miembros = red.nodos
    .map((nodo) => nodo.id)
    .filter((id) => conjuntoUnion.has(id));

  const textoMiembros =
    miembros.length > 0 ? miembros.map(formatearVariableLatex).join(', ') : '\\varnothing';
  const formulaLatex = `MB(${formatearVariableLatex(idNodo)}) = \\{${textoMiembros}\\}`;

  return {
    idNodo,
    padres,
    hijos,
    copadres,
    miembros,
    formulaLatex,
  };
}

/**
 * Detecta si una consulta univariada Q tiene toda su Manta de Markov observada en la evidencia E,
 * habilitando el atajo de factorización local P(Q | MB(Q)) ∝ P(Q | Pa(Q)) ∏_{Y ∈ Ch(Q)} P(Y | Pa(Y)).
 */
export function estaMantaMarkovCompletamenteObservada(
  red: RedBayesiana,
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
): VerificacionAtajoMantaMarkov {
  if (variablesConsulta.length !== 1) {
    return { aplicable: false };
  }

  const idConsulta = variablesConsulta[0]!;
  const nodoObjetivo = red.nodos.find((nodo) => nodo.id === idConsulta);
  if (!nodoObjetivo) {
    return { aplicable: false };
  }

  const manta = calcularMantaMarkov(red, idConsulta);
  if (manta.miembros.length === 0) {
    return { aplicable: false };
  }

  const conjuntoEvidencia = new Set(Object.keys(evidencia));
  const todosObservados = manta.miembros.every((idMiembro) =>
    conjuntoEvidencia.has(idMiembro),
  );

  if (!todosObservados) {
    return { aplicable: false, manta };
  }

  const nodosPorId = new Map(red.nodos.map((nodo) => [nodo.id, nodo]));
  const terminoPropio =
    nodoObjetivo.padres.length > 0
      ? `P(${formatearVariableLatex(idConsulta)} \\mid ${nodoObjetivo.padres.map(formatearVariableLatex).join(', ')})`
      : `P(${formatearVariableLatex(idConsulta)})`;

  const terminosHijos = manta.hijos.map((idHijo) => {
    const hijo = nodosPorId.get(idHijo)!;
    return `P(${formatearVariableLatex(idHijo)} \\mid ${hijo.padres.map(formatearVariableLatex).join(', ')})`;
  });

  const ladoDerecho = [terminoPropio, ...terminosHijos].join(' \\, ');
  const latexProporcional = `P(${formatearVariableLatex(idConsulta)} \\mid MB(${formatearVariableLatex(idConsulta)})) \\propto ${ladoDerecho}`;

  return {
    aplicable: true,
    manta,
    latexProporcional,
  };
}
