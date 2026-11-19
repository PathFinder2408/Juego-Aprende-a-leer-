# PROGRESS.md

- **Proyecto:** Videojuego web educativo de lectura (Phaser 3 + Matter.js + React + TypeScript + Vite)
- **Fase actual:** Fase 8 en curso (rama `feat/fase-8-laberintos` — F8-01 completada)
- **Última actualización:** 2026-11-19

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
| F4-01 | Opciones de palabras flotantes para huecos en `cards.json` y tipos en `types/game.ts` | L | Gemini 4 Hydrogen (Medium) | hecha | Cada carta define `wordChoices` en JSON sin hardcode en lógica | `cards.json`, `types/game.ts`, regla GitHub en `AGENTS.md` |
| F4-02 | Lógica pura del álbum (`albumLogic.ts`: validar palabra al hueco, cartas completadas y bonus) | M | Gemini 4 Hydrogen (Medium) | hecha | Lógica pura desacoplada de React | `src/features/album/albumLogic.ts` |
| F4-03 | Tests unitarios (`albumLogic.test.ts`) + UI interactiva de huecos flotantes (arrastrar/tocar) en `CardGallery` y `App` | M | Gemini 4 Hydrogen (Medium) | hecha | `npm test` pasa; completar hueco lee la frase en `es-CL` y da bonus | `albumLogic.test.ts`, `CardGallery`, `App`, `styles.css` |
| F4-04 | Verificación integral Fase 4 (`npm test`, `npm run build` y prueba en navegador de álbum interactivo) | L | Gemini 4 Hydrogen (Medium) | hecha | Tests, build y consola en 0 errores | 9/9 tests, build OK, 0 errores en navegador |

## Fase 5: Pulido, audio y accesibilidad
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F5-01 | Configuración y tipos de accesibilidad (`accessibility.ts`: movimiento reducido, flotación lenta, alto contraste, voz/SFX) | L | Gemini 4 Hydrogen (Medium) | hecha | Tipos estrictos y evento `accessibility:update` en `gameBus` | `accessibility.ts`, `types/game.ts` |
| F5-02 | Conectar ajustes de audio y accesibilidad en `sfx.ts`, `speech.ts`, `AntigravityScene` y `WorldScene` | M | Gemini 4 Hydrogen (Medium) | hecha | Respeta silencio, flotación lenta (0.55x) y reduce tweens | `speech.ts`, `sfx.ts`, `AntigravityScene` |
| F5-03 | Modal de Ajustes accesible en React (`SettingsModal.tsx` + estilos alto contraste y `reduced-motion` en `App`/`styles.css`) | M | Gemini 4 Hydrogen (Medium) | hecha | Toggles grandes y táctiles aplican cambios en vivo en UI y Phaser | `SettingsModal`, `App`, `styles.css` |
| F5-04 | Verificación integral Fase 5 (`npm test`, `npm run build`, navegador y merge a `main` + push) | L | Gemini 4 Hydrogen (Medium) | hecha | Tests, build y consola en 0 errores | 9/9 tests, build OK, 0 errores en navegador |

## Fase 6: Persistencia local versionada y reinicio
> Alcance acordado: `localStorage` versionado con migraciones + opción de reinicio de progreso (sin backend remoto; contrato desacoplado si se agrega luego).

| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F6-01 | Esquema versionado (`SaveStateV1`), motor de migraciones (`v0 -> v1`), adaptador `localStorage` seguro y `restoreState`/`reset` en `AdaptiveEngine` | P | Gemini 4 Hydrogen (XHigh) | hecha | Tipos estrictos en `types/game.ts`, migración pura secuencial, saneamiento ante JSON corrupto/IDs inválidos/cuota y restauración/reinicio en `AdaptiveEngine` | `types/game.ts`, `saveStorage.ts`, `adaptiveEngine.ts`, `DECISIONS.md`; `typecheck` y 9/9 tests OK |
| F6-02 | Tests unitarios de persistencia, migraciones (`v0 -> v1` y multi-versión) y restauración/reinicio de `AdaptiveEngine` | M | Gemini 4 Hydrogen (Medium) | hecha | `npm test` valida carga por defecto, migraciones, saneamiento de IDs y manejo seguro de storage bloqueado/corrupto | `saveStorage.test.ts`, `adaptiveEngine.test.ts`; 15/15 tests OK |
| F6-03 | Integración en `App.tsx`, sincronización inicial a escenas y "Reiniciar progreso" con confirmación en 2 pasos en `SettingsModal.tsx` | M | Gemini 4 Hydrogen (Medium) | hecha | Al recargar se restauran capturas, álbum, nivel/rachas y accesibilidad; reinicio táctil borra progreso (conserva accesibilidad) y reinicia cúpula | `App.tsx`, `SettingsModal.tsx`, `styles.css`, `AntigravityScene.ts`; `typecheck`, 15/15 tests y `build` OK |
| F6-04 | Verificación integral Fase 6 (`npm test`, `npm run build`, prueba de recarga y reinicio en navegador) + merge a `main` y `push` | L | Gemini 4 Hydrogen (Medium) | hecha | Tests, build y consola en 0 errores; persistencia y reinicio validados en navegador; cierre en `main` | 15/15 tests, `build` OK, recarga/reinicio/Cúpula con 0 errores en navegador |

---

## Roadmap v2.0 — Master Plan (Pac-Man + Bomberman + Cúpula + Historia y Lectura Fluida)
> Referencia completa en `docs/MASTER_PLAN_V2.md`. Controles universales (`WASD`/Flechas, `Espacio`/`Enter`/`J`/`Z`, Gamepad y Táctil).

### Fase 7: Arquitectura v2.0, Currículo de Lectura Fluida y Contratos JSON
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F7-01 | Contratos TS v2.0 (`src/types/campaign.ts`, `src/types/game.ts`) para capítulos, mapas en grilla, enemigos, power-ups, historia y modos de lectura fluida | P | Gemini 4 Hydrogen (XHigh) | hecha | Tipos estrictos sin `any`, cubriendo letras/sílabas/frases/comprensión y mapa de campaña | `types/campaign.ts`, `types/game.ts`; `typecheck` y 15/15 tests OK |
| F7-02 | Currículo ampliado en JSON (`chapters.json`, `words.json`, `sentences.json`) para Capítulos 1–6 (de 6 años a lectura fluida) + test de integridad | M | Gemini 4 Hydrogen (Medium) | hecha | 100% contenido pedagógico en JSON validado por test automático (`curriculum.test.ts`) | 6 capítulos, 30 palabras, 9 frases/comprensión; 18/18 tests OK |
| F7-03 | Migración `SaveStateV1 -> SaveStateV2` en `saveStorage.ts` + tests en `saveStorage.test.ts` (progreso de campaña, estrellas por etapa, historia y cartas equipadas) | M | Gemini 4 Hydrogen (Medium) | hecha | Guardados `v1` migran sin pérdida a `v2`; `npm test` valida migración y saneamiento | `types/game.ts`, `saveStorage.ts`, `App.tsx`, `saveStorage.test.ts`; 19/19 tests OK |
| F7-04 | Controlador de entrada universal (`src/features/input/InputController.ts` + tests): `WASD`/Flechas, `Espacio/Enter/J/Z`, `E/Shift`, `P/Esc`, Gamepad y API táctil | P | Gemini 4 Hydrogen (XHigh) | hecha | Mapeo unificado con soporte de buffer de giro y tests unitarios de prioridades teclado/táctil/gamepad | `InputController.ts`, `InputController.test.ts`; 23/23 tests y `build` OK |

### Fase 8: Motor de Laberintos 2.5D y Mecánica Pac-Man + Bomberman
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F8-01 | Modelo lógico puro del laberinto (`src/features/maze/mazeEngine.ts` + `mazeEngine.test.ts`): grilla, bloques rompibles, orbes/sílabas y ondas de burbujas en cruz | P | Gemini 4 Hydrogen (XHigh) | hecha | Lógica pura desacoplada de Phaser; `npm test` valida explosión en cruz, colisión con muros y recolección | `mazeEngine.ts`, `mazeEngine.test.ts`; typecheck y 29/29 tests OK |
| F8-02 | Mapas amplios JSON del Capítulo 1 + plantillas escalables (`src/data/maps/`) y validador de alcanzabilidad (`mapValidator.ts` + tests) | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Test valida que todos los spawns, orbes y portales sean alcanzables | Mapas `15x11` a `23x15` |
| F8-03 | Escena Phaser 2.5D `MazeScene` (`MazeScene.ts`, `MazeRenderer.ts`, `MazePlayer.ts`): cámara seguimiento, giro asistido en esquinas, burbujas sónicas y portal | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Explorador se mueve fluido con `WASD`/Flechas, rompe bloques con burbujas y abre portal al completar sellos | Integrada en `PhaserCanvas` |
| F8-04 | Controles táctiles en pantalla (`TouchControls.tsx` + `styles.css`) + prueba E2E de controles universales en navegador | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Cruceta táctil + botón Burbuja/Poder operativos sin errores de consola | Verificado en viewport PC y tablet |

### Fase 9: Enemigos, Power-Ups, Corazones y HUD Arcade
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F9-01 | IA pura de enemigos (`src/features/maze/enemyAI.ts` + `enemyAI.test.ts`): patrulla, persecución por vista, aturdimiento por burbuja y huida (`Orbe Dorado`) | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Tests validan transiciones de estado y rutas válidas en grilla | Sin castigos agresivos |
| F9-02 | Power-ups, corazones/escudo y drops (`src/features/maze/powerups.ts` + `MazeScene.ts`): `+Burbuja`, `Onda +1`, `Botas Turbo`, `Escudo Solar`, `Orbe Dorado` con voz `es-CL` | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Recoger power-ups aplica efecto inmediato y respeta límite de corazones/checkpoint | Invulnerabilidad breve al daño |
| F9-03 | HUD Arcade en React (`ArcadeHud.tsx` + `styles.css`) conectado por `gameBus`: corazones, burbujas, fichas, puntaje y pausa (`Esc`/`P`) | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | HUD refleja estado en vivo y pausa congela simulación sin errores | Reutiliza estilos accesibles |
| F9-04 | Verificación integral Fase 9 (`npm test`, `npm run build`, prueba E2E de laberinto + enemigos + power-ups) + merge a `main` | L | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Tests, build y consola en 0 errores | Cierre de Fase 9 |

### Fase 10: Campaña Completa (Inicio a Fin), Historia y 6 Jefes
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F10-01 | Guion e historia en JSON (`src/data/story.json`: prólogo, diálogos de 6 capítulos, epílogo final) + `StoryModal.tsx` con lectura `es-CL` | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Narrativa completa inicio → desarrollo → fin, accesible y saltable | Texto `Lexend` + voz |
| F10-02 | Mapa de Campaña (`CampaignMapView.tsx` + `campaignLogic.ts` + `App.tsx`): 6 islas, 30 etapas, estrellas, desbloqueo y modo rejugar | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Navegación fluida entre capítulos/etapas y persistencia `v2` automática | Sustituye/amplía acceso lineal |
| F10-03 | Jefes de Capítulo (`bossBehavior.ts` + JSON de 6 jefes en `MazeScene`): patrullas especiales, obstáculos mudos, aturdimiento x3 y paso a Cúpula de Jefe | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Los 6 jefes funcionan por configuración JSON sin lógica hardcodeada | Incluye jefe final *Don Silencio* |
| F10-04 | Contenido completo de las 30 etapas (Capítulos 1–6) en `src/data/maps/` + test integral `campaignContent.test.ts` + prueba E2E de flujo historia/jefe/final | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Todos los mapas/palabras/frases de los 6 capítulos pasan validación y build | Cierre de Fase 10 en `main` |

### Fase 11: Cúpula Antigravedad 2.0 (Lectura Fluida) y Cartas con Poderes
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F11-01 | Evolución de `puzzleLogic.ts` y `AntigravityScene.ts`: modo `sentence` (ordenar frases), modo `comprehension` (pregunta/respuesta) y burbujas con escudo | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Tests unitarios validan frases y comprensión; cúpula lee en `es-CL` la frase final | Mantiene 60 FPS en Matter.js |
| F11-02 | Motor de fluidez y adaptación ampliada (`fluencyEngine.ts` + `adaptiveEngine.ts` + tests): ajuste por racha y velocidad de lectura sin castigo | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Progresión adapta señuelos/velocidad entre sílabas, frases y relatos | Retrocompatible con Fases 3–6 |
| F11-03 | Álbum y Cartas Equipables (`cards.json` para Capítulos 1–6 + selección de carta activa en `CardGallery.tsx` con efecto en laberinto/cúpula) | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Cartas otorgan habilidades reales (*Imán*, *Pista Sonora*, *+Burbuja*) | Máx. 1–2 equipadas |
| F11-04 | Verificación integral Fase 11 (`npm test`, `npm run build`, prueba de frases/comprensión/cartas en navegador) + merge a `main` | L | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Tests, build y consola en 0 errores | Cierre de Fase 11 |

### Fase 12: Pulido Profesional, Audio/Arte, Balanceo y Lanzamiento v2.0
| ID | Tarea | Esfuerzo (L/M/P) | Modelo usado | Estado | Criterio de aceptación | Notas |
|---|---|---|---|---|---|---|
| F12-01 | Audio dinámico (`sfx.ts` + música ambiental suave Web Audio + lectura fluida de relatos en `speech.ts`) con control independiente en `SettingsModal.tsx` | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Música/SFX respetan silencio y accesibilidad sin distorsión | Zero dependencias externas |
| F12-02 | Pack de arte 2.5D ampliado (`public/assets/`: biomas, enemigos, power-ups, jefes y criaturas restantes) + optimización de peso | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Assets originales optimizados (< 4 MB total) y cargados en `BootScene` | Cero referencias externas |
| F12-03 | Balanceo de dificultad, accesibilidad completa en `MazeScene` (alto contraste, velocidad lenta, movimiento reducido) y tutorial en Etapa 1-1 | M | _(rec. Gemini 4 Hydrogen Medium)_ | pendiente | Primera etapa guía controles universales y reglas en < 30 s | Pensado para 6+ años |
| F12-04 | QA integral final v2.0 (`npm test`, `npm run build`, E2E campaña inicio → fin, persistencia `v2` y 60 FPS) + cierre en `main` y `push` | P | _(rec. Gemini 4 Hydrogen XHigh)_ | pendiente | Suite completa verde, 0 errores en consola y v2.0 publicada en `main` | Cierre del Master Plan v2.0 |

---

## Siguiente paso
Iniciar **F8-02** en rama `feat/fase-8-laberintos` (mapas amplios JSON del Capítulo 1 + `mapValidator.ts` y tests, esfuerzo **M**, modelo recomendado **Gemini 4 Hydrogen (Medium)**).

## Bloqueos y riesgos
- Sin bloqueos técnicos. Repositorio remoto configurado en `origin` (`PathFinder2408/Juego-Aprende-a-leer-`).
- Riesgos de Fase 1 documentados en `docs/GDD.md`; plan completo v2.0 en `docs/MASTER_PLAN_V2.md`.

## Registro de sesiones
- **2026-11-18:** Fases 2, 3, 4 y 5 completas (`F2-01` a `F5-04` cerradas; accesibilidad, audio, alto contraste y `reduced-motion` verificados con 9/9 tests y 0 errores).
- **2026-11-18:** Rama `feat/fase-6-persistencia` creada y Fase 6 completa (`F6-01` a `F6-04` cerradas; `localStorage` versionado con migraciones, reinicio en 2 pasos, 15/15 tests, build y navegador con 0 errores).
- **2026-11-19:** Diseñado Master Plan v2.0 (`docs/MASTER_PLAN_V2.md` y Fases 7–12 en `PROGRESS.md`) para híbrido Pac-Man + Bomberman + Cúpula con historia completa, controles universales y currículo desde 6 años hasta lectura fluida.
- **2026-11-19:** Iniciada rama `feat/fase-7-arquitectura-v2` y completada Fase 7 (`F7-01` a `F7-04` cerradas; contratos v2.0, 6 capítulos / 30 palabras / frases en JSON, `SaveStateV2` y `InputController` universal; 23/23 tests y build OK).
- **2026-11-19 (Fase 8):** Creada rama `feat/fase-8-laberintos` y completada `F8-01` (`MazeEngine` puro y determinista con giro asistido, warps, ondas en cruz, bloques blandos/duros y recolección; typecheck y 29/29 tests OK).
