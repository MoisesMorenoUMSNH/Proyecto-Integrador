// barra superior desarrollado por Cesar Ambris Salguero 
import {
  Download,
  FilePlus2,
  FileUp,
  FolderOpen,
  Network,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { serializarRedJson } from '../nucleo';
import { CATALOGO_EJEMPLOS } from './catalogoEjemplos';
import { descargarArchivo } from './descargarArchivo';
import { useStoreRed } from './store/useStoreRed';

export function BarraSuperior() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const red = useStoreRed((s) => s.red);
  const idEjemploActivo = useStoreRed((s) => s.idEjemploActivo);
  const problemasValidacion = useStoreRed((s) => s.problemasValidacion);
  const mostrarVistaReporte = useStoreRed((s) => s.mostrarVistaReporte);

  const crearNuevaRed = useStoreRed((s) => s.crearNuevaRed);
  const cargarEjemploGaleria = useStoreRed((s) => s.cargarEjemploGaleria);
  const importarTextoJson = useStoreRed((s) => s.importarTextoJson);
  const autoOrganizarDiseno = useStoreRed((s) => s.autoOrganizarDiseno);
  const establecerMostrarVistaReporte = useStoreRed(
    (s) => s.establecerMostrarVistaReporte,
  );
  const establecerNotificacion = useStoreRed(
    (s) => s.establecerNotificacionLienzo,
  );

  const manejarGuardarJson = () => {
    const json = serializarRedJson(red, 2);
    const nombre = `${red.metadatos.id || 'red-bayesiana'}.json`;
    descargarArchivo(json, nombre, 'application/json');
    establecerNotificacion({
      tipo: 'exito',
      mensaje: `Archivo "${nombre}" guardado.`,
    });
  };

  const manejarImportarArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const txt = await f.text();
      importarTextoJson(txt, f.name);
    } catch {
      establecerNotificacion({
        tipo: 'error',
        mensaje: `Error al leer "${f.name}".`,
      });
    } finally {
      e.target.value = '';
    }
  };

  const esValido = problemasValidacion.length === 0;

  return (
    <header className="ocultar-en-impresion flex h-12 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4">
      {/* Lado izquierdo: Título, Galería e Indicador de Validez */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Network className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-900 hidden sm:inline">
            Redes Bayesianas
          </span>
        </div>

        {/* 1. Selector de Galería (/ejemplos) */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 min-w-0">
          <FolderOpen className="h-3.5 w-3.5 text-slate-400 hidden md:inline shrink-0" aria-hidden="true" />
          <select
            id="selector-galeria-ejemplos"
            aria-label="Cargar ejemplo oficial de la galería"
            value={idEjemploActivo ?? ''}
            onChange={(e) => e.target.value && cargarEjemploGaleria(e.target.value)}
            className="h-7 max-w-[210px] sm:max-w-xs truncate rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 hover:border-slate-400 focus:outline-none"
          >
            <option value="" disabled>
              Ejemplos oficiales...
            </option>
            {CATALOGO_EJEMPLOS.map((ej) => (
              <option key={ej.id} value={ej.id}>
                {ej.etiquetaMenu}
              </option>
            ))}
          </select>
        </div>

        {/* 7. Indicador sutil de validación */}
        <div className="pl-1">
          {esValido ? (
            <span
              title="DAG acíclico y CPTs normalizadas a 1.0000"
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 border border-emerald-200"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Válido</span>
            </span>
          ) : (
            <span
              title={problemasValidacion.map((p) => `[${p.codigo}] ${p.mensaje}`).join('\n')}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-800 border border-red-200"
            >
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span>{problemasValidacion.length} error(es)</span>
            </span>
          )}
        </div>
      </div>

      {/* Lado derecho: Botones sin duplicados */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={manejarImportarArchivo}
          className="sr-only"
          aria-label="Seleccionar archivo JSON"
        />

        {/* 2. Botón Nueva Red */}
        <button
          type="button"
          onClick={crearNuevaRed}
          title="Crear un lienzo limpio"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <FilePlus2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden sm:inline">Nueva Red</span>
        </button>

        {/* 3. Botón agrupado: Importar / Guardar JSON */}
        <div className="inline-flex h-7 rounded-lg border border-slate-300 bg-white shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Importar archivo JSON"
            className="inline-flex items-center gap-1 border-r border-slate-200 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <FileUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            type="button"
            onClick={manejarGuardarJson}
            disabled={red.nodos.length === 0}
            title="Guardar red en JSON"
            className="inline-flex items-center gap-1 px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline">Guardar JSON</span>
          </button>
        </div>

        {/* 4. Botón Auto-organizar (Único del sistema) */}
        <button
          type="button"
          onClick={() => autoOrganizarDiseno('TB')}
          disabled={red.nodos.length === 0}
          title="Auto-organizar jerárquicamente de arriba hacia abajo"
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <RotateCcw className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden md:inline">Auto-organizar</span>
        </button>

        {/* 5. Botón Reporte */}
        <button
          type="button"
          onClick={() => establecerMostrarVistaReporte(!mostrarVistaReporte)}
          disabled={red.nodos.length === 0}
          aria-label="Imprimir / Exportar Reporte"
          title="Ver reporte imprimible o exportar en PDF"
          className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold shadow-xs transition-colors ${
            mostrarVistaReporte
              ? 'bg-slate-800 text-white hover:bg-slate-900'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Printer className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{mostrarVistaReporte ? 'Volver al Editor de 3 Paneles' : 'Reporte'}</span>
        </button>
      </div>
    </header>
  );
}

