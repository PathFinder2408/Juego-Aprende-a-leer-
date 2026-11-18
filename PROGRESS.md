# PROGRESS.md

- **Proyecto:** Videojuego web educativo de lectura (Phaser 3 + Matter.js + React + TypeScript + Vite)
- **Fase actual:** Fase 4 planificada (pendiente de confirmación)
- **Última actualización:** 2026-11-18

---

## Fase 0: Configuración inicial

| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F0-01 | Crear `AGENTS.md`, `PROGRESS.md` y `docs/DECISIONS.md` | L | Gemini 4 Hydrogen (Medium) | hecha | Archivos creados según plantilla y `AGENTS.md` <= 60 líneas | Sin código del juego |

## Fase 1: Prototipo de antigravedad

| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F1-01 | GDD resumido (bucle, 6 criaturas originales, curva 5 niveles), estructura de carpetas y riesgos | P | Gemini 4 Hydrogen (Medium) | hecha | `docs/GDD.md` y `docs/DECISIONS.md` completos y revisados | Perfil asumido: 6 años, reconoce letras/sílabas, PC+tablet |
| F1-02 | Inicializar proyecto Vite + React + TS estricto + Phaser 3 y carpetas por feature | M | Gemini 4 Hydrogen (Medium) | hecha | `npm install` y `npm run build` pasan sin errores de TS | Deps justificadas en `docs/DECISIONS.md` |
| F1-03 | Config de física antigravedad, event bus tipado y JSON de prueba (`S-O-L`) | M | Gemini 4 Hydrogen (Medium) | hecha | Tipos estrictos sin palabras hardcodeadas en lógica | Módulos `config`, `events`, `data`, `types` |
| F1-04 | Servicio de voz Web Speech API (`es-CL`) con fallback seguro | M | Gemini 4 Hydrogen (Medium) | hecha | Pronuncia letra/palabra al invocar sin lanzar errores si no hay soporte | Módulo `audio` (`src/audio/speech.ts`) |
| F1-05 | Escena Phaser Matter.js: cúpula gravedad 0, letras S-O-L legibles, orden, feedback y evento `capture` | P | Gemini 4 Hydrogen (XHigh) | hecha | Secuencia S-O-L en orden dispara `capture`; error rebota suave sin castigo | `AntigravityScene`, `LetterBody`, `PlayerBumper`, `puzzleLogic`, `sfx` |
| F1-06 | Integración React + Phaser y panel de debug en vivo de parámetros de física | M | Gemini 4 Hydrogen (XHigh) | hecha | Sliders actualizan física en vivo y UI muestra estado de captura | `PhaserCanvas`, `PhysicsDebugPanel`, `App`, `styles.css` |
| F1-07 | Verificación integral Fase 1 (`npm install && npm run dev`, consola limpia, captura S-O-L) | L | Gemini 4 Hydrogen (Medium) | hecha | App corre sin errores en consola y S-O-L dispara captura | Verificado en navegador (0 errores), `npm run build` pasó |

## Fase 2: Mundo tropical 2.5D, Hub estilo móvil y salto visual
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F2-01 | Generar pack de arte original 3D-chibi/tropical (explorador, Solín, Mumu, Sapín, tiles isla y marco de carta) | M | Gemini 4 Hydrogen (Medium) | hecha | Sprites PNG transparentes/optimizados en `public/assets/` (< 1.5 MB total) | 5 PNGs transparentes (436.9 KB total) |
| F2-02 | Datos JSON de zonas de Isla Sol, misiones y cartas coleccionables (`world.json`, `cards.json`) | L | Gemini 4 Hydrogen (Medium) | hecha | Esquema tipado en `src/types/` sin textos hardcodeados en lógica | `types/game.ts`, `words.json`, `world.json`, `cards.json` |
| F2-03 | Escena Phaser 2.5D `WorldScene` (isla soleada, cámara seguimiento, Y-sort, props cómicos Matter.js, pasto alto y encuentro) | P | Gemini 4 Hydrogen (XHigh) | hecha | Explorador camina por isla, empuja props y al tocar criatura salvaje inicia cúpula | `islandRenderer`, `WorldPlayer`, `WorldScene`, `AntigravityScene.init` |
| F2-04 | Upgrade visual de `AntigravityScene` (cúpula estilizada, sprite ilustrado de criatura, burbujas 3D-shaded) | M | Gemini 4 Hydrogen (Medium) | hecha | Reemplaza círculos planos manteniendo 60 FPS y legibilidad total | `AntigravityScene`, `LetterBody`, `PlayerBumper` |
| F2-05 | Hub/Lobby y HUD estilo móvil/tablet en React (barra superior nivel/estrellas, misión activa, barra inferior `Inicio/Isla/Cúpula/Cartas`) | M | Gemini 4 Hydrogen (Medium) | hecha | Navegación limpia entre Lobby, Exploración, Cúpula y Cartas vía `gameBus` | `PhaserCanvas`, `LobbyView`, `CardGallery`, `App`, `styles.css` |
| F2-06 | Carta coleccionable holográfica CSS tras captura + verificación E2E en navegador (`Inicio → Isla → Cúpula → Carta`) | L | Gemini 4 Hydrogen (Medium) | hecha | Flujo completo sin errores en consola y `npm run build` exitoso | `CaptureCardModal`, verificado E2E con 0 errores |

## Fase 3: Progresión y adaptación
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F3-01 | Curva de dificultad (5 niveles) y pool de señuelos en JSON (`difficulty.json`) + tipos | L | Gemini 4 Hydrogen (Medium) | hecha | Datos pedagógicos 100% en JSON validado por tipos TS | `difficulty.json`, `types/game.ts` |
| F3-02 | Motor puro de dificultad adaptativa (`adaptiveEngine.ts`: +3 sube, -3 baja, aviso pausa 15 min) | P | Gemini 4 Hydrogen (XHigh) | hecha | Lógica pura desacoplada de Phaser/React | `src/features/progression/adaptiveEngine.ts` |
| F3-03 | Tests unitarios con Vitest (`puzzleLogic` y `adaptiveEngine`) | M | Gemini 4 Hydrogen (Medium) | hecha | `npm test` pasa validando orden de sílabas y adaptación ±3 | 2 archivos, 7 tests pasando |
| F3-04 | Integración de señuelos, velocidad adaptativa y aviso de pausa en `AntigravityScene` y `App` | M | Gemini 4 Hydrogen (Medium) | hecha | Cúpula genera señuelos y ajusta velocidad según racha | `AntigravityScene`, `App` |
| F3-05 | Verificación integral Fase 3 (`npm test`, `npm run build`, prueba en navegador con sílabas) | L | Gemini 4 Hydrogen (Medium) | hecha | Tests y build pasan y consola en 0 errores | `BootScene` en `PhaserCanvas`, 7/7 tests y 0 errores |

## Fase 4: Álbum y meta-juego
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F4-01 | Opciones de palabras flotantes para huecos en `cards.json` y tipos en `types/game.ts` | L | - | pendiente | Cada carta define `wordChoices` en JSON sin hardcode en lógica | Extiende `cards.json` |
| F4-02 | Lógica pura del álbum (`albumLogic.ts`: validar palabra al hueco, cartas completadas y bonus) | M | - | pendiente | Lógica pura desacoplada de React | Módulo `album` |
| F4-03 | Tests unitarios (`albumLogic.test.ts`) + UI interactiva de huecos flotantes (arrastrar/tocar) en `CardGallery` y `App` | M | - | pendiente | `npm test` pasa; completar hueco lee la frase en `es-CL` y da bonus | Tactil + mouse |
| F4-04 | Verificación integral Fase 4 (`npm test`, `npm run build` y prueba en navegador de álbum interactivo) | L | - | pendiente | Tests, build y consola en 0 errores | Cierre Fase 4 |

## Fase 5: Pulido, audio y accesibilidad
_(Pendiente de recibir prompt de Fase 5)_

## Fase 6: Persistencia y backend opcional
_(Pendiente de recibir prompt de Fase 6)_

---

## Siguiente paso
Confirmar el desglose de **Fase 4** para iniciar **`F4-01`** (extensión de `cards.json` y tipos, esfuerzo LIGERO).

## Bloqueos y riesgos
- Sin bloqueos técnicos. Repositorio remoto configurado en `origin` (`PathFinder2408/Juego-Aprende-a-leer-`).
- Riesgos de Fase 1 documentados en `docs/GDD.md`.

## Registro de sesiones
- **2026-11-18:** Fase 2 y Fase 3 completas (`F2-01` a `F3-05` cerradas; progresión adaptativa ±3, señuelos, `BootScene`, 7/7 tests y 0 errores en navegador).
