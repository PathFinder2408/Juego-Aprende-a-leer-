# Cúpula de Letras

Videojuego web educativo de lectura en español (`es-CL`) diseñado para acompañar a niños y niñas desde los **6 años** (letras y sílabas) hasta la **lectura fluida** (oraciones y comprensión), combinando exploración en laberintos 2.5D, física en gravedad cero, narrativa por capítulos y cartas coleccionables.

## Características principales

- **Campaña de 6 islas y 30 etapas**: *Playa Amanecer*, *Selva Murmullo*, *Cañón del Eco*, *Cumbre Brasa*, *Ruinas del Saber* y *Cúpula Estelar*, con prólogo, intros/outros por capítulo, epílogo y 6 jefes finales (incluido *Don Silencio*).
- **Laberintos 2.5D (Pac-Man + Bomberman)**: recoge sellos silábicos y orbes estelares, rompe bloques con burbujas sónicas, usa warps y power-ups (*+Burbuja*, *Onda +1*, *Botas Turbo*, *Escudo Solar*, *Orbe Dorado*) y abre el portal.
- **Cúpula Antigravedad (Matter.js)**: reúne sílabas, ordena oraciones o responde preguntas de comprensión en gravedad cero con lectura en voz alta (`Web Speech API es-CL`) y adaptación progresiva sin castigos.
- **Álbum de 7 cartas equipables**: completa frases en tu álbum y equipa habilidades reales (*Imán de Sílabas*, *Pista Sonora*, *+Burbuja*, *Onda +1*, *Escudo Solar inicial*).
- **Estilos del Explorador**: elige entre **Explorador**, **Futbolista #7** (rojo y verde) y **Kayros #24** (básquet negro y naranja).
- **Accesibilidad y persistencia**: alto contraste, flotación lenta, movimiento reducido, controles independientes de voz, SFX y música ambiental Web Audio, más guardado automático versionado en `localStorage`.

## Controles universales

- **Teclado**: `WASD` o `Flechas` para moverte · `Espacio` / `Enter` / `J` / `Z` para burbuja · `E` / `Shift` para poder · `P` / `Esc` para pausa.
- **Táctil / Móvil**: cruceta y botones en pantalla (`Burbuja` y `Poder`) + toque directo en isla y cúpula.
- **Gamepad**: stick izquierdo y botones principales.

## Requisitos e instalación

Requiere **Node.js 18+**.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173/` en tu navegador.

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo Vite |
| `npm run typecheck` | Verifica tipos con TypeScript (`tsc --noEmit`) |
| `npm test` | Ejecuta la suite de tests unitarios con Vitest |
| `npm run build` | Verifica tipos y genera el bundle de producción en `dist/` |
| `npm run preview` | Previsualiza el build de producción |

## Estructura del proyecto

- `src/features/maze/`: motor puro de laberintos (`mazeEngine.ts`), IA de enemigos (`enemyAI.ts`), jefes (`bossBehavior.ts`), power-ups y escena Phaser (`MazeScene.ts`).
- `src/features/antigravity/`: física en gravedad cero (`AntigravityScene.ts`, `PlayerBumper.ts`, `LetterBody.ts`, `puzzleLogic.ts`).
- `src/features/campaign/`: progreso de campaña, currículo y fluidez lectora (`campaignLogic.ts`, `fluencyEngine.ts`).
- `src/features/persistence/`: guardado versionado `v2` con migraciones (`saveStorage.ts`).
- `src/data/`: contenido 100% en JSON (`chapters.json`, `words.json`, `sentences.json`, `cards.json`, `story.json`, `bosses.json`, `skins.json`, `maps/`).
- `src/components/`: interfaz React (`LobbyView`, `CampaignMapView`, `ArcadeHud`, `TouchControls`, `CardGallery`, `StoryModal`, `SettingsModal`).
- `public/assets/`: sprites 3D-chibi originales optimizados en PNG transparente.
