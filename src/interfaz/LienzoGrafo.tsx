import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type DefaultEdgeOptions,
  type Edge,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  calcularMantaMarkov,
  podarNodosIrrelevantes,
  type IdNodo,
} from '../nucleo';
import {
  calcularAutoDiseno,
  type CoordenadaLienzo,
  type OrientacionDiseno,
} from './autoDiseno';
import { NodoGrafo, type NodoFlujoGrafo, type RolConsultaNodo, type RolMantaNodo } from './NodoGrafo';
import { useStoreRed } from './store/useStoreRed';

export { calcularAutoDiseno, type CoordenadaLienzo, type OrientacionDiseno };

const TIPOS_NODOS: NodeTypes = {
  nodoBayes: NodoGrafo,
};

const OPCIONES_ARISTAS_DEFECTO: DefaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
};

function ContenidoLienzo() {
  const flujo = useReactFlow();

  const red = useStoreRed((s) => s.red);
  const variablesConsulta = useStoreRed((s) => s.variablesConsulta);
  const evidencia = useStoreRed((s) => s.evidencia);
  const problemasValidacion = useStoreRed((s) => s.problemasValidacion);
  const idNodoSeleccionado = useStoreRed((s) => s.idNodoSeleccionado);
  const idNodoMantaResaltada = useStoreRed((s) => s.idNodoMantaResaltada);
  const trazaActiva = useStoreRed((s) => s.trazaActiva);
  const notificacion = useStoreRed((s) => s.notificacionLienzo);
  const contadorAjusteVista = useStoreRed((s) => s.contadorAjusteVista);

  const seleccionarNodo = useStoreRed((s) => s.seleccionarNodo);
  const actualizarPosicionNodo = useStoreRed((s) => s.actualizarPosicionNodo);
  const conectarArista = useStoreRed((s) => s.conectarArista);
  const establecerNotificacion = useStoreRed((s) => s.establecerNotificacionLienzo);

  const [aristaSeleccionada, setAristaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    if (red.nodos.length === 0) return;
    const t = window.setTimeout(() => {
      void flujo.fitView({ padding: 0.25, duration: 200 });
    }, 60);
    return () => clearTimeout(t);
  }, [red.nodos.length, contadorAjusteVista, flujo]);

  const nodosPodados = useMemo(() => {
    if (variablesConsulta.length === 0) return new Set<IdNodo>();
    const poda = podarNodosIrrelevantes(red, variablesConsulta, evidencia);
    return new Set<IdNodo>(poda.nodosPodados.map((n) => n.id));
  }, [red, variablesConsulta, evidencia]);

  const rolesManta = useMemo(() => {
    const mapa = new Map<IdNodo, RolMantaNodo>();
    if (!idNodoMantaResaltada) return mapa;
    const m = calcularMantaMarkov(red, idNodoMantaResaltada);
    mapa.set(idNodoMantaResaltada, 'objetivo');
    for (const p of m.padres) mapa.set(p, 'padre');
    for (const h of m.hijos) mapa.set(h, 'hijo');
    for (const c of m.copadres) mapa.set(c, 'copadre');
    return mapa;
  }, [red, idNodoMantaResaltada]);

  const erroresNodos = useMemo(() => {
    const s = new Set<IdNodo>();
    for (const p of problemasValidacion) {
      if (p.idNodo) s.add(p.idNodo);
    }
    return s;
  }, [problemasValidacion]);

  const generarNodosFlujo = useCallback((): NodoFlujoGrafo[] => {
    return red.nodos.map((n) => {
      let rol: RolConsultaNodo = 'oculto-activo';
      if (variablesConsulta.includes(n.id)) {
        rol = 'consulta';
      } else if (n.id in evidencia) {
        rol = 'evidencia';
      } else if (nodosPodados.has(n.id)) {
        rol = 'podado';
      }

      const valEv = evidencia[n.id];
      const resumenPost =
        rol === 'consulta' && trazaActiva?.paso6?.posteriorPorEstado
          ? {
              estado: n.estados[0]!,
              probabilidad: trazaActiva.paso6.posteriorPorEstado[n.estados[0]!] ?? 0,
              tieneEvidencia: Object.keys(evidencia).length > 0,
            }
          : undefined;

      return {
        id: n.id,
        type: 'nodoBayes',
        position: { x: n.posicion.x, y: n.posicion.y },
        data: {
          idNodo: n.id,
          nombre: n.nombre,
          estados: n.estados,
          ...(n.etiquetasEstados !== undefined
            ? { etiquetasEstados: n.etiquetasEstados }
            : {}),
          rol,
          ...(valEv !== undefined ? { valorEvidencia: valEv } : {}),
          seleccionado: idNodoSeleccionado === n.id,
          tieneErrorValidacion: erroresNodos.has(n.id),
          rolMantaMarkov: rolesManta.get(n.id) ?? null,
          ...(resumenPost !== undefined ? { resumenPosterior: resumenPost } : {}),
        },
      };
    });
  }, [
    red.nodos,
    variablesConsulta,
    evidencia,
    nodosPodados,
    trazaActiva,
    idNodoSeleccionado,
    erroresNodos,
    rolesManta,
  ]);

  const [nodes, setNodes] = useState<NodoFlujoGrafo[]>(generarNodosFlujo);

  useEffect(() => {
    setNodes(generarNodosFlujo());
  }, [generarNodosFlujo]);

  const aristasFlujo: Edge[] = useMemo(() => {
    const conocidos = new Set(red.nodos.map((n) => n.id));
    const lista: Edge[] = [];

    for (const n of red.nodos) {
      for (const p of n.padres) {
        if (!conocidos.has(p)) continue;
        const idArista = `${p}->${n.id}`;
        const esPodada = nodosPodados.has(p) || nodosPodados.has(n.id);
        const sel = aristaSeleccionada === idArista;
        const color = sel ? '#2563eb' : esPodada ? '#94a3b8' : '#475569';

        lista.push({
          id: idArista,
          source: p,
          target: n.id,
          type: 'smoothstep',
          selected: sel,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color,
          },
          style: {
            stroke: color,
            strokeWidth: sel ? 2.5 : 1.7,
            ...(esPodada ? { strokeDasharray: '5 4', opacity: 0.6 } : {}),
          },
        });
      }
    }
    return lista;
  }, [red.nodos, nodosPodados, aristaSeleccionada]);

  const manejarCambiosNodos = useCallback(
    (cambios: NodeChange<NodoFlujoGrafo>[]) => {
      setNodes((nds) => applyNodeChanges(cambios, nds));
    },
    [],
  );

  const manejarFinArrastreNodo: OnNodeDrag<NodoFlujoGrafo> = useCallback(
    (_, nodo) => {
      actualizarPosicionNodo(nodo.id, {
        x: Math.round(nodo.position.x),
        y: Math.round(nodo.position.y),
      });
    },
    [actualizarPosicionNodo],
  );

  const manejarConexion = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      conectarArista(c.source, c.target);
    },
    [conectarArista],
  );

  return (
    <section aria-label="Lienzo interactivo del Grafo Dirigido Acíclico (DAG)" className="relative h-full w-full bg-slate-50 overflow-hidden">
      {/* Notificación flotante de ciclo evitado o acción */}
      {notificacion && (
        <div
          role={notificacion.tipo === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-2 rounded-xl border px-3 py-2 text-xs shadow-md ${
            notificacion.tipo === 'error'
              ? 'border-red-300 bg-red-50 text-red-950'
              : notificacion.tipo === 'exito'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-slate-300 bg-white text-slate-800'
          }`}
        >
          <div className="flex items-start gap-2">
            {notificacion.tipo === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            ) : notificacion.tipo === 'exito' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <p className="font-semibold">{notificacion.mensaje}</p>
              {notificacion.rutaCiclo && notificacion.rutaCiclo.length > 0 && (
                <p className="mt-0.5 font-mono text-[11px] text-red-800">
                  Ciclo evitado: {notificacion.rutaCiclo.join(' → ')}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => establecerNotificacion(null)}
            aria-label="Cerrar notificación del lienzo"
            className="rounded p-0.5 hover:bg-slate-200"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Lienzo limpio sin controles de zoom ni barra flotante inferior */}
      <ReactFlow
        nodes={nodes}
        edges={aristasFlujo}
        nodeTypes={TIPOS_NODOS}
        connectionMode={ConnectionMode.Loose}
        defaultEdgeOptions={OPCIONES_ARISTAS_DEFECTO}
        onNodesChange={manejarCambiosNodos}
        onNodeDragStop={manejarFinArrastreNodo}
        onConnect={manejarConexion}
        onNodeClick={(_, nodo) => seleccionarNodo(nodo.id)}
        onPaneClick={() => {
          seleccionarNodo(null);
          setAristaSeleccionada(null);
        }}
        onEdgeClick={(_, arista) => {
          setAristaSeleccionada(arista.id);
        }}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2.5}
        snapToGrid
        snapGrid={[12, 12]}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
      </ReactFlow>
    </section>
  );
}

export function LienzoGrafo() {
  return (
    <ReactFlowProvider>
      <ContenidoLienzo />
    </ReactFlowProvider>
  );
}
