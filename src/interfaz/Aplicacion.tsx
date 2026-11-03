import { Calculator, Network, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { BarraSuperior } from './BarraSuperior';
import { LienzoGrafo } from './LienzoGrafo';
import { PanelEditor } from './PanelEditor';
import { PanelInferencia } from './PanelInferencia';
import { useStoreRed } from './store/useStoreRed';
import { VistaReporte } from './VistaReporte';

type PanelMovil = 'editor' | 'lienzo' | 'inferencia';

export function Aplicacion() {
  const [panelMovil, setPanelMovil] = useState<PanelMovil>('lienzo');
  const mostrarVistaReporte = useStoreRed((s) => s.mostrarVistaReporte);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 lg:h-screen lg:overflow-hidden font-sans">
      <BarraSuperior />

      {mostrarVistaReporte ? (
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <VistaReporte />
        </main>
      ) : (
        <>
          {/* Navegación móvil para pantallas compactas (< 1024px) */}
          <nav
            aria-label="Selector de panel en pantallas compactas"
            className="ocultar-en-impresion flex border-b border-slate-200 bg-white px-3 py-1.5 gap-2 lg:hidden"
          >
            <button
              type="button"
              onClick={() => setPanelMovil('editor')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${
                panelMovil === 'editor' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editor & CPT</span>
            </button>
            <button
              type="button"
              onClick={() => setPanelMovil('lienzo')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${
                panelMovil === 'lienzo' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Network className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Lienzo DAG</span>
            </button>
            <button
              type="button"
              onClick={() => setPanelMovil('inferencia')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${
                panelMovil === 'inferencia' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Inferencia</span>
            </button>
          </nav>

          {/* Distribución definitiva de 3 paneles: Editor Fijo (~25%) | Lienzo Central (~50%) | Inferencia (~25%) */}
          <main className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
            {/* Panel Izquierdo SIEMPRE Fijo y Visible (~25% de ancho) */}
            <div
              className={`${
                panelMovil === 'editor' ? 'flex' : 'hidden'
              } w-full flex-col lg:flex lg:w-[320px] xl:w-[360px] lg:shrink-0 lg:min-h-0`}
            >
              <PanelEditor />
            </div>

            {/* Lienzo Central Amplio y Despejado */}
            <div
              className={`${
                panelMovil === 'lienzo' ? 'flex' : 'hidden'
              } h-[520px] w-full flex-col lg:flex lg:h-full lg:flex-1 lg:min-h-0`}
            >
              <LienzoGrafo />
            </div>

            {/* Panel Derecho de Inferencia Compacto (~25% de ancho) */}
            <div
              className={`${
                panelMovil === 'inferencia' ? 'flex' : 'hidden'
              } w-full flex-col lg:flex lg:w-[320px] xl:w-[360px] lg:shrink-0 lg:min-h-0`}
            >
              <PanelInferencia />
            </div>
          </main>
        </>
      )}
    </div>
  );
}
