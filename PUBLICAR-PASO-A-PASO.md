# Publicar La Quiniela (Opción B: con GitHub) — Paso a paso

Sigue estos pasos en orden. Si algo falla, revisa el mensaje de error o dime en qué paso estás.

---

## Paso 0: Instalar Git (solo si no lo tienes)

1. Entra en **https://git-scm.com/download/win**
2. Descarga "64-bit Git for Windows Setup" e instálalo (siguiente, siguiente; deja las opciones por defecto).
3. Cierra y vuelve a abrir la terminal (o Cursor) para que reconozca `git`.

Para comprobar: abre una terminal y escribe `git --version`. Debe salir algo como `git version 2.x.x`.

---

## Paso 1: Crear cuenta y repositorio en GitHub

1. Entra en **https://github.com** e **inicia sesión** (o crea cuenta si no tienes).
2. Arriba a la derecha: clic en **"+"** → **"New repository"**.
3. Rellena:
   - **Repository name:** `la-quiniela` (o el nombre que quieras).
   - **Description:** opcional.
   - **Public.**
   - **No** marques "Add a README", "Add .gitignore" ni "Choose a license" (el proyecto ya tiene código).
4. Clic en **"Create repository"**.
5. En la página del repo verás una URL. **Cópiala** (será algo como):
   ```text
   https://github.com/TU_USUARIO/la-quiniela.git
   ```
   La necesitarás en el Paso 3.

---

## Paso 2: Inicializar Git y hacer el primer commit (en tu PC)

Abre una terminal **en la carpeta del proyecto** (`football-predictions`). En Cursor: Terminal → New Terminal (o `Ctrl+ñ`). Luego ejecuta **cada línea** (Enter después de cada una):

```bash
cd c:\Users\xaviv\Documents\Cursor\football-predictions
```

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial commit - La Quiniela"
```

```bash
git branch -M main
```

---

## Paso 3: Conectar con GitHub y subir el código

Sustituye `TU_USUARIO/la-quiniela` por **tu** usuario y nombre del repo (la URL que copiaste en el Paso 1). Ejemplo: si tu repo es `https://github.com/xaviv/la-quiniela.git`, usa `xaviv/la-quiniela`:

```bash
git remote add origin https://github.com/TU_USUARIO/la-quiniela.git
```

```bash
git push -u origin main
```

Te pedirá **usuario y contraseña** de GitHub. Si pide contraseña, en GitHub ya no se usa la contraseña de la cuenta; hay que usar un **Personal Access Token**:

- GitHub → **Settings** (tu perfil) → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token**.  
- Ponle un nombre (ej. "Vercel deploy"), marca **repo** y genera.  
- **Copia el token** (solo se muestra una vez) y úsalo como "contraseña" cuando `git push` te la pida. Usuario = tu usuario de GitHub.

Si todo va bien, al refrescar la página del repo en GitHub verás todos los archivos.

---

## Paso 4: Conectar el repo con Vercel y desplegar

1. Entra en **https://vercel.com** e **inicia sesión con GitHub** (Authorize si te lo pide).
2. Clic en **"Add New..."** → **"Project"**.
3. En "Import Git Repository" deberías ver **la-quiniela** (o el nombre de tu repo). Clic en **"Import"**.
4. En la pantalla de configuración:
   - **Project Name:** déjalo o cámbialo (ej. `la-quiniela`).
   - **Framework Preset:** Next.js (debe estar ya).
   - **Root Directory:** vacío.
   - **Build Command:** `next build` (por defecto).
   - **Output Directory:** por defecto.
5. **Variables de entorno** (muy importante):
   - Clic en **"Environment Variables"**.
   - Añade la primera:
     - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
     - **Value:** pega aquí la URL de tu proyecto Supabase (la tienes en Supabase → Project Settings → API → Project URL).
     - Marca **Production**, **Preview** y **Development**.
   - Añade la segunda:
     - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - **Value:** pega la "anon public" key (Supabase → Project Settings → API → Project API keys → anon public).
     - Marca también las tres (Production, Preview, Development).
6. Clic en **"Deploy"**.
7. Espera 1–2 minutos. Al terminar verás **"Congratulations"** y una URL tipo **https://la-quiniela.vercel.app**. Esa es tu web.

---

## Paso 5: Configurar Supabase para que el login funcione en producción

1. Entra en **https://supabase.com** → tu proyecto.
2. Menú izquierdo: **Authentication** → **URL Configuration**.
3. **Site URL:** pon exactamente la URL de Vercel (ej. `https://la-quiniela.vercel.app`), sin barra al final.
4. **Redirect URLs:** en la caja de texto, añade esta línea (y deja `http://localhost:3000/**` si quieres seguir probando en local):
   ```text
   https://la-quiniela.vercel.app/**
   ```
   (Sustituye por tu URL de Vercel si es distinta.)
5. **Save**.

---

## Paso 6: Probar la web

1. Abre la URL de Vercel en el navegador.
2. Prueba **registrarte** con un email y contraseña.
3. Prueba **iniciar sesión** y navegar por Semana, Ranking, Stats.

Si el login o el registro fallan, revisa que en Supabase hayas puesto bien la **Site URL** y **Redirect URLs** (Paso 5).

---

## A partir de ahora: cómo actualizar la web

Cuando cambies código en el proyecto:

1. En la terminal, dentro de `football-predictions`:
   ```bash
   git add .
   git commit -m "Descripción del cambio"
   git push
   ```
2. Vercel desplegará solo y en 1–2 minutos la web tendrá los cambios.

---

## Resumen rápido

| Paso | Dónde | Qué haces |
|------|--------|------------|
| 0 | Tu PC | Instalar Git si no está |
| 1 | GitHub | Crear repo (sin README) y copiar URL |
| 2 | Terminal | `git init`, `git add .`, `git commit`, `git branch -M main` |
| 3 | Terminal | `git remote add origin ...`, `git push` (con token si pide contraseña) |
| 4 | Vercel | Import repo, añadir env vars Supabase, Deploy |
| 5 | Supabase | Site URL + Redirect URLs con la URL de Vercel |
| 6 | Navegador | Probar registro y login |

Si te atascas en un paso concreto, dime en cuál (y el mensaje de error si hay) y lo vemos.
