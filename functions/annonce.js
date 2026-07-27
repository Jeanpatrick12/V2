// Cloudflare Pages Function — enrichit le <head> de la page /annonce (titre,
// description, Open Graph) avec les vraies infos de l'annonce AVANT même que
// le JavaScript ne s'exécute. Sans ça, les moteurs de recherche et les
// aperçus de partage (WhatsApp, Facebook, etc.) voient un titre générique
// identique pour toutes les annonces, puisque le vrai contenu n'était ajouté
// qu'après coup par le JavaScript une fois les données chargées.
//
// Conçu pour ne jamais rien casser : à la moindre erreur (Supabase injoignable,
// annonce introuvable, etc.) on retombe simplement sur la page telle qu'elle
// était servie avant — aucune régression possible.

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
      SUPABASE_URL + "/rest/v1/listings?id=eq." + encodeURIComponent(id) +
      "&select=title,type,transaction,ville,price,photos",
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
    );
    if (!apiRes.ok) return assetResponse;

    const rows = await apiRes.json();
    const l = rows && rows[0];
    if (!l) return assetResponse;

    const typeLabels = { maison: "Maison", appartement: "Appartement", studio: "Studio", loft: "Loft / Atelier" };
    const typeLabel = typeLabels[l.type] || "Bien";
    const title = l.title || (typeLabel + (l.ville ? " — " + l.ville : ""));
    const priceStr = l.price ? Number(l.price).toLocaleString("fr-FR") + " €" + (l.transaction === "location" ? "/mois" : "") : "";
    const fullTitle = title + (priceStr ? " — " + priceStr : "") + " — SansAgents";
    const desc = typeLabel + " " + (l.transaction === "location" ? "à louer" : "à vendre") +
      (l.ville ? " à " + l.ville : "") + " sur SansAgents, directement entre particuliers, sans agence.";

    let photo = null;
    if (Array.isArray(l.photos) && l.photos[0]) {
      const p0 = l.photos[0];
      photo = (p0 && typeof p0 === "object" && p0.url) ? p0.url : String(p0);
    }

    let html = await assetResponse.text();
    html = html.replace(/<title>[^<]*<\/title>/, "<title>" + escapeHtml(fullTitle) + "</title>");
    html = html.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + escapeHtml(desc) + '">');
    html = html.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + escapeHtml(photo || "https://sansagents.fr/favicon.svg") + '">');
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
