import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

function getServiceKey(): string {
  const secretKeysRaw = Deno.env.get('SUPABASE_SECRET_KEYS')
  if (secretKeysRaw) {
    try {
      const parsed = JSON.parse(secretKeysRaw)
      if (parsed.service_role) return parsed.service_role
    } catch (_) {}
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
}

// Reprend volontairement seulement les criteres les plus utilises (transaction,
// type, ville, budget, surface, pieces) plutot que la totalite des filtres
// avances de la page annonces — un match un peu large vaut mieux qu'une
// fonction fragile a maintenir.
function matchesCriteria(listing: any, criteria: any): boolean {
  if (!criteria) return true
  if (criteria.transaction && criteria.transaction !== 'all' && listing.transaction !== criteria.transaction) return false
  if (Array.isArray(criteria.types) && criteria.types.length && !criteria.types.includes(listing.type)) return false
  if (criteria.ville && !String(listing.ville || '').toLowerCase().includes(String(criteria.ville).toLowerCase())) return false
  if (criteria.prixMin != null && listing.price < criteria.prixMin) return false
  if (criteria.prixMax != null && listing.price > criteria.prixMax) return false
  if (criteria.surfMin != null && listing.surface < criteria.surfMin) return false
  if (criteria.surfMax != null && listing.surface > criteria.surfMax) return false
  if (criteria.piecesMin != null && (listing.pieces || 0) < criteria.piecesMin) return false
  if (criteria.piecesMax != null && (listing.pieces || 0) > criteria.piecesMax) return false
  return true
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const listing = payload.record
    console.log('notify-search-matches: annonce recue', JSON.stringify({ id: listing?.id, ville: listing?.ville, price: listing?.price, status: listing?.status, is_demo: listing?.is_demo }))

    if (!listing || listing.status !== 'active' || listing.is_demo) {
      return new Response('Ignoree (pas active ou demo)', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    const { data: searches, error: searchesErr } = await supabase
      .from('saved_searches')
      .select('id,user_id,label,criteria,email_alerts')
      .eq('email_alerts', true)
    console.log('notify-search-matches: recherches actives', JSON.stringify({ count: searches?.length, error: searchesErr?.message }))
    if (!searches || !searches.length) return new Response('Aucune recherche avec alertes actives', { status: 200 })

    const matching = searches.filter((s) => matchesCriteria(listing, s.criteria))
    console.log('notify-search-matches: correspondances trouvees', matching.length)
    if (!matching.length) return new Response('Aucune correspondance', { status: 200 })

    const listingLabel = listing.title || ((listing.type || 'Bien') + (listing.ville ? ' à ' + listing.ville : ''))
    const listingUrl = 'https://sansagents.fr/annonce?id=' + listing.id
    const priceLabel = listing.price
      ? Number(listing.price).toLocaleString('fr-FR') + ' €' + (listing.transaction === 'location' ? '/mois' : '')
      : ''

    let sent = 0
    for (const search of matching) {
      const { data: userAuth, error: userErr } = await supabase.auth.admin.getUserById(search.user_id)
      const email = userAuth?.user?.email
      console.log('notify-search-matches: destinataire', JSON.stringify({ search_id: search.id, email, error: userErr?.message }))
      if (!email) continue

      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
          to: [{ email }],
          replyTo: { email: 'contact@sansagents.fr' },
          subject: `Nouvelle annonce pour votre recherche « ${search.label} »`,
          htmlContent: `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#E84533;padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">Nouvelle annonce disponible</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">SansAgents · Immobilier sans agence</div>
  </div>
  <div style="padding:26px 24px 22px">
    <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 20px">Une nouvelle annonce correspond à votre recherche enregistrée <strong style="color:#111">« ${search.label} »</strong>.</p>
    <div style="background:#f7f7f7;border-radius:12px;padding:18px 20px;border-left:4px solid #E84533;margin-bottom:24px">
      <p style="color:#111;font-size:16px;font-weight:700;margin:0 0 6px">${listingLabel}</p>
      ${priceLabel ? `<p style="color:#E84533;font-size:15px;font-weight:700;margin:0">${priceLabel}</p>` : ''}
    </div>
    <a href="${listingUrl}" style="display:block;text-align:center;background:#E84533;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700;font-size:14px">Voir l'annonce</a>
  </div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Immobilier direct entre particuliers · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a><br>Vous recevez cet email car vous avez activé les alertes pour cette recherche. Vous pouvez les désactiver à tout moment depuis « Mes recherches ».</p>
  </div>
</div>
</div>`
        })
      })

      const brevoBody = await brevoRes.text()
      console.log('notify-search-matches: brevo', email, brevoRes.status, brevoBody)
      sent++
    }

    return new Response('OK - ' + sent + ' email(s) envoyé(s)', { status: 200 })
  } catch (err) {
    console.error('notify-search-matches: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
