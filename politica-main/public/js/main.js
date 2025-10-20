// main.js - File principale
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();

    if (typeof initializeUIManager === 'function') {
        initializeUIManager();
    }

    if (typeof initializeFlashcardSystem === 'function') {
        initializeFlashcardSystem();
    }
});

function initializeApp() {
  // Nascondi tutti gli schermi tranne auth all'inizio
  if (document.getElementById('user-dashboard')) document.getElementById('user-dashboard').style.display = "none";
  if (document.getElementById('quiz-screen')) document.getElementById('quiz-screen').style.display = "none";
  if (document.getElementById('results-screen')) document.getElementById('results-screen').style.display = "none";
  
  // Nascondi quiz-settings all'inizio
  const quizSettings = document.querySelector('.quiz-settings');
  if (quizSettings) quizSettings.style.display = "none";

  // Nascondi anche la sezione materia e dashboard
  if (document.getElementById('subject-section')) document.getElementById('subject-section').style.display = "none";
  if (document.getElementById('subject-dashboard')) document.getElementById('subject-dashboard').style.display = "none";
  if (document.getElementById('no-quiz-message')) document.getElementById('no-quiz-message').style.display = "none";
  
  // Mostra solo la schermata di autenticazione
  if (document.getElementById('auth-screen')) document.getElementById('auth-screen').style.display = "flex";
  
  // Poi controlla se c'è un utente loggato
  checkLoggedInUser();
  
  // Inizializza Dark Mode
  initializeDarkMode();
}

function checkLoggedInUser() {
    const lastUser = localStorage.getItem('lastUser');
    
    if (!lastUser) {
        return;
    }

    if (typeof usersDB !== 'undefined' && usersDB && usersDB[lastUser]) {
        currentUser = lastUser;
        loginUser();
        return;
    }

    try {
        const persistedUsers = JSON.parse(localStorage.getItem('quizUsers') || '{}');
        if (persistedUsers[lastUser] && typeof usersDB !== 'undefined' && usersDB) {
            usersDB[lastUser] = persistedUsers[lastUser];
            currentUser = lastUser;
            loginUser();
        }
    } catch (error) {
        console.warn('Errore nel ripristino dell\'utente salvato:', error);
    }
}

// Dark Mode System
let isDarkMode = false;

function initializeDarkMode() {
    const toggleBtn = document.getElementById("darkModeToggle");
    const body = document.body;

    // Carica stato salvato
    if (localStorage.getItem("darkMode") === "enabled") {
        body.classList.add("dark-mode");
        if (toggleBtn) {
            toggleBtn.querySelector("i").classList.replace("fa-moon", "fa-sun");
            toggleBtn.querySelector("span").textContent = "Modalità chiara";
        }
    }

    // Toggle
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            body.classList.toggle("dark-mode");
            const enabled = body.classList.contains("dark-mode");

            if (toggleBtn.querySelector("i")) {
                toggleBtn.querySelector("i").classList.toggle("fa-sun", enabled);
                toggleBtn.querySelector("i").classList.toggle("fa-moon", !enabled);
                toggleBtn.querySelector("span").textContent = enabled ? "Modalità chiara" : "Modalità scura";
            }

            localStorage.setItem("darkMode", enabled ? "enabled" : "disabled");
        });
    }
}
