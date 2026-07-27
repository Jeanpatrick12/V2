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

const STAR_FILLED = '★'
const STAR_EMPTY = '☆'
function starsHtml(note: number): string {
  return STAR_FILLED.repeat(note) + STAR_EMPTY.repeat(5 - note)
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const avis = payload.record
    console.log('notify-avis: avis reçu', JSON.stringify({ id: avis?.id, type: avis?.type, target_id: avis?.target_id }))

    if (!avis) return new Response('No record', { status: 400 })

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    let recipientEmail: string | null = null
    let subjectLabel = ''

    if (avis.type === 'pro') {
      // Pro réel uniquement (les pros de démonstration n'ont pas de ligne en base)
      const { data: pro, error: proErr } = await supabase
        .from('pros')
        .select('name, email')
        .eq('id', avis.target_id)
        .single()
      console.log('notify-avis: pro', JSON.stringify({ pro, error: proErr?.message }))
      if (pro?.email) {
        recipientEmail = pro.email
        subjectLabel = pro.name || 'votre profil professionnel'
      }
    } else if (avis.type === 'vendeur' || avis.type === 'acheteur') {
      // Annonce réelle uniquement (les annonces de démonstration n'ont pas de ligne en base)
      const { data: listing, error: listingErr } = await supabase
        .from('listings')
        .select('owner_id, title, ville, type, transaction')
        .eq('id', avis.target_id)
        .single()
      console.log('notify-avis: listing', JSON.stringify({ owner_id: listing?.owner_id, error: listingErr?.message }))
      if (listing?.owner_id) {
        const { data: ownerAuth, error: ownerErr } = await supabase.auth.admin.getUserById(listing.owner_id)
        console.log('notify-avis: proprietaire', JSON.stringify({ email: ownerAuth?.user?.email, error: ownerErr?.message }))
        if (ownerAuth?.user?.email) {
          recipientEmail = ownerAuth.user.email
          subjectLabel = listing.title || (listing.type || 'votre annonce') + (listing.ville ? ' à ' + listing.ville : '')
        }
      }
    }

    if (!recipientEmail) return new Response('No recipient (demo item or not found)', { status: 200 })

    const auteur = avis.auteur || 'Anonyme'
    const roleLine = avis.role ? ` (${avis.role})` : ''

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: recipientEmail }],
        replyTo: { email: 'contact@sansagents.fr' },
        subject: `Nouvel avis reçu — ${subjectLabel}`,
        htmlContent: `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#E84533;padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">Nouvel avis reçu</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">SansAgents · Immobilier sans agence</div>
  </div>
  <div style="padding:26px 24px 22px">
    <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 20px">${auteur}${roleLine} vous a laissé un avis concernant <strong style="color:#111">${subjectLabel}</strong>.</p>
    <div style="background:#f7f7f7;border-radius:12px;padding:18px 20px;border-left:4px solid #E84533;margin-bottom:24px">
      <p style="color:#f59e0b;font-size:18px;letter-spacing:2px;margin:0 0 10px">${starsHtml(avis.note)}</p>
      <p style="color:#111;font-size:14px;line-height:1.65;margin:0;white-space:pre-wrap">${avis.commentaire || ''}</p>
    </div>
    <p style="color:#999;font-size:12px;line-height:1.6;margin:0 0 20px">Cet avis sera examiné par notre équipe avant d'être publié publiquement.</p>
    <a href="https://sansagents.fr" style="display:block;text-align:center;background:#E84533;color:white;text-decoration:none;padding:14px 20px;border-radius:10px;font-weight:700;font-size:14px">Voir sur SansAgents</a>
  </div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Immobilier direct entre particuliers · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a></p>
  </div>
</div>
</div>`
      })
    })

    const brevoBody = await brevoRes.text()
    console.log('notify-avis: brevo', brevoRes.status, brevoBody)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-avis: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
