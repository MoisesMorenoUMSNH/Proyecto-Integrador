// Configuración unificada de Vite 8 + Tailwind CSS 4 para despliegue en GitHub Pages
// Fuentes oficiales:
// - https://vite.dev/config/
// - https://tailwindcss.com/docs/installation/using-vite
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
