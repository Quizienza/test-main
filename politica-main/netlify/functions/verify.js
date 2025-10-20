// netlify/functions/verify.js
import { createClient } from '@supabase/supabase-js'

// Inizializza il client Supabase con le env di Netlify
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

    // Cerca il token nel DB
    const { data: rows, error } = await supabase
      .from('test')
      .select('*')
      .eq('token', token)
      .limit(1)

    if (error) throw error
    if (!rows || rows.length === 0) {
      return { statusCode: 401, body: JSON.stringify({ valid: false, error: 'Token non valido' }) }
    }

    const row = rows[0]

    // Controlla scadenza
    if (new Date(row.expires_at) < new Date()) {
      return { statusCode: 401, body: JSON.stringify({ valid: false, error: 'Token scaduto' }) }
    }

    // Se non ha ancora fingerprint → assegna a questo dispositivo
    if (!row.fingerprint) {
      const { error: updateError } = await supabase
        .from('test')
        .update({ fingerprint })
        .eq('id', row.id)

      if (updateError) throw updateError
      return { statusCode: 200, body: JSON.stringify({ valid: true, message: 'Token associato' }) }
    }

    // Se già associato → deve combaciare
    if (row.fingerprint !== fingerprint) {
      return { statusCode: 403, body: JSON.stringify({ valid: false, error: 'Token già usato da altro dispositivo' }) }
    }

    return { statusCode: 200, body: JSON.stringify({ valid: true, message: 'Accesso valido' }) }

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ valid: false, error: 'Errore interno', details: err.message }) }
  }
}
