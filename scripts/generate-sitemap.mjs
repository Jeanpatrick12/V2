// generate-sitemap.mjs — régénère sitemap.xml avec les pages statiques du
// site PLUS toutes les annonces actives et tous les professionnels non
// suspendus, en interrogeant directement l'API REST publique de Supabase
// (même URL/clé anonyme que le site, déjà publiques dans sa-config.js).
//
// Lancé par .github/workflows/update-sitemap.yml (cron quotidien + à chaque
// push sur main). Ne fait rien d'autre que réécrire sitemap.xml à la racine
// du repo — le workflow commit/push le résultat s'il a changé.
//
// Reproduit exactement les mêmes règles de slug que SA.listingSlug /
// SA.proSlug dans sa-shared.js : si l'un des deux change, reporter le
// changement ici aussi pour que les URLs du sitemap restent valides.

import { readFileSync, writeFileSync } from "fs";

const CONFIG_TEXT = readFileSync(new URL("../sa-config.js", import.meta.url), "utf8");
const SUPABASE_URL = CONFIG_TEXT.match(/url:\s*"([^"]+)"/)?.[1];
const ANON_KEY = CONFIG_TEXT.match(/anonKey:\s*"([^"]+)"/)?.[1];
if (!SUPABASE_URL || !ANON_KEY) {
  console.error("Impossible de lire url/anonKey depuis sa-config.js");
  process.exit(1);
}

const SITE = "https://sansagents.fr";

function slugPart(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();
}

function listingSlug(l) {
  const parts = [];
  if (l.transaction) parts.push(l.transaction === "vente" ? "vente" : "location");
  if (l.type) parts.push(slugPart(String(l.type).replace(/\s*\/.*/, "")));
  if (l.ville) parts.push(slugPart(l.ville));
  if (l.postal) parts.push(l.postal);
  parts.push(String(l.id).substring(0, 8));
  return parts.join("-");
}

function proSlug(p) {
  const parts = [];
  if (p.name) parts.push(slugPart(p.name));
  if (p.job) parts.push(slugPart(p.job));
  if (p.city) parts.push(slugPart(p.city));
  parts.push(String(p.id).length > 8 ? String(p.id).substring(0, 8) : String(p.id));
  return parts.join("-");
}

async function fetchTable(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` }
  });
  if (!res.ok) {
    throw new Error(`Requête ${table} échouée : ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function isoDate(v) {
  const d = v ? new Date(v) : new Date();
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function urlEntry(loc, lastmod, changefreq, priority) {
  return `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

const STATIC_PAGES = [
  ["/", "daily", "1.0"],
  ["/annonces", "hourly", "0.9"],
  ["/guides", "monthly", "0.8"],
  ["/guide-vendeur", "monthly", "0.8"],
  ["/guide-acheteur", "monthly", "0.7"],
  ["/guide-loueur", "monthly", "0.7"],
  ["/vendeur", "monthly", "0.7"],
  ["/acheteur", "monthly", "0.7"],
  ["/documents", "monthly", "0.6"],
  ["/estimer-son-bien", "monthly", "0.7"],
  ["/deposer", "monthly", "0.8"],
  ["/professionnels", "weekly", "0.7"],
  ["/a-propos", "monthly", "0.5"],
  ["/inscription-pro", "monthly", "0.6"],
  ["/accord", "monthly", "0.6"],
  ["/aide-documents", "monthly", "0.6"],
  ["/contact", "monthly", "0.5"],
  ["/aide-signaler", "monthly", "0.4"],
  ["/cgu", "yearly", "0.3"],
  ["/mentions-legales", "yearly", "0.3"],
  ["/confidentialite", "yearly", "0.3"],
  ["/cookies", "yearly", "0.3"]
];

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`];

  for (const [path, freq, prio] of STATIC_PAGES) {
    lines.push(urlEntry(`${SITE}${path}`, today, freq, prio));
  }

  let listings = [];
  try {
    listings = await fetchTable(
      "listings",
      "select=id,type,transaction,ville,postal,created_at&status=eq.active"
    );
  } catch (err) {
    console.error("Annonces ignorées :", err.message);
  }
  for (const l of listings) {
    lines.push(urlEntry(`${SITE}/annonce/${listingSlug(l)}`, isoDate(l.created_at), "weekly", "0.6"));
  }

  let pros = [];
  try {
    pros = await fetchTable("pros", "select=id,name,job,city,created_at,suspended&suspended=is.false");
  } catch (err) {
    // La colonne "suspended" n'existe pas encore (avant migration) : on
    // retente sans le filtre pour ne pas casser le sitemap en attendant.
    try {
      pros = await fetchTable("pros", "select=id,name,job,city,created_at");
    } catch (err2) {
      console.error("Professionnels ignorés :", err2.message);
    }
  }
  for (const p of pros) {
    lines.push(urlEntry(`${SITE}/pro/${proSlug(p)}`, isoDate(p.created_at), "weekly", "0.5"));
  }

  lines.push(`</urlset>`);
  writeFileSync(new URL("../sitemap.xml", import.meta.url), lines.join("\n") + "\n");
  console.log(`sitemap.xml généré : ${STATIC_PAGES.length} pages statiques, ${listings.length} annonces, ${pros.length} professionnels.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
