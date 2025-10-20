/* ===================== */
/* QUIZ FUNCTIONALITY */
/* ===================== */

// Variabili globali per il conteggio delle risposte corrette e totali
let correctAnsweredIndexes = [];
let totalAnswered = 0;
let errorFrequencyBySubject = {};   // { subject: { "testo domanda": numero errori } }
let frequentErrorsBySubject = {};   // { subject: [array domande] }
let userAnswers = [];
let lastQuizType = localStorage.getItem("lastQuizType") || null; // 'full' | 'frequentErrors' | 'retryWrong'
let inRepeatFrequentErrorsMode = false;


document.addEventListener('DOMContentLoaded', function() {
    if (typeof prefillCredentials === 'function') prefillCredentials();

    // carica errori frequenti PER MATERIA da localStorage
    try {
        errorFrequencyBySubject = JSON.parse(localStorage.getItem("errorFrequencyBySubject") || "{}");
        frequentErrorsBySubject = JSON.parse(localStorage.getItem("frequentErrorsBySubject") || "{}");
    } catch (e) {
        errorFrequencyBySubject = {};
        frequentErrorsBySubject = {};
        console.warn("Errore parsing localStorage per errori frequenti per materia", e);
    }

    // collega il pulsante (se presente) e inizializza lo stato
    const repeatBtn = document.getElementById('repeat-frequent-errors-btn');
    if (repeatBtn) {
        repeatBtn.addEventListener('click', repeatFrequentErrors);
        // Inizializza lo stato del bottone
        setTimeout(updateFrequentErrorsCounter, 100);
    }
    const viewResultsBtn = document.getElementById('view-results-btn');
    if (viewResultsBtn) {
        viewResultsBtn.addEventListener('click', toggleDetailedResults);
    }
});


// Variabile globale per le domande correnti
let questions = [];

// Mappa dei file delle domande per ogni materia
const subjectQuestionFiles = {
    'politica': 'domandepoleco.js',
    'organizzazione': 'domandeorganizzazione.js',
    // Aggiungi altre materie qui man mano che le implementi
    'eoi': 'domandeeoi.js',
    'empi': 'domandeempi.js',
    'ecopol': 'domandeecopol.js',
    'ecomonetaria': 'domandemonetaria.js',
};

// User database
const usersDB = JSON.parse(localStorage.getItem('quizUsers')) || {};
let currentUser = null;

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
const channelCards = document.querySelectorAll('.channel-card');
const subjectSection = document.getElementById('subject-section');
const subjectCards = document.querySelectorAll('.subject-card');
const completedQuizzes = document.getElementById('completed-quizzes');
const averageScore = document.getElementById('average-score');
const bestScore = document.getElementById('best-score');
const startQuizBtn = document.getElementById('start-quiz-btn');
const questionCountSelect = document.getElementById('question-count');
const quizScreen = document.getElementById('quiz-screen');
const questionText = document.getElementById('question-text');
const imageContainer = document.getElementById('image-container');
const answerButtons = document.getElementById('answer-buttons');
const nextButton = document.getElementById('next-btn');
const progressText = document.getElementById('progress-text');
const progressFill = document.getElementById('progress-fill');
const timeRemaining = document.getElementById('time-remaining');
const resultsScreen = document.getElementById('results-screen');
const scorePercentage = document.getElementById('score-percentage');
const scoreText = document.getElementById('score-text');
const correctAnswers = document.getElementById('correct-answers');
const wrongAnswersElement = document.getElementById('wrong-answers');
const timeTaken = document.getElementById('time-taken');
const logoutBtn = document.getElementById('logout-btn');
const retryWrongBtn = document.getElementById('retry-wrong-btn');
const newQuizBtn = document.getElementById('new-quiz-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const backToDashboardBtn2 = document.getElementById('back-to-dashboard-btn2');
const repeatSameQuizBtn = document.getElementById("repeat-same-quiz-btn");



// Quiz variables
let retryMode = false;
let originalWrongAnswers = [];
let shuffledQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let totalQuestions = 0;
let wrongAnswers = [];
let quizStartTime = 0;
let quizTimerInterval = null;
let totalTimeAllowed = 0;
let timeLeft = 0;

// Aggiungi queste variabili per la gestione delle materie
let currentChannel = null;
let currentSubject = null;
const subjectDashboard = document.getElementById('subject-dashboard');
const noQuizMessage = document.getElementById('no-quiz-message');
const currentSubjectName = document.getElementById('current-subject-name');
const currentSubjectBadge = document.getElementById('current-subject-badge');

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
   
    prefillCredentials();
});

function restoreDashboardView() {
    // Ripristina la vista normale della dashboard
    const dashboardHeader = document.querySelector('.subject-dashboard .dashboard-header');
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardHeader) dashboardHeader.style.display = 'block';
    if (dashboardContent) dashboardContent.style.display = 'block';
    noQuizMessage.style.display = 'none';
    
    // Nascondi impostazioni quiz per sicurezza
    const quizSettings = document.querySelector('.quiz-settings');
    if (quizSettings) quizSettings.style.display = 'none';
    
    // Mostra il footer
    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) siteFooter.style.display = 'block';
}

function initializeApp() {
  // Nascondi tutti gli schermi tranne auth all'inizio
  if (userDashboard) userDashboard.style.display = "none";
  if (quizScreen) quizScreen.style.display = "none";
  if (resultsScreen) resultsScreen.style.display = "none";
  
  // Nascondi quiz-settings (impostazioni quiz) all'inizio
  const quizSettings = document.querySelector('.quiz-settings');
  if (quizSettings) quizSettings.style.display = "none";

   // Nascondi anche la sezione materia e dashboard
   if (subjectSection) subjectSection.style.display = "none";
   if (subjectDashboard) subjectDashboard.style.display = "none";
   if (noQuizMessage) noQuizMessage.style.display = "none";
  
  // Mostra solo la schermata di autenticazione
  if (authScreen) authScreen.style.display = "flex";
  
  // Poi controlla se c'è un utente loggato
  checkLoggedInUser();
}

function checkLoggedInUser() {
  const lastUser = localStorage.getItem('lastUser');
  if (lastUser && usersDB[lastUser]) {
    currentUser = lastUser;
    loginUser();
  }
}

function showAuthScreen() {
  if (authScreen) authScreen.style.display = "flex";
  if (userDashboard) userDashboard.style.display = "none";
  if (quizScreen) quizScreen.style.display = "none";
  if (resultsScreen) resultsScreen.style.display = "none";
  
  if (document.getElementById('auth-forms')) {
    document.getElementById('auth-forms').style.display = 'block';
  }
  if (loginForm) loginForm.style.display = 'block';
  if (registerForm) registerForm.style.display = 'none';
  
}

/* ===================== */
/* AUTHENTICATION */
/* ===================== */
// Chiama prefillCredentials all'inizio

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

// Modifica il click handler del login button
if (loginBtn) {
  loginBtn.addEventListener('click', () => {
      const username = document.getElementById('username')?.value.trim();
      const password = document.getElementById('password')?.value.trim();
      const rememberMe = document.getElementById('remember-me')?.checked;
      
      if (!username || !password) {
        alert('Per favore inserisci sia username che password');
        return;
      }
      
      if (usersDB[username] && usersDB[username].password === password) {
        currentUser = username;
        localStorage.setItem('lastUser', username);
        
        if (rememberMe) {
            saveCredentials(username, password);
        } else {
            clearSavedCredentials();
        }
        
        loginUser();
      } else {
        alert('Credenziali non valide');
      }
  });
}

if (registerBtn) {
  registerBtn.addEventListener('click', () => {
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
    currentUser = username;
    localStorage.setItem('lastUser', username);
    loginUser();
  });
}

function loginUser() {
  if (authScreen) authScreen.style.display = 'none';
  if (userDashboard) userDashboard.style.display = 'block';
  
  // Nascondi quiz-settings all'accesso (si mostrerà solo dopo aver selezionato una materia)
  const quizSettings = document.querySelector('.quiz-settings');
  if (quizSettings) quizSettings.style.display = 'none';
  
  // Nascondi anche le altre sezioni
  if (subjectSection) subjectSection.style.display = 'none';
  if (subjectDashboard) subjectDashboard.style.display = 'none';
  if (noQuizMessage) noQuizMessage.style.display = 'none';
  
  if (quizScreen) quizScreen.style.display = 'none';
  if (resultsScreen) resultsScreen.style.display = 'none';
  
  updateUserDashboard();
}
function saveCredentials(username, password) {
    const credentials = {
        username: username,
        password: password,
        timestamp: Date.now()
    };
    localStorage.setItem('rememberedUser', JSON.stringify(credentials));
}

function clearSavedCredentials() {
    localStorage.removeItem('rememberedUser');
}

function getSavedCredentials() {
    const saved = localStorage.getItem('rememberedUser');
    if (!saved) return null;
    
    const credentials = JSON.parse(saved);
    // Scadenza dopo 1 anno
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (Date.now() - credentials.timestamp > oneYear) {
        clearSavedCredentials();
        return null;
    }

    
    return credentials;
}

function prefillCredentials() {
    const credentials = getSavedCredentials();
    if (credentials) {
        document.getElementById('username').value = credentials.username;
        document.getElementById('password').value = credentials.password;
        document.getElementById('remember-me').checked = true;
    }
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

// Gestione selezione canale
channelCards.forEach(card => {
    card.addEventListener('click', () => {
        currentChannel = card.dataset.channel;
        
        // Nascondi la dashboard e mostra la sezione materie
        subjectSection.style.display = 'block';
        noQuizMessage.style.display = 'none';
        
        // Scorri fino alla sezione materie
        subjectSection.scrollIntoView({ behavior: 'smooth' });
    });
});

// Nomi completi delle materie
const subjectNames = {
    politica: "Politica Economica",
    eoi: "Economia e Organizzazione Industriale",
    empi: "Energie, Materie Prime e Innovazione",
    organizzazione: "Organizzazione Aziendale",
    ecopol: "Economia Politica",
    ecomonetaria: "Economia e Politica Monetaria",
};

// Verifica se una materia ha domande
function hasQuestions(subject) {
    return Object.keys(subjectQuestionFiles).includes(subject);
}

// Funzione per caricare dinamicamente il file delle domande
function loadQuestionsForSubject(subject, callback) {
    const scriptFile = subjectQuestionFiles[subject];
    
    if (!scriptFile) {
        console.error('Nessun file domande trovato per la materia:', subject);
        if (callback) callback([]);
        return;
    }
    
    // Rimuovi lo script precedente se esiste
    const oldScript = document.getElementById('current-question-script');
    if (oldScript) {
        document.head.removeChild(oldScript);
    }
    
    // Crea un nuovo script element
    const script = document.createElement('script');
    script.id = 'current-question-script';
    script.src = scriptFile;
    script.onload = function() {
        console.log(`Domande per ${subject} caricate con successo`);
        if (callback) callback(window.questions || []);
    };
    script.onerror = function() {
        console.error(`Errore nel caricamento delle domande per ${subject}`);
        if (callback) callback([]);
    };
    
    document.head.appendChild(script);
}

// Seleziona materia
subjectCards.forEach(card => {
    card.addEventListener('click', () => {
        currentSubject = card.dataset.subject;
        
        // Nascondi le impostazioni quiz inizialmente
        const quizSettings = document.querySelector('.quiz-settings');
        if (quizSettings) quizSettings.style.display = 'none';

        // NASCONDI LA SEZIONE CANALE quando mostri la dashboard materia
        const channelSection = document.querySelector('.channel-section');
        if (channelSection) channelSection.style.display = 'none';
        
        if (!hasQuestions(currentSubject)) {
            // NASCONDI TUTTO e mostra SOLO il messaggio di errore
            subjectSection.style.display = 'none';
            subjectDashboard.style.display = 'block'; // MOSTRA la dashboard
            noQuizMessage.style.display = 'block'; // MOSTRA il messaggio
            
            // Nascondi il contenuto normale della dashboard
            const dashboardHeader = document.querySelector('.subject-dashboard .dashboard-header');
            const dashboardContent = document.querySelector('.dashboard-content');
            if (dashboardHeader) dashboardHeader.style.display = 'none';
            if (dashboardContent) dashboardContent.style.display = 'none';
            
            // Mostra SOLO il messaggio di errore
            noQuizMessage.innerHTML = `
                <button id="back-to-subjects" class="back-arrow-btn" title="Torna indietro">
        <i class="fas fa-arrow-left"></i>
    </button>
    <div style="padding-left: 50px;">
        <i class="fas fa-info-circle"></i>
        <h3>Quiz non ancora disponibile</h3>
        <p>La materia <strong>${subjectNames[currentSubject]}</strong> non ha ancora quiz disponibili.</p>
        <p style="color: var(--text-light); font-size: 0.9rem;">
            Stiamo lavorando per aggiungere nuovi contenuti.
        </p>
    </div>
`;
            
            // Scorri fino al messaggio
            noQuizMessage.scrollIntoView({ behavior: 'smooth' });
            
            // Aggiungi event listener al pulsante "Torna indietro"
            setTimeout(() => {
                const backButton = document.getElementById('back-to-subjects');
                if (backButton) {
                    backButton.addEventListener('click', () => {
                        // NASCONDI TUTTO
                        noQuizMessage.style.display = 'none';
                        subjectSection.style.display = 'block';
                        subjectDashboard.style.display = 'none';
                        // NASCONDI IMPOSTAZIONI QUIZ
                        const quizSettings = document.querySelector('.quiz-settings');
                        if (quizSettings) quizSettings.style.display = 'none';
                        // MOSTRA LA SEZIONE CANALE
                        const channelSection = document.querySelector('.channel-section');
                        if (channelSection) channelSection.style.display = 'block';

                        // RESETTA la materia corrente
                         currentSubject = null;
        
                        // RIPRISTINA la vista normale
                        restoreDashboardView();

                        // Ripristina il contenuto della dashboard
                        const dashboardHeader = document.querySelector('.subject-dashboard .dashboard-header');
                        const dashboardContent = document.querySelector('.dashboard-content');
                        if (dashboardHeader) dashboardHeader.style.display = 'block';
                        if (dashboardContent) dashboardContent.style.display = 'block';
                    });
                }
            }, 100);
            
            return;
        }
        
        // Se la materia HA domande
        subjectSection.style.display = 'none';
        noQuizMessage.style.display = 'none';
        updateSubjectDashboard();
        subjectDashboard.style.display = 'block';

        // Mostra le impostazioni quiz SOLO per le materie con domande
        if (quizSettings && hasQuestions(currentSubject)) {
            quizSettings.style.display = 'block';
        }
        
        // Scorri fino alla dashboard materia
        subjectDashboard.scrollIntoView({ behavior: 'smooth' });
    });
});

// Aggiorna la dashboard della materia
function updateSubjectDashboard() {
    if (!currentUser || !currentSubject) return;
    
    const userData = usersDB[currentUser];
    
    // Filtra solo i quiz COMPLETI (escludi i retry) della materia corrente
    const subjectHistory = userData.quizHistory.filter(quiz => 
        quiz.subject === currentSubject && !quiz.isRetry
    );
    
    // Filtra tutti i quiz della materia (anche retry) per le statistiche complete
    const allSubjectQuizzes = userData.quizHistory.filter(quiz => 
        quiz.subject === currentSubject
    );
    
    if (currentSubjectName) {
        currentSubjectName.textContent = subjectNames[currentSubject] || currentSubject;
    }
    
    if (currentSubjectBadge) {
        currentSubjectBadge.textContent = `Canale ${currentChannel}`;
    }
    
    // Aggiorna le statistiche - QUIZ COMPLETI (no retry)
    if (completedQuizzes) {
        completedQuizzes.textContent = subjectHistory.length;
    }
    
    // Per media e miglior punteggio, considera TUTTI i quiz (anche retry)
    const avg = subjectHistory.length > 0 
        ? Math.round(subjectHistory.reduce((sum, quiz) => sum + quiz.score, 0) / subjectHistory.length)
        : 0;
    if (averageScore) averageScore.textContent = `${avg}%`;
    
    const best = subjectHistory.length > 0
        ? Math.max(...subjectHistory.map(quiz => quiz.score))
        : 0;
    if (bestScore) bestScore.textContent = `${best}%`;
    
    // AGGIORNA IL CONTATORE DEGLI ERRORI FREQUENTI
    updateFrequentErrorsCounter();
    
    // Mostra/nascondi footer appropriatamente
    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) {
        siteFooter.style.display = 'block';
    }
}


/* ===================== */
/* QUIZ FUNCTIONALITY */
/* ===================== */

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getResultText(percentage) {
    if (percentage >= 90) return "Perfetto!";
    if (percentage >= 70) return "Eccellente!";
    if (percentage >= 50) return "Buono";
    if (percentage >= 30) return "Discreto";
    return "Da migliorare";
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function startQuiz() {
    // Aggiungi questo controllo all'inizio
    if (!currentSubject || !hasQuestions(currentSubject)) {
        alert('Quiz non disponibile per questa materia');
        return;
    }
    
    // Carica le domande per la materia corrente
    loadQuestionsForSubject(currentSubject, function(loadedQuestions) {
        if (loadedQuestions.length === 0) {
            alert('Nessuna domanda disponibile per questa materia');
            return;
        }
        
        // Assegna le domande caricate alla variabile questions
        questions = loadedQuestions;
        
        // Il resto del codice rimane invariato
        // Nascondi il footer quando inizia il quiz
        const siteFooter = document.querySelector('.site-footer');
        if (siteFooter) siteFooter.style.display = 'none';

        // Reset retry mode e domande errate ogni volta che parte un nuovo quiz normale
        inRepeatFrequentErrorsMode = false;
        retryMode = false;
        originalWrongAnswers = [];
        const selectedCount = parseInt(questionCountSelect.value);
        
        if (selectedCount === 15) {
            totalTimeAllowed = 30 * 60;
        } else if (selectedCount === 30) {
            totalTimeAllowed = 45 * 60;
        } else if (selectedCount === 5) {
            totalTimeAllowed = 10 * 60;
        } else if (selectedCount === 10) {
            totalTimeAllowed = 20 * 60;
        } else if (selectedCount === 20) {
            totalTimeAllowed = 40 * 60;
        } else {
            totalTimeAllowed = 0;
        }
        
        totalQuestions = selectedCount > 0 ? Math.min(selectedCount, questions.length) : questions.length;
        shuffledQuestions = shuffleArray(questions).slice(0, totalQuestions);
        // Salva le domande ORIGINALI usate in questo quiz (non mescolate)
        localStorage.setItem("lastQuizQuestions", JSON.stringify(shuffledQuestions));
        localStorage.setItem("lastQuizSubject", currentSubject);
        localStorage.setItem("lastQuizCount", totalQuestions);
        
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        quizStartTime = Date.now();
        timeLeft = totalTimeAllowed;
        
        if (userDashboard) userDashboard.style.display = "none";
        if (quizScreen) quizScreen.style.display = "block";
        if (resultsScreen) resultsScreen.style.display = "none";
        
        // Nascondi quiz-settings e footer
        const quizSettings = document.querySelector('.quiz-settings');
        if (quizSettings) quizSettings.style.display = 'none';
        
        if (document.querySelector('.quiz-timer')) {
            document.querySelector('.quiz-timer').style.display = totalTimeAllowed > 0 ? 'flex' : 'none';
        }
        
        if (totalTimeAllowed > 0) {
            startQuizTimer();
        }
        
        showQuestion();
    });
}

function startQuizTimer() {
    clearInterval(quizTimerInterval);
    if (timeRemaining) timeRemaining.textContent = formatTime(timeLeft);
    
    quizTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeRemaining) timeRemaining.textContent = formatTime(timeLeft);
        
        if (timeLeft <= 0) {
            clearInterval(quizTimerInterval);
            handleQuizTimeOut();
        }
    }, 1000);
}

function handleQuizTimeOut() {
    currentQuestionIndex = totalQuestions;
    showResults();
}

function updateCorrectCounter() {
    const counter = document.getElementById('correct-counter');
    if (counter) {
        counter.textContent = `${score}/${totalQuestions}`;
    }
}

function clearExplainDock() {
  const dock = document.getElementById('explainDock');
  if (dock) dock.innerHTML = "";
  const whyBtn = document.getElementById('whyBtn');
  if (whyBtn) {
    whyBtn.textContent = "Perché?";
    whyBtn.style.display = "none";
    whyBtn.disabled = false;
    whyBtn.classList.remove("loading");
  }
}

function showQuestion() {
    resetState();
    clearExplainDock();
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    
    const progressPercent = ((currentQuestionIndex) / totalQuestions) * 100;
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `Domanda ${currentQuestionIndex + 1} di ${totalQuestions}`;
    
    // Aggiorna il punteggio corrente
    updateCurrentScore();
    updateCorrectCounter();

    if (questionText) questionText.textContent = `${currentQuestionIndex + 1}. ${currentQuestion.question}`;
    
    if (imageContainer) {
        imageContainer.innerHTML = "";
        if (currentQuestion.image) {
            const img = document.createElement("img");
            img.src = currentQuestion.image;
            img.alt = "Illustrazione domanda";
            img.classList.add("question-image");
            imageContainer.appendChild(img);
        }
    }

    const shuffledAnswers = shuffleArray([...currentQuestion.answers]);
    if (answerButtons) {
        shuffledAnswers.forEach(answer => {
            const button = document.createElement("button");
            button.classList.add("answer-btn");
            
            if (answer.text) {
                button.innerHTML = `<span class="answer-text">${answer.text}</span>`;
            } else if (answer.image) {
                button.innerHTML = `<span class="answer-text"><img src="${answer.image}" class="answer-image"></span>`;
            }
            
            if (answer.correct) {
                button.dataset.correct = answer.correct;
            }
            
            button.addEventListener("click", selectAnswer);
            answerButtons.appendChild(button);
        });
    }
}

// Aggiorna il punteggio corrente
function updateCurrentScore() {
    const percentage = Math.round((score / totalQuestions) * 100);
    const scoreElement = document.getElementById('current-score');
    if (scoreElement) {
        scoreElement.textContent = `${percentage}% (${score}/${totalQuestions})`;
    }
}

function resetState() {
    if (nextButton) nextButton.disabled = true;
    if (answerButtons) {
        while (answerButtons.firstChild) {
            answerButtons.removeChild(answerButtons.firstChild);
        }
    }
    if (imageContainer) imageContainer.innerHTML = "";
}

function toggleDetailedResults() {
    const detailedResults = document.getElementById('detailed-results');
    const viewResultsBtn = document.getElementById('view-results-btn');
    
    if (detailedResults.style.display === 'none') {
        showDetailedResults();
        detailedResults.style.display = 'block';
        viewResultsBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Nascondi Risultati';
    } else {
        detailedResults.style.display = 'none';
        viewResultsBtn.innerHTML = '<i class="fas fa-eye"></i> Vedi Risultati';
    }
}

function showDetailedResults() {
    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';
    
    console.log("UserAnswers:", userAnswers);
    console.log("Total questions:", totalQuestions);
    console.log("Shuffled questions:", shuffledQuestions);
    
    if (userAnswers.length === 0) {
        resultsList.innerHTML = `
            <div class="no-results-message">
                <i class="fas fa-info-circle"></i>
                <p>Nessun dato disponibile per la visualizzazione dettagliata.</p>
            </div>
        `;
        return;
    }
    
    let hasContent = false;
    
    for (let i = 0; i < totalQuestions; i++) {
        const userAnswer = userAnswers[i];
        const question = shuffledQuestions[i];
        
        console.log(`Domanda ${i}:`, question);
        console.log(`Risposta utente ${i}:`, userAnswer);
        
        if (!question) continue;
        
        hasContent = true;
        const correctAnswer = question.answers.find(a => a.correct);
        const correctAnswerText = correctAnswer?.text || '';
        const correctAnswerImage = correctAnswer?.image || '';
        
        // Trova la risposta selezionata dall'utente
        const userSelectedAnswer = userAnswer ? userAnswer.userAnswer : 'Nessuna risposta';
        const isCorrect = userAnswer ? userAnswer.isCorrect : false;
        
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${isCorrect ? 'correct' : 'wrong'}`;
        
        resultItem.innerHTML = `
            <div class="result-item-header">
                <span class="result-status ${isCorrect ? 'correct' : 'wrong'}">
                    ${isCorrect ? '✓' : '✗'}
                </span>
                <span class="result-question">${i + 1}. ${question.question}</span>
            </div>
            
            ${question.image ? `<img src="${question.image}" class="result-image" alt="Domanda">` : ''}
            
            <!-- Mostra la risposta dell'utente -->
            <div class="user-answer ${isCorrect ? 'user-correct' : 'user-wrong'}">
                <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                <div>
                    <strong>La tua risposta:</strong>
                    <div>${userSelectedAnswer}</div>
                </div>
            </div>
            
            ${!isCorrect ? `
                <!-- Mostra la risposta corretta solo se sbagliata -->
                <div class="result-correct-answer">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <strong>Risposta corretta:</strong>
                        ${correctAnswerImage ? `<div><img src="${correctAnswerImage}" class="answer-image" alt="Risposta corretta"></div>` : ''}
                        ${correctAnswerText ? `<div>${correctAnswerText}</div>` : ''}
                    </div>
                </div>
            ` : ''}
        `;
        
        resultsList.appendChild(resultItem);
    }
    
    if (!hasContent) {
        resultsList.innerHTML = `
            <div class="no-results-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Impossibile caricare i dettagli delle risposte.</p>
            </div>
        `;
    }
}

function selectAnswer(e) {
  const selectedBtn = e.target.closest('.answer-btn');
  if (!selectedBtn) return;

  const isCorrect = selectedBtn.dataset.correct === "true";
  const currentQuestion = shuffledQuestions[currentQuestionIndex];

  // DEBUG
  console.log("Domanda corrente:", currentQuestion.question);
  console.log("Risposta selezionata:", selectedBtn.textContent);
  console.log("È corretta?", isCorrect);

  // Trova la risposta corretta
  const correctAnswer = currentQuestion.answers.find(a => a.correct);
  const correctAnswerText = correctAnswer?.text || '';
  const correctAnswerImage = correctAnswer?.image || '';

  // Salva risposta utente
  const userAnswerText = selectedBtn.querySelector('.answer-text')?.textContent?.trim() || selectedBtn.textContent.trim();
  userAnswers[currentQuestionIndex] = {
    question: currentQuestion.question,
    questionImage: currentQuestion.image || '',
    userAnswer: userAnswerText,
    isCorrect: isCorrect,
    correctAnswerText: correctAnswerText,
    correctAnswerImage: correctAnswerImage
  };
  console.log("Risposta salvata:", userAnswers[currentQuestionIndex]);

  // Tracking errori
  if (!isCorrect) {
    if (!wrongAnswers.some(q => q.question === currentQuestion.question)) wrongAnswers.push(currentQuestion);
  }

  if (isCorrect) {
    selectedBtn.classList.add("correct");
    score++;
    if (frequentErrorsBySubject[currentSubject]) {
      frequentErrorsBySubject[currentSubject] =
        frequentErrorsBySubject[currentSubject].filter(q => q.question !== currentQuestion.question);
      localStorage.setItem("frequentErrorsBySubject", JSON.stringify(frequentErrorsBySubject));
    }
  } else {
    selectedBtn.classList.add("incorrect");
  }

  if (!isCorrect) {
    if (!errorFrequencyBySubject[currentSubject]) errorFrequencyBySubject[currentSubject] = {};
    if (!frequentErrorsBySubject[currentSubject]) frequentErrorsBySubject[currentSubject] = [];

    errorFrequencyBySubject[currentSubject][currentQuestion.question] =
      (errorFrequencyBySubject[currentSubject][currentQuestion.question] || 0) + 1;

    if (errorFrequencyBySubject[currentSubject][currentQuestion.question] > 2 &&
        !frequentErrorsBySubject[currentSubject].some(q => q.question === currentQuestion.question)) {
      frequentErrorsBySubject[currentSubject].push(currentQuestion);
    }

    localStorage.setItem("errorFrequencyBySubject", JSON.stringify(errorFrequencyBySubject));
    localStorage.setItem("frequentErrorsBySubject", JSON.stringify(frequentErrorsBySubject));
    updateFrequentErrorsCounter();
  }

  updateCurrentScore();

  // Disabilita pulsanti risposta e mostra la corretta
  if (answerButtons) {
    Array.from(answerButtons.children).forEach(button => {
      if (button.dataset.correct === "true") button.classList.add("correct");
      button.disabled = true;
    });
  }

  if (nextButton) nextButton.disabled = false;
  if (isCorrect) {
    frequentErrors = frequentErrors.filter(q => q.question !== currentQuestion.question);
    updateFrequentErrorsCounter();
  }

  // ====== INTEGRAZIONE "PERCHÉ?" ======
  const dock = document.getElementById('explainDock'); // box esterno ai bottoni
  let whyBtn = document.getElementById('whyBtn');

  // Sempre azzera il dock al cambio risposta
  if (dock) dock.innerHTML = "";

  if (!isCorrect) {
    // crea/mostra il bottone vicino ad "Avanti", ma il box va nel dock
    if (!whyBtn) {
      whyBtn = document.createElement("button");
      whyBtn.id = "whyBtn";
      whyBtn.className = "why-btn";
      whyBtn.textContent = "Perché?";
      nextButton.insertAdjacentElement("afterend", whyBtn);
    } else {
      whyBtn.className = "why-btn";
      whyBtn.style.display = "inline-flex";
      whyBtn.disabled = false;
      whyBtn.textContent = "Perché?";
    }

    // resetta eventuali vecchi listener
    whyBtn.replaceWith(whyBtn.cloneNode(true));
    whyBtn = document.getElementById("whyBtn");

    // click handler
    whyBtn.addEventListener("click", async () => {
        if (!dock) return;

        const open = dock.querySelector('#whyResponse');
        if (open && open.dataset.qid === String(currentQuestionIndex)) {
            dock.innerHTML = "";
            whyBtn.textContent = "Perché?";
            return;
        }

        dock.innerHTML = "";
        const box = document.createElement("div");
        box.id = "whyResponse";
        box.className = "ai-explanation";
        box.dataset.qid = String(currentQuestionIndex);
        box.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Generazione...</span></div>`;
        dock.appendChild(box);

        whyBtn.disabled = true;
        whyBtn.classList.add("loading");
        whyBtn.textContent = "Carico...";

        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 9000);

        try {
            const res = await fetch("/.netlify/functions/askGemini", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                question: currentQuestion.question,
                userAnswer: userAnswerText,
                correctAnswer: correctAnswerText
            }),
            signal: ctrl.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            // spiegazione: HTML già pronto con link
            const html = data?.html || '';
            const text = data?.text || 'Spiegazione non disponibile.';
            box.innerHTML = `
            <h5>Spiegazione</h5>
            <div>${html || String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
            `;

            // fonti: <a> cliccabili
            const src = Array.isArray(data?.sources) ? data.sources : [];
            if (src.length) {
            const wrap = document.createElement('div');
            wrap.className = 'ai-sources';
            wrap.innerHTML = '<h6>Fonti</h6>';
            const ul = document.createElement('ul');

            src.forEach((s, i) => {
                const li = document.createElement('li');
                li.append(document.createTextNode(`[${i+1}] `));
                const a = document.createElement('a');
                a.href = s.uri;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = s.title || s.uri;
                li.appendChild(a);
                ul.appendChild(li);
            });

            wrap.appendChild(ul);
            box.appendChild(wrap);
            }

            whyBtn.textContent = "Nascondi";
        } catch (err) {
            box.innerHTML = `<h5>Errore</h5><p>${err.name === "AbortError" ? "Tempo scaduto, riprova." : err.message}</p>`;
            whyBtn.textContent = "Riprova";
        } finally {
            clearTimeout(to);
            whyBtn.disabled = false;
            whyBtn.classList.remove("loading");
        }
    });

  } else {
    // risposta corretta: nascondi bottone e pulisci dock
    if (whyBtn) { whyBtn.style.display = "none"; whyBtn.replaceWith(whyBtn); }
    if (dock) dock.innerHTML = "";
  }
}



const repeatFrequentErrorsBtn = document.getElementById('repeat-frequent-errors-btn');
if (repeatFrequentErrorsBtn) {
    repeatFrequentErrorsBtn.addEventListener('click', repeatFrequentErrors);
    
}

function repeatFrequentErrors() {
    // Controllo aggiuntivo per sicurezza
    const subjectErrors = frequentErrorsBySubject[currentSubject] || {};
    const errorCount = Object.keys(subjectErrors).length;
    
    if (errorCount === 0) {
        alert("Non ci sono errori frequenti da ripetere per questa materia!");
        return;
    }

    const subjectErrorsArray = frequentErrorsBySubject[currentSubject] || [];

    if (subjectErrorsArray.length === 0) {
        alert("Non ci sono errori frequenti da ripetere per questa materia!");
        return;
    }
    inRepeatFrequentErrorsMode = true;
    shuffledQuestions = [...subjectErrorsArray];
    totalQuestions = shuffledQuestions.length;
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    retryMode = true;
    quizStartTime = Date.now();
    totalTimeAllowed = 0;

    if (userDashboard) userDashboard.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "none";
    if (quizScreen) quizScreen.style.display = "block";

    if (document.querySelector('.quiz-timer')) {
        document.querySelector('.quiz-timer').style.display = 'none';
    }

    showQuestion();
}
function updateFrequentErrorsCounter() {
    const repeatBtn = document.getElementById('repeat-frequent-errors-btn');
    if (!repeatBtn) return;

    const subjectErrors = frequentErrorsBySubject[currentSubject];
    // supporta sia array che object (compatibilità)
    const errorCount = Array.isArray(subjectErrors)
        ? subjectErrors.length
        : (subjectErrors ? Object.keys(subjectErrors).length : 0);

    let counterBadge = repeatBtn.querySelector('.error-counter-badge');
    repeatBtn.classList.remove('enabled', 'disabled');

    if (errorCount > 0) {
        repeatBtn.style.transition = 'all 0.8s ease-in-out';

        if (!counterBadge) {
            counterBadge = document.createElement('span');
            counterBadge.className = 'error-counter-badge';
            repeatBtn.appendChild(counterBadge);
        } else {
            counterBadge.classList.remove('fade-out');
        }
        counterBadge.textContent = errorCount;

        repeatBtn.classList.add('enabled');
        repeatBtn.removeAttribute('disabled');
    } else {
        repeatBtn.style.transition = 'all 0.8s ease-in-out';
        if (counterBadge) {
            counterBadge.classList.add('fade-out');
            setTimeout(() => {
                if (counterBadge && counterBadge.parentNode) counterBadge.remove();
            }, 400);
        }
        repeatBtn.classList.add('disabled');
        repeatBtn.removeAttribute('disabled');
    }
}

function showResults() {
    clearInterval(quizTimerInterval);
    
    const timeSpent = Math.floor((Date.now() - quizStartTime) / 1000);
    const percentage = Math.round((score / totalQuestions) * 100);
    
    // DEBUG: Verifica cosa c'è nelle userAnswers prima di resettare
    console.log("UserAnswers prima del reset:", userAnswers);
    console.log("Score:", score, "Total:", totalQuestions);
    
    if (retryMode) {
        originalWrongAnswers = [...wrongAnswers];
    } else {
        originalWrongAnswers = [...wrongAnswers];
    }
    
    if (scorePercentage) scorePercentage.textContent = `${percentage}%`;
    if (scoreText) scoreText.textContent = getResultText(percentage);
    if (correctAnswers) correctAnswers.textContent = score;
    if (wrongAnswersElement) wrongAnswersElement.textContent = totalQuestions - score;
    if (timeTaken) timeTaken.textContent = formatTime(timeSpent);
    
    // Nascondi la sezione dettagliata quando mostri i risultati
    const detailedResults = document.getElementById('detailed-results');
    const viewResultsBtn = document.getElementById('view-results-btn');
    if (detailedResults) detailedResults.style.display = 'none';
    if (viewResultsBtn) viewResultsBtn.innerHTML = '<i class="fas fa-eye"></i> Vedi Risultati';
    
    if (currentUser) {
        const userData = usersDB[currentUser];
        const quizResult = {
            date: new Date().toISOString(),
            score: percentage,
            totalQuestions: totalQuestions,
            wrongAnswers: wrongAnswers,
            timeSpent: timeSpent,
            isRetry: retryMode,
            subject: currentSubject,
            channel: currentChannel,
            userAnswers: userAnswers // Salva anche le risposte utente
        };
        
        userData.quizHistory.push(quizResult);
        localStorage.setItem('quizUsers', JSON.stringify(usersDB));
        updateUserDashboard();
        
    }
    
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "block";
        const repeatSameQuizBtn = document.getElementById("repeat-same-quiz-btn");
    if (repeatSameQuizBtn) {
        // se siamo nella modalità "ripeti errori frequenti" non mostrare il bottone
        repeatSameQuizBtn.style.display = inRepeatFrequentErrorsMode ? "none" : "";
    }

    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "block";
    
    
    // NON resettare userAnswers qui - devono rimanere per la visualizzazione
    // userAnswers = []; // RIMOSSO - le risposte servono per "Vedi Risultati"
}

function nextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < totalQuestions) {
        showQuestion();
    } else {
        showResults();
    }
    clearExplainDock();
}

function retryWrongQuestions() {
    inRepeatFrequentErrorsMode = false;
    if (originalWrongAnswers.length === 0) {
        alert('Non ci sono domande da ripetere!');
        return;
    }
    
    shuffledQuestions = [...originalWrongAnswers];
    totalQuestions = shuffledQuestions.length;
    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = [];
    retryMode = true;
    quizStartTime = Date.now();
    totalTimeAllowed = 0;
    
    if (resultsScreen) resultsScreen.style.display = "none";
    if (quizScreen) quizScreen.style.display = "block";
    
    if (document.querySelector('.quiz-timer')) {
        document.querySelector('.quiz-timer').style.display = 'none';
    }
    
    showQuestion();
}


function backToDashboard() {
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "none";
    if (userDashboard) userDashboard.style.display = "block";
}

function backToDashboard2() {
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "none";
    if (userDashboard) userDashboard.style.display = "block";
}

// Aggiungi questa funzione per tornare alla dashboard della materia
function backToSubjectDashboard() {
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "none";
    if (userDashboard) userDashboard.style.display = "block";
    subjectDashboard.style.display = "block";

    // Mostra le impostazioni quiz quando si torna alla dashboard della materia
    const quizSettings = document.querySelector('.quiz-settings');
    if (quizSettings && currentSubject && hasQuestions(currentSubject)) {
        quizSettings.style.display = 'block';
    } else if (quizSettings) {
        quizSettings.style.display = 'none';
    }
    
    // Aggiorna le statistiche
    updateSubjectDashboard();

    // Mostra footer quando torni alla dashboard
    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) siteFooter.style.display = 'block';
}

// Event listeners
if (startQuizBtn) {
    startQuizBtn.addEventListener("click", function() {
        if (!currentSubject) {
            alert('Per favore seleziona prima una materia');
            return;
        }
        startQuiz();
    });
}

if (nextButton) {
    nextButton.addEventListener("click", nextQuestion);
}

if (retryWrongBtn) {
    retryWrongBtn.addEventListener("click", retryWrongQuestions);
}


if (repeatSameQuizBtn) {
  repeatSameQuizBtn.addEventListener("click", repeatSameQuiz);
}

function repeatSameQuiz() {
    // 1) Preferisci l'ultimo quiz completo salvato in localStorage
    const savedQuestions = JSON.parse(localStorage.getItem("lastQuizQuestions") || "[]");
    const savedSubject = localStorage.getItem("lastQuizSubject");
    const savedCount = parseInt(localStorage.getItem("lastQuizCount") || "0");

    if (Array.isArray(savedQuestions) && savedQuestions.length > 0 && savedSubject) {
        currentSubject = savedSubject;
        questions = [...savedQuestions];
        // Mescola l'ordine ma usa le stesse domande
        shuffledQuestions = shuffleArray([...savedQuestions]).slice(0, savedCount || savedQuestions.length);
        totalQuestions = savedCount || shuffledQuestions.length;

        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        inRepeatFrequentErrorsMode = false;
        retryMode = false;
        timeLeft = 0;

        if (resultsScreen) resultsScreen.style.display = "none";
        if (quizScreen) quizScreen.style.display = "block";
        showQuestion();
        return;
    }

    // 2) Se non ci sono savedQuestions, ma siamo in retryMode ripeti l'insieme corrente
    if (retryMode && Array.isArray(shuffledQuestions) && shuffledQuestions.length > 0) {
        shuffledQuestions = shuffleArray(shuffledQuestions);
        totalQuestions = shuffledQuestions.length;
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        timeLeft = 0;

        if (resultsScreen) resultsScreen.style.display = "none";
        if (quizScreen) quizScreen.style.display = "block";
        showQuestion();
        return;
    }

    // 3) Altrimenti, se ci sono errori frequenti per la materia corrente, ripetili
    const subjectErrorsArray = frequentErrorsBySubject[currentSubject] || [];
    if (Array.isArray(subjectErrorsArray) && subjectErrorsArray.length > 0) {
        shuffledQuestions = shuffleArray([...subjectErrorsArray]);
        questions = [...subjectErrorsArray];
        totalQuestions = shuffledQuestions.length;
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        retryMode = true;
        timeLeft = 0;

        if (resultsScreen) resultsScreen.style.display = "none";
        if (quizScreen) quizScreen.style.display = "block";
        showQuestion();
        return;
    }

    // 4) Nessun fallback disponibile
    alert("Nessun quiz precedente da ripetere");
}

async function askGemini({ question, userAnswer, correctAnswer }) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch("/.netlify/functions/askGemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, userAnswer, correctAnswer }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Timeout");
    throw e;
  } finally {
    clearTimeout(to);
  }
}



if (newQuizBtn) {
    newQuizBtn.addEventListener("click", () => {
        if (resultsScreen) resultsScreen.style.display = "none";
        const selectedCount = questionCountSelect.value;
        if (retryMode) {
            retryMode = false;
            questionCountSelect.value = selectedCount;
        }
        // Avvia immediatamente un nuovo quiz con lo stesso numero di domande
        startQuiz();
    });
}

if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener("click", backToSubjectDashboard);
}

if (backToDashboardBtn2) {
    backToDashboardBtn2.addEventListener("click", backToSubjectDashboard);
}

//  QUESTO EVENT LISTENER PER IL PULSANTE "TORNA ALLA SELEZIONE MATERIA"
document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'back-to-subjects') {
        noQuizMessage.style.display = 'none';
        subjectSection.style.display = 'block';
        // Scorri fino alla sezione materia
        subjectSection.scrollIntoView({ behavior: 'smooth' });
    }
});
document.addEventListener('DOMContentLoaded', function() {
    const tooltipContainers = document.querySelectorAll('.tooltip-container');
    
    tooltipContainers.forEach(container => {
        // Per dispositivi touch
        container.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) { // Solo su mobile
                e.preventDefault();
                e.stopPropagation();
                
                // Chiudi altri tooltip aperti
                tooltipContainers.forEach(other => {
                    if (other !== container) {
                        other.classList.remove('active');
                    }
                });
                
                // Apri/chiudi questo tooltip
                container.classList.toggle('active');
            }
        });
        
        // Chiudi tooltip quando si clicca altrove (solo su mobile)
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && !container.contains(e.target)) {
                container.classList.remove('active');
            }
        });
        
        // Per desktop - hover normale
        container.addEventListener('mouseenter', function() {
            if (window.innerWidth > 768) {
                container.classList.add('active');
            }
        });
        
        container.addEventListener('mouseleave', function() {
            if (window.innerWidth > 768) {
                container.classList.remove('active');
            }
        });
    });
});

// QUESTO EVENT LISTENER PER TORNARE AI CANALI
const backToChannelsBtn = document.getElementById('back-to-channels');
if (backToChannelsBtn) {
    backToChannelsBtn.addEventListener('click', () => {
        // NASCONDI TUTTO della dashboard materia
        subjectDashboard.style.display = 'none';
        noQuizMessage.style.display = 'none';
        
        // NASCONDI IMPOSTAZIONI QUIZ
        const quizSettings = document.querySelector('.quiz-settings');
        if (quizSettings) quizSettings.style.display = 'none';
        
        // MOSTRA DI NUOVO LA SEZIONE CANALE E MATERIE
        const channelSection = document.querySelector('.channel-section');
        if (channelSection) channelSection.style.display = 'block';
        subjectSection.style.display = 'block';
        
        // RESETTA la materia corrente
        currentSubject = null;
        
        // RIPRISTINA la vista normale
        restoreDashboardView();
        
        // Assicurati che il footer sia visibile
        const siteFooter = document.querySelector('.site-footer');
        if (siteFooter) siteFooter.style.display = 'block';
    });
}

// Modifica il logout
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        currentUser = null;
        localStorage.removeItem('lastUser');
        clearSavedCredentials();
        showAuthScreen();
        if (userDashboard) userDashboard.style.display = "none";
        if (quizScreen) quizScreen.style.display = "none";
        if (resultsScreen) resultsScreen.style.display = "none";
        
        const quizSettings = document.querySelector('.quiz-settings');
        if (quizSettings) quizSettings.style.display = 'none';
        
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        if (usernameInput) usernameInput.value = '';
        if (passwordInput) passwordInput.value = '';
    });
}

function setupBackButtonHandler() {
    // Inserisci 3 stati fittizi in history all'avvio
    window.history.pushState({ page: "block" }, "", window.location.href);
    window.history.pushState({ page: "active" }, "", window.location.href);
    window.history.pushState({ page: "active" }, "", window.location.href);

    window.addEventListener("popstate", function (event) {
        console.log("Tasto indietro premuto");

        // Re-inserisci lo stato fittizio subito
        if (!event.state || event.state.page !== "active") {
            window.history.pushState({ page: "active" }, "", window.location.href);
        }

        // La tua logica di navigazione
        if (quizScreen && quizScreen.style.display === "block") {
            backToSubjectDashboard();
        } else if (resultsScreen && resultsScreen.style.display === "block") {
            backToSubjectDashboard2();
        } else if (subjectDashboard && subjectDashboard.style.display === "block") {
            // Da subject-dashboard → user-dashboard
            subjectDashboard.style.display = "none";
            if (userDashboard) userDashboard.style.display = "block";

            // Nascondi impostazioni quiz
            const quizSettings = document.querySelector(".quiz-settings");
            if (quizSettings) quizSettings.style.display = "none";

            const channelSection = document.querySelector(".channel-section");
            if (channelSection) channelSection.style.display = "block";
        } else if (subjectSection && subjectSection.style.display === "block") {
            subjectSection.style.display = "none";
            if (userDashboard) userDashboard.style.display = "block";
            const channelSection = document.querySelector(".channel-section");
            if (channelSection) channelSection.style.display = "block";
        } else if (noQuizMessage && noQuizMessage.style.display === "block") {
            const backToSubjectsBtn = document.getElementById("back-to-subjects");
            if (backToSubjectsBtn) backToSubjectsBtn.click();
        } else if (authScreen && authScreen.style.display === "flex") {
            console.log("Sei nella schermata di login");
             // Se sei nella schermata di login e il prossimo back sarebbe fuori dal sito
            if (window.history.length <= 2) { // solo 1 pagina precedente
                if (confirm("Vuoi davvero uscire dal sito?")) {
                    window.history.back(); // esci davvero
                } else {
                    window.history.pushState({ page: "active" }, "", window.location.href); // rimani
                }
            }
        } else {
            if (userDashboard) userDashboard.style.display = "block";
            if (quizScreen) quizScreen.style.display = "none";
            if (resultsScreen) resultsScreen.style.display = "none";
            if (subjectSection) subjectSection.style.display = "none";
            if (subjectDashboard) subjectDashboard.style.display = "none";
            if (noQuizMessage) noQuizMessage.style.display = "none";

            const channelSection = document.querySelector(".channel-section");
            if (channelSection) channelSection.style.display = "block";

            const quizSettings = document.querySelector(".quiz-settings");
            if (quizSettings) quizSettings.style.display = "none";
        }
    });
}

document.addEventListener("DOMContentLoaded", setupBackButtonHandler);


// Debug
console.log("Materia selezionata:", currentSubject);
console.log("Dati utente:", usersDB[currentUser]);