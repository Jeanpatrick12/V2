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

// Déclenchée par un webhook Database sur UPDATE de boost_requests (quand un
// admin confirme la réception du virement depuis admin.html). Le payload
// d'un webhook UPDATE contient à la fois "record" (nouvelle ligne) et
// "old_record" (ancienne ligne) : on ne notifie que la transition réelle
// vers "confirmed", pour ne jamais ré-envoyer l'email sur une autre mise à
// jour de la même ligne.
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const request = payload.record
    const oldRequest = payload.old_record
    console.log('notify-boost-confirmed: reçu', JSON.stringify({ id: request?.id, status: request?.status, oldStatus: oldRequest?.status }))

    if (!request) return new Response('No record', { status: 400 })
    if (request.status !== 'confirmed' || oldRequest?.status === 'confirmed') {
      return new Response('Pas une confirmation', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('owner_id, title, ville, type, transaction')
      .eq('id', request.listing_id)
      .single()

    console.log('notify-boost-confirmed: annonce', JSON.stringify({ owner_id: listing?.owner_id, error: listingErr?.message }))
    if (!listing) return new Response('Annonce introuvable : ' + listingErr?.message, { status: 200 })

    const { data: ownerAuth, error: ownerErr } = await supabase.auth.admin.getUserById(listing.owner_id)
    const ownerEmail = ownerAuth?.user?.email
    console.log('notify-boost-confirmed: propriétaire', JSON.stringify({ email: ownerEmail, error: ownerErr?.message }))
    if (!ownerEmail) return new Response('Pas d\'email propriétaire', { status: 200 })

    const listingLabel = listing.title || ((listing.type || 'Votre annonce') + (listing.ville ? ' à ' + listing.ville : ''))
    const listingUrl = 'https://sansagents.fr/annonce?id=' + request.listing_id

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: ownerEmail }],
        replyTo: { email: 'contact@sansagents.fr' },
        subject: `Votre mise en avant est activée — ${listingLabel}`,
        htmlContent: `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#E84533;padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">Mise en avant activée ✓</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">SansAgents · Immobilier sans agence</div>
  </div>
  <div style="padding:26px 24px 22px">
    <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 20px">Votre virement a bien été reçu. Votre annonce <strong style="color:#111">${listingLabel}</strong> est désormais mise en avant pour ${request.duration_days} jours : elle remonte en tête des résultats de recherche et porte un badge "En avant".</p>
    <a href="${listingUrl}" style="display:block;text-align:center;background:#E84533;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700;font-size:14px">Voir mon annonce</a>
  </div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Immobilier direct entre particuliers · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a></p>
  </div>
</div>
</div>`
      })
    })

    const brevoBody = await brevoRes.text()
    console.log('notify-boost-confirmed: brevo', brevoRes.status, brevoBody)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-boost-confirmed: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
