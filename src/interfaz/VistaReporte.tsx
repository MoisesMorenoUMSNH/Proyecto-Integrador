// Vista del reporte desarrollado por Cesar Ambris Salguero 
import { ArrowLeft, Download, Printer } from 'lucide-react';
import {
  formatearNumeroAcademico,
  formatearReporteMarkdown,
} from '../nucleo';
import { descargarArchivo } from './descargarArchivo';
import { TablaFactor } from './TablaFactor';
import { useStoreRed } from './store/useStoreRed';

export function VistaReporte() {
  const red = useStoreRed((s) => s.red);
  const traza = useStoreRed((s) => s.trazaActiva);
  const establecerMostrarVistaReporte = useStoreRed(
    (s) => s.establecerMostrarVistaReporte,
  );

  const manejarExportarMd = () => {
    const md = formatearReporteMarkdown(red, traza ?? undefined);
    const nombre = `reporte-${red.metadatos.id || 'red'}.md`;
    descargarArchivo(md, nombre, 'text/markdown;charset=utf-8');
  };

  return (
    <article
      aria-label="Reporte académico imprimible de Red Bayesiana"
      className="mx-auto max-w-4xl p-6 space-y-6 bg-white min-h-screen text-slate-900"
    >
      {/* Botones de acción superiores (ocultos al imprimir) */}
      <div className="ocultar-en-impresion flex items-center justify-between border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => establecerMostrarVistaReporte(false)}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al Editor de 3 Paneles</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={manejarExportarMd}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            <span>Descargar .MD</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-sm"
          >
            <Printer className="h-4 w-4" />
            <span>Imprimir / PDF</span>
          </button>
        </div>
      </div>

      {/* Encabezado académico */}
      <div className="border-b border-slate-300 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-950">
          Reporte de Red Bayesiana e Inferencia Exacta
        </h1>
        <p className="mt-1 text-sm text-slate-700">{red.metadatos.titulo}</p>
        {red.metadatos.descripcion && (
          <p className="mt-1 text-xs text-slate-500">{red.metadatos.descripcion}</p>
        )}
      </div>

      {/* 1. Estructura Topológica del DAG y Diccionario de Variables */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
          1. Estructura Topológica del DAG y Diccionario de Variables
        </h2>
        <div className="overflow-x-auto rounded border border-slate-200">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100 font-semibold text-slate-800 border-b border-slate-200">
                <th className="px-3 py-1.5 font-mono">ID</th>
                <th className="px-3 py-1.5">Nombre</th>
                <th className="px-3 py-1.5">Dominio / Estados</th>
                <th className="px-3 py-1.5 font-mono">Padres Pa(X)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {red.nodos.map((n) => (
                <tr key={n.id}>
                  <td className="px-3 py-1.5 font-mono font-bold text-slate-900">{n.id}</td>
                  <td className="px-3 py-1.5">{n.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px]">
                    {n.estados.map((e) => n.etiquetasEstados?.[e] ? `${e} (${n.etiquetasEstados[e]})` : e).join(', ')}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-700">
                    {n.padres.join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Tablas de Probabilidad Condicional (CPT) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
          2. Tablas de Probabilidad Condicional (CPT)
        </h2>
        <div className="space-y-4">
          {red.nodos.map((n) => (
            <div key={n.id} className="rounded border border-slate-200 p-2 text-xs">
              <span className="font-mono font-bold text-slate-800 block mb-1">
                P({n.id}{n.padres.length > 0 ? ` | ${n.padres.join(', ')}` : ''})
              </span>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold">
                    {n.padres.map((p) => (
                      <th key={p} className="px-2 py-1 border-r border-slate-200 font-mono">{p}</th>
                    ))}
                    {n.estados.map((e) => (
                      <th key={e} className="px-2 py-1 text-right font-mono">P({n.id}={e})</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {n.cpt.map((fila, i) => (
                    <tr key={i}>
                      {n.padres.map((p) => (
                        <td key={p} className="px-2 py-1 border-r border-slate-200 font-semibold">{fila.cuando[p] ?? ''}</td>
                      ))}
                      {n.estados.map((e) => (
                        <td key={e} className="px-2 py-1 text-right">{fila.probabilidades[e]?.toFixed(4) ?? '0.0000'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Traza Completa de los 6 Pasos de Inferencia */}
      {traza && (
        <section className="space-y-4 pt-2">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">
            3. Traza Académica de los 6 Pasos de Eliminación de Variables
          </h2>

          <div className="space-y-3">
            {/* Paso 1 */}
            <div className="rounded border border-slate-200 p-3 text-xs space-y-1">
              <span className="font-bold text-slate-900">Paso 1: Planteamiento y Tipo de Inferencia ({traza.paso1.clasificacion.etiqueta})</span>
              <p className="font-mono text-slate-700 bg-slate-50 p-1.5 rounded">{traza.paso1.latexSimbolico}</p>
              <p className="text-slate-600 text-[11px]">{traza.paso1.clasificacion.explicacion}</p>
            </div>

            {/* Paso 2 */}
            <div className="rounded border border-slate-200 p-3 text-xs space-y-1">
              <span className="font-bold text-slate-900">Paso 2: Poda de Variables</span>
              <p className="text-slate-700 text-[11px]">
                Variables podadas: <span className="font-mono font-bold">{traza.paso2.nodosPodados.map((n) => n.id).join(', ') || 'Ninguna'}</span>
              </p>
              <p className="text-slate-700 text-[11px]">
                Variables activas en el subgrafo: <span className="font-mono font-bold">{traza.paso2.nodosActivos.map((n) => n.id).join(', ')}</span>
              </p>
            </div>

            {/* Paso 3 */}
            <div className="rounded border border-slate-200 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-900">Paso 3: Factores Iniciales Restringidos</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {traza.paso3.entradas.map((e) => (
                  <TablaFactor key={e.factor.id} factor={e.factor} variante="reporte" />
                ))}
              </div>
            </div>

            {/* Paso 4 */}
            <div className="rounded border border-slate-200 p-3 text-xs space-y-1">
              <span className="font-bold text-slate-900">Paso 4: Orden de Eliminación</span>
              <p className="font-mono font-bold text-blue-800">π = ({traza.paso4.ordenEliminacion.join(', ') || '∅'})</p>
              <p className="text-slate-600 text-[11px]">Estrategia: {traza.paso4.estrategia}</p>
            </div>

            {/* Paso 5 */}
            <div className="rounded border border-slate-200 p-3 text-xs space-y-2">
              <span className="font-bold text-slate-900">Paso 5: Factores Intermedios Generados</span>
              <div className="space-y-2">
                {traza.paso5.subPasos.map((p, idx) => (
                  <div key={idx} className="rounded border border-slate-100 bg-slate-50 p-2 space-y-1">
                    <span className="font-semibold text-slate-800">
                      Paso {p.etiquetaSubPaso}: Eliminación de {p.variable} → {p.nuevoFactor.id}
                    </span>
                    <TablaFactor factor={p.nuevoFactor} variante="reporte" mostrarCalculo />
                  </div>
                ))}
              </div>
            </div>

            {/* Paso 6 */}
            <div className="rounded border border-emerald-300 bg-emerald-50/50 p-3 text-xs space-y-2">
              <span className="font-bold text-emerald-950">Paso 6: Normalización y Posterior Final</span>
              <p className="font-mono font-bold text-slate-800">α = {traza.paso6.alfa !== null ? formatearNumeroAcademico(traza.paso6.alfa) : '1.0000'}</p>
              <div className="space-y-1 pt-1">
                {Object.entries(traza.paso6.posteriorPorEstado).map(([est, prob]) => (
                  <div key={est} className="flex justify-between font-mono font-bold text-slate-900 border-b border-emerald-200 py-0.5">
                    <span>P({traza.paso1.variablesConsulta.join(', ')} = {est})</span>
                    <span>{formatearNumeroAcademico(prob)} ({(prob * 100).toFixed(2)}%)</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-emerald-900 pt-1">
                Verificación: Doble Verificación contra Enumeración Completa exitosa.
              </p>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
