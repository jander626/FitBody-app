# FitFood

App de registro de calorías y macros **por foto o por texto**, con una conversación
corta para afinar la estimación. PWA instalable, de uso personal.

Es la evolución de [`jander626/fitfood`](https://github.com/jander626/fitfood) — la
bitácora de 90 días en Markdown/JSON. Ese repo **sigue siendo el diario**; este solo
lo lee una vez para importar los datos de arranque.

## Por qué existe

El sistema actual funciona por chat: mandas una foto, describes lo que haga falta, se
corrige entre los dos, y alguien escribe el JSON a mano. Funciona, pero depende de que
haya un chat abierto al otro lado. Esta app hace el mismo ciclo —**incluida la
conversación**— sin intermediario.

La conversación no es un adorno. Los registros históricos están llenos de
`"origen": "foto + descripcion + correccion del usuario"` y de notas como *"es quesito,
no queso costeño"* o *"dejó 1 de las 3 tortitas sin comer"*. Ninguna de esas
correcciones sale de una foto: salen de que alguien preguntó.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local     # y llenar las claves
npm run dev
```

Hace falta un proyecto de Supabase (plan gratis alcanza):

1. Crear el proyecto y copiar `URL` y `anon key` a `.env.local`.
2. Aplicar las migraciones de `supabase/migrations/` en el SQL Editor, en orden.
3. Entrar a `/login` y pedir el magic link.

Para arrancar con los datos reales en vez de en cero:

```bash
FITFOOD_REPO_PATH=../fitfood npm run import
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests (motor, guardrails, importación, normalización, métricas) |
| `npm run test:db` | Levanta un Postgres desechable, aplica las migraciones, prueba el aislamiento RLS y ensaya la importación |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run import` | Importa la bitácora de fitfood a Supabase |
| `npm run eval -- --texto` | Mide la precisión contra los datos históricos (gasta API) |
| `npm run eval -- --texto --dry` | Lo mismo, sin llamar a la API: para revisar el montaje |
| `npm run iconos` | Regenera los PNG de la PWA desde `assets/icon.svg` |

## Estructura

```
app/
  hoy/        diario del día: kcal restantes, macros, comidas
  registrar/  foto y/o texto → estimación editable → guardar
  peso/       registro y tendencia con media móvil de 7 días
  perfil/     datos, objetivo y gasto de API del mes
  api/registro/   el único endpoint que habla con Claude
lib/
  nutrition/  motor puro: TMB, GET, macros, media móvil, ajuste semanal
  vision/     prompt, schema, normalización contra la tabla de alimentos
  guardrails/ límites de turnos, sesiones y gasto
  supabase/   clientes browser y server
supabase/migrations/   esquema y RLS
scripts/    importación, evaluación de precisión, iconos
```

## Notas

- **La IA estima *qué* y *cuánto*; la tabla de alimentos pone los números.** Cuando un
  ítem hace match con la tabla, los macros se recalculan con `kcal100 × g / 100`. Solo
  el texto libre conserva la estimación del modelo.
- **El chat está acotado** a comida, nutrición, ejercicio y composición corporal, con
  límites duros (turnos por sesión, sesiones por día, tope de gasto mensual) que se
  verifican **antes** de llamar a la API.
- Si se agota el tope, la app sigue siendo usable: el buscador y el registro manual no
  tocan la API.

Esto no es consejo médico. Es un sistema de seguimiento.
