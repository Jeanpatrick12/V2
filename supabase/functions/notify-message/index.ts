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

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const message = payload.record
    console.log('notify-message: message reçu', JSON.stringify({
      id: message?.id,
      conversation_id: message?.conversation_id,
      sender_id: message?.sender_id,
      from_role: message?.from_role
    }))

    if (!message) return new Response('No record', { status: 400 })

    // Ne notifier que les messages envoyés par l'acheteur (from_role = "me" côté acheteur)
    // sender_id null = message de démo, on ignore
    if (!message.sender_id) return new Response('No sender', { status: 200 })

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    // 1. Récupérer la conversation pour obtenir le listing_id et le seller_id
    const { data: conversation, error: convoErr } = await supabase
      .from('conversations')
      .select('listing_id, seller_id, buyer_id')
      .eq('id', message.conversation_id)
      .single()

    console.log('notify-message: conversation', JSON.stringify({ conversation, error: convoErr?.message }))
    if (!conversation) return new Response('Conversation not found: ' + convoErr?.message, { status: 404 })

    // Ne pas notifier si c'est le vendeur qui s'envoie un message à lui-même
    if (message.sender_id === conversation.seller_id) {
      console.log('notify-message: message du vendeur, skip')
      return new Response('Seller message', { status: 200 })
    }

    // 2. Récupérer l'annonce
    const { data: listing, error: listingErr } = await supabase
      .from('listings')
      .select('owner_id, title, ville, type, transaction')
      .eq('id', conversation.listing_id)
      .single()

    console.log('notify-message: listing', JSON.stringify({ owner_id: listing?.owner_id, error: listingErr?.message }))
    if (!listing) return new Response('Listing not found: ' + listingErr?.message, { status: 404 })

    // 3. Email du vendeur
    const { data: sellerAuth, error: sellerErr } = await supabase.auth.admin.getUserById(listing.owner_id)
    const sellerEmail = sellerAuth?.user?.email
    console.log('notify-message: vendeur', JSON.stringify({ email: sellerEmail, error: sellerErr?.message }))
    if (!sellerEmail) return new Response('No seller email', { status: 404 })

    const messageText = message.text || message.content || message.message || ''
    const listingLabel = listing.title || (listing.type || 'Votre bien') + (listing.ville ? ' à ' + listing.ville : '')

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: sellerEmail }],
        replyTo: { email: 'contact@sansagents.fr' },
        subject: `💬 Nouveau message — ${listingLabel}`,
        htmlContent: `
<span style="display:none;max-height:0;overflow:hidden;mso-hide:all">Vous avez reçu un nouveau message concernant ${listingLabel} sur SansAgents.</span>
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

    const brevoBody = await brevoRes.text()
    console.log('notify-message: brevo', brevoRes.status, brevoBody)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-message: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
