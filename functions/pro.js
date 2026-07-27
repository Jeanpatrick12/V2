// Cloudflare Pages Function — enrichit le <head> de la page /pro (titre,
// description, Open Graph) avec les vraies infos du professionnel. Voir
// functions/annonce.js pour l'explication complète : à la moindre erreur on
// retombe simplement sur la page telle qu'elle était servie avant, sans
// aucune régression possible.

const SUPABASE_URL = "https://hnbxkiazozknxfhcplaw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnhraWF6b3prbnhmaGNwbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzczNzUsImV4cCI6MjA5Nzk1MzM3NX0.P5DQEmtb1ie_cbNP_ESC3UDNHMAPTxU8byFWHtRLd-Q";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function onRequestGet(context) {
  const assetResponse = await context.next();

  try {
    const url = new URL(context.request.url);
    const id = url.searchParams.get("id");
    if (!id) return assetResponse;

    const contentType = assetResponse.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return assetResponse;

    const apiRes = await fetch(
      SUPABASE_URL + "/rest/v1/pros?id=eq." + encodeURIComponent(id) +
      "&select=name,job,city,description,logo",
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
    );
    if (!apiRes.ok) return assetResponse;

    const rows = await apiRes.json();
    const p = rows && rows[0];
    if (!p) return assetResponse;

    const fullTitle = "SansAgents — " + p.name + (p.job ? " — " + p.job : "");
    const desc = (p.description || (p.job + (p.city ? " à " + p.city : "") + ". Professionnel de confiance sur SansAgents.")).slice(0, 300);

    let html = await assetResponse.text();
    html = html.replace(/<title>[^<]*<\/title>/, "<title>" + escapeHtml(fullTitle) + "</title>");
    html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + escapeHtml(desc) + '">');
    if (p.logo) {
      html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + escapeHtml(p.logo) + '">');
    }
    html = html.replace(
      '<meta property="og:site_name" content="SansAgents">',
      '<meta property="og:site_name" content="SansAgents">\n<meta property="og:title" content="' + escapeHtml(fullTitle) + '">\n<meta property="og:description" content="' + escapeHtml(desc) + '">'
    );

    return new Response(html, {
      status: assetResponse.status,
      headers: assetResponse.headers
    });
  } catch (err) {
    return assetResponse;
  }
}
