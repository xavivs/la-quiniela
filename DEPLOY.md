# Publicar La Quiniela de forma gratuita

Todo lo que necesitas es **gratis**: Vercel (hosting) y Supabase (base de datos). GitHub es **opcional** (sirve para desplegar automáticamente cada vez que hagas push).

---

## Opción A: Publicar sin GitHub (desde tu PC)

1. Instala Vercel CLI (solo una vez):
   ```bash
   npm i -g vercel
   ```
2. En la carpeta del proyecto (`football-predictions`), ejecuta:
   ```bash
   vercel
   ```
3. Inicia sesión en Vercel cuando te lo pida (te abrirá el navegador).
4. Responde a las preguntas:
   - **Set up and deploy?** → Yes
   - **Which scope?** → tu cuenta
   - **Link to existing project?** → No
   - **Project name?** → el que quieras (ej. la-quiniela)
   - **Directory?** → ./ (Enter)
5. **Antes del primer deploy**, añade las variables de entorno. En [vercel.com](https://vercel.com) → tu proyecto → **Settings → Environment Variables** añade:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu URL de Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key
   Luego en la carpeta del proyecto ejecuta de nuevo:
   ```bash
   vercel --prod
   ```
   para desplegar a producción con esas variables.

Tu URL quedará tipo `la-quiniela.vercel.app`. Cada vez que quieras actualizar la web, ejecuta `vercel --prod` desde la carpeta del proyecto.

---

## Opción B: Con GitHub (despliegue automático en cada push)

### 1. Subir el código a GitHub

1. Crea una cuenta en [github.com](https://github.com) si no la tienes.
2. Crea un **repositorio nuevo** (por ejemplo `la-quiniela`). No marques "Add a README" si ya tienes código local.
3. En la carpeta del proyecto, abre terminal y ejecuta:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

(Sustituye `TU_USUARIO` y `TU_REPO` por tu usuario de GitHub y el nombre del repo.)

### 2. Conectar y desplegar en Vercel (gratis)

1. Entra en [vercel.com](https://vercel.com) e inicia sesión con **GitHub**.
2. Pulsa **"Add New..." → "Project"**.
3. Importa tu repositorio (si no aparece, autoriza a Vercel en GitHub).
4. **Configuración del proyecto:**
   - **Framework Preset:** Next.js (detectado automáticamente).
   - **Root Directory:** deja vacío.
   - **Build Command:** `next build` (por defecto).
   - **Output Directory:** por defecto.

5. **Variables de entorno** (importante):
   - Pulsa **"Environment Variables"**.
   - Añade:
     - **Name:** `NEXT_PUBLIC_SUPABASE_URL`  
       **Value:** tu URL de Supabase (ej. `https://xxxxx.supabase.co`).
     - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
       **Value:** tu clave anónima de Supabase (anon key).
   - Marca **Production**, **Preview** y **Development** para ambas.

6. Pulsa **Deploy**. En 1–2 minutos tendrás una URL tipo `tu-proyecto.vercel.app`.

---

## Configurar Supabase para producción (en ambos casos)

Para que el login y las sesiones funcionen en tu dominio de Vercel:

1. Entra en [supabase.com](https://supabase.com) → tu proyecto → **Authentication** → **URL Configuration**.
2. En **Site URL** pon tu URL de Vercel, por ejemplo:
   ```
   https://tu-proyecto.vercel.app
   ```
3. En **Redirect URLs** añade (y deja también `http://localhost:3000` si sigues desarrollando en local):
   ```
   https://tu-proyecto.vercel.app/**
   http://localhost:3000/**
   ```
4. Guarda los cambios.

---

## Comprobar que todo funciona

- Abre `https://tu-proyecto.vercel.app`.
- Prueba **registrarte** y **iniciar sesión**.
- Navega por Semana, Ranking, Stats, Admin.

Si algo falla, revisa la pestaña **Deployments** en Vercel y los **logs** del último deployment para ver errores de build o de variables de entorno.

---

## Resumen de servicios (todos con plan gratuito)

| Servicio   | Uso                         | Límites gratis (aprox.)      |
|-----------|-----------------------------|------------------------------|
| **Vercel** | Hosting de la app Next.js   | 100 GB ancho de banda, builds ilimitados |
| **Supabase** | Base de datos + auth       | 500 MB DB, 50.000 usuarios activos/mes  |
| **GitHub** | Opcional. Repo + despliegue automático en cada push | Repos públicos ilimitados |

---

## Actualizaciones futuras

- **Sin GitHub:** ejecuta `vercel --prod` en la carpeta del proyecto cada vez que quieras publicar cambios.
- **Con GitHub:** cada `git push` a `main` desplegará automáticamente en Vercel.
