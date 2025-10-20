// auth-system.js - Gestione autenticazione

// User database
const usersDB = JSON.parse(localStorage.getItem('quizUsers')) || {};
let currentUser = null;

const LOGIN_STATUS_KEY = 'userLoggedIn';
const LOGGED_IN_USER_KEY = 'loggedInUser';
const LAST_USER_KEY = 'lastUser';

const storedLoggedInUser = localStorage.getItem(LOGGED_IN_USER_KEY);
if (storedLoggedInUser && usersDB[storedLoggedInUser]) {
  currentUser = storedLoggedInUser;
  if (localStorage.getItem(LOGIN_STATUS_KEY) !== 'true') {
    localStorage.setItem(LOGIN_STATUS_KEY, 'true');
  }
} else if (storedLoggedInUser && !usersDB[storedLoggedInUser]) {
  localStorage.removeItem(LOGGED_IN_USER_KEY);
  localStorage.removeItem(LOGIN_STATUS_KEY);
}

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const showRegister = document.getElementById('show-register');
const showLogin = document.getElementById('show-login');
const authScreen = document.getElementById('auth-screen');
const userDashboard = document.getElementById('user-dashboard');
const welcomeUsername = document.getElementById('welcome-username');
const logoutBtn = document.getElementById('logout-btn');
const completedQuizzes = document.getElementById('completed-quizzes');
const averageScore = document.getElementById('average-score');
const bestScore = document.getElementById('best-score');

// Event listeners per autenticazione
if (showRegister) {
  showRegister.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
  });
}

if (showLogin) {
  showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    if (registerForm) registerForm.style.display = 'none';
    if (loginForm) loginForm.style.display = 'block';
  });
}

if (loginBtn) {
  loginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const username = document.getElementById('username')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    
    if (!username || !password) {
      alert('Per favore inserisci sia username che password');
      return;
    }
    
    if (usersDB[username] && usersDB[username].password === password) {
      setLoginState(username);
      loginUser();
    } else {
      alert('Credenziali non valide');
    }
  });
}

if (registerBtn) {
  registerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username')?.value.trim();
    const password = document.getElementById('reg-password')?.value.trim();
    const confirmPassword = document.getElementById('reg-confirm-password')?.value.trim();
    
    if (!username || !password || !confirmPassword) {
      alert('Per favore compila tutti i campi');
      return;
    }
    
    if (password !== confirmPassword) {
      alert('Le password non coincidono');
      return;
    }

    if (usersDB[username]) {
      alert('Username già esistente');
      return;
    }

    usersDB[username] = {
      password: password,
      quizHistory: []
    };
    
    localStorage.setItem('quizUsers', JSON.stringify(usersDB));
    setLoginState(username);
    loginUser();
  });
}

function setLoginState(username, rememberLastUser = true) {
  currentUser = username || null;

  if (username) {
    if (rememberLastUser) {
      localStorage.setItem(LAST_USER_KEY, username);
    }
    localStorage.setItem(LOGGED_IN_USER_KEY, username);
    localStorage.setItem(LOGIN_STATUS_KEY, 'true');
  } else {
    localStorage.removeItem(LOGGED_IN_USER_KEY);
    localStorage.removeItem(LOGIN_STATUS_KEY);
  }
}

function isUserLoggedIn() {
  return localStorage.getItem(LOGIN_STATUS_KEY) === 'true' && !!localStorage.getItem(LOGGED_IN_USER_KEY);
}

function loginUser() {
  if (currentUser) {
    localStorage.setItem(LOGGED_IN_USER_KEY, currentUser);
    localStorage.setItem(LOGIN_STATUS_KEY, 'true');
    localStorage.setItem(LAST_USER_KEY, currentUser);
  }

  showDashboard();
}

function updateUserDashboard() {
    if (!currentUser) return;
    
    const userData = usersDB[currentUser];
    // Filtra solo i quiz COMPLETI (escludi i retry)
    const completedQuizzesList = userData.quizHistory.filter(quiz => !quiz.isRetry);
    
    if (welcomeUsername) welcomeUsername.textContent = currentUser;
    
    if (completedQuizzes) {
        completedQuizzes.textContent = completedQuizzesList.length;
    }
    
    // Per media e miglior punteggio, considera TUTTI i quiz (anche retry)
    const avg = userData.quizHistory.length > 0 
        ? Math.round(userData.quizHistory.reduce((sum, quiz) => sum + quiz.score, 0) / userData.quizHistory.length)
        : 0;
    if (averageScore) averageScore.textContent = `${avg}%`;
    
    const best = userData.quizHistory.length > 0
        ? Math.max(...userData.quizHistory.map(quiz => quiz.score))
        : 0;
    if (bestScore) bestScore.textContent = `${best}%`;
}

if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        setLoginState(null);
        localStorage.removeItem(LAST_USER_KEY);
        showAuthScreen();

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    });
}

function prefillLoginForm() {
  const savedUser = localStorage.getItem(LAST_USER_KEY);
  const usernameInput = document.getElementById('username');

  if (savedUser && usernameInput && !usernameInput.value) {
    usernameInput.value = savedUser;
  }
}

function showAuthScreen() {
  if (authScreen) authScreen.style.display = "flex";
  if (userDashboard) userDashboard.style.display = "none";

  if (document.body && document.body.dataset) {
    delete document.body.dataset.menuInitialized;
  }

  const quizSettings = document.querySelector('.quiz-settings');
  if (quizSettings) quizSettings.style.display = 'none';

  if (document.getElementById('subject-section')) document.getElementById('subject-section').style.display = 'none';
  if (document.getElementById('subject-dashboard')) document.getElementById('subject-dashboard').style.display = 'none';
  if (document.getElementById('no-quiz-message')) document.getElementById('no-quiz-message').style.display = 'none';
  if (document.getElementById('quiz-screen')) document.getElementById('quiz-screen').style.display = "none";
  if (document.getElementById('results-screen')) document.getElementById('results-screen').style.display = "none";
  
  const authForms = document.getElementById('auth-forms');
  if (authForms) authForms.style.display = 'block';
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';

  prefillLoginForm();
}

function showDashboard() {
  if (authScreen) authScreen.style.display = 'none';
  if (userDashboard) userDashboard.style.display = 'block';

  const authForms = document.getElementById('auth-forms');
  if (authForms) authForms.style.display = 'none';

  const quizSettings = document.querySelector('.quiz-settings');
  if (quizSettings) quizSettings.style.display = 'none';

  if (document.getElementById('subject-section')) document.getElementById('subject-section').style.display = 'none';
  if (document.getElementById('subject-dashboard')) document.getElementById('subject-dashboard').style.display = 'none';
  if (document.getElementById('no-quiz-message')) document.getElementById('no-quiz-message').style.display = 'none';
  if (document.getElementById('quiz-screen')) document.getElementById('quiz-screen').style.display = 'none';
  if (document.getElementById('results-screen')) document.getElementById('results-screen').style.display = 'none';

  updateUserDashboard();

  setTimeout(() => {
    initializeMenu();
  }, 100);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!isUserLoggedIn()) {
    prefillLoginForm();
  }
});

// ===================== //
// GESTIONE MENU A TENDINA (SOLO IN DASHBOARD) //
// ===================== //

function initializeMenu() {
    // Controlla se siamo nella dashboard
    const userDashboard = document.getElementById('user-dashboard');
    if (!userDashboard || userDashboard.style.display === 'none') {
        return; // Esci se non siamo nella dashboard
    }
    
    const menuToggle = document.getElementById('menuToggle');
    const menuClose = document.getElementById('menuClose');
    const sidebarMenu = document.getElementById('sidebarMenu');
    const menuOverlay = document.getElementById('menuOverlay');

    if (!menuToggle || !sidebarMenu) return;

    if (document.body.dataset.menuInitialized === 'true') {
        return;
    }
    document.body.dataset.menuInitialized = 'true';

    // Apri menu
    menuToggle.addEventListener('click', () => {
        sidebarMenu.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // Chiudi menu
    function closeMenu() {
        sidebarMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    if (menuClose) menuClose.addEventListener('click', closeMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', closeMenu);

    // Chiudi menu con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebarMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // Chiudi menu quando si clicca su un link
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', closeMenu);
    });
}
function openMaterialSubmission() {
    // Chiudi il menu mobile se aperto
    const sidebarMenu = document.getElementById('sidebarMenu');
    if (sidebarMenu) {
        sidebarMenu.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Mostra direttamente l'avviso senza aprire il modal complesso
    showMaterialInstructions();
}

function showMaterialInstructions() {
    const alertHTML = `
        <div class="simple-alert-overlay" id="material-alert">
            <div class="simple-alert">
                <div class="alert-header">
                    <i class="fas fa-envelope"></i>
                    <h3>Invia Materiale PDF</h3>
                </div>
                
                <div class="alert-body">
                    <p><strong>Come inviare il tuo materiale:</strong></p>
                    
                    <div class="instruction-steps">
                        <div class="step">
                            <div class="step-number">1</div>
                            <div class="step-content">
                                <strong>Apri la tua email</strong>
                                <p>Usa il tuo client email preferito (Gmail, Outlook, ecc.)</p>
                            </div>
                        </div>
                        
                        <div class="step">
                            <div class="step-number">2</div>
                            <div class="step-content">
                                <strong>Scrivi a quizienza@gmail.com</strong>
                                <p>Inserisci questo indirizzo come destinatario</p>
                            </div>
                        </div>
                        
                        <div class="step">
                            <div class="step-number">3</div>
                            <div class="step-content">
                                <strong>Allega il PDF e invia</strong>
                                <p>Includi una breve descrizione del materiale</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="email-example">
                        <p><strong>Esempio di oggetto:</strong></p>
                        <p class="example-text">"Materiale per [Nome Materia] - Quizienza"</p>
                    </div>
                </div>
                
                <div class="alert-footer">
                    <button class="primary-btn" onclick="closeMaterialAlert()">
                        <i class="fas fa-check"></i> Ho capito!
                    </button>
                </div>
            </div>
        </div>
    `;

    // Rimuovi alert esistenti
    const existingAlert = document.getElementById('material-alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Aggiungi l'alert al body
    document.body.insertAdjacentHTML('beforeend', alertHTML);
}

function closeMaterialAlert() {
    const alert = document.getElementById('material-alert');
    if (alert) {
        alert.remove();
    }
}

// Chiudi l'alert con ESC
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeMaterialAlert();
    }
});

// Chiudi l'alert cliccando fuori
document.addEventListener('click', function (e) {
    if (e.target.classList.contains('simple-alert-overlay')) {
        closeMaterialAlert();
    }
});
