import {
  CheckCircle2,
  CircleAlert,
  Plus,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  EPSILON_SUMA_PROBABILIDAD,
  MAX_NODOS_RED,
  calcularMantaMarkov,
  puedeAgregarArista,
  type IdNodo,
  type NodoBayes,
  type ValorEstado,
} from '../nucleo';
import { FormulaMatematica } from './FormulaMatematica';
import { useStoreRed } from './store/useStoreRed';

// -------------------------------------------------------------
// TABLA EDITOR CPT (Exportada para pruebas unitarias)
// -------------------------------------------------------------
export interface PropiedadesTablaEditorCPT {
  readonly nodo: NodoBayes;
}

export function TablaEditorCPT({ nodo }: PropiedadesTablaEditorCPT) {
  const actualizarProbabilidadCeldaCpt = useStoreRed(
    (s) => s.actualizarProbabilidadCeldaCpt,
  );
  const normalizarFilaCpt = useStoreRed((s) => s.normalizarFilaCpt);

  const [borrador, setBorrador] = useState<{ clave: string; texto: string } | null>(null);

  const claveCelda = (idx: number, est: ValorEstado) => `${nodo.id}::${idx}::${est}`;

  const manejarCambio = (idx: number, est: ValorEstado, valor: string) => {
    const k = claveCelda(idx, est);
    setBorrador({ clave: k, texto: valor });
    const num = Number(valor.trim());
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      actualizarProbabilidadCeldaCpt(nodo.id, idx, est, num, true);
    }
  };

  const manejarBlur = (idx: number, est: ValorEstado) => {
    const k = claveCelda(idx, est);
    if (borrador && borrador.clave === k) {
      const num = Number(borrador.texto.trim());
      if (!Number.isNaN(num) && Number.isFinite(num)) {
        actualizarProbabilidadCeldaCpt(nodo.id, idx, est, num, true);
      }
      setBorrador(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-slate-800">
          Tabla CPT: <code className="font-mono text-blue-700">P({nodo.id}{nodo.padres.length > 0 ? ` | ${nodo.padres.join(', ')}` : ''})</code>
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
              {nodo.padres.map((p) => (
                <th key={p} className="border-r border-slate-200 px-2 py-1 font-mono">{p}</th>
              ))}
              {nodo.estados.map((est) => (
                <th key={est} className="px-2 py-1 font-mono text-right">P({nodo.id}={est})</th>
              ))}
              <th className="px-2 py-1 text-right">Suma</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {nodo.cpt.map((fila, idx) => {
              let suma = 0;
              for (const est of nodo.estados) {
                const prob = fila.probabilidades[est];
                if (prob !== undefined && Number.isFinite(prob)) suma += prob;
              }
              const valida = Math.abs(suma - 1.0) <= EPSILON_SUMA_PROBABILIDAD;
              const cond =
                nodo.padres.length > 0
                  ? nodo.padres.map((p) => `${p}=${fila.cuando[p] ?? '?'}`).join(', ')
                  : 'incondicional';

              return (
                <tr key={idx} className={valida ? 'hover:bg-slate-50/50' : 'bg-red-50/70'}>
                  {nodo.padres.map((p) => (
                    <td key={p} className="border-r border-slate-200 bg-slate-50/80 px-2 py-1 font-mono text-[11px] font-semibold text-slate-800">
                      {fila.cuando[p] ?? ''}
                    </td>
                  ))}
                  {nodo.estados.map((est) => {
                    const k = claveCelda(idx, est);
                    const val = fila.probabilidades[est] ?? 0;
                    const texto = borrador && borrador.clave === k ? borrador.texto : String(val);

                    return (
                      <td key={est} className="px-1.5 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          aria-label={`Probabilidad de ${nodo.id}=${est} dado ${cond}`}
                          value={texto}
                          onFocus={() => setBorrador({ clave: k, texto: String(val) })}
                          onChange={(e) => manejarCambio(idx, est, e.target.value)}
                          onBlur={() => manejarBlur(idx, est)}
                          className="numeros-tabulares w-16 rounded-md border border-slate-300 bg-white px-1 py-0.5 text-right font-mono text-xs focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    {valida ? (
                      <span
                        aria-label={`Fila ${idx + 1} válida, suma 1.0000`}
                        className="numeros-tabulares inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-800"
                      >
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                        <span>{suma.toFixed(4)}</span>
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        <span
                          role="alert"
                          aria-label={`Fila ${idx + 1} inválida, suma ${suma.toFixed(4)}`}
                          className="numeros-tabulares inline-flex items-center gap-0.5 rounded-md bg-red-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-red-800"
                        >
                          <CircleAlert className="h-3 w-3 text-red-600" aria-hidden="true" />
                          <span>{suma.toFixed(4)}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => normalizarFilaCpt(nodo.id, idx)}
                          aria-label={`Normalizar fila ${idx + 1}`}
                          title="Normalizar a 1.0000"
                          className="rounded-md border border-red-300 bg-white p-0.5 text-red-700 hover:bg-red-50"
                        >
                          <WandSparkles className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// TARJETA MANTA DE MARKOV (Exportada para pruebas unitarias)
// -------------------------------------------------------------
export interface PropiedadesTarjetaMantaMarkov {
  readonly idNodo: IdNodo;
}

export function TarjetaMantaMarkov({ idNodo }: PropiedadesTarjetaMantaMarkov) {
  const red = useStoreRed((s) => s.red);
  const idMantaResaltada = useStoreRed((s) => s.idNodoMantaResaltada);
  const alternarManta = useStoreRed((s) => s.alternarResaltadoMantaMarkov);
  const seleccionarNodo = useStoreRed((s) => s.seleccionarNodo);

  const manta = useMemo(() => {
    if (!red.nodos.some((n) => n.id === idNodo)) return null;
    return calcularMantaMarkov(red, idNodo);
  }, [red, idNodo]);

  if (!manta) return null;

  const resaltada = idMantaResaltada === idNodo;

  return (
    <div aria-label={`Manta de Markov del nodo ${idNodo}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs font-bold text-slate-800">
          Manta de Markov <code className="font-mono text-blue-700">MB({idNodo})</code>
        </span>
        <button
          type="button"
          onClick={() => alternarManta(idNodo)}
          aria-pressed={resaltada}
          className="sr-only"
        >
          {resaltada ? 'Ocultar en lienzo' : 'Resaltar en lienzo'}
        </button>
      </div>

      <div className="rounded-lg bg-white px-2 py-1 text-center font-mono text-xs border border-slate-200">
        <FormulaMatematica latex={manta.formulaLatex} />
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-1">
        <div>
          <span className="font-medium text-slate-600 block">Padres:</span>
          {manta.padres.length === 0 ? (
            <span className="italic text-slate-400">∅</span>
          ) : (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {manta.padres.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => seleccionarNodo(p)}
                  className="rounded border border-slate-300 bg-white px-1 font-mono font-semibold text-slate-700 hover:bg-blue-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="font-medium text-slate-600 block">Hijos:</span>
          {manta.hijos.length === 0 ? (
            <span className="italic text-slate-400">∅</span>
          ) : (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {manta.hijos.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => seleccionarNodo(h)}
                  className="rounded border border-slate-300 bg-white px-1 font-mono font-semibold text-slate-700 hover:bg-blue-50"
                >
                  {h}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="font-medium text-slate-600 block">Copadres:</span>
          {manta.copadres.length === 0 ? (
            <span className="italic text-slate-400">∅</span>
          ) : (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {manta.copadres.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => seleccionarNodo(c)}
                  className="rounded border border-slate-300 bg-white px-1 font-mono font-semibold text-slate-700 hover:bg-blue-50"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// PANEL EDITOR FIJO A LA IZQUIERDA (~25% ANCHO)
// -------------------------------------------------------------
export function PanelEditor() {
  const red = useStoreRed((s) => s.red);
  const idNodoSeleccionado = useStoreRed((s) => s.idNodoSeleccionado);
  const agregarNodo = useStoreRed((s) => s.agregarNodo);
  const eliminarNodo = useStoreRed((s) => s.eliminarNodo);
  const actualizarDatosNodo = useStoreRed((s) => s.actualizarDatosNodo);
  const actualizarEstadosNodo = useStoreRed((s) => s.actualizarEstadosNodo);
  const alternarPadreNodo = useStoreRed((s) => s.alternarPadreNodo);

  const [nuevoEstadoTexto, setNuevoEstadoTexto] = useState('');
  const [errorEstado, setErrorEstado] = useState<string | null>(null);

  const nodo = red.nodos.find((n) => n.id === idNodoSeleccionado) ?? null;

  const manejarAgregarEstado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodo) return;
    const t = nuevoEstadoTexto.trim();
    if (!t) return;
    const res = actualizarEstadosNodo(nodo.id, [...nodo.estados, t]);
    if (!res.exito) {
      setErrorEstado(res.mensaje ?? 'Error al agregar estado');
    } else {
      setNuevoEstadoTexto('');
      setErrorEstado(null);
    }
  };

  const manejarQuitarEstado = (est: string) => {
    if (!nodo) return;
    const restantes = nodo.estados.filter((e) => e !== est);
    const res = actualizarEstadosNodo(nodo.id, restantes);
    if (!res.exito) {
      setErrorEstado(res.mensaje ?? 'Debe conservar al menos 2 estados.');
    } else {
      setErrorEstado(null);
    }
  };

  const posiblesPadres = nodo ? red.nodos.filter((n) => n.id !== nodo.id) : [];

  return (
    <aside
      aria-label="Editor de nodo y CPT"
      className="flex h-full flex-col overflow-y-auto bg-white p-3.5 space-y-3.5 border-r border-slate-200"
    >
      {/* 1.1 Barra superior del panel: Botón '+ Agregar Nodo' y 'Eliminar Nodo' */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
        <button
          type="button"
          onClick={() => agregarNodo()}
          disabled={red.nodos.length >= MAX_NODOS_RED}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Agregar Nodo</span>
        </button>

        {nodo && (
          <button
            type="button"
            onClick={() => eliminarNodo(nodo.id)}
            title={`Eliminar nodo ${nodo.id} de la red`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Eliminar Nodo</span>
          </button>
        )}
      </div>

      {/* Si NO hay nodo seleccionado: Estado limpio */}
      {!nodo ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-500 leading-relaxed border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
          <p>
            Selecciona un nodo en el lienzo para editar sus propiedades y CPT, o haz clic en <strong>"+ Agregar Nodo"</strong>.
          </p>
        </div>
      ) : (
        /* Si HAY un nodo seleccionado: Campos directos, CPT y Manta de Markov */
        <div className="space-y-3.5">
          {/* Identificador y Nombre editable */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 block">
              Variable seleccionada:
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-black text-slate-900 shrink-0">
                {nodo.id}
              </span>
              <input
                type="text"
                value={nodo.nombre}
                onChange={(e) => actualizarDatosNodo(nodo.id, { nombre: e.target.value })}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none"
                placeholder="Nombre de la variable..."
              />
            </div>
          </div>

          {/* Lista de Estados */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 block">
              Estados ({nodo.estados.length}):
            </label>
            <div className="flex flex-wrap gap-1">
              {nodo.estados.map((est) => (
                <span
                  key={est}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800"
                >
                  <span>{est}</span>
                  {nodo.estados.length > 2 && (
                    <button
                      type="button"
                      onClick={() => manejarQuitarEstado(est)}
                      className="text-slate-400 hover:text-red-700"
                      title={`Eliminar estado ${est}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            <form onSubmit={manejarAgregarEstado} className="flex gap-1 pt-0.5">
              <input
                type="text"
                placeholder="Nuevo estado..."
                value={nuevoEstadoTexto}
                onChange={(e) => setNuevoEstadoTexto(e.target.value)}
                className="flex-1 rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-semibold text-white hover:bg-slate-900"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
            {errorEstado && <p className="text-[11px] text-red-600">{errorEstado}</p>}
          </div>

          {/* Casillas de Padres Directos Pa(X) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 block">
              Padres directos Pa({nodo.id}):
            </label>
            {posiblesPadres.length === 0 ? (
              <p className="text-[11px] italic text-slate-500">No hay otros nodos en la red.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {posiblesPadres.map((candidato) => {
                  const esPadre = nodo.padres.includes(candidato.id);
                  const testArista = puedeAgregarArista(red, candidato.id, nodo.id);
                  const deshabilitado = !esPadre && !testArista.permitida;

                  return (
                    <button
                      key={candidato.id}
                      type="button"
                      disabled={deshabilitado}
                      onClick={() => alternarPadreNodo(nodo.id, candidato.id)}
                      title={
                        deshabilitado
                          ? testArista.razon
                          : esPadre
                            ? `Quitar a ${candidato.id} como padre`
                            : `Hacer a ${candidato.id} padre de ${nodo.id}`
                      }
                      className={`rounded-md border px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
                        esPadre
                          ? 'border-blue-700 bg-blue-600 text-white'
                          : deshabilitado
                            ? 'border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {candidato.id}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tabla CPT editable directamente */}
          <TablaEditorCPT nodo={nodo} />

          {/* Manta de Markov compacta */}
          <TarjetaMantaMarkov idNodo={nodo.id} />
        </div>
      )}
    </aside>
  );
}
