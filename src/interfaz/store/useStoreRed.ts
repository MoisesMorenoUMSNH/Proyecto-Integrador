import { create } from 'zustand';
import {
  ESTADOS_BINARIOS_CANONICOS,
  MAX_NODOS_RED,
  actualizarCptNodo,
  autocompletarFilaBinaria,
  crearCptUniforme,
  ejecutarEliminacionVariables,
  normalizarDistribucionFila,
  obtenerDominiosPadres,
  parsearRedJson,
  podarNodosIrrelevantes,
  puedeAgregarArista,
  redimensionarCptNodo,
  renombrarNodoEnRed,
  validarRedBayesiana,
  type AsignacionVariables,
  type EstrategiaEliminacion,
  type FilaCPT,
  type IdNodo,
  type NodoBayes,
  type ProblemaValidacion,
  type RedBayesiana,
  type TrazaEliminacionVariables,
  type ValorEstado,
} from '../../nucleo';
import {
  calcularAutoDiseno,
  type CoordenadaLienzo,
  type OrientacionDiseno,
} from '../autoDiseno';
import {
  CATALOGO_EJEMPLOS,
  type ElementoGaleriaEjemplo,
} from '../catalogoEjemplos';

export {
  CATALOGO_EJEMPLOS,
  type ElementoGaleriaEjemplo,
  type CoordenadaLienzo,
  type OrientacionDiseno,
};

export interface NotificacionLienzo {
  readonly tipo: 'error' | 'info' | 'exito';
  readonly mensaje: string;
  readonly rutaCiclo?: readonly IdNodo[];
}

export interface ResultadoAccionEdicion {
  readonly exito: boolean;
  readonly mensaje?: string;
}

const REGEX_ID_VALIDO = /^[A-Za-z][A-Za-z0-9_]*$/;

function sincronizarOrdenManual(
  red: RedBayesiana,
  variablesConsulta: readonly IdNodo[],
  evidencia: AsignacionVariables,
  ordenPrevio: readonly IdNodo[],
): IdNodo[] {
  if (variablesConsulta.length === 0) {
    return [];
  }
  const poda = podarNodosIrrelevantes(red, variablesConsulta, evidencia);
  const ocultasActivas = poda.variablesOcultasActivas;
  const conjuntoActivas = new Set(ocultasActivas);

  const conservadas = ordenPrevio.filter((id) => conjuntoActivas.has(id));
  const conjuntoConservadas = new Set(conservadas);
  const faltantes = ocultasActivas.filter((id) => !conjuntoConservadas.has(id));

  return [...conservadas, ...faltantes];
}

function prepararEstadoDesdeRed(
  red: RedBayesiana,
  idEjemploActivo: string | null,
): Pick<
  EstadoStoreRed,
  | 'red'
  | 'idEjemploActivo'
  | 'problemasValidacion'
  | 'idNodoSeleccionado'
  | 'idNodoMantaResaltada'
  | 'variablesConsulta'
  | 'evidencia'
  | 'estrategiaEliminacion'
  | 'ordenManual'
  | 'idConsultaPredefinidaSeleccionada'
  | 'trazaActiva'
  | 'erroresConsulta'
> {
  const problemasValidacion = validarRedBayesiana(red);
  const primeraPredefinida = red.consultasPredefinidas?.[0];

  let variablesConsulta: readonly IdNodo[] = [];
  let evidencia: Readonly<Record<IdNodo, ValorEstado>> = {};
  let estrategiaEliminacion: EstrategiaEliminacion = 'minimo-relleno';
  let ordenSugerido: readonly IdNodo[] = [];
  let idConsultaPredefinidaSeleccionada = '';

  if (primeraPredefinida) {
    variablesConsulta = [...primeraPredefinida.variablesConsulta];
    evidencia = { ...primeraPredefinida.evidencia };
    idConsultaPredefinidaSeleccionada = primeraPredefinida.id;
    if (
      primeraPredefinida.ordenSugerido &&
      primeraPredefinida.ordenSugerido.length > 0
    ) {
      estrategiaEliminacion = 'manual';
      ordenSugerido = [...primeraPredefinida.ordenSugerido];
    }
  } else if (red.nodos.length > 0) {
    const ultimoNodo = red.nodos[red.nodos.length - 1]!;
    variablesConsulta = [ultimoNodo.id];
  }

  const ordenManual = sincronizarOrdenManual(
    red,
    variablesConsulta,
    evidencia,
    ordenSugerido,
  );

  let trazaActiva: TrazaEliminacionVariables | null = null;
  let erroresConsulta: readonly ProblemaValidacion[] = [];

  if (problemasValidacion.length === 0 && variablesConsulta.length > 0) {
    const ejecucion = ejecutarEliminacionVariables(red, {
      variablesConsulta,
      evidencia,
      estrategia: estrategiaEliminacion,
      ...(estrategiaEliminacion === 'manual' ? { ordenManual } : {}),
    });
    if (ejecucion.exito) {
      trazaActiva = ejecucion.traza;
    } else {
      erroresConsulta = ejecucion.errores;
    }
  }

  return {
    red,
    idEjemploActivo,
    problemasValidacion,
    idNodoSeleccionado: red.nodos[0]?.id ?? null,
    idNodoMantaResaltada: null,
    variablesConsulta,
    evidencia,
    estrategiaEliminacion,
    ordenManual,
    idConsultaPredefinidaSeleccionada,
    trazaActiva,
    erroresConsulta,
  };
}

export interface EstadoStoreRed {
  readonly red: RedBayesiana;
  readonly idEjemploActivo: string | null;
  readonly problemasValidacion: readonly ProblemaValidacion[];
  readonly erroresImportacion: readonly ProblemaValidacion[];
  readonly notificacionLienzo: NotificacionLienzo | null;
  readonly idNodoSeleccionado: IdNodo | null;
  readonly idNodoMantaResaltada: IdNodo | null;

  readonly variablesConsulta: readonly IdNodo[];
  readonly evidencia: Readonly<Record<IdNodo, ValorEstado>>;
  readonly estrategiaEliminacion: EstrategiaEliminacion;
  readonly ordenManual: readonly IdNodo[];
  readonly idConsultaPredefinidaSeleccionada: string;

  readonly trazaActiva: TrazaEliminacionVariables | null;
  readonly erroresConsulta: readonly ProblemaValidacion[];

  readonly mostrarVistaReporte: boolean;
  readonly visorPasosAmpliado: boolean;
  readonly orientacionDisenoActual: OrientacionDiseno;
  readonly contadorAjusteVista: number;

  // Acciones de persistencia y barra superior
  crearNuevaRed: () => void;
  cargarEjemploGaleria: (idEjemplo: string) => void;
  importarTextoJson: (textoJson: string, nombreArchivo?: string) => boolean;
  limpiarErroresImportacion: () => void;
  establecerNotificacionLienzo: (notificacion: NotificacionLienzo | null) => void;
  actualizarMetadatosRed: (cambios: {
    readonly titulo?: string;
    readonly descripcion?: string;
    readonly dominio?: string;
    readonly autor?: string;
  }) => void;
  autoOrganizarDiseno: (orientacion?: OrientacionDiseno) => void;

  // Acciones de selección y Manta de Markov
  seleccionarNodo: (idNodo: IdNodo | null) => void;
  alternarResaltadoMantaMarkov: (idNodo: IdNodo | null) => void;

  // Acciones sobre nodos, aristas y CPTs
  agregarNodo: (posicion?: CoordenadaLienzo) => IdNodo | null;
  eliminarNodo: (idNodo: IdNodo) => void;
  actualizarPosicionNodo: (idNodo: IdNodo, posicion: CoordenadaLienzo) => void;
  conectarArista: (idOrigen: IdNodo, idDestino: IdNodo) => boolean;
  eliminarArista: (idOrigen: IdNodo, idDestino: IdNodo) => void;
  alternarPadreNodo: (idNodoHijo: IdNodo, idPadre: IdNodo) => boolean;
  renombrarIdNodo: (idActual: IdNodo, nuevoIdCrudo: string) => ResultadoAccionEdicion;
  actualizarDatosNodo: (
    idNodo: IdNodo,
    cambios: { readonly nombre?: string; readonly descripcion?: string },
  ) => void;
  actualizarEstadosNodo: (
    idNodo: IdNodo,
    nuevosEstadosCrudos: readonly string[],
    etiquetasEstados?: Readonly<Record<ValorEstado, string>>,
  ) => ResultadoAccionEdicion;
  actualizarProbabilidadCeldaCpt: (
    idNodo: IdNodo,
    indiceFila: number,
    estadoEditado: ValorEstado,
    nuevoValor: number,
    autocompletarBinario?: boolean,
  ) => void;
  normalizarFilaCpt: (idNodo: IdNodo, indiceFila: number) => void;
  restablecerCptUniformeNodo: (idNodo: IdNodo) => void;

  // Acciones de consulta e inferencia
  establecerRolVariableConsulta: (
    idNodo: IdNodo,
    rol: 'oculta' | 'consulta' | 'evidencia',
    valorEvidencia?: ValorEstado,
  ) => void;
  actualizarValorEvidencia: (idNodo: IdNodo, valor: ValorEstado) => void;
  limpiarConsultaYEvidencia: () => void;
  seleccionarConsultaPredefinida: (idConsulta: string) => void;
  cargarConsultaPredefinida: (idConsulta?: string) => void;
  establecerEstrategiaEliminacion: (estrategia: EstrategiaEliminacion) => void;
  moverVariableOrdenManual: (idVariable: IdNodo, direccion: 'subir' | 'bajar') => void;
  ejecutarInferenciaActual: () => boolean;

  // Acciones de visualización y reporte
  establecerMostrarVistaReporte: (mostrar: boolean) => void;
  alternarVisorPasosAmpliado: () => void;
}

const ejemploInicial = CATALOGO_EJEMPLOS[0]!;
const estadoInicialDerivado = prepararEstadoDesdeRed(
  ejemploInicial.red,
  ejemploInicial.id,
);

export const useStoreRed = create<EstadoStoreRed>((set, get) => ({
  ...estadoInicialDerivado,
  erroresImportacion: [],
  notificacionLienzo: null,
  mostrarVistaReporte: false,
  visorPasosAmpliado: false,
  orientacionDisenoActual: 'TB',
  contadorAjusteVista: 1,

  crearNuevaRed: () => {
    const redVacia: RedBayesiana = {
      versionEsquema: '1.0',
      metadatos: {
        id: 'nueva-red-bayesiana',
        titulo: 'Nueva Red Bayesiana',
        descripcion:
          'Agregue entre 3 y 10 nodos en el lienzo, defina sus relaciones dirigidas y complete sus CPTs.',
        dominio: 'Personalizado',
      },
      nodos: [],
    };

    set((estado) => ({
      red: redVacia,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(redVacia),
      erroresImportacion: [],
      notificacionLienzo: {
        tipo: 'info',
        mensaje:
          'Lienzo limpio iniciado. Agregue al menos 3 nodos para construir un modelo válido.',
      },
      idNodoSeleccionado: null,
      idNodoMantaResaltada: null,
      variablesConsulta: [],
      evidencia: {},
      estrategiaEliminacion: 'minimo-relleno',
      ordenManual: [],
      idConsultaPredefinidaSeleccionada: '',
      trazaActiva: null,
      erroresConsulta: [],
      mostrarVistaReporte: false,
      contadorAjusteVista: estado.contadorAjusteVista + 1,
    }));
  },

  cargarEjemploGaleria: (idEjemplo) => {
    const encontrado = CATALOGO_EJEMPLOS.find((item) => item.id === idEjemplo);
    if (!encontrado) return;

    const derivado = prepararEstadoDesdeRed(encontrado.red, encontrado.id);
    set((estado) => ({
      ...derivado,
      erroresImportacion: [],
      notificacionLienzo: {
        tipo: 'exito',
        mensaje: `Red cargada: ${encontrado.red.metadatos.titulo}`,
      },
      mostrarVistaReporte: false,
      contadorAjusteVista: estado.contadorAjusteVista + 1,
    }));
  },

  importarTextoJson: (textoJson, nombreArchivo) => {
    const parseado = parsearRedJson(textoJson);
    if (!parseado.exito) {
      set({
        erroresImportacion: parseado.errores,
        notificacionLienzo: {
          tipo: 'error',
          mensaje: `No se pudo importar${nombreArchivo ? ` "${nombreArchivo}"` : ' el archivo JSON'}: se detectaron ${parseado.errores.length} error(es) de validación.`,
        },
      });
      return false;
    }

    const derivado = prepararEstadoDesdeRed(parseado.valor, null);
    set((estado) => ({
      ...derivado,
      erroresImportacion: [],
      notificacionLienzo: {
        tipo: 'exito',
        mensaje: `Archivo importado correctamente: ${parseado.valor.metadatos.titulo}`,
      },
      mostrarVistaReporte: false,
      contadorAjusteVista: estado.contadorAjusteVista + 1,
    }));
    return true;
  },

  limpiarErroresImportacion: () => {
    set({ erroresImportacion: [] });
  },

  establecerNotificacionLienzo: (notificacion) => {
    set({ notificacionLienzo: notificacion });
  },

  actualizarMetadatosRed: (cambios) => {
    set((estado) => {
      const metaActual = estado.red.metadatos;
      const nuevoTitulo =
        cambios.titulo !== undefined ? cambios.titulo : metaActual.titulo;
      const nuevaDesc =
        cambios.descripcion !== undefined
          ? cambios.descripcion
          : metaActual.descripcion;
      const nuevoDominio =
        cambios.dominio !== undefined ? cambios.dominio : metaActual.dominio;
      const nuevoAutor =
        cambios.autor !== undefined ? cambios.autor : metaActual.autor;

      const nuevaRed: RedBayesiana = {
        ...estado.red,
        metadatos: {
          id: metaActual.id,
          titulo: nuevoTitulo,
          ...(nuevaDesc !== undefined && nuevaDesc.trim().length > 0
            ? { descripcion: nuevaDesc }
            : {}),
          ...(nuevoDominio !== undefined && nuevoDominio.trim().length > 0
            ? { dominio: nuevoDominio }
            : {}),
          ...(nuevoAutor !== undefined && nuevoAutor.trim().length > 0
            ? { autor: nuevoAutor }
            : {}),
        },
      };
      return { red: nuevaRed, idEjemploActivo: null };
    });
  },

  autoOrganizarDiseno: (orientacion) => {
    const estadoActual = get();
    const orientacionFinal = orientacion ?? estadoActual.orientacionDisenoActual;
    if (estadoActual.red.nodos.length === 0) return;

    const nuevasPosiciones = calcularAutoDiseno(
      estadoActual.red.nodos,
      orientacionFinal,
    );
    const nuevaRed: RedBayesiana = {
      ...estadoActual.red,
      nodos: estadoActual.red.nodos.map((nodo) => ({
        ...nodo,
        posicion: nuevasPosiciones[nodo.id] ?? nodo.posicion,
      })),
    };

    set((previo) => ({
      red: nuevaRed,
      orientacionDisenoActual: orientacionFinal,
      contadorAjusteVista: previo.contadorAjusteVista + 1,
      notificacionLienzo: {
        tipo: 'info',
        mensaje: `Disposición automática aplicada (${orientacionFinal === 'TB' ? 'Vertical: Arriba → Abajo' : 'Horizontal: Izquierda → Derecha'}).`,
      },
    }));
  },

  seleccionarNodo: (idNodo) => {
    set({ idNodoSeleccionado: idNodo });
  },

  alternarResaltadoMantaMarkov: (idNodo) => {
    set((estado) => ({
      idNodoMantaResaltada:
        estado.idNodoMantaResaltada === idNodo ? null : idNodo,
    }));
  },

  agregarNodo: (posicion) => {
    const estado = get();
    if (estado.red.nodos.length >= MAX_NODOS_RED) {
      set({
        notificacionLienzo: {
          tipo: 'error',
          mensaje: `Límite máximo alcanzado: la red no puede superar ${MAX_NODOS_RED} nodos.`,
        },
      });
      return null;
    }

    const idsExistentes = new Set(estado.red.nodos.map((n) => n.id));
    let indice = estado.red.nodos.length + 1;
    let nuevoId = `X${indice}`;
    while (idsExistentes.has(nuevoId)) {
      indice += 1;
      nuevoId = `X${indice}`;
    }

    const columna = estado.red.nodos.length % 3;
    const fila = Math.floor(estado.red.nodos.length / 3);
    const coordenada: CoordenadaLienzo = posicion ?? {
      x: 80 + columna * 260,
      y: 80 + fila * 170,
    };

    const nuevoNodo: NodoBayes = {
      id: nuevoId,
      nombre: `Variable ${indice}`,
      estados: [...ESTADOS_BINARIOS_CANONICOS],
      etiquetasEstados: { '1': 'Sí', '0': 'No' },
      padres: [],
      posicion: coordenada,
      cpt: crearCptUniforme(ESTADOS_BINARIOS_CANONICOS, [], {}),
    };

    const nuevaRed: RedBayesiana = {
      ...estado.red,
      nodos: [...estado.red.nodos, nuevoNodo],
    };

    const siguientesConsultas =
      estado.variablesConsulta.length > 0 ? estado.variablesConsulta : [nuevoId];

    const nuevoOrdenManual = sincronizarOrdenManual(
      nuevaRed,
      siguientesConsultas,
      estado.evidencia,
      estado.ordenManual,
    );

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      idNodoSeleccionado: nuevoId,
      variablesConsulta: siguientesConsultas,
      ordenManual: nuevoOrdenManual,
      trazaActiva: null,
      notificacionLienzo: {
        tipo: 'exito',
        mensaje: `Nodo "${nuevoId}" agregado (${nuevaRed.nodos.length}/${MAX_NODOS_RED} nodos).`,
      },
    });

    return nuevoId;
  },

  eliminarNodo: (idNodo) => {
    const estado = get();
    if (!estado.red.nodos.some((n) => n.id === idNodo)) return;

    const nodosFiltrados = estado.red.nodos.filter((n) => n.id !== idNodo);

    const nodosActualizados: NodoBayes[] = nodosFiltrados.map((nodo) => {
      if (!nodo.padres.includes(idNodo)) return nodo;
      const nuevosPadres = nodo.padres.filter((p) => p !== idNodo);
      const dominiosPadres = obtenerDominiosPadres(nodosFiltrados, nuevosPadres);
      return {
        ...nodo,
        padres: nuevosPadres,
        cpt: redimensionarCptNodo(nodo, nodo.estados, nuevosPadres, dominiosPadres),
      };
    });

    const nuevaRed: RedBayesiana = {
      ...estado.red,
      nodos: nodosActualizados,
    };

    const nuevasConsultas = estado.variablesConsulta.filter((q) => q !== idNodo);
    const nuevaEvidencia: Record<IdNodo, ValorEstado> = {};
    for (const [clave, valor] of Object.entries(estado.evidencia)) {
      if (clave !== idNodo) {
        nuevaEvidencia[clave] = valor;
      }
    }

    const nuevoOrdenManual = sincronizarOrdenManual(
      nuevaRed,
      nuevasConsultas,
      nuevaEvidencia,
      estado.ordenManual.filter((v) => v !== idNodo),
    );

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      idNodoSeleccionado:
        estado.idNodoSeleccionado === idNodo
          ? (nodosActualizados[0]?.id ?? null)
          : estado.idNodoSeleccionado,
      idNodoMantaResaltada:
        estado.idNodoMantaResaltada === idNodo ? null : estado.idNodoMantaResaltada,
      variablesConsulta: nuevasConsultas,
      evidencia: nuevaEvidencia,
      ordenManual: nuevoOrdenManual,
      trazaActiva: null,
      notificacionLienzo: {
        tipo: 'info',
        mensaje: `Nodo "${idNodo}" eliminado de la red.`,
      },
    });
  },

  actualizarPosicionNodo: (idNodo, posicion) => {
    set((estado) => ({
      red: {
        ...estado.red,
        nodos: estado.red.nodos.map((nodo) =>
          nodo.id === idNodo
            ? {
                ...nodo,
                posicion: {
                  x: Math.round(posicion.x),
                  y: Math.round(posicion.y),
                },
              }
            : nodo,
        ),
      },
    }));
  },

  conectarArista: (idOrigen, idDestino) => {
    const estado = get();
    const verificacion = puedeAgregarArista(estado.red, idOrigen, idDestino);
    if (!verificacion.permitida) {
      set({
        notificacionLienzo: {
          tipo: 'error',
          mensaje: verificacion.razon,
          ...(verificacion.rutaCiclo !== undefined
            ? { rutaCiclo: verificacion.rutaCiclo }
            : {}),
        },
      });
      return false;
    }

    const nodosActualizados = estado.red.nodos.map((nodo) => {
      if (nodo.id !== idDestino) return nodo;
      const nuevosPadres = [...nodo.padres, idOrigen];
      const dominiosPadres = obtenerDominiosPadres(estado.red.nodos, nuevosPadres);
      return {
        ...nodo,
        padres: nuevosPadres,
        cpt: redimensionarCptNodo(nodo, nodo.estados, nuevosPadres, dominiosPadres),
      };
    });

    const nuevaRed: RedBayesiana = {
      ...estado.red,
      nodos: nodosActualizados,
    };

    const nuevoOrdenManual = sincronizarOrdenManual(
      nuevaRed,
      estado.variablesConsulta,
      estado.evidencia,
      estado.ordenManual,
    );

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      ordenManual: nuevoOrdenManual,
      trazaActiva: null,
      notificacionLienzo: {
        tipo: 'exito',
        mensaje: `Relación dirigida ${idOrigen} → ${idDestino} agregada. CPT de "${idDestino}" actualizada.`,
      },
    });
    return true;
  },

  eliminarArista: (idOrigen, idDestino) => {
    const estado = get();
    const nodosActualizados = estado.red.nodos.map((nodo) => {
      if (nodo.id !== idDestino || !nodo.padres.includes(idOrigen)) return nodo;
      const nuevosPadres = nodo.padres.filter((p) => p !== idOrigen);
      const dominiosPadres = obtenerDominiosPadres(estado.red.nodos, nuevosPadres);
      return {
        ...nodo,
        padres: nuevosPadres,
        cpt: redimensionarCptNodo(nodo, nodo.estados, nuevosPadres, dominiosPadres),
      };
    });

    const nuevaRed: RedBayesiana = {
      ...estado.red,
      nodos: nodosActualizados,
    };

    const nuevoOrdenManual = sincronizarOrdenManual(
      nuevaRed,
      estado.variablesConsulta,
      estado.evidencia,
      estado.ordenManual,
    );

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      ordenManual: nuevoOrdenManual,
      trazaActiva: null,
      notificacionLienzo: {
        tipo: 'info',
        mensaje: `Relación dirigida ${idOrigen} → ${idDestino} eliminada.`,
      },
    });
  },

  alternarPadreNodo: (idNodoHijo, idPadre) => {
    const estado = get();
    const nodoHijo = estado.red.nodos.find((n) => n.id === idNodoHijo);
    if (!nodoHijo) return false;

    if (nodoHijo.padres.includes(idPadre)) {
      estado.eliminarArista(idPadre, idNodoHijo);
      return true;
    }
    return estado.conectarArista(idPadre, idNodoHijo);
  },

  renombrarIdNodo: (idActual, nuevoIdCrudo) => {
    const nuevoId = nuevoIdCrudo.trim();
    if (nuevoId === idActual) {
      return { exito: true };
    }
    if (!REGEX_ID_VALIDO.test(nuevoId)) {
      return {
        exito: false,
        mensaje:
          'El ID debe iniciar con una letra y contener únicamente letras, números o guion bajo (sin espacios).',
      };
    }

    const estado = get();
    if (estado.red.nodos.some((n) => n.id === nuevoId)) {
      return {
        exito: false,
        mensaje: `Ya existe un nodo con el identificador "${nuevoId}".`,
      };
    }

    const nuevaRed = renombrarNodoEnRed(estado.red, idActual, nuevoId);

    const nuevasConsultas = estado.variablesConsulta.map((q) =>
      q === idActual ? nuevoId : q,
    );
    const nuevaEvidencia: Record<IdNodo, ValorEstado> = {};
    for (const [clave, valor] of Object.entries(estado.evidencia)) {
      nuevaEvidencia[clave === idActual ? nuevoId : clave] = valor;
    }
    const nuevoOrdenManual = estado.ordenManual.map((v) =>
      v === idActual ? nuevoId : v,
    );

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      idNodoSeleccionado:
        estado.idNodoSeleccionado === idActual
          ? nuevoId
          : estado.idNodoSeleccionado,
      idNodoMantaResaltada:
        estado.idNodoMantaResaltada === idActual
          ? nuevoId
          : estado.idNodoMantaResaltada,
      variablesConsulta: nuevasConsultas,
      evidencia: nuevaEvidencia,
      ordenManual: nuevoOrdenManual,
      trazaActiva: null,
    });

    return { exito: true };
  },

  actualizarDatosNodo: (idNodo, cambios) => {
    set((estado) => {
      const nodosActualizados = estado.red.nodos.map((nodo) => {
        if (nodo.id !== idNodo) return nodo;
        const nuevoNombre =
          cambios.nombre !== undefined ? cambios.nombre : nodo.nombre;
        const nuevaDescripcion =
          cambios.descripcion !== undefined
            ? cambios.descripcion
            : nodo.descripcion;

        const copiaBase: NodoBayes = {
          id: nodo.id,
          nombre: nuevoNombre.length > 0 ? nuevoNombre : nodo.id,
          ...(nuevaDescripcion !== undefined && nuevaDescripcion.trim().length > 0
            ? { descripcion: nuevaDescripcion }
            : {}),
          estados: nodo.estados,
          ...(nodo.etiquetasEstados !== undefined
            ? { etiquetasEstados: nodo.etiquetasEstados }
            : {}),
          padres: nodo.padres,
          posicion: nodo.posicion,
          cpt: nodo.cpt,
          ...(nodo.esLatente !== undefined ? { esLatente: nodo.esLatente } : {}),
        };
        return copiaBase;
      });

      const nuevaRed: RedBayesiana = {
        ...estado.red,
        nodos: nodosActualizados,
      };
      return {
        red: nuevaRed,
        idEjemploActivo: null,
        problemasValidacion: validarRedBayesiana(nuevaRed),
      };
    });
  },

  actualizarEstadosNodo: (idNodo, nuevosEstadosCrudos, etiquetasEstados) => {
    const limpios = nuevosEstadosCrudos
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const unicos = Array.from(new Set(limpios));

    if (unicos.length < 2 || unicos.length !== limpios.length) {
      return {
        exito: false,
        mensaje: 'Cada variable debe tener al menos 2 estados únicos y no vacíos.',
      };
    }

    const estado = get();
    const nodosActualizados: NodoBayes[] = estado.red.nodos.map((nodo) => {
      if (nodo.id === idNodo) {
        const dominiosPadresPropios = obtenerDominiosPadres(estado.red.nodos, nodo.padres);
        const nuevaCpt = redimensionarCptNodo(
          nodo,
          unicos,
          nodo.padres,
          dominiosPadresPropios,
        );

        const esBinarioCanonico =
          unicos.length === 2 && unicos[0] === '1' && unicos[1] === '0';
        const etiquetasFinales =
          etiquetasEstados ??
          (esBinarioCanonico ? { '1': 'Sí', '0': 'No' } : undefined);

        return {
          id: nodo.id,
          nombre: nodo.nombre,
          ...(nodo.descripcion !== undefined
            ? { descripcion: nodo.descripcion }
            : {}),
          estados: unicos,
          ...(etiquetasFinales !== undefined
            ? { etiquetasEstados: etiquetasFinales }
            : {}),
          padres: nodo.padres,
          posicion: nodo.posicion,
          cpt: nuevaCpt,
          ...(nodo.esLatente !== undefined ? { esLatente: nodo.esLatente } : {}),
        };
      }

      if (nodo.padres.includes(idNodo)) {
        const dominiosPadresHijo = obtenerDominiosPadres(estado.red.nodos, nodo.padres);
        dominiosPadresHijo[idNodo] = unicos;
        return {
          ...nodo,
          cpt: redimensionarCptNodo(
            nodo,
            nodo.estados,
            nodo.padres,
            dominiosPadresHijo,
          ),
        };
      }

      return nodo;
    });

    const nuevaRed: RedBayesiana = {
      ...estado.red,
      nodos: nodosActualizados,
    };

    const nuevaEvidencia: Record<IdNodo, ValorEstado> = { ...estado.evidencia };
    const valorActualEvidencia = nuevaEvidencia[idNodo];
    if (
      valorActualEvidencia !== undefined &&
      !unicos.includes(valorActualEvidencia)
    ) {
      nuevaEvidencia[idNodo] = unicos[0]!;
    }

    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      evidencia: nuevaEvidencia,
      trazaActiva: null,
    });

    return { exito: true };
  },

  actualizarProbabilidadCeldaCpt: (
    idNodo,
    indiceFila,
    estadoEditado,
    nuevoValor,
    autocompletarBinario = true,
  ) => {
    const estado = get();
    const nodo = estado.red.nodos.find((n) => n.id === idNodo);
    if (!nodo) return;

    const nuevaCpt: FilaCPT[] = nodo.cpt.map((fila, idx) => {
      if (idx !== indiceFila) return fila;

      const siguientesProbs: Record<ValorEstado, number> = {
        ...fila.probabilidades,
        [estadoEditado]: nuevoValor,
      };

      // Autocompletado binario exacto 1 - p cuando se edita el primer estado
      if (
        autocompletarBinario &&
        nodo.estados.length === 2 &&
        estadoEditado === nodo.estados[0] &&
        Number.isFinite(nuevoValor) &&
        nuevoValor >= 0 &&
        nuevoValor <= 1
      ) {
        const segundoEstado = nodo.estados[1]!;
        siguientesProbs[segundoEstado] = autocompletarFilaBinaria(nuevoValor);
      }

      return {
        cuando: fila.cuando,
        probabilidades: siguientesProbs,
      };
    });

    const nuevaRed = actualizarCptNodo(estado.red, idNodo, nuevaCpt);
    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      trazaActiva: null,
    });
  },

  normalizarFilaCpt: (idNodo, indiceFila) => {
    const estado = get();
    const nodo = estado.red.nodos.find((n) => n.id === idNodo);
    if (!nodo) return;

    const nuevaCpt: FilaCPT[] = nodo.cpt.map((fila, idx) => {
      if (idx !== indiceFila) return fila;
      return {
        cuando: fila.cuando,
        probabilidades: normalizarDistribucionFila(nodo.estados, fila.probabilidades),
      };
    });

    const nuevaRed = actualizarCptNodo(estado.red, idNodo, nuevaCpt);
    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      trazaActiva: null,
    });
  },

  restablecerCptUniformeNodo: (idNodo) => {
    const estado = get();
    const nodo = estado.red.nodos.find((n) => n.id === idNodo);
    if (!nodo) return;

    const dominiosPadres = obtenerDominiosPadres(estado.red.nodos, nodo.padres);
    const cptUniforme = crearCptUniforme(nodo.estados, nodo.padres, dominiosPadres);
    const nuevaRed = actualizarCptNodo(estado.red, idNodo, cptUniforme);
    set({
      red: nuevaRed,
      idEjemploActivo: null,
      problemasValidacion: validarRedBayesiana(nuevaRed),
      trazaActiva: null,
    });
  },

  establecerRolVariableConsulta: (idNodo, rol, valorEvidencia) => {
    const estado = get();
    const nodo = estado.red.nodos.find((n) => n.id === idNodo);
    if (!nodo) return;

    let nuevasConsultas = estado.variablesConsulta.filter((q) => q !== idNodo);
    const nuevaEvidencia: Record<IdNodo, ValorEstado> = {};
    for (const [clave, valor] of Object.entries(estado.evidencia)) {
      if (clave !== idNodo) {
        nuevaEvidencia[clave] = valor;
      }
    }

    if (rol === 'consulta') {
      const ordenCanonico = estado.red.nodos.map((n) => n.id);
      const conjuntoQ = new Set([...nuevasConsultas, idNodo]);
      nuevasConsultas = ordenCanonico.filter((id) => conjuntoQ.has(id));
    } else if (rol === 'evidencia') {
      const valorInicial =
        valorEvidencia && nodo.estados.includes(valorEvidencia)
          ? valorEvidencia
          : (nodo.estados[0] ?? '1');
      nuevaEvidencia[idNodo] = valorInicial;
    }

    const nuevoOrdenManual = sincronizarOrdenManual(
      estado.red,
      nuevasConsultas,
      nuevaEvidencia,
      estado.ordenManual,
    );

    set({
      variablesConsulta: nuevasConsultas,
      evidencia: nuevaEvidencia,
      ordenManual: nuevoOrdenManual,
      idConsultaPredefinidaSeleccionada: '',
      trazaActiva: null,
      erroresConsulta: [],
    });
  },

  actualizarValorEvidencia: (idNodo, valor) => {
    const estado = get();
    const nodo = estado.red.nodos.find((n) => n.id === idNodo);
    if (!nodo || !nodo.estados.includes(valor)) return;

    const nuevaEvidencia: Record<IdNodo, ValorEstado> = {
      ...estado.evidencia,
      [idNodo]: valor,
    };

    set({
      evidencia: nuevaEvidencia,
      idConsultaPredefinidaSeleccionada: '',
      trazaActiva: null,
      erroresConsulta: [],
    });
  },

  limpiarConsultaYEvidencia: () => {
    set({
      variablesConsulta: [],
      evidencia: {},
      ordenManual: [],
      idConsultaPredefinidaSeleccionada: '',
      trazaActiva: null,
      erroresConsulta: [],
    });
  },

  seleccionarConsultaPredefinida: (idConsulta) => {
    set({ idConsultaPredefinidaSeleccionada: idConsulta });
  },

  cargarConsultaPredefinida: (idConsulta) => {
    const estado = get();
    const lista = estado.red.consultasPredefinidas ?? [];
    if (lista.length === 0) return;

    const idObjetivo =
      idConsulta ??
      (estado.idConsultaPredefinidaSeleccionada || lista[0]!.id);
    const consulta = lista.find((c) => c.id === idObjetivo) ?? lista[0]!;

    const estrategia: EstrategiaEliminacion =
      consulta.ordenSugerido && consulta.ordenSugerido.length > 0
        ? 'manual'
        : 'minimo-relleno';

    const ordenManual = sincronizarOrdenManual(
      estado.red,
      consulta.variablesConsulta,
      consulta.evidencia,
      consulta.ordenSugerido ?? [],
    );

    let trazaActiva: TrazaEliminacionVariables | null = null;
    let erroresConsulta: readonly ProblemaValidacion[] = [];

    if (estado.problemasValidacion.length === 0) {
      const resultado = ejecutarEliminacionVariables(estado.red, {
        variablesConsulta: consulta.variablesConsulta,
        evidencia: consulta.evidencia,
        estrategia,
        ...(estrategia === 'manual' ? { ordenManual } : {}),
      });
      if (resultado.exito) {
        trazaActiva = resultado.traza;
      } else {
        erroresConsulta = resultado.errores;
      }
    }

    set({
      idConsultaPredefinidaSeleccionada: consulta.id,
      variablesConsulta: [...consulta.variablesConsulta],
      evidencia: { ...consulta.evidencia },
      estrategiaEliminacion: estrategia,
      ordenManual,
      trazaActiva,
      erroresConsulta,
      notificacionLienzo: {
        tipo: 'info',
        mensaje: `Consulta de prueba cargada: ${consulta.etiqueta}`,
      },
    });
  },

  establecerEstrategiaEliminacion: (estrategia) => {
    const estado = get();
    const ordenManual = sincronizarOrdenManual(
      estado.red,
      estado.variablesConsulta,
      estado.evidencia,
      estado.ordenManual,
    );

    let nuevaTraza = estado.trazaActiva;
    let erroresConsulta = estado.erroresConsulta;

    if (
      estado.trazaActiva !== null &&
      estado.problemasValidacion.length === 0 &&
      estado.variablesConsulta.length > 0
    ) {
      const resultado = ejecutarEliminacionVariables(estado.red, {
        variablesConsulta: estado.variablesConsulta,
        evidencia: estado.evidencia,
        estrategia,
        ...(estrategia === 'manual' ? { ordenManual } : {}),
      });
      if (resultado.exito) {
        nuevaTraza = resultado.traza;
        erroresConsulta = [];
      } else {
        erroresConsulta = resultado.errores;
      }
    }

    set({
      estrategiaEliminacion: estrategia,
      ordenManual,
      trazaActiva: nuevaTraza,
      erroresConsulta,
    });
  },

  moverVariableOrdenManual: (idVariable, direccion) => {
    const estado = get();
    const actual = sincronizarOrdenManual(
      estado.red,
      estado.variablesConsulta,
      estado.evidencia,
      estado.ordenManual,
    );
    const indice = actual.indexOf(idVariable);
    if (indice === -1) return;

    const destino = direccion === 'subir' ? indice - 1 : indice + 1;
    if (destino < 0 || destino >= actual.length) return;

    const reordenado = [...actual];
    const temporal = reordenado[destino]!;
    reordenado[destino] = reordenado[indice]!;
    reordenado[indice] = temporal;

    let nuevaTraza = estado.trazaActiva;
    let erroresConsulta = estado.erroresConsulta;

    if (
      estado.trazaActiva !== null &&
      estado.problemasValidacion.length === 0 &&
      estado.variablesConsulta.length > 0
    ) {
      const resultado = ejecutarEliminacionVariables(estado.red, {
        variablesConsulta: estado.variablesConsulta,
        evidencia: estado.evidencia,
        estrategia: 'manual',
        ordenManual: reordenado,
      });
      if (resultado.exito) {
        nuevaTraza = resultado.traza;
        erroresConsulta = [];
      } else {
        erroresConsulta = resultado.errores;
      }
    }

    set({
      estrategiaEliminacion: 'manual',
      ordenManual: reordenado,
      trazaActiva: nuevaTraza,
      erroresConsulta,
    });
  },

  ejecutarInferenciaActual: () => {
    const estado = get();
    const ordenManual = sincronizarOrdenManual(
      estado.red,
      estado.variablesConsulta,
      estado.evidencia,
      estado.ordenManual,
    );

    const resultado = ejecutarEliminacionVariables(estado.red, {
      variablesConsulta: estado.variablesConsulta,
      evidencia: estado.evidencia,
      estrategia: estado.estrategiaEliminacion,
      ...(estado.estrategiaEliminacion === 'manual' ? { ordenManual } : {}),
      verificarConEnumeracionCompleta: true,
    });

    if (!resultado.exito) {
      set({
        trazaActiva: null,
        erroresConsulta: resultado.errores,
        ordenManual,
      });
      return false;
    }

    set({
      trazaActiva: resultado.traza,
      erroresConsulta: [],
      ordenManual,
    });
    return true;
  },

  establecerMostrarVistaReporte: (mostrar) => {
    set({ mostrarVistaReporte: mostrar });
  },

  alternarVisorPasosAmpliado: () => {
    set((estado) => ({ visorPasosAmpliado: !estado.visorPasosAmpliado }));
  },
}));
