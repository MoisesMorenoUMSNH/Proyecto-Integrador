import type { RedBayesiana, Resultado } from '../dominio/tipos';
import { validarObjetoRedCrudo } from './esquema';

/**
 * Parsea y valida el contenido textual de un archivo `.json` hacia una entidad inmutable `RedBayesiana`.
 * Nunca lanza excepciones no controladas ante sintaxis malformada o probabilidades inválidas;
 * devuelve diagnósticos estructurados en español.
 */
export function parsearRedJson(textoJson: string): Resultado<RedBayesiana> {
  let crudo: unknown;
  try {
    crudo = JSON.parse(textoJson);
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    return {
      exito: false,
      errores: [
        {
          codigo: 'ERROR_VALIDACION_ESQUEMA',
          severidad: 'error',
          mensaje: `El archivo no contiene JSON válido (RFC 8259): ${detalle}`,
        },
      ],
    };
  }

  return validarObjetoRedCrudo(crudo);
}

/**
 * Serializa una `RedBayesiana` sin pérdida hacia JSON formateado preservando metadatos,
 * coordenadas visuales (x, y), estados, etiquetas de estados, CPTs y consultas predefinidas.
 */
export function serializarRedJson(
  red: RedBayesiana,
  espaciosIndentacion: number = 2,
): string {
  return `${JSON.stringify(red, null, espaciosIndentacion)}\n`;
}
