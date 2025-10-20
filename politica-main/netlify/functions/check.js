// netlify/functions/check.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valid: false, error: 'Method not allowed' }) }
  }

  try {
    const { token, fingerprint } = JSON.parse(event.body)

    if (!token || !fingerprint) {
      return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Token e fingerprint obbligatori' }) }
    }

    const { data: row, error } = await supabase
      .from('test')
      .select('*')
      .eq('token', token)
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!row) return { statusCode: 401, body: JSON.stringify({ valid: false, error: 'Token non valido' }) }

    if (new Date(row.expires_at) < new Date()) {
      return { statusCode: 401, body: JSON.stringify({ valid: false, error: 'Token scaduto' }) }
    }

    if (row.fingerprint && row.fingerprint !== fingerprint) {
      return { statusCode: 403, body: JSON.stringify({ valid: false, error: 'Token già usato da altro dispositivo' }) }
    }

    return { statusCode: 200, body: JSON.stringify({ valid: true }) }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ valid: false, error: err.message }) }
  }
}
