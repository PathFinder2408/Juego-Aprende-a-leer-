# Registro de Decisiones de Arquitectura (ADR)

> Registrar cada decisión técnica o de dependencias en 1 a 3 líneas (fecha, decisión, motivo).

- **2026-11-18:** Phaser 3 + Matter.js para simulación y React solo para UI/debug fuera del canvas, comunicados por event bus tipado; evita mezclar ciclo de render del juego con DOM.
- **2026-11-18:** Contenido pedagógico 100% en JSON validado (`src/data/`) y parámetros de física en `src/config/`; permite iterar sin tocar lógica y escalar niveles.
- **2026-11-18:** Ragdoll simplificado (cuerpo compuesto/procedural) y rotación amortiguada en letras; prioriza 60 FPS en tablet y legibilidad infantil sobre realismo físico.
- **2026-11-18:** Dependencias base (`phaser`, `react`, `react-dom`, `vite`, `typescript`): requeridas por la arquitectura definida del proyecto (canvas Matter.js + UI React estricta).
- **2026-11-18:** Salto gráfico con Phaser 2.5D (`Y-sort` + sprites estilo 3D chibi pre-renderizados) y cartas holográficas CSS en React en vez de 3D real (Three.js); mantiene 60 FPS en móvil/tablet y < 5 MB sin reescribir la base de Fase 1.
- **2026-11-18:** Dependencia dev `vitest`: elegida para tests unitarios rápidos de lógica pedagógica (`puzzleLogic`, `adaptiveEngine`) con soporte nativo de TypeScript y Vite.
- **2026-11-18:** Persistencia local en `localStorage` bajo clave `cupula_letras_save` con esquema versionado (`v1`), migraciones secuenciales (`v0 -> v1`), saneamiento contra catálogos JSON y reinicio de progreso que conserva ajustes de accesibilidad.
