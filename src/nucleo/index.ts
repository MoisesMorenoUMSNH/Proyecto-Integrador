/**
 * API Pública Controlada del Núcleo Matemático Puro (`/src/nucleo`).
 * Estrictamente 0% acoplada a React, Zustand, `@xyflow/react` o APIs del DOM del navegador.
 */

export * from './dominio/tipos';
export * from './dominio/cpt';
export * from './dominio/validadores';

export * from './grafo/dag';
export * from './grafo/poda';
export * from './grafo/mantaMarkov';
export * from './grafo/tipoInferencia';

export * from './factor/tipos';
export * from './factor/operaciones';

export * from './inferencia/tipos';
export * from './inferencia/heuristicas';
export * from './inferencia/enumeracionCompleta';
export * from './inferencia/eliminacionVariables';

export * from './persistencia/esquema';
export * from './persistencia/serializador';
export * from './persistencia/formateadorReporte';

export * from './aprendizaje/tipos';
