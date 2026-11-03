//Nodo grafo Leonardo Soria Raya
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CircleDot, Eye, Scissors, Target } from 'lucide-react';
import { memo } from 'react';
import { formatearNumeroAcademico, type ValorEstado } from '../nucleo';

export type RolConsultaNodo =
  | 'consulta'
  | 'evidencia'
  | 'oculto-activo'
  | 'podado';

export type RolMantaNodo = 'objetivo' | 'padre' | 'hijo' | 'copadre' | null;

export type DatosNodoGrafo = {
  readonly idNodo: string;
  readonly nombre: string;
  readonly estados: readonly ValorEstado[];
  readonly etiquetasEstados?: Readonly<Record<ValorEstado, string>>;
  readonly rol: RolConsultaNodo;
  readonly valorEvidencia?: ValorEstado;
  readonly seleccionado: boolean;
  readonly tieneErrorValidacion: boolean;
  readonly rolMantaMarkov: RolMantaNodo;
  readonly resumenPosterior?: {
    readonly estado: ValorEstado;
    readonly probabilidad: number;
    readonly tieneEvidencia: boolean;
  };
};

export type NodoFlujoGrafo = Node<DatosNodoGrafo, 'nodoBayes'>;

function ComponenteNodoGrafo({ data }: NodeProps<NodoFlujoGrafo>) {
  let clasesBordeFondo = 'border-slate-300 bg-white text-slate-900 shadow-xs hover:border-slate-400';
  let clasesBadge = 'border-slate-200 bg-slate-100 text-slate-600';
  let textoBadge = 'Oculto';
  let IconoRol = CircleDot;

  if (data.rol === 'consulta') {
    clasesBordeFondo = 'border-2 border-blue-600 bg-blue-50/90 text-slate-950 shadow-sm';
    clasesBadge = 'border-blue-700 bg-blue-600 text-white font-semibold';
    textoBadge = 'Consulta (Q)';
    IconoRol = Target;
  } else if (data.rol === 'evidencia') {
    clasesBordeFondo = 'border-2 border-emerald-600 bg-emerald-50/90 text-slate-950 shadow-sm';
    clasesBadge = 'border-emerald-800 bg-emerald-700 text-white font-semibold';
    textoBadge = `Evidencia: ${data.idNodo}=${data.valorEvidencia ?? ''}`;
    IconoRol = Eye;
  } else if (data.rol === 'podado') {
    clasesBordeFondo = 'opacity-40 border-2 border-dashed border-slate-400 bg-slate-50 text-slate-500';
    clasesBadge = 'border-dashed border-slate-300 bg-slate-200 text-slate-600';
    textoBadge = 'Podado (∑=1)';
    IconoRol = Scissors;
  }

  const anillo = data.seleccionado
    ? 'ring-2 ring-blue-600 ring-offset-2'
    : data.rolMantaMarkov !== null
      ? 'ring-2 ring-amber-500 ring-offset-2'
      : '';

  return (
    <div
      aria-label={`Nodo ${data.idNodo}: ${data.nombre}. Rol: ${textoBadge}`}
      title="Clic para editar propiedades y CPT en el panel izquierdo"
      className={`relative w-[200px] rounded-2xl border p-3 transition-all select-none ${clasesBordeFondo} ${anillo}`}
    >
      {/* Asa superior central (Entrada de múltiples padres) */}
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={true}
        aria-label={`Entrada de padres hacia ${data.idNodo}`}
        className="!h-3.5 !w-3.5 !border-2 !border-white !bg-slate-500 hover:!bg-blue-600 hover:!scale-125 transition-transform cursor-crosshair !-top-1.5"
      />

      {/* Cabecera del nodo: Rol y CPT status */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${clasesBadge}`}>
          <IconoRol className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate max-w-[130px]">{textoBadge}</span>
        </span>
        {data.tieneErrorValidacion && (
          <span
            title="CPT incompleta o inválida"
            className="rounded-full bg-red-100 px-1.5 py-0.2 text-[9px] font-bold text-red-700"
          >
            !CPT
          </span>
        )}
      </div>

      {/* Identificador y Nombre */}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="font-mono text-base font-extrabold text-slate-900 shrink-0">
          {data.idNodo}
        </span>
        <span className="truncate text-xs font-medium text-slate-600" title={data.nombre}>
          {data.nombre}
        </span>
      </div>

      {/* Estados disponibles */}
      <div className="mt-2 flex flex-wrap gap-1">
        {data.estados.map((estado) => {
          const etiqueta = data.etiquetasEstados?.[estado] ?? estado;
          const esEvidencia = data.rol === 'evidencia' && data.valorEvidencia === estado;
          return (
            <span
              key={estado}
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${
                esEvidencia
                  ? 'border border-emerald-600 bg-emerald-600 text-white font-bold'
                  : 'border border-slate-200 bg-slate-100 text-slate-600'
              }`}
            >
              {etiqueta}
            </span>
          );
        })}
      </div>

      {/* Resumen posterior para nodo de consulta */}
      {data.resumenPosterior && data.rol === 'consulta' && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-100/70 px-2 py-1 text-[11px] font-semibold text-blue-950">
          <span>P({data.idNodo}={data.resumenPosterior.estado})</span>
          <span className="font-mono font-bold">
            {formatearNumeroAcademico(data.resumenPosterior.probabilidad)}
          </span>
        </div>
      )}

      {/* Asa inferior central (Salida hacia múltiples hijos) */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={true}
        aria-label={`Salida hacia hijos desde ${data.idNodo}`}
        className="!h-3.5 !w-3.5 !border-2 !border-white !bg-slate-500 hover:!bg-blue-600 hover:!scale-125 transition-transform cursor-crosshair !-bottom-1.5"
      />
    </div>
  );
}

export const NodoGrafo = memo(ComponenteNodoGrafo);

