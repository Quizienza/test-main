// netlify/functions/askGemini.js
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function resp(body, statusCode = 200) {
  return { statusCode, headers: corsHeaders, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

async function fetchWithTimeout(url, options, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

// ---------- Utils ----------
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Aggiunge schema e rimuove punteggiatura finale
function normalizeUrl(uri) {
  if (!uri) return '';
  let u = String(uri).trim();
  u = u.replace(/^<|>$/g, '');                   // <url>
  u = u.replace(/[)\]\}.,;:!?'"”’]+$/g, '');     // punteggiatura finale
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('www.')) return 'https://' + u;
  if (/^[\w.-]+\.[a-z]{2,}(?:[\/?#].*)?$/i.test(u)) return 'https://' + u;
  return u;
}

// Markdown inline -> HTML con link cliccabili (anche URL nudi)
function mdInlineToHtml(s) {
  let out = escapeHtml(s);

  // [titolo](url)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g,
    (_, text, url) => `<a href="${normalizeUrl(url)}" target="_blank" rel="noopener">${text}</a>`);

  // URL nudi -> <a>
  out = out.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)]+)(?=$|[\s).,!?:;])/g,
    (_, pre, url) => `${pre}<a href="${normalizeUrl(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`);

  // `code`, **bold**, *italic*
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*(.+?)\*\*/g, (_, m) => `<strong>${m}</strong>`);
  out = out.replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,!?:;]|$)/g, (_, pre, m) => `${pre}<em>${m}</em>`);

  const paras = out.trim().split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`);
  return paras.join('');
}

// Estrai fonti: grounding + markdown + URL nudi, normalizzati
function extractSources(cand, textRaw) {
  const out = [], seen = new Set();
  const chunks = cand?.groundingMetadata?.groundingChunks || [];
  for (const c of chunks) {
    const uri = normalizeUrl(c?.web?.uri);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri); out.push({ title: c?.web?.title || uri, uri });
  }
  const text = String(textRaw || '');
  for (const m of text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g)) {
    const title = m[1], uri = normalizeUrl(m[2]);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri); out.push({ title, uri });
  }
  for (const m of text.matchAll(/(?:https?:\/\/|www\.)[^\s<)]+/g)) {
    const uri = normalizeUrl(m[0]);
    if (!uri || seen.has(uri)) continue;
    seen.add(uri); out.push({ title: uri, uri });
  }
  return out.slice(0, 6);
}

// HEAD veloce per scartare link rotti; fallback GET Range 0-0


// Valida massimo 3 fonti per non sforare il timeout

// Rimuovi blocco “Fonti ...” nel testo per evitare doppioni
function stripSourcesSection(text) {
  if (!text) return text;
  const m = text.match(/(^|\n)\s*Fonti\s*:?\s*\n[\s\S]*$/i);
  return m ? text.slice(0, m.index).trim() : text;
}

// ---------- Handler ----------
exports.handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: corsHeaders, body: '' };
    if (event.httpMethod !== 'POST') return resp({ error: 'Method Not Allowed' }, 405);

    const { question, userAnswer, correctAnswer } = JSON.parse(event.body || '{}');

    const API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!API_KEY) return resp({ error: 'API key mancante' }, 500);

    const prompt =
`Domanda: ${String(question ?? '').slice(0,800)}
Risposta data: ${String(userAnswer ?? '').slice(0,400)}
Risposta corretta: ${String(correctAnswer ?? '').slice(0,400)}

Istruzioni:
1) Spiega in 4–8 frasi perché la corretta è giusta e l’altra è errata.
2) Stile asciutto.
3) Inserisci 2–4 fonti in fondo, con link completi (https://...). Se nessuna fonte valida: scrivi "Fonti: nessuna".
4) Puoi usare Markdown (*corsivo*, **grassetto**, \`code\`).`;

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.2 }
    };

    const upstream = await fetchWithTimeout(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify(body)
    }, 8000);

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      return resp({ error: 'Upstream error', status: upstream.status, details: txt }, upstream.status);
    }

    const raw = await upstream.json();
    const cand = raw?.candidates?.[0] || {};
    const textRaw = cand?.content?.parts?.[0]?.text || 'Spiegazione non disponibile.';
    const text = stripSourcesSection(textRaw);
    const html = mdInlineToHtml(text);

    // Estrai e valida fonti; se nessuna valida, nessuna lista
    const extracted = extractSources(cand, textRaw);
    const sources = extracted.slice(0, 6);

    return resp({ html, text, sources, candidates: raw?.candidates ?? [] }, 200);
  } catch (e) {
    const msg = e?.name === 'AbortError' ? 'Timeout interno' : (e?.message || 'Errore');
    return resp({ error: msg }, 500);
  }
};
