import { createClient } from '@supabase/supabase-js';

// Configura Supabase con le variabili d'ambiente
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    if (event.httpMethod === 'POST') {
      // Inserimento recensione
      const { user_name, stars, comment } = JSON.parse(event.body);

      if (!user_name || !stars || !comment) {
        return { statusCode: 400, body: JSON.stringify({ error: "Tutti i campi sono obbligatori" }) };
      }

      const { data, error } = await supabase
        .from('reviews')
        .insert([{ user_name, stars, comment }]);

      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message }) };

      return { statusCode: 200, body: JSON.stringify({ success: true, data }) };
    }

    if (event.httpMethod === 'GET') {
      // Recupera tutte le recensioni ordinate per data decrescente
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message }) };

      return { statusCode: 200, body: JSON.stringify(data) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: "Metodo non consentito" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
