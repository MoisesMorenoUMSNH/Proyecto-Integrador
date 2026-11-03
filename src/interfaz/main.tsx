import '@xyflow/react/dist/style.css';
import 'katex/dist/katex.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacion } from './Aplicacion';
import './estilos/index.css';

const elementoRaiz = document.getElementById('root');
if (!elementoRaiz) {
  throw new Error('No se encontró el elemento raíz #root en index.html');
}

createRoot(elementoRaiz).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
);
