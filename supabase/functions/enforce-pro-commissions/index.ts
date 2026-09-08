import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Adresse perso du fondateur, prévenue quand une fiche est suspendue
// automatiquement — à créer dans Supabase > Edge Functions > Secrets.
const ADMIN_ALERT_EMAIL = Deno.env.get('ADMIN_ALERT_EMAIL') || ''

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

// ═══════════════════════════════════════════════════════════════════
// enforce-pro-commissions
//
// Fonction PLANIFIÉE (cron, une fois par jour, programmée via pg_cron +
// pg_net côté base de données — voir les instructions de déploiement).
// Elle ne réagit pas à un événement précis comme les autres notify-*, elle
// scanne toutes les réclamations de commission approuvées mais pas encore
// réglées par le professionnel, et fait progresser chaque professionnel en
// retard d'un palier de pression à la fois :
//
//   J+0  (retard atteint)   → relance polie, rappel du montant dû
//   J+7                     → relance ferme, rappel de la pénalité légale
//                              (10%/an + 40€, art. L441-10 du Code de commerce,
//                              déjà annoncée dans les CGU)
//   J+15                    → dernier avis avant suspension (délai de 7 jours)
//   J+22                    → suspension automatique de la fiche de
//                              l'annuaire public + email à l'administrateur
//                              (au-delà, la suite — mise en demeure formelle,
//                              injonction de payer — reste une décision
//                              humaine, volontairement non automatisée)
//
// Le palier est déduit de pros.commission_reminder_count (jamais de la date
// du jour seule) pour ne jamais renvoyer deux fois le même email si la
// fonction tourne plusieurs fois le même jour ou après un redémarrage.
// ═══════════════════════════════════════════════════════════════════

const TIERS = [
  { minDays: 0, reminderCountBefore: 0 },
  { minDays: 7, reminderCountBefore: 1 },
  { minDays: 15, reminderCountBefore: 2 },
  { minDays: 22, reminderCountBefore: 3 } // celui-ci suspend au lieu de relancer
]

function lateFeeEstimate(owed: number, daysOverdue: number) {
  const annualRate = 0.10
  const interest = owed * annualRate * (daysOverdue / 365)
  return Math.round((interest + 40) * 100) / 100
}

async function sendBrevo(to: string, subject: string, html: string) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'SansAgents', email: 'notifications@sansagents.fr' },
      to: [{ email: to }],
      replyTo: { email: 'contact@sansagents.fr' },
      subject,
      htmlContent: html
    })
  })
  const body = await res.text()
  console.log('enforce-pro-commissions: brevo', to, res.status, body)
  return res.ok
}

function emailShell(headerColor: string, title: string, subtitle: string, bodyHtml: string) {
  return `<div style="background:#f0f0f0;padding:28px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
  <div style="background:${headerColor};padding:24px 28px">
    <div style="color:white;font-size:19px;font-weight:700;margin:0">${title}</div>
    <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:4px">${subtitle}</div>
  </div>
  <div style="padding:26px 24px 22px">${bodyHtml}</div>
  <div style="border-top:1px solid #efefef;padding:16px 24px;background:#fafafa">
    <p style="color:#bbb;font-size:11px;margin:0">SansAgents · Immobilier direct entre particuliers · <a href="https://sansagents.fr" style="color:#bbb">sansagents.fr</a></p>
  </div>
</div>
</div>`
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(SUPABASE_URL, getServiceKey())

    const { data: claims, error: claimsErr } = await supabase
      .from('commission_claims')
      .select('id,pro_id,pro_commission_amount,pro_payment_due_at')
      .eq('status', 'approved')
      .eq('pro_commission_received', false)
      .not('pro_payment_due_at', 'is', null)

    if (claimsErr) throw claimsErr
    if (!claims || !claims.length) return new Response('Rien à relancer', { status: 200 })

    const byPro = new Map<string, { owed: number; earliestDueAt: string }>()
    for (const c of claims) {
      const entry = byPro.get(c.pro_id) || { owed: 0, earliestDueAt: c.pro_payment_due_at }
      entry.owed += Number(c.pro_commission_amount) || 0
      if (c.pro_payment_due_at < entry.earliestDueAt) entry.earliestDueAt = c.pro_payment_due_at
      byPro.set(c.pro_id, entry)
    }

    const proIds = [...byPro.keys()]
    const { data: pros, error: prosErr } = await supabase
      .from('pros')
      .select('id,name,email,suspended,commission_reminder_count')
      .in('id', proIds)
    if (prosErr) throw prosErr

    let processed = 0
    for (const pro of pros || []) {
      if (pro.suspended) continue // déjà suspendu, on n'insiste pas automatiquement
      const debt = byPro.get(pro.id)!
      const daysOverdue = Math.floor((Date.now() - new Date(debt.earliestDueAt).getTime()) / 86400000)
      if (daysOverdue < 0) continue // échéance pas encore atteinte

      const count = pro.commission_reminder_count || 0
      const tier = TIERS.filter((t) => daysOverdue >= t.minDays && count === t.reminderCountBefore).pop()
      if (!tier) continue // déjà relancé pour ce palier, ou palier pas encore atteint

      const owed = Math.round(debt.owed * 100) / 100
      const proEmail = pro.email
      if (!proEmail) { console.log('enforce-pro-commissions: pas d\'email pour', pro.id); continue }

      if (tier.minDays < 22) {
        const isFirm = tier.minDays >= 7
        const fee = lateFeeEstimate(owed, daysOverdue)
        const subject = tier.minDays === 0
          ? `Commission SansAgents à régler — ${owed} €`
          : (tier.minDays === 7
              ? `Rappel : commission SansAgents en retard de paiement — ${owed} €`
              : `Dernier avis avant suspension de votre fiche SansAgents`)
        const body = `<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 16px">Bonjour <strong>${pro.name}</strong>,</p>
<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 16px">Un client vous a été mis en relation via SansAgents et a signé un contrat avec vous. Conformément à nos <a href="https://sansagents.fr/cgu">CGU</a>, la commission de 13% due à SansAgents sur ce contrat s'élève à <strong style="color:#111">${owed} €</strong> et son échéance de paiement (${new Date(debt.earliestDueAt).toLocaleDateString('fr-FR')}) est déjà dépassée de ${daysOverdue} jour(s).</p>
${isFirm ? `<p style="color:#7a3226;background:#fff5f4;border:1px solid #ffd8d3;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;margin:0 0 16px">Passé ce délai, une pénalité de retard s'applique de plein droit (10%/an + indemnité forfaitaire de recouvrement de 40€, art. L441-10 du Code de commerce), soit environ <strong>${fee} €</strong> à ce jour.</p>` : ''}
${tier.minDays === 15 ? `<p style="color:#7a3226;background:#fff5f4;border:1px solid #ffd8d3;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;margin:0 0 16px"><strong>Sans règlement sous 7 jours</strong>, votre fiche sera automatiquement retirée de l'annuaire public SansAgents, conformément à nos CGU.</p>` : ''}
<p style="color:#555;font-size:14px;line-height:1.65;margin:0">Merci de régulariser au plus vite par virement, ou de nous contacter à <a href="mailto:contact@sansagents.fr">contact@sansagents.fr</a> en cas de difficulté.</p>`
        await sendBrevo(proEmail, subject, emailShell(isFirm ? '#c0392b' : '#E84533', isFirm ? 'Commission en retard' : 'Commission à régler', 'SansAgents · Annuaire professionnels', body))
      } else {
        // Palier final : suspension automatique.
        await supabase.from('pros').update({ suspended: true, suspended_at: new Date().toISOString(), suspended_reason: 'Commission impayée (relance automatique)' }).eq('id', pro.id)
        const body = `<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 16px">Bonjour <strong>${pro.name}</strong>,</p>
<p style="color:#555;font-size:14px;line-height:1.65;margin:0 0 16px">Votre fiche a été retirée de l'annuaire public SansAgents : la commission de <strong style="color:#111">${owed} €</strong> due sur un contrat signé via la plateforme n'a pas été réglée dans les délais prévus par nos <a href="https://sansagents.fr/cgu">CGU</a>.</p>
<p style="color:#555;font-size:14px;line-height:1.65;margin:0">Votre fiche sera réactivée dès réception du règlement. Contactez-nous à <a href="mailto:contact@sansagents.fr">contact@sansagents.fr</a>.</p>`
        await sendBrevo(proEmail, 'Votre fiche SansAgents a été suspendue', emailShell('#111', 'Fiche suspendue', 'SansAgents · Annuaire professionnels', body))

        if (ADMIN_ALERT_EMAIL) {
          await sendBrevo(ADMIN_ALERT_EMAIL, `Pro suspendu automatiquement : ${pro.name} (${owed} €)`,
            emailShell('#111', 'Suspension automatique', 'Alerte interne SansAgents',
              `<p style="color:#555;font-size:14px;line-height:1.65">${pro.name} (id ${pro.id}) a été suspendu automatiquement pour ${owed} € de commission impayée depuis ${daysOverdue} jours. Une mise en demeure formelle ou une injonction de payer peut être envisagée manuellement si le professionnel ne réagit pas.</p>`))
        }
      }

      await supabase.from('pros').update({ commission_reminder_count: count + 1, commission_reminder_last_sent_at: new Date().toISOString() }).eq('id', pro.id)
      processed++
    }

    return new Response(`OK — ${processed} professionnel(s) relancé(s)/suspendu(s)`, { status: 200 })
  } catch (err) {
    console.error('enforce-pro-commissions: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
