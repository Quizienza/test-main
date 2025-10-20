// Funzione per creare un fingerprint semplice del dispositivo
async function getFingerprint() {
  const userAgent = navigator.userAgent;
  const lang = navigator.language;
  const screenRes = `${screen.width}x${screen.height}`;
  return btoa(userAgent + lang + screenRes);
}

function showAuthUI() {
  if (typeof window.showAuthScreen === "function") {
    window.showAuthScreen();
    return;
  }

  const authScreen = document.getElementById("auth-screen");
  const dashboard = document.getElementById("user-dashboard");
  const quizScreen = document.getElementById("quiz-screen");
  
  if (authScreen) authScreen.style.display = "block";
  if (dashboard) dashboard.style.display = "none";
  if (quizScreen) quizScreen.style.display = "none";
}

function showDashboardUI() {
  if (typeof window.showDashboard === "function") {
    window.showDashboard();
    return;
  }

  const authScreen = document.getElementById("auth-screen");
  const dashboard = document.getElementById("user-dashboard");
  const quizScreen = document.getElementById("quiz-screen");
  
  if (authScreen) authScreen.style.display = "none";
  if (dashboard) dashboard.style.display = "block";
  if (quizScreen) quizScreen.style.display = "none";
}



function isUserSessionActive() {
  if (typeof window.isUserLoggedIn === "function") {
    return window.isUserLoggedIn();
  }
  return localStorage.getItem("userLoggedIn") === "true";
}

// Mostra errore 404 e pagina bianca
function show404Error() {
  document.body.innerHTML = '';
  document.body.style.backgroundColor = 'white';
  document.body.style.display = 'flex';
  document.body.style.justifyContent = 'center';
  document.body.style.alignItems = 'center';
  document.body.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.style.fontFamily = 'Arial, sans-serif';
  
  const errorDiv = document.createElement('div');
  errorDiv.style.textAlign = 'center';
  errorDiv.style.color = '#666';
  
  errorDiv.innerHTML = `
    <h1 style="font-size: 48px; margin: 0;">404</h1>
    <p style="font-size: 18px; margin: 10px 0;">Pagina non trovata</p>
    <p style="font-size: 14px;">Accesso non autorizzato</p>
  `;
  
  document.body.appendChild(errorDiv);
}

// Controlla se la pagina è in background
function isPageInBackground() {
  return document.hidden || document.visibilityState === 'hidden';
}

// Variabile per tracciare lo stato di autenticazione
let isAuthenticating = false;

// Richiesta token nuovo se non esiste o non valido
async function requestToken(fingerprint) {
  isAuthenticating = true;
  
  if (isPageInBackground()) {
    show404Error();
    isAuthenticating = false;
    return null;
  }

  const token = prompt("Inserisci il token di accesso fornito dall'amministratore:");
  
  if (token === null || isPageInBackground()) {
    show404Error();
    isAuthenticating = false;
    return null;
  }
  
  if (!token.trim()) {
    alert("Il token è obbligatorio");
    isAuthenticating = false;
    return requestToken(fingerprint);
  }

  try {
    const res = await fetch("/.netlify/functions/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, fingerprint })
    });

    const data = await res.json();
    
    if (res.status === 200 && data.valid) {
      localStorage.setItem("quiz_token", token);
      alert("Accesso consentito!");
      
      if (isUserSessionActive()) {
        showDashboardUI();
      } else {
        showAuthUI();
      }
      
      isAuthenticating = false;
      return token;
    } 
    else if (res.status === 403) {
      alert("Token già utilizzato su un altro dispositivo. Accesso negato.");
      show404Error();
      isAuthenticating = false;
      return null;
    }
    else {
      alert(data.error || "Token non valido");
      isAuthenticating = false;
      return requestToken(fingerprint);
    }
  } catch (err) {
    console.error("Errore nella verifica token:", err);
    alert("Errore di connessione. Riprova più tardi.");
    isAuthenticating = false;
    return null;
  }
}

// Controlla se il token è valido
async function checkAccess() {
  isAuthenticating = true;
  
  if (isPageInBackground()) {
    show404Error();
    isAuthenticating = false;
    return;
  }

  const token = localStorage.getItem("quiz_token");
  const fingerprint = await getFingerprint();

  if (token) {
    try {
      const res = await fetch("/.netlify/functions/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fingerprint })
      });

      const data = await res.json();
      
      if (res.status === 200 && data.valid) {
        console.log("Accesso valido dal refresh");
        
        if (isUserSessionActive()) {
          showDashboardUI();
        } else {
          showAuthUI();
        }
        
        isAuthenticating = false;
        return;
      } 
      else if (res.status === 403) {
        // Token già associato a un dispositivo diverso - BLOCCA COMPLETAMENTE
        alert("Token già utilizzato su un altro dispositivo. Accesso negato.");
        localStorage.removeItem("quiz_token");
        localStorage.removeItem("userLoggedIn");
        show404Error();
        isAuthenticating = false;
        return;
      }
      else if (res.status === 401) {
        // Token scaduto o non valido
        alert("Token scaduto o non valido");
        localStorage.removeItem("quiz_token");
        localStorage.removeItem("userLoggedIn");
        await requestToken(fingerprint);
      }
      else {
        // Altri errori
        alert("Errore di verifica token");
        localStorage.removeItem("quiz_token");
        localStorage.removeItem("userLoggedIn");
        await requestToken(fingerprint);
      }
    } catch (err) {
      console.error("Errore nella verifica token:", err);
      alert("Errore di connessione. Riprova più tardi.");
      // In caso di errore di connessione, potresti voler mostrare la auth screen
      showAuthUI();
    }
  } else {
    // Nessun token → richiedi nuovo
    await requestToken(fingerprint);
  }
  
  isAuthenticating = false;
}


// Listener per cambiamenti di visibilità - solo durante autenticazione
let visibilityChangeHandler = null;

function setupVisibilityListener() {
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
  }
  
  visibilityChangeHandler = function() {
    if (isAuthenticating && isPageInBackground()) {
      show404Error();
      document.removeEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeHandler = null;
    }
  };
  
  document.addEventListener('visibilitychange', visibilityChangeHandler);
}

function removeVisibilityListener() {
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler);
    visibilityChangeHandler = null;
  }
}

// Esegue il controllo appena la pagina viene caricata
document.addEventListener('DOMContentLoaded', function() {
  if (isPageInBackground()) {
    show404Error();
  } else {
    setupVisibilityListener();
    checkAccess().finally(() => {
      removeVisibilityListener();
    });
  }
});








