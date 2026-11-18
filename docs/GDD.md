# GDD Resumido — Cúpula de Letras

> **Perfil objetivo:** Niño de 6 años (lee algunas palabras), español de Chile (`es-CL`), juego multidispositivo (PC, tablet y móvil).

## 1. Bucle Principal y Dirección Visual
**Lobby / Campamento → Exploración Tropical 2.5D → Encuentro → Cúpula de Antigravedad → Captura como Carta Coleccionable → Álbum / Duelos**
1. **Dirección artística (100% original):** Isla tropical soleada en 2.5D (inspiración *Alola / Pokémon Sun*) + física cómica con props empujables (*Wobbly Life*) + explorador chibi con volumen 3D pre-renderizado + Hub/HUD móvil con barra inferior (`Inicio / Isla / Cúpula / Cartas`) y cartas holográficas CSS.
2. **Exploración:** Explorador chibi recorre senderos, playa y pasto alto brillante en la Isla Sol con cámara de seguimiento y sombras por profundidad (`Y-sort`).
3. **Encuentro:** Al acercarse a una criatura salvaje o agitar el pasto brillante se despliega la **cúpula de antigravedad** (gravedad 0).
4. **Puzle:** Letras o sílabas flotan y rebotan como cuerpos físicos Matter.js. El jugador las toca o golpea en orden.
   - **Acierto:** Sonido + pronunciación `es-CL` + la letra se acopla al objetivo.
   - **Error (sin castigo):** Rebote suave, sin "game over"; tras 3 fallos seguidos baja la dificultad y muestra pista visual/sonora.
5. **Captura y Cartas:** Completar la palabra dispara `capture`, lee la palabra en voz alta y otorga la **carta coleccionable ilustrada** de la criatura (efecto foil 3D).
6. **Álbum y Duelos de Cartas:** Descripciones con huecos que se completan con palabras flotantes y mini-duelos amistosos cargando cartas con lectura.
- **Ritmo:** Ciclo de 1 a 3 min por captura; sugerencia amigable de pausa a los 15-20 min.

## 2. Criaturas Originales (Ejemplos)
| Criatura | Descripción breve | Palabra objetivo | Nivel |
|---|---|---|---|
| **Solín** | Chispita solar redonda que bosteza luz tibia | `SOL` | 1 |
| **Mumu** | Nubecita esponjosa que flota de cabeza | `LUNA` | 2 |
| **Sapín** | Ranita torpe con botas de goma gigantes | `SAPO` | 2 |
| **Pelufo** | Ovillo de lana con patitas que rueda sin parar | `PELO` | 3 |
| **Chispón** | Luciérnaga con casco espacial de burbuja | `CHISPA` | 4 |
| **Brumín** | Dragoncito de vapor tibio que hace ruido de locomotora | `TREN` | 5 |

## 3. Curva de Dificultad (5 Niveles — Método Silábico)
Adaptación automática: **3 aciertos seguidos** suben complejidad; **3 errores seguidos** la reducen y activan pista.

| Nivel | Foco pedagógico | Señuelos | Velocidad flotación |
|---|---|---|---|
| **1** | Vocales y palabras cortas directas (2-3 letras, ej. `SOL`) | 0 - 1 | Muy lenta |
| **2** | Sílabas directas C+V y bisílabas simples (`LUNA`, `SAPO`) | 1 - 2 | Lenta |
| **3** | Bisílabas y trisílabas directas (`PELO`, `PELOTA`) | 2 - 3 | Media |
| **4** | Dígrafos (`ch`, `ll`, `rr`, `qu`, `gu`) y sílabas mixtas (`CHISPA`) | 3 | Media-alta |
| **5** | Sílabas trabadas (`tr`, `br`, `pl`, `fr`, ej. `TREN`) | 3 - 4 | Dinámica |

## 4. Estructura de Carpetas
- `src/config/`: Parámetros de física y accesibilidad tipados y editables en vivo.
- `src/events/`: Event bus tipado para desacoplar Phaser (canvas) de React (UI/debug).
- `src/data/`: Contenido pedagógico en JSON validado (palabras, sílabas, criaturas, niveles).
- `src/audio/`: Servicio de voz `es-CL` (Web Speech API con fallback seguro a audio).
- `src/features/antigravity/`: Escena Phaser + Matter.js de la cúpula de gravedad cero.
- `src/features/{world,encounter,album,progression}/`: Módulos por feature para Fases 2 a 4.
- `src/components/`: Componentes React fuera del canvas (HUD, panel debug, álbum, ajustes).

## 5. Riesgos Técnicos y de Diseño (y Mitigación)
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Letras ilegibles al girar o superponerse | Frustración lectora | Amortiguación angular alta, retorno suave a 0° y área táctil mínima (>= 56 px). |
| Web Speech API inconsistente en tablets/navegadores | Falta de refuerzo sonoro | Wrapper con fallback silencioso, cola cancelable y soporte futuro de MP3/OGG. |
| Caída de FPS en tablet gama media | Experiencia lenta (< 60 FPS) | Máx. 10-12 cuerpos activos en cúpula, ragdoll simple (sin cadena completa) y DPR acotado. |
| Toques accidentales repetidos | Falsos errores consecutivos | Cooldown breve por cuerpo (~250 ms) y rebote suave sin penalización. |
| Estado desincronizado Phaser ↔ React | UI muestra datos viejos | Fuente de verdad única en Phaser/servicios; React solo escucha y emite vía event bus. |
