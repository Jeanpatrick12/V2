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

// Déclenchée par un webhook Database sur UPDATE de commission_claims (quand
// un admin fait passer une réclamation à "paid" depuis admin.html, après
// avoir réellement envoyé le virement). Comme pour notify-boost-confirmed,
// on ne notifie que la transition réelle vers "paid" pour ne jamais
// ré-envoyer l'email sur une autre mise à jour de la même ligne.
Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const claim = payload.record
    const oldClaim = payload.old_record
    console.log('notify-commission-claim: reçu', JSON.stringify({ id: claim?.id, status: claim?.status, oldStatus: oldClaim?.status }))

    if (!claim) return new Response('No record', { status: 400 })
    if (claim.status !== 'paid' || oldClaim?.status === 'paid') {
      return new Response('Pas un paiement', { status: 200 })
    }

    const supabase = createClient(SUPABASE_URL, getServiceKey())

    const { data: claimantAuth, error: claimantErr } = await supabase.auth.admin.getUserById(claim.claimant_id)
    const claimantEmail = claimantAuth?.user?.email
    console.log('notify-commission-claim: réclamant', JSON.stringify({ email: claimantEmail, error: claimantErr?.message }))
    if (!claimantEmail) return new Response('Pas d\'email réclamant', { status: 200 })

    const { data: pro } = await supabase.from('pros').select('name').eq('id', claim.pro_id).single()
    const proName = pro?.name || 'ce professionnel'

    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
        to: [{ email: claimantEmail }],
        replyTo: { email: 'contact@sansagents.fr' },
        subject: `Votre virement de ${claim.reward_amount} € a été envoyé`,
        htmlContent: `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:#E84533;padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">Virement envoyé ✓</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">SansAgents · Réclamation de commission</div>
  </div>
  <div style="padding:26px 24px 22px">
    <p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 20px">Votre réclamation pour le contrat signé avec <strong style="color:#111">${proName}</strong> a été validée. Un virement de <strong style="color:#111">${claim.reward_amount} €</strong> vient de vous être envoyé — comptez quelques jours ouvrés pour qu'il apparaisse sur votre compte.</p>
    <p style="color:#999;font-size:12px;line-height:1.6;margin:0">Merci d'avoir utilisé SansAgents pour trouver ce professionnel.</p>
  </div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Immobilier direct entre particuliers · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a></p>
  </div>
</div>
</div>`
      })
    })

    const brevoBody = await brevoRes.text()
    console.log('notify-commission-claim: brevo', brevoRes.status, brevoBody)

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('notify-commission-claim: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
