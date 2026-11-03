/**
 * Dispara la descarga de contenido textual o estructurado desde el navegador como archivo local.
 */
export function descargarArchivo(
  contenido: string,
  nombreArchivo: string,
  tipoMime: string = 'text/plain;charset=utf-8',
): void {
  const blob = new Blob([contenido], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}
