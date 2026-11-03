import { parsearRedJson, type RedBayesiana } from '../nucleo';

import ejemplo01Crudo from '../../ejemplos/01-ciberseguridad-3-nodos.json?raw';
import ejemplo02Crudo from '../../ejemplos/02-mundial-futbol-4-nodos.json?raw';
import ejemplo03Crudo from '../../ejemplos/03-videojuegos-5-nodos.json?raw';
import ejemplo04Crudo from '../../ejemplos/04-ransomware-6-nodos.json?raw';
import ejemplo05Crudo from '../../ejemplos/05-mundial-octavos-10-nodos.json?raw';
import ejemploBonusCrudo from '../../ejemplos/bonus-consolas-multivaluada-7-nodos.json?raw';

export interface ElementoGaleriaEjemplo {
  readonly id: string;
  readonly nombreArchivo: string;
  readonly etiquetaMenu: string;
  readonly cantidadNodos: number;
  readonly red: RedBayesiana;
}

function cargarRedEjemploSeguro(
  nombreArchivo: string,
  etiquetaMenu: string,
  jsonCrudo: string,
): ElementoGaleriaEjemplo {
  const resultado = parsearRedJson(jsonCrudo);
  if (!resultado.exito) {
    throw new Error(
      `Error al cargar el ejemplo oficial "${nombreArchivo}": ${resultado.errores
        .map((e) => e.mensaje)
        .join('; ')}`,
    );
  }
  return {
    id: resultado.valor.metadatos.id,
    nombreArchivo,
    etiquetaMenu,
    cantidadNodos: resultado.valor.nodos.length,
    red: resultado.valor,
  };
}

export const CATALOGO_EJEMPLOS: readonly ElementoGaleriaEjemplo[] = [
  cargarRedEjemploSeguro(
    '01-ciberseguridad-3-nodos.json',
    '1. Ciberseguridad: Phishing (3 nodos)',
    ejemplo01Crudo,
  ),
  cargarRedEjemploSeguro(
    '02-mundial-futbol-4-nodos.json',
    '2. Mundial de Fútbol (4 nodos)',
    ejemplo02Crudo,
  ),
  cargarRedEjemploSeguro(
    '03-videojuegos-5-nodos.json',
    '3. Desarrollo de Videojuegos (5 nodos)',
    ejemplo03Crudo,
  ),
  cargarRedEjemploSeguro(
    '04-ransomware-6-nodos.json',
    '4. Ataque de Ransomware (6 nodos)',
    ejemplo04Crudo,
  ),
  cargarRedEjemploSeguro(
    'bonus-consolas-multivaluada-7-nodos.json',
    'Bonus. Consolas Actuales — Multivaluada (7 nodos)',
    ejemploBonusCrudo,
  ),
  cargarRedEjemploSeguro(
    '05-mundial-octavos-10-nodos.json',
    '5. Octavos del Mundial (10 nodos)',
    ejemplo05Crudo,
  ),
];
