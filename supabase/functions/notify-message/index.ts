import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const message = payload.record
    if (!message) return new Response('No record', { status: 400 })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Récupérer l'annonce pour trouver le vendeur
    const { data: listing } = await supabase
      .from('listings')
      .select('user_id, title, ville, type, transaction')
      .eq('id', message.listing_id)
      .single()

    if (!listing) return new Response('Listing not found', { status: 404 })

    // Email du vendeur via auth.admin
    const { data: sellerAuth } = await supabase.auth.admin.getUserById(listing.user_id)
    const sellerEmail = sellerAuth?.user?.email
    if (!sellerEmail) return new Response('No seller email', { status: 404 })

    // Ne pas notifier si le vendeur s'envoie un message à lui-même
    if (message.sender_id === listing.user_id) return new Response('Self-message', { status: 200 })

    const messageText = message.content || message.message || message.text || ''
    const listingLabel = listing.title || (listing.type || 'Votre bien') + (listing.ville ? ' à ' + listing.ville : '')

    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: sellerEmail }],
        replyTo: { email: 'contact@sansagents.fr' },
        subject: `💬 Nouveau message — ${listingLabel}`,
        htmlContent: `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#fff">
  <div style="background:#E84533;border-radius:14px;padding:22px 26px;margin-bottom:28px">
    <h1 style="color:white;margin:0;font-size:19px;font-weight:700">💬 Nouveau message reçu</h1>
    <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:13px">SansAgents · Immobilier sans agence</p>
  </div>

  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px">
    Quelqu'un vous a envoyé un message concernant votre annonce
    <strong style="color:#111">${listingLabel}</strong>.
  </p>

  <div style="background:#f7f7f7;border-radius:12px;padding:18px 20px;border-left:4px solid #E84533;margin-bottom:24px">
    <p style="color:#999;font-size:11.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin:0 0 8px">Message</p>
    <p style="color:#111;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${messageText}</p>
  </div>

  <a href="https://sansagents.fr/messages"
     style="display:inline-block;background:#E84533;color:white;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:700;font-size:14px;margin-bottom:28px">
    Répondre sur SansAgents →
  </a>

  <hr style="border:none;border-top:1px solid #efefef;margin:0 0 20px">
  <p style="color:#bbb;font-size:11px;margin:0">
    SansAgents · Immobilier direct entre particuliers · Vous recevez cet email car vous êtes vendeur sur sansagents.fr
  </p>
</div>`
      })
    })

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
