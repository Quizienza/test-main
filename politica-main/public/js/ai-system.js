// ai-system.js - Funzioni AI per spiegazioni e assistenza

// Effettua la richiesta di spiegazione all'AI.
// Prova prima Netlify (/.netlify/functions/askGemini), poi fallback a /api/askGemini.
async function askAIExplanation({ question, userAnswer, correctAnswer, subject }) {
  const payload = { question, userAnswer, correctAnswer, subject };

  // Due endpoint supportati: Netlify function e backend Express
  const endpoints = [
    "/.netlify/functions/askGemini",
    "/api/askGemini"
  ];

  for (const url of endpoints) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      clearTimeout(to);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      // prova endpoint successivo
    }
  }

  // Fallback: risposta statica se nessun endpoint è disponibile
  return {
    text: "Spiegazione non disponibile al momento. Configura l'endpoint AI.",
    html: "",
    sources: []
  };
}

// Mostra una finestra/modale con la spiegazione AI.
// Utilizzata dai pulsanti "Chiedi Spiegazione all'AI" nella schermata risultati.
function openAIExplanation({ question, userAnswer, correctAnswer, subject, isExplanation }) {
  // Crea overlay
  const overlay = document.createElement("div");
  overlay.className = "ai-chat-overlay";

  const container = document.createElement("div");
  container.className = "ai-chat-container";

  const header = document.createElement("div");
  header.className = "ai-chat-header";
  header.innerHTML = `
    <div class="chat-title">
      <i class="fas fa-lightbulb"></i>
      <div>
        <h3>Spiegazione AI</h3>
        <span class="chat-status">Domanda su: ${subject || "Quiz"}</span>
      </div>
    </div>
    <button class="close-chat-btn" title="Chiudi"><i class="fas fa-times"></i></button>
  `;

  const messages = document.createElement("div");
  messages.className = "ai-chat-messages";
  messages.innerHTML = `
    <div class="welcome-ai-message">
      <i class="fas fa-robot"></i>
      <h4>Sto analizzando la tua risposta...</h4>
      <p>Domanda: <strong>${escapeHtml(question || "")}</strong></p>
      ${userAnswer ? `<p>La tua risposta: <em>${escapeHtml(userAnswer)}</em></p>` : ""}
    </div>
  `;

  const inputArea = document.createElement("div");
  inputArea.className = "ai-chat-input-area";
  inputArea.innerHTML = `
    <div class="ai-input-wrapper" style="opacity:0.6; pointer-events:none;">
      <input class="ai-input" placeholder="Scrivi un messaggio... (disabilitato)" disabled />
      <button class="ai-send-btn" disabled><i class="fas fa-paper-plane"></i></button>
    </div>
  `;

  container.appendChild(header);
  container.appendChild(messages);
  container.appendChild(inputArea);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  // Chiudi overlay
  header.querySelector(".close-chat-btn").addEventListener("click", () => {
    overlay.remove();
  });
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Recupera spiegazione
  (async () => {
    try {
      const data = await askAIExplanation({ question, userAnswer, correctAnswer, subject });
      const html = data?.html || "";
      const text = data?.text || "Spiegazione non disponibile.";
      const sources = Array.isArray(data?.sources) ? data.sources : [];

      const block = document.createElement("div");
      block.className = "ai-message ai";
      block.innerHTML = `
        <div class="message-content">
          ${html || `<p>${escapeHtml(text)}</p>`}
          ${sources.length ? renderSourcesList(sources) : ""}
        </div>
      `;
      messages.appendChild(block);
      messages.scrollTop = messages.scrollHeight;
    } catch (err) {
      const block = document.createElement("div");
      block.className = "ai-message ai";
      block.innerHTML = `<div class="message-content"><p>Errore nel recupero spiegazione: ${escapeHtml(err.message || "")}</p></div>`;
      messages.appendChild(block);
    }
  })();
}

function renderSourcesList(sources) {
  try {
    const items = sources
      .map((s, i) => `<li>[${i + 1}] <a href="${escapeAttr(s.uri || "#")}" target="_blank" rel="noopener">${escapeHtml(s.title || s.uri || "Fonte")}</a></li>`) 
      .join("");
    return `<div class="ai-sources"><h6>Fonti</h6><ul>${items}</ul></div>`;
  } catch {
    return "";
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}

// Esporta in globalThis per uso da inline onclick / altri moduli
window.askAIExplanation = askAIExplanation;
window.openAIExplanation = openAIExplanation;

