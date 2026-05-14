/**
 * Configura Site URL y Redirect URLs (uri_allow_list) del proyecto Supabase
 * vía Management API. No subas nunca el token al repositorio.
 *
 * 1) Crea un token: https://supabase.com/dashboard/account/tokens
 *    (permisos: al menos lectura/escritura de proyecto / auth si usas token fino)
 * 2) En PowerShell, desde la carpeta del proyecto:
 *    $env:SUPABASE_ACCESS_TOKEN = "sbp_..."
 *    node scripts/set-supabase-auth-urls.mjs
 *
 * Panel manual (misma configuración):
 * https://supabase.com/dashboard/project/xkzqvqowioocrsveimas/auth/url-configuration
 */

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "xkzqvqowioocrsveimas";
const SITE_URL = "https://la-quiniela.vercel.app";
const REQUIRED_REDIRECTS = [
  "https://la-quiniela.vercel.app/**",
  "http://localhost:3000/**",
  "https://*.vercel.app/**",
];

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token || token.length < 10) {
  console.error(
    [
      "Falta SUPABASE_ACCESS_TOKEN en el entorno.",
      "",
      "Crea un token en: https://supabase.com/dashboard/account/tokens",
      "Luego en PowerShell:",
      '  $env:SUPABASE_ACCESS_TOKEN = "sbp_..."',
      "  node scripts/set-supabase-auth-urls.mjs",
      "",
      "O configura a mano en:",
      `  https://supabase.com/dashboard/project/${PROJECT_REF}/auth/url-configuration`,
      "",
      "  Site URL: " + SITE_URL,
      "  Redirect URLs: añade las mismas entradas que REQUIRED_REDIRECTS en este script.",
    ].join("\n")
  );
  process.exit(1);
}

function parseAllowList(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeAllowList(existing) {
  return [...new Set([...existing, ...REQUIRED_REDIRECTS])].join(",");
}

async function main() {
  const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const getRes = await fetch(url, { headers: { Authorization: headers.Authorization } });
  const getText = await getRes.text();
  if (!getRes.ok) {
    console.error("GET /config/auth falló:", getRes.status, getText);
    process.exit(1);
  }
  const current = JSON.parse(getText);
  const mergedList = mergeAllowList(parseAllowList(current.uri_allow_list));

  const body = {
    site_url: SITE_URL,
    uri_allow_list: mergedList,
  };

  const patchRes = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  const patchText = await patchRes.text();
  if (!patchRes.ok) {
    console.error("PATCH /config/auth falló:", patchRes.status, patchText);
    process.exit(1);
  }

  console.log("Listo. Auth actualizado para el proyecto", PROJECT_REF);
  console.log("  site_url:       ", SITE_URL);
  console.log("  uri_allow_list: ", mergedList);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
