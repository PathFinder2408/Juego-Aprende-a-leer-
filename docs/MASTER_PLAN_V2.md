# Master Plan v2.0 — Cúpula de Letras: La Aventura del Archipiélago Silábico

> **Objetivo central:** Evolucionar el MVP (Fases 1–6) hacia un videojuego arcade-educativo completo con **inicio, desarrollo, jefes y final**, fusionando exploración en laberintos amplios (**Pac-Man + Bomberman**) con la **Cúpula de Antigravedad Matter.js**, llevando al jugador desde **6 años** (vocales y primeras sílabas) hasta **lectura fluida y comprensión lectora** en español (`es-CL`).

---

## 1. Visión de Diseño y Bucle Jugable v2.0

**Prólogo / Historia → Mapa de Campaña (6 Capítulos) → Laberinto Amplio (Pac-Man + Bomberman) → Portal → Cúpula de Antigravedad 2.0 → Captura / Jefe → Álbum de Poderes → Epílogo Final**

1. **Historia completa ("El Rescate del Archipiélago Silábico"):**
   - **Conflicto:** *Don Silencio* y su *Niebla Muda* dispersaron las sílabas y frases del *Gran Libro de las Islas*, atrapando a las criaturas guardianas en 6 islas temáticas.
   - **Estructura narrativa:** Prólogo introductorio, diálogos breves con voz `es-CL` antes y después de cada capítulo/jefe, evolución visible del archipiélago al liberar islas y **cinemática final con epílogo y trofeo** al restaurar el Gran Libro.
2. **Laberinto 2.5D Amplio (Pac-Man + Bomberman):**
   - Mapas amplios con cámara de seguimiento (`15×11` a `23×15` tiles), bloques indestructibles, bloques destructibles (cajas, corales, rocas agrietadas) y portales de pasillo.
   - **Recolección estilo Pac-Man:** Orbes de estrellas y **fichas de sílabas/palabras clave** que se pronuncian en `es-CL` al recogerlas.
   - **Burbujas Sónicas estilo Bomberman:** El explorador suelta burbujas con temporizador visual cuya onda en cruz rompe bloques blandos, revela **power-ups** o llaves silábicas y **aturde** a enemigos patrulla (sin violencia gráfica ni "game over" frustrante).
   - **Power-Ups:** `+Burbuja`, `Onda +1`, `Botas Turbo`, `Escudo Solar` (absorbe 1 golpe) y `Orbe Dorado` (vuelve vulnerables a los enemigos durante 6 s, estilo Power Pellet).
   - **Sistema de corazones:** 3 corazones (más Escudo Solar); si se agotan, reaparece en el checkpoint de etapa conservando letras/aprendizaje previos.
3. **Cúpula de Antigravedad 2.0:**
   - Se abre al reunir los sellos de palabra del laberinto o al aturdir al jefe de capítulo.
   - Evoluciona según el capítulo: letras/sílabas → palabras con dígrafos/trabadas → **ordenar palabras en oraciones** → **comprensión lectora** flotante.
4. **Cartas con Poderes Reales:**
   - Capturar criaturas y completar sus huecos en el álbum desbloquea **habilidades equipables** (ej. *Imán de Sílabas*, *Burbuja Extra*, *Pista Sonora*).

---

## 2. Currículo Progresivo: De 6 Años a Lectura Fluida (6 Capítulos · 30 Etapas)

| Capítulo | Bioma / Isla | Foco Pedagógico | Mecánica Nueva | Jefe |
|---|---|---|---|---|
| **1** | Playa Amanecer | Vocales + sílabas directas (`M, P, L, S`) | Laberinto base, burbujas, *Sombras Dormilonas* | *Cangrejo Eco* |
| **2** | Selva Murmullo | Consonantes (`T, D, N, R, C, B, V, F`), bisílabas/trisílabas | Lianas rompibles, `+Burbuja`, `Onda +1` | *Camaleón Mudo* |
| **3** | Cañón del Eco | Dígrafos (`CH, LL, RR, QU, GU, Ñ`) y sílabas inversas (`AL, ES, AR`) | Portales laterales estilo Pac-Man, persecución por vista | *Eco Tartamudo* |
| **4** | Cumbre Brasa | Sílabas trabadas (`BR, BL, CR, DR, FR, GL, PL, TR`) | Bloques duros (2 ondas), `Botas Turbo`, `Escudo Solar` | *Gólem de Ceniza* |
| **5** | Ruinas del Saber | **Oraciones completas**, conectores y comprensión básica | Interruptores por palabra correcta en laberinto | *Esfinge de Tinta* |
| **6** | Cúpula Estelar | **Mini-relatos (2–4 frases)**, signos (`¿? ¡! , .`), fluidez | Cúpula multi-frase + cartas equipadas | *Don Silencio* (Final) |

---

## 3. Controles Universales (PC + Gamepad + Táctil)

| Acción | Teclado Universal | Gamepad | Táctil en Pantalla |
|---|---|---|---|
| **Moverse** | `WASD` o `Flechas` (con asistencia en esquinas) | Stick izquierdo o D-Pad | Cruceta / Joystick virtual |
| **Soltar Burbuja** | `Espacio`, `Enter`, `J` o `Z` | Botón Sur (`A` / `✕`) | Botón grande `Burbuja` |
| **Usar Carta / Poder** | `E`, `Shift`, `K` o `X` | Botón Este (`B` / `○`) | Botón `Poder` |
| **Pausa / Mapa** | `Esc` o `P` | `Start` / `Options` | Botón `Pausa` en HUD |

---

## 4. Arquitectura Técnica y Reutilización del MVP

- **Reutilizado de Fases 1–6:** `Phaser 3 + Matter.js`, `gameBus` tipado, `speech.ts` (`es-CL`), `sfx.ts`, `adaptiveEngine.ts`, `saveStorage.ts` (migración `v1 → v2`), `SettingsModal.tsx` (accesibilidad) y `CardGallery.tsx`.
- **Nuevos módulos por feature:**
  - `src/features/input/`: `InputController.ts` unificado (teclado + gamepad + virtual táctil).
  - `src/features/maze/`: `mazeEngine.ts` (lógica pura en grilla), `enemyAI.ts`, `powerups.ts`, `MazeScene.ts`, `MazeRenderer.ts`, `MazePlayer.ts`.
  - `src/features/campaign/`: `campaignLogic.ts`, `fluencyEngine.ts`.
  - `src/data/`: `chapters.json`, `story.json`, `maps/*.json`, `sentences.json`, `cards.json` y `words.json` ampliados.
  - `src/components/`: `TouchControls.tsx`, `ArcadeHud.tsx`, `StoryModal.tsx`, `CampaignMapView.tsx`.

---

## 5. Roadmap en Fases (Fases 7 a 12)

- **Fase 7:** Arquitectura v2.0, currículo JSON, migración `SaveStateV2` y `InputController` universal.
- **Fase 8:** Motor de laberintos 2.5D (`MazeEngine` + `MazeScene`) con burbujas sónicas y controles táctiles.
- **Fase 9:** Enemigos (IA patrulla/persecución/aturdimiento), corazones/escudo, power-ups y `ArcadeHud`.
- **Fase 10:** Modo Historia (prólogo a final), selector de 6 capítulos/30 etapas y 6 jefes.
- **Fase 11:** Cúpula Antigravedad 2.0 (modo frases y comprensión) y cartas equipables con poderes.
- **Fase 12:** Audio dinámico, arte de biomas/criaturas/enemigos, balanceo y QA integral v2.0.
