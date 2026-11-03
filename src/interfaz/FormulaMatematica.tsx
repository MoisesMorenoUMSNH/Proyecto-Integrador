import katex from 'katex';
import { useMemo } from 'react';

export interface PropiedadesFormulaMatematica {
  readonly latex: string;
  readonly display?: boolean;
  readonly className?: string;
}

/**
 * Componente unificado y memoizado para renderizar expresiones LaTeX con KaTeX de forma segura.
 */
export function FormulaMatematica({
  latex,
  display = false,
  className,
}: PropiedadesFormulaMatematica) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        strict: 'ignore',
      });
    } catch {
      return latex;
    }
  }, [latex, display]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
