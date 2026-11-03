//Tabla Factor Autor Leonardo Soria Raya
import { formatearNumeroAcademico, type Factor } from '../nucleo';

export interface PropiedadesTablaFactor {
  readonly factor: Factor;
  readonly mostrarCalculo?: boolean;
  readonly subtitulo?: string;
  readonly variante?: 'panel' | 'reporte';
}

/**
 * Componente unificado para renderizar tablas de factores (constantes escalares o multidimensionales),
 * expresiones aritméticas paso a paso y valores numéricos exactos formateados.
 */
export function TablaFactor({
  factor,
  mostrarCalculo = false,
  subtitulo,
  variante = 'panel',
}: PropiedadesTablaFactor) {
  const tieneCalculo = mostrarCalculo && factor.filas.some((f) => Boolean(f.textoCalculo));
  const titulo = factor.variables.length > 0 ? `${factor.id}(${factor.variables.join(', ')})` : factor.id;
  const textoSubtitulo = subtitulo ?? (variante === 'reporte' && factor.etiquetaOrigen ? factor.etiquetaOrigen : undefined);

  if (factor.variables.length === 0) {
    const val = factor.filas[0]?.valor ?? 1;
    const calc = factor.filas[0]?.textoCalculo;
    return (
      <div className={`rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs ${variante === 'reporte' ? 'font-mono' : ''}`}>
        <div className="flex items-center justify-between font-mono font-bold text-slate-800">
          <span>{factor.id}</span>
          <span className="text-[10px] font-normal text-slate-500">(Constante escalar)</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-slate-700">
          {mostrarCalculo && calc ? `${calc} = ` : ''}
          <strong>{formatearNumeroAcademico(val)}</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-xs">
      <div className="flex items-center justify-between bg-slate-100/70 px-3 py-1.5 text-[11px] border-b border-slate-200">
        <span className="font-mono font-bold text-slate-800">{titulo}</span>
        {textoSubtitulo && <span className="text-slate-500">{textoSubtitulo}</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold text-slate-600">
              {factor.variables.map((v) => (
                <th key={v} className="border-r border-slate-200 px-2.5 py-1.5 font-mono">
                  {v}
                </th>
              ))}
              {tieneCalculo && (
                <th className="border-r border-slate-200 px-2.5 py-1.5">
                  Expresión aritmética
                </th>
              )}
              <th className="px-2.5 py-1.5 text-right font-mono">
                Valor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {factor.filas.map((fila, idx) => (
              <tr key={idx} className="hover:bg-slate-50/40">
                {factor.variables.map((v) => (
                  <td
                    key={v}
                    className="border-r border-slate-200 bg-slate-50/50 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-800"
                  >
                    {fila.asignacion[v] ?? ''}
                  </td>
                ))}
                {tieneCalculo && (
                  <td className="numeros-tabulares border-r border-slate-200 px-2.5 py-1 font-mono text-[11px] text-slate-700">
                    {fila.textoCalculo ?? '—'}
                  </td>
                )}
                <td className="numeros-tabulares px-2.5 py-1 text-right font-mono font-bold text-slate-900">
                  {formatearNumeroAcademico(fila.valor)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
