# AGENTS.md — Reglas del Proyecto

## A. Economía de tokens
- Lee `AGENTS.md` y `PROGRESS.md` al inicio de cada sesión; lee solo archivos necesarios para la tarea (nunca recorras todo el repo).
- Antes de leer un archivo grande, busca con grep/símbolos y lee solo el rango relevante.
- No repitas código existente ni pegues archivos completos: muestra solo diffs o fragmentos cambiados.
- Respuestas breves: resultado, archivos tocados, cómo verificar. Sin resúmenes largos ni disculpas.
- Una tarea = un objetivo. Si supera ~5 archivos modificados, divídela en subtareas en `PROGRESS.md` antes de ejecutar.
- Si tras 2 intentos un error persiste, DETENTE: resume lo probado y propón 2 hipótesis.
- Si la conversación se alarga, resume el estado en `PROGRESS.md` y sugiere abrir sesión nueva.
- No instales dependencias sin justificarlo en 1 línea en `docs/DECISIONS.md`.
- Ejecuta tests, lint y build solo cuando sea relevante para la tarea.

## B. Enrutamiento de modelos (por esfuerzo)
Clasifica cada tarea antes de ejecutar y recomienda nivel (el usuario cambia manualmente):
- **LIGERO (L)** (rápido/económico): renombrados, formato, comentarios, JSON de contenido, CSS, textos, config, fixes triviales, README.
- **MEDIO (M)** (equilibrado): componentes React, escenas/sistemas Phaser acotados, tests unitarios, refactors de 1 módulo, integración de 2 módulos, bugs con causa conocida.
- **PESADO (P)** (mayor razonamiento / planificación): arquitectura inicial, física antigravedad, dificultad adaptativa, bugs sin causa clara, persistencia/migraciones, seguridad/rendimiento, cambios multimódulo.
- **Escalada**: si L o M falla 2 veces, sugiere subir; si P pasa a trabajo mecánico tras planificar, sugiere bajar.
- **Patrón**: planificar con P, implementar con M o L, revisar con P solo si es crítico.

## C. Flujo de trabajo por tarea
1. Anuncia en 1 línea: ID de tarea, esfuerzo y modelo recomendado. Si el modelo actual no coincide, pregunta antes de continuar.
2. Implementa lo mínimo para cumplir el criterio de aceptación (sin extras).
3. Verifica el criterio de aceptación y reporta resultado real (pasó / falló / no verificado).
4. Actualiza `PROGRESS.md` (estado, fecha, notas) y haz commit convencional (`feat:`, `fix:`, `chore:`, `docs:`) en la rama de la fase; sube a GitHub (`push`) en hitos clave y fusiona a `main` al cerrar fase.
5. Detente y espera confirmación antes de pasar a la siguiente tarea.

## D. Calidad
- TypeScript estricto, módulos por feature, sin palabras ni sílabas hardcodeadas (todo en JSON validado).
- Contenido infantil original: cero criaturas, nombres o assets de franquicias existentes.
- No inventes APIs ni opciones de configuración: si hay duda, dilo y propón cómo verificar.
