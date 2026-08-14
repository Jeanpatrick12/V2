# Régénère sitemap.xml : pages statiques + annonces actives réelles (is_demo = false).
# À relancer périodiquement (ex: une fois par semaine) pour que les nouvelles
# annonces soient soumises à Google. Nécessite PowerShell (Windows).
#
# Le lastmod des pages statiques est fixe (date de dernière modification réelle du
# contenu) : ne pas le régénérer automatiquement à chaque exécution, cela enverrait
# un faux signal de fraîcheur à Google. Mettez-le à jour à la main dans ce script
# le jour où vous modifiez réellement le contenu d'une page. Le lastmod des annonces,
# lui, est calculé automatiquement depuis la base à chaque exécution.
#
# Usage : powershell -File scripts\update-sitemap.ps1

$SupabaseUrl = "https://hnbxkiazozknxfhcplaw.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYnhraWF6b3prbnhmaGNwbGF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNzczNzUsImV4cCI6MjA5Nzk1MzM3NX0.P5DQEmtb1ie_cbNP_ESC3UDNHMAPTxU8byFWHtRLd-Q"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutFile = Join-Path $RepoRoot "sitemap.xml"

$staticUrls = @(
  @{ loc = "https://sansagents.fr/"; lastmod = "2026-08-14"; changefreq = "daily"; priority = "1.0" }
  @{ loc = "https://sansagents.fr/annonces"; lastmod = "2026-08-14"; changefreq = "hourly"; priority = "0.9" }
  @{ loc = "https://sansagents.fr/guide"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.8" }
  @{ loc = "https://sansagents.fr/estimer-son-bien"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.7" }
  @{ loc = "https://sansagents.fr/deposer"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.8" }
  @{ loc = "https://sansagents.fr/professionnels"; lastmod = "2026-08-14"; changefreq = "weekly"; priority = "0.7" }
  @{ loc = "https://sansagents.fr/a-propos"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.5" }
  @{ loc = "https://sansagents.fr/inscription-pro"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.6" }
  @{ loc = "https://sansagents.fr/accord"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.6" }
  @{ loc = "https://sansagents.fr/aide-documents"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.6" }
  @{ loc = "https://sansagents.fr/contact"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.5" }
  @{ loc = "https://sansagents.fr/aide-signaler"; lastmod = "2026-08-14"; changefreq = "monthly"; priority = "0.4" }
  @{ loc = "https://sansagents.fr/cgu"; lastmod = "2026-08-14"; changefreq = "yearly"; priority = "0.3" }
  @{ loc = "https://sansagents.fr/mentions-legales"; lastmod = "2026-08-14"; changefreq = "yearly"; priority = "0.3" }
  @{ loc = "https://sansagents.fr/confidentialite"; lastmod = "2026-08-14"; changefreq = "yearly"; priority = "0.3" }
  @{ loc = "https://sansagents.fr/cookies"; lastmod = "2026-08-14"; changefreq = "yearly"; priority = "0.3" }
)

$headers = @{ apikey = $AnonKey; Authorization = "Bearer $AnonKey" }
$query = "$SupabaseUrl/rest/v1/listings?select=id,created_at,updated_at&status=eq.active&is_demo=eq.false&order=created_at.desc"
$listings = @()
try {
  $listings = Invoke-RestMethod -Uri $query -Headers $headers -Method Get
} catch {
  Write-Warning "Impossible de récupérer les annonces depuis Supabase : $_"
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('<?xml version="1.0" encoding="UTF-8"?>')
[void]$sb.AppendLine('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($u in $staticUrls) {
  [void]$sb.AppendLine("  <url><loc>$($u.loc)</loc><lastmod>$($u.lastmod)</lastmod><changefreq>$($u.changefreq)</changefreq><priority>$($u.priority)</priority></url>")
}
foreach ($l in $listings) {
  $loc = "https://sansagents.fr/annonce?id=$($l.id)"
  $rawDate = if ($l.updated_at) { $l.updated_at } else { $l.created_at }
  $lastmod = if ($rawDate) { ([datetime]$rawDate).ToString("yyyy-MM-dd") } else { $null }
  $lastmodTag = if ($lastmod) { "<lastmod>$lastmod</lastmod>" } else { "" }
  [void]$sb.AppendLine("  <url><loc>$loc</loc>$lastmodTag<changefreq>weekly</changefreq><priority>0.7</priority></url>")
}
[void]$sb.AppendLine('</urlset>')

$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($OutFile, $sb.ToString(), $enc)
Write-Host "sitemap.xml régénéré : $($staticUrls.Count) pages statiques + $($listings.Count) annonce(s) réelle(s)."
