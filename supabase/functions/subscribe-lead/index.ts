const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')!
const BREVO_LIST_ID = Deno.env.get('BREVO_LIST_ID') // optionnel — voir README du dossier

Deno.serve(async (req) => {
  try {
    const payload = await req.json()
    const lead = payload.record
    console.log('subscribe-lead: lead reçu', JSON.stringify({ email: lead?.email, source: lead?.source }))

    if (!lead?.email) return new Response('No email', { status: 400 })

    const body: Record<string, unknown> = {
      email: lead.email,
      attributes: { SOURCE: lead.source || '' },
      updateEnabled: true, // pas d'erreur si le contact existe deja
    }
    if (BREVO_LIST_ID) body.listIds = [Number(BREVO_LIST_ID)]

    const brevoRes = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const brevoBody = await brevoRes.text()
    console.log('subscribe-lead: brevo', brevoRes.status, brevoBody)

    // 400 "Contact already exist" arrive normalement avec updateEnabled=true
    // dans de rares cas de course ; on ne le traite pas comme une erreur fatale.
    if (!brevoRes.ok && brevoRes.status !== 400) {
      return new Response('Brevo error: ' + brevoBody, { status: 502 })
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('subscribe-lead: erreur', err)
    return new Response('Error: ' + err.message, { status: 500 })
  }
})
