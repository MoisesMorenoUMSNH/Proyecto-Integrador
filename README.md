# Sistema de Modelado e Inferencia Exacta en Redes Bayesianas (Eliminación de Variables)

> **Materia:** Modelos Probabilistas  
> **Institución:** Facultad de Ingeniería Eléctrica (FIE) · Universidad Michoacana de San Nicolás de Hidalgo (UMSNH)  
> **Profesor:** Mauricio Rene Reyes Gutierrez


---

## 1. Descripción del Proyecto

Este software es una plataforma integral basada en entorno web (SPA de cliente estático) diseñada para el **modelado gráfico interactivo, validación axiomática e inferencia probabilística exacta** sobre Redes Bayesianas discretas. 

El sistema implementa con rigurosa fidelidad matemática el algoritmo de **Eliminación de Variables (Variable Elimination)** estructurado en un pipeline pedagógico de **6 pasos**, complementado con un motor de verificación formal por **Enumeración Exhaustiva Completa** para garantizar exactitud numérica y medir el ahorro computacional.

### Alcance y Capacidades Principales

* **Modelado Gráfico Asistido (3 a 10 nodos):** Lienzo bidireccional interactivo con zoom, paneo, alineación automática y validación en tiempo real de aristas dirigidas.
* **Validación Axiomática Estricta:**
  * **Topología:** Detección de ciclos en tiempo real mediante búsqueda en profundidad (DFS) y restricciones de cardinalidad ($3 \le |V| \le 10$).
  * **Tablas de Probabilidad Condicional (CPT):** Verificación exhaustiva de todas las combinaciones de padres ($|\text{estados}|^{|\text{padres}|}$ filas) y cumplimiento del axioma de probabilidad total ($\sum P = 1.0 \pm 1\times 10^{-6}$).
  * **Soporte Multivaluado:** Variables binarias estándar (`"1"`, `"0"`) y discretas con $k \ge 3$ estados cualitativos.
* **Inferencia Exacta en 6 Pasos:** Trazabilidad completa con fórmulas matemáticas en LaTeX (KaTeX), tablas dinámicas de factores intermedios y desglose de multiplicaciones escalares.
* **Verificación de Verdad Fundamental (Ground Truth):** Comparación simultánea en tiempo real contra el producto conjunto exhaustivo, registrando error residual ($|P_{VE} - P_{Enum}| < 1\times 10^{-12}$) y porcentaje de multiplicaciones evitadas.
* **Análisis de Manta de Markov y Poda:** Identificación visual de la manta $MB(X) = \text{padres}(X) \cup \text{hijos}(X) \cup \text{copadres}(X)$ y poda automática de nodos irrelevantes o d-separados para la consulta.
* **Heurísticas de Ordenamiento:** Comparativa del ancho de factores generados entre **Mínimo Relleno (Min-Fill)**, **Mínimo Grado (Min-Degree)**, **Regla Práctica de Clase** y orden manual.
* **Portabilidad y Reportes:** Importación/exportación en esquema JSON validado con Zod, generación de reportes técnicos imprimibles optimizados (`@media print`) y exportación de trazas a formato Markdown.

---

## 2. Enlace a Despliegue en Línea

La aplicación está configurada con rutas relativas (`base: './'`) y se compila como un sitio estático puro optimizado para alojarse en **GitHub Pages**. El despliegue se ejecuta de manera automatizada mediante el flujo de trabajo de integración continua de GitHub Actions (`.github/workflows/despliegue.yml`) tras cada confirmación en la rama `main`.

> 🌐 **Despliegue Público Oficial en GitHub Pages:**  
> [https://moisesmorenoumsnh.github.io/Proyecto-Integrador/](https://moisesmorenoumsnh.github.io/Proyecto-Integrador/)

---

## 3. Requisitos de Ejecución

Para clonar, compilar y ejecutar el proyecto en entornos locales (GNU/Linux, macOS o Windows):

* **Node.js:** Versión `>= 20.0.0` (recomendado LTS `>= 22.12.0`).
* **pnpm:** Versión `>= 9.0.0` (recomendado `9.x` o `10.x` para gestión determinista de dependencias).
* **Navegador Web Moderno:** Google Chrome, Chromium, Mozilla Firefox, Microsoft Edge o Safari con compatibilidad ECMAScript 2022+.

---

## 4. Comandos de Instalación y Uso

Todas las tareas de desarrollo y compilación para producción se gestionan a través de `pnpm`:

```bash
# 1. Clonar el repositorio y acceder a la raíz del proyecto
git clone https://github.com/MoisesMorenoUMSNH/Proyecto-Integrador
cd Proyecto-Integrador

# 2. Instalar dependencias exactas usando el bloqueo determinista de pnpm
pnpm install

# 3. Iniciar el servidor de desarrollo local con Hot Module Replacement (HMR)
# Accesible de inmediato en http://localhost:5173
pnpm dev

# 4. Compilar y empaquetar para producción (TypeScript estricto + Vite 8)
# Los artefactos estáticos optimizados se generan en la carpeta dist/
pnpm build

# 5. Previsualizar localmente la compilación de producción generada
# Accesible en http://localhost:4173
pnpm preview
```

---

## 5. Arquitectura del Software

El sistema sigue un principio de diseño desacoplado de **Separación de Responsabilidades (SoC)**, dividiendo estrictamente el motor computacional de la capa visual:

```
src/
├── nucleo/                        # Motor matemático y algorítmico puro (Sin dependencias de DOM/React)
│   ├── dominio/                   # Modelos de datos inmutables (CPT, validadores, axiomas de probabilidad)
│   ├── factor/                    # Álgebra de factores multidimensionales (producto, marginalización, restricción)
│   ├── grafo/                     # Algoritmos de grafos dirigidos (DFS aciclicidad, topología, poda, Manta de Markov)
│   ├── inferencia/                # Motor de Eliminación de Variables (6 pasos), Heurísticas y Enumeración Completa
│   ├── persistencia/              # Esquemas de frontera Zod v4, serializador JSON y generador de reportes
│   └── aprendizaje/               # Contratos y tipos desacoplados listos para la extensión del Algoritmo EM
└── interfaz/                      # Capa de presentación y experiencia de usuario (GUI SPA)
    ├── store/                     # Gestión de estado global reactivo con Zustand 5 (useStoreRed.ts)
    ├── estilos/                   # Sistema de diseño con Tailwind CSS 4 y modo de impresión profesional
    ├── LienzoGrafo.tsx            # Lienzo DAG interactivo construido con @xyflow/react (React Flow v12)
    ├── NodoGrafo.tsx              # Componente visual de nodo bayesiano con insignias de estado y probabilidad
    ├── PanelEditor.tsx            # Editor lateral de nodos, aristas dirigidas y CPTs dinámicas
    ├── PanelInferencia.tsx        # Constructor de consultas P(Q | e) y visualizador interactivo de los 6 pasos
    ├── TablaFactor.tsx            # Tablas renderizadas para factores phi y g_k
    ├── FormulaMatematica.tsx      # Renderizado KaTeX en tiempo real de notación matemática
    └── VistaReporte.tsx           # Vista imprimible vectorizada con memoria de cálculo detallada
```

### Ventajas del desacoplamiento arquitectónico:
1. **Aislamiento Funcional:** Toda la matemática en `/src/nucleo` opera como una librería TypeScript independiente sin efectos secundarios sobre el DOM ni acoplamiento a React.
2. **Precisión Numérica de 64 bits:** Las operaciones con factores se ejecutan en punto flotante nativo IEEE 754 de 64 bits sin redondear valores intermedios; el redondeo a 4 o 6 decimales se delega exclusivamente a la vista.
3. **Preservación de Factores Escalares:** Al fijar evidencia sobre un nodo raíz, los factores constantes resultantes no se descartan, garantizando que el producto acumulado final reproduzca con exactitud la probabilidad de la evidencia $P(\mathbf{e})$ y su constante $\alpha = 1 / P(\mathbf{e})$.

---

## 6. Algoritmo de Eliminación de Variables en 6 Pasos

El motor de inferencia desglosa cada consulta $P(\mathbf{Q} \mid \mathbf{e})$ en seis fases matemáticas secuenciales:

| Paso | Denominación Matemática | Descripción y Operación Realizada |
| :---: | :--- | :--- |
| **Paso 1** | **Formulación Simbólica y Clasificación** | Define la consulta $P(\mathbf{Q} \mid \mathbf{e}) = \alpha \sum_{\mathbf{H}} P(\mathbf{Q}, \mathbf{H}, \mathbf{e})$, particiona las variables en Consulta ($\mathbf{Q}$), Evidencia ($\mathbf{E}$) y Ocultas ($\mathbf{H}$), genera la fórmula en LaTeX y clasifica la inferencia (Causal/Predictiva, Diagnóstica, Intercausal o Mixta). |
| **Paso 2** | **Poda de Nodos Irrelevantes** | Computa el subgrafo ancestral de $\mathbf{Q} \cup \mathbf{E}$, elimina nodos estériles o d-separados que no aportan a la posterior, simplifica la sumatoria y verifica si la Manta de Markov $MB(X)$ permite una simplificación directa. |
| **Paso 3** | **Definición y Restricción de Factores** | Transforma las CPTs de los nodos activos en factores iniciales $f_{X_i} = P(X_i \mid \text{padres}(X_i))$ y aplica la evidencia observada restringiendo las filas ($f_{X_i}|_{\mathbf{e}}$), manteniendo factores escalares constantes. |
| **Paso 4** | **Selección del Orden de Eliminación $\pi$** | Determina la secuencia de marginalización de las variables ocultas mediante heurísticas (Mínimo Relleno, Mínimo Grado o Regla Práctica), evaluando métricas de ancho inducido de factores y total de multiplicaciones. |
| **Paso 5** | **Eliminación Secuencial por Marginalización** | Para cada variable $Z_k \in \pi$, recolecta los factores que la contienen, calcula el producto intermedio $\psi = \prod f$ y marginaliza sumando sobre sus estados: $g_k = \sum_{Z_k} \psi$. Registra la traza algebraica y los factores restantes. |
| **Paso 6** | **Producto Acumulado, $\alpha$ y Normalización** | Multiplica los factores restantes para obtener la conjunta no normalizada $P(\mathbf{Q}, \mathbf{e})$. Suma los valores para obtener $P(\mathbf{e})$, calcula el factor de normalización $\alpha = 1 / P(\mathbf{e})$, obtiene la distribución posterior $P(\mathbf{Q} \mid \mathbf{e})$ y valida contra Enumeración Completa. |

---

## 7. Catálogo de Redes Oficiales de Prueba

El repositorio incluye en la carpeta `/ejemplos` una biblioteca de **6 redes bayesianas oficiales**, completamente validadas con sus CPTs y consultas predefinidas:

| Archivo | Título del Modelo | Dominio | Nodos | Tipos de Variables | Descripción del Escenario |
| :--- | :--- | :--- | :---: | :---: | :--- |
| [`01-ciberseguridad-3-nodos.json`](ejemplos/01-ciberseguridad-3-nodos.json) | **Cadena de Phishing** | Ciberseguridad | 3 | Binarias (`P, C, A`) | Cadena causal simple ($P \to C \to A$) donde un correo de phishing permite el robo de credenciales y el acceso ilícito a la infraestructura. |
| [`02-mundial-futbol-4-nodos.json`](ejemplos/02-mundial-futbol-4-nodos.json) | **Mundial de Fútbol (Clase)** | Deportes | 4 | Binarias (`L, R, F, G`) | Modelo canónico del curso: la lesión influye en la forma ($L \to F$), y la victoria depende de la forma y la fuerza del rival ($F \to G, R \to G$). Estructura en colisión/V. |
| [`03-videojuegos-5-nodos.json`](ejemplos/03-videojuegos-5-nodos.json) | **Venta de Videojuegos** | Industria de Videojuegos | 5 | Binarias (`D, R, T, V, K`) | Lanzamiento digital: descuento, reseñas y viralidad convergen en ventas semanales ($D, R, T \to V$), las cuales determinan el ingreso al Top 10 ($V \to K$). |
| [`04-ransomware-6-nodos.json`](ejemplos/04-ransomware-6-nodos.json) | **Infección por Ransomware** | Ciberseguridad | 6 | Binarias (`P, V, I, C, T, L`) | Dos causas de infección ($P, V \to I$), dos señales observables directas ($I \to C, I \to T$) y consecuencia de pérdida de datos ($C \to L$). Ideal para inferencia intercausal. |
| [`05-mundial-octavos-10-nodos.json`](ejemplos/05-mundial-octavos-10-nodos.json) | **Octavos de Final del Mundial** | Deportes | 10 | Binarias (`Le, Rk, Pf, Cl, Of, Df, G, Go, Ta, Cm`) | Modelo denso de 10 nodos: causas físicas y climáticas determinan rendimiento ofensivo y defensivo; estos condicionan victoria, goleada, tarjetas rojas y venta de camisetas. |
| [`bonus-consolas-multivaluada-7-nodos.json`](ejemplos/bonus-consolas-multivaluada-7-nodos.json) | **Ecosistema de Consolas Multivaluada** | Industria de Videojuegos | 7 | Discretas (`Pl` con 3 estados: PS5, Xbox, Switch 2; 6 binarias) | Modelo que acredita la capacidad del motor de resolver inferencia exacta sobre variables discretas multivaluadas no binarias interactuando con variables binarias. |

---

## 8. Especificación del Formato JSON de Persistencia

El sistema almacena y transfiere redes en archivos `.json` normalizados bajo el estándar `versionEsquema: "1.0"`, validado en frontera mediante esquemas Zod (`src/nucleo/persistencia/esquema.ts`).

### Estructura General del Objeto JSON

```json
{
  "versionEsquema": "1.0",
  "metadatos": {
    "id": "identificador-unico-red",
    "titulo": "Título formal del modelo probabilístico",
    "descripcion": "Descripción detallada del dominio y propósito de la red",
    "autor": "Nombre del autor o equipo",
    "dominio": "Ciberseguridad | Deportes | Medicina | etc.",
    "actualizadoEn": "2026-11-02T00:00:00.000Z"
  },
  "nodos": [
    {
      "id": "F",
      "nombre": "Forma del Equipo",
      "descripcion": "Rendimiento físico y anímico del equipo",
      "estados": ["1", "0"],
      "etiquetasEstados": { "1": "Buena", "0": "Mala" },
      "padres": ["L"],
      "posicion": { "x": 100, "y": 200 },
      "cpt": [
        {
          "cuando": { "L": "1" },
          "probabilidades": { "1": 0.40, "0": 0.60 }
        },
        {
          "cuando": { "L": "0" },
          "probabilidades": { "1": 0.80, "0": 0.20 }
        }
      ]
    }
  ],
  "consultasPredefinidas": [
    {
      "id": "consulta-ejemplo",
      "etiqueta": "P(G = 1 | L = 1)",
      "descripcion": "Probabilidad de ganar sabiendo que la estrella está lesionada",
      "variablesConsulta": ["G"],
      "evidencia": { "L": "1" },
      "ordenSugerido": ["R", "F"]
    }
  ]
}
```

### Campos Clave del Esquema

1. **`versionEsquema` (`string`):** Versión estricta del protocolo (actualmente `"1.0"`).
2. **`metadatos` (`object`):** Objeto descriptivo que contiene identificación, autoría y contextualización del problema.
3. **`nodos` (`array`):** Arreglo de nodos del grafo ($3 \le \text{longitud} \le 10$). Cada nodo define:
   * `id`: Clave alfanumérica única en la red (ej. `"G"`).
   * `estados`: Arreglo ordenado de valores discretos admisibles (ej. `["1", "0"]` para binarias o `["PS5", "Xbox", "Switch 2"]`).
   * `padres`: Lista de IDs de nodos padre en el DAG. Si es nodo raíz, el arreglo es vacío `[]`.
   * `posicion`: Coordenadas cartesianas `{ x, y }` para su visualización en el lienzo.
   * `cpt` (`array` de filas condicionales): Cada elemento representa una fila de probabilidad condicional con:
     * **`cuando` (`record`):** Condición de los padres como pares `padre: valor`. En nodos raíz es un objeto vacío `{}`.
     * **`probabilidades` (`record`):** Probabilidad asignada a cada estado del nodo hijo bajo dicha condición de padres. La suma de todas las claves debe ser exactamente `1.0` ($\pm 1\times 10^{-6}$).
4. **`consultasPredefinidas` (`array`, opcional):** Conjunto de consultas de prueba preconfiguradas que el usuario puede cargar con un solo clic desde la interfaz.

---

## 9. Créditos y Equipo de Desarrollo

Este software fue desarrollado como proyecto integrador para la materia de Modelos Probabilistas, correspondiente al programa de Ingeniería en Computación de la Facultad de Ingeniería Eléctrica (FIE) en la Universidad Michoacana de San Nicolás de Hidalgo (UMSNH).

### Integrantes y División de Responsabilidades

| Integrante | Rol | Responsabilidades y Contribuciones Técnicas |
| :--- | :--- | :--- |
| **Moisés Moreno Cortez** | Líder Técnico & Arquitectura | Arquitectura desacoplada del sistema, motor matemático de factores multidimensionales, implementación del algoritmo de Eliminación de Variables (6 pasos), motor de enumeración exhaustiva y gestión del estado global con Zustand (`useStoreRed.ts`). Despliegue CI/CD automatizado en GitHub Pages. |
| **César Ambris Salguero** | Desarrollo Frontend, Reportes & Modelado | Diseño y maquetación de paneles visuales (`BarraSuperior.tsx`, `PanelEditor.tsx`), vista imprimible de memoria de cálculo con fórmulas KaTeX (`VistaReporte.tsx`), revisión del flujo de inferencia (`eliminacionVariables.ts`) y modelado de redes bayesianas de 5 y 6 nodos (Videojuegos y Ransomware). |
| **Leonardo Soria Raya** | Interfaz Visual, Grafos & Modelado | Maquetación visual e interacción del panel de inferencia (`PanelInferencia.tsx`), renderizado y estilos de nodos personalizados en el lienzo de React Flow (`NodoGrafo.tsx`), visualización tabular de matrices probabilistas (`TablaFactor.tsx`), tipado de inferencia (`tipoInferencia.ts`) y diseño de modelos probabilistas de 4, 7 (multivaluado) y 10 nodos (Mundial de Fútbol). |

---

### Licencia y Uso Académico

Este proyecto ha sido desarrollado con fines exclusivamente académicos y de divulgación científica bajo licencia **MIT**. Se autoriza su consulta, modificación y réplica citando debidamente la fuente original y la institución educativa.
