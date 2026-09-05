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

// Déclenchée par un webhook Database sur INSERT dans pro_contacts (le
// formulaire "Demander un devis" de pro.html / m/professionnel.html, qui a
// remplacé le mailto: direct pour que chaque demande soit comptée).
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const contact = payload.record
    console.log('notify-pro-contact: contact reçu', JSON.stringify({ id: contact?.id, pro_id: contact?.pro_id }))

    if (!contact) return new Response('No record', { status: 400 })

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    const { data: pro, error: proErr } = await supabase
      .from('pros')
      .select('name, email')
      .eq('id', contact.pro_id)
      .single()

    console.log('notify-pro-contact: pro', JSON.stringify({ name: pro?.name, hasEmail: !!pro?.email, error: proErr?.message }))
    if (!pro || !pro.email) return new Response('Pro introuvable ou sans email : ' + proErr?.message, { status: 200 })

    const senderName = contact.sender_name || 'Un particulier'
    const senderEmail = contact.sender_email || ''
    const messageText = contact.message || ''

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: pro.email }],
        replyTo: senderEmail ? { email: senderEmail, name: senderName } : { email: 'contact@sansagents.fr' },
        subject: `Nouvelle demande de devis via SansAgents — ${senderName}`,
        htmlContent: `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#E84533;padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">Nouvelle demande de devis</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">SansAgents · Annuaire professionnels</div>
  </div>
  <div style="padding:26px 24px 22px">
    <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 16px"><strong style="color:#111">${senderName}</strong> vous a contacté via votre fiche SansAgents${senderEmail ? ` (${senderEmail})` : ''}.</p>
    <div style="background:#f7f7f7;border-radius:12px;padding:18px 20px;border-left:4px solid #E84533;margin-bottom:24px">
      <p style="color:#999;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 10px">Message</p>
      <p style="color:#111;font-size:14px;line-height:1.65;margin:0;white-space:pre-wrap">${messageText}</p>
    </div>
    <p style="color:#999;font-size:11.5px;line-height:1.6;margin:0">Répondez directement à cet email pour recontacter ${senderName}.</p>
  </div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Annuaire de professionnels · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a></p>
  </div>
</div>
</div>`
      })
    })

    const brevoBody = await brevoRes.text()
    console.log('notify-pro-contact: brevo', brevoRes.status, brevoBody)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-pro-contact: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
