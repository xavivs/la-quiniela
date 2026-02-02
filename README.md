# La Quiniela

Pronóstico Quiniela (14 partidos 1/X/2 + pleno al 15) para 8 usuarios. **Next.js 14 (App Router)** y **Supabase**.

## Reglas

- **14 partidos**: resultado 1 (local), X (empate), 2 (visitante). Un punto por acierto.
- **Partido 15 (pleno al 15)**: goles local y visitante: 0, 1, 2 o M (más de 2). Un punto si aciertas exacto.
- **Usuarios fijos**: Xavi, Laura, Montse, Lluís, Jordi, Neus, Denci, Marià (siempre en ese orden).

## Secciones

- **Semana**: Pronóstico (click en celdas 1/X/2 o pleno 0/1/2/M) y **Resultados Semana** (aciertos por persona, verde/rojo).
- **Ranking**: Suma de puntos de toda la temporada, en el orden fijo de nombres.
- **Admin**: Importar jornada subiendo foto del boleto y rellenando los 15 partidos; introducir resultados manualmente.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

| Variable | Descripción |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto (Supabase → Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon/public |

## Base de datos

1. Crea un proyecto en [Supabase](https://supabase.com).
2. **Crear tablas:** en Supabase → **SQL Editor** → **New query** → pega todo el archivo **`supabase/setup-quiniela-full.sql`** → **Run**. Si ves *"Could not find the table public.jornadas"*, ejecuta ese script.
3. Crea el bucket de Storage para fotos de boletos: Storage → New bucket → id `quiniela-slips`, público. Opcional: en Policies, permitir `insert` para `authenticated` y `select` para todos.
4. En Authentication → Providers activa **Email** (y opcionalmente desactiva “Confirm email” para pruebas).

## Ejecutar en local

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Dónde desplegar (gratis y sencillo)

**Recomendado: Vercel** (gratis, muy fácil para Next.js):

1. Crea una cuenta en [vercel.com](https://vercel.com) (con GitHub).
2. Sube el proyecto a un repo de GitHub (si no lo tienes: “New repository”, sube el código).
3. En Vercel: “Add New” → “Project” → importa tu repo de GitHub.
4. En “Environment Variables” añade:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (los mismos valores que en `.env.local`).
5. Pulsa “Deploy”. En unos minutos tendrás una URL tipo `tu-proyecto.vercel.app`.

**Alternativa:** Netlify también permite desplegar Next.js gratis (importas el repo y configuras las mismas variables).

## Estructura (Quiniela)

```
src/
  app/
    page.tsx, login/, signup/
    semana/          # Pronóstico + Resultados Semana (verde/rojo)
    ranking/         # Ranking temporada (orden fijo)
    admin/           # Importar jornada (foto + 15 partidos), editar resultados
    api/
      quiniela/      # predictions, jornadas, results
      upload/slip/   # subir foto boleto
  lib/
    quiniela-constants.ts   # Nombres fijos, opciones 1/X/2 y 0/1/2/M
    quiniela-scoring.ts
    quiniela-ranking.ts
supabase/
  schema.sql         # users, etc.
  schema-quiniela.sql # jornadas, quiniela_matches, quiniela_predictions
```
