// quiz-system.js - Sistema completo dei quiz

// Variabili globali per il conteggio delle risposte corrette e totali
let correctAnsweredIndexes = [];
let totalAnswered = 0;
let errorFrequencyBySubject = {};   // { subject: { "testo domanda": numero errori } }
let frequentErrorsBySubject = {};   // { subject: [array domande] }
let userAnswers = [];
let lastQuizType = localStorage.getItem("lastQuizType") || null; // 'full' | 'frequentErrors' | 'retryWrong'
let inRepeatFrequentErrorsMode = false;

// Variabile globale per le domande correnti
let questions = [];

// Mappa dei file delle domande per ogni materia
const subjectQuestionFiles = {
    'politica': 'domande/domandepoleco.js',
    'organizzazione': 'domande/domandeorganizzazione.js',
    'eoi': 'domande/domandeeoi.js',
    'empi': 'domande/domandeempi.js',
    'ecopol': 'domande/domandeecopol.js',
    'privatoad': 'domande/domandeprivatoad.js',
    'dirittoprivato': 'domande/domandedirittoprivato.js',
    
};

// DOM Elements
const channelCards = document.querySelectorAll('.channel-card');
const subjectSection = document.getElementById('subject-section');
const subjectCards = document.querySelectorAll('.subject-card');
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
const retryWrongBtn = document.getElementById('retry-wrong-btn');
const newQuizBtn = document.getElementById('new-quiz-btn');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const backToDashboardBtn2 = document.getElementById('back-to-dashboard-btn2');
const repeatSameQuizBtn = document.getElementById('repeat-same-quiz-btn');

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

// Nomi completi delle materie
const subjectNames = {
    politica: "Politica Economica",
    eoi: "Economia e Organizzazione Industriale",
    empi: "Energie, Materie Prime e Innovazione",
    organizzazione: "Organizzazione Aziendale",
    ecopol: "Economia Politica",
    privatoad: "Diritto Privato" 
};

// Canali e materie
const channelSubjects = {
    'A-D': ['politica', 'eoi', 'empi', 'organizzazione', 'ecopol', 'privatoad'],
    'E-M': ['politica', 'eoi', 'empi', 'organizzazione', 'ecopol', 'dirittoprivato'],
    'N-Z': ['politica', 'eoi', 'empi', 'organizzazione', 'ecopol']
};

// Inizializzazione
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

    // Pulsante per tornare ai canali dalla sezione materie
    const backToChannelsFromSubjects = document.getElementById('back-to-channels-from-subjects');
    if (backToChannelsFromSubjects) {
        backToChannelsFromSubjects.addEventListener('click', () => {
            subjectSection.style.display = 'none';
            const channelSection = document.querySelector('.channel-section');
            if (channelSection) channelSection.style.display = 'block';
            currentChannel = null;
        });
    }

    // Setup event listeners
    setupQuizEventListeners();
    setupSubjectNavigation();
});

function setupQuizEventListeners() {
    if (startQuizBtn) {
        startQuizBtn.addEventListener("click", startQuiz);
    }

    if (nextButton) {
        nextButton.addEventListener("click", nextQuestion);
    }

    if (retryWrongBtn) {
        retryWrongBtn.addEventListener("click", retryWrongQuestions);
    }

    if (newQuizBtn) {
        newQuizBtn.addEventListener("click", () => {
            if (resultsScreen) resultsScreen.style.display = "none";
            const selectedCount = questionCountSelect.value;
            if (retryMode) {
                retryMode = false;
                questionCountSelect.value = selectedCount;
            }
            startQuiz();
        });
    }

    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener("click", backToSubjectDashboard);
    }
    if (backToDashboardBtn2) {
        backToDashboardBtn2.addEventListener("click", backToSubjectDashboard);
    }

    // Ripeti stesso quiz (se presente nel DOM)
    if (repeatSameQuizBtn) {
        repeatSameQuizBtn.addEventListener('click', repeatSameQuiz);
    }

    // Pulsante per tornare ai canali
    const backToChannelsBtn = document.getElementById('back-to-channels');
    if (backToChannelsBtn) {
        backToChannelsBtn.addEventListener('click', () => {
            subjectDashboard.style.display = 'none';
            noQuizMessage.style.display = 'none';
            
            const quizSettings = document.querySelector('.quiz-settings');
            if (quizSettings) quizSettings.style.display = 'none';
            
            const channelSection = document.querySelector('.channel-section');
            if (channelSection) channelSection.style.display = 'block';
            subjectSection.style.display = 'block';
            
            currentSubject = null;
            
            restoreDashboardView();
            
            const siteFooter = document.querySelector('.site-footer');
            if (siteFooter) siteFooter.style.display = 'block';
        });
    }
}

function setupSubjectNavigation() {
    // Gestione selezione canale
    channelCards.forEach(card => {
        card.addEventListener('click', () => {
            currentChannel = card.dataset.channel;
            
            subjectSection.style.display = 'block';
            noQuizMessage.style.display = 'none';
            
            filterSubjectsByChannel(currentChannel);
            subjectSection.scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Seleziona materia
    subjectCards.forEach(card => {
        card.addEventListener('click', () => {
            currentSubject = card.dataset.subject;
            const isOralSubject = card.dataset.type === 'flashcards' || card.dataset.type === 'study-method';

            // Se è una materia orale, gestiscila separatamente
            if (isOralSubject) {
                if (card.dataset.type === 'flashcards') {
                    openDirittoPrivatoFlashcards();
                } else if (card.dataset.type === 'study-method') {
                    openStudyMethod();
                }
                return;
            }
            
            handleSubjectSelection();
        });
    });
}

function handleSubjectSelection() {
    const channelSection = document.querySelector('.channel-section');
    if (channelSection) channelSection.style.display = 'none';
    
    if (!hasQuestions(currentSubject)) {
        subjectSection.style.display = 'none';
        subjectDashboard.style.display = 'block';
        noQuizMessage.style.display = 'block';
        
        showNoQuizMessage();
        return;
    }
    
    subjectSection.style.display = 'none';
    noQuizMessage.style.display = 'none';
    updateSubjectDashboard();
    subjectDashboard.style.display = 'block';

    const quizSettings = document.querySelector('.quiz-settings');
    if (quizSettings && hasQuestions(currentSubject)) {
        quizSettings.style.display = 'block';
    }
    
    subjectDashboard.scrollIntoView({ behavior: 'smooth' });
}

function showNoQuizMessage() {
    noQuizMessage.innerHTML = `
        <button id="back-to-subjects" class="back-arrow-btn" title="Torna indietro">
            <i class="fas fa-arrow-left"></i>
        </button>
        <div style="padding-left: 50px;">
            <i class="fas fa-info-circle"></i>
            <h3>Quiz non ancora disponibile</h3>
            <p>La materia <strong>${subjectNames[currentSubject] || currentSubject}</strong> non ha ancora quiz disponibili.</p>
            <p style="color: var(--text-light); font-size: 0.9rem;">
                Stiamo lavorando per aggiungere nuovi contenuti.
            </p>
        </div>
    `;
    
    setTimeout(() => {
        const backButton = document.getElementById('back-to-subjects');
        if (backButton) {
            backButton.addEventListener('click', () => {
                noQuizMessage.style.display = 'none';
                subjectSection.style.display = 'block';
                subjectDashboard.style.display = 'none';
                const quizSettings = document.querySelector('.quiz-settings');
                if (quizSettings) quizSettings.style.display = 'none';
                const channelSection = document.querySelector('.channel-section');
                if (channelSection) channelSection.style.display = 'block';
                currentSubject = null;
                restoreDashboardView();
            });
        }
    }, 100);
}

function filterSubjectsByChannel(channel) {
    const subjectsForChannel = channelSubjects[channel] || [];

     const currentChannelDisplay = document.getElementById('current-channel-display');
     if (currentChannelDisplay) {
         currentChannelDisplay.textContent = channel;
     }
    
    subjectCards.forEach(card => {
        card.style.display = 'none';
    });
    
    subjectsForChannel.forEach(subject => {
        const subjectCard = document.querySelector(`.subject-card[data-subject="${subject}"]`);
        if (subjectCard) {
            subjectCard.style.display = 'block';
            
            const channelBadge = subjectCard.querySelector('.channel-badge');
            if (channelBadge) {
                channelBadge.textContent = `Canale ${channel}`;
            }
        }
    });
    
    updateCategoryTitles(channel);
}

function updateCategoryTitles(channel) {
    const categoryTitles = document.querySelectorAll('[data-channel-title="true"]');
    categoryTitles.forEach(title => {
        const originalText = title.textContent;
        const cleanText = originalText.replace(/ - Canale [A-Z]-[A-Z]/, '');
        title.textContent = `${cleanText} - Canale ${channel}`;
    });
}

function hasQuestions(subject) {
    return Object.keys(subjectQuestionFiles).includes(subject);
}

function loadQuestionsForSubject(subject, callback) {
    const scriptFile = subjectQuestionFiles[subject];
    
    if (!scriptFile) {
        console.error('Nessun file domande trovato per la materia:', subject);
        if (callback) callback([]);
        return;
    }
    
    const oldScript = document.getElementById('current-question-script');
    if (oldScript) {
        document.head.removeChild(oldScript);
    }
    
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

function updateSubjectDashboard() {
    if (!currentUser || !currentSubject) return;
    
    const userData = usersDB[currentUser];
    const subjectHistory = userData.quizHistory.filter(quiz => 
        quiz.subject === currentSubject && !quiz.isRetry
    );
    
    const allSubjectQuizzes = userData.quizHistory.filter(quiz => 
        quiz.subject === currentSubject
    );
    
    if (currentSubjectName) {
        currentSubjectName.textContent = subjectNames[currentSubject] || currentSubject;
    }
    
    if (currentSubjectBadge) {
        currentSubjectBadge.textContent = `Canale ${currentChannel}`;
    }
    
    if (completedQuizzes) {
        completedQuizzes.textContent = subjectHistory.length;
    }
    
    const avg = subjectHistory.length > 0 
        ? Math.round(subjectHistory.reduce((sum, quiz) => sum + quiz.score, 0) / subjectHistory.length)
        : 0;
    if (averageScore) averageScore.textContent = `${avg}%`;
    
    const best = subjectHistory.length > 0
        ? Math.max(...subjectHistory.map(quiz => quiz.score))
        : 0;
    if (bestScore) bestScore.textContent = `${best}%`;
    
    updateFrequentErrorsCounter();
    
    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) {
        siteFooter.style.display = 'block';
    }
}

function startQuiz() {
    if (!currentSubject || !hasQuestions(currentSubject)) {
        alert('Quiz non disponibile per questa materia');
        return;
    }
    
    loadQuestionsForSubject(currentSubject, function(loadedQuestions) {
        if (loadedQuestions.length === 0) {
            alert('Nessuna domanda disponibile per questa materia');
            return;
        }
        
        questions = loadedQuestions;
        
        const siteFooter = document.querySelector('.site-footer');
        if (siteFooter) siteFooter.style.display = 'none';

        retryMode = false;
        originalWrongAnswers = [];
        const selectedCount = parseInt(questionCountSelect.value);
        
        // Tempo consentito in base al numero di domande
        // Richiesta: 20 domande -> 40 minuti
        if (selectedCount === 20) {
            totalTimeAllowed = 40 * 60; // 40 minuti
        } else if (selectedCount === 30) {
            totalTimeAllowed = 45 * 60; // compatibilità (se presente nelle opzioni)
        } else if (selectedCount === 15) {
            totalTimeAllowed = 30 * 60; // compatibilità legacy
        } else {
            totalTimeAllowed = 0; // senza tempo
        }
        
        totalQuestions = selectedCount > 0 ? Math.min(selectedCount, questions.length) : questions.length;
        shuffledQuestions = shuffleArray(questions).slice(0, totalQuestions);
        // Memorizza l'ultimo quiz per poterlo ripetere identico (stesso set di domande)
        try {
            localStorage.setItem("lastQuizQuestions", JSON.stringify(shuffledQuestions));
            localStorage.setItem("lastQuizSubject", currentSubject);
            localStorage.setItem("lastQuizCount", String(totalQuestions));
            localStorage.setItem("lastQuizType", "full");
        } catch {}
        
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        quizStartTime = Date.now();
        timeLeft = totalTimeAllowed;
        
        if (userDashboard) userDashboard.style.display = "none";
        if (quizScreen) quizScreen.style.display = "block";
        if (resultsScreen) resultsScreen.style.display = "none";
        
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

function showQuestion() {
    resetState();
    ensureExplainDock();
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    
    const progressPercent = ((currentQuestionIndex) / totalQuestions) * 100;
    if (progressFill) progressFill.style.width = `${progressPercent}%`;
    if (progressText) progressText.textContent = `Domanda ${currentQuestionIndex + 1} di ${totalQuestions}`;
    
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

function updateCurrentScore() {
    const percentage = Math.round((score / totalQuestions) * 100);
    const scoreElement = document.getElementById('current-score');
    if (scoreElement) {
        scoreElement.textContent = `${percentage}% (${score}/${totalQuestions})`;
    }
}

// Animazione del punteggio
const quizScore = document.querySelector('.quiz-score');
if (quizScore) {
    quizScore.classList.add('score-update');
    setTimeout(() => {
        quizScore.classList.remove('score-update');
    }, 600);
}

function resetState() {
    if (nextButton) nextButton.disabled = true;
    if (answerButtons) {
        while (answerButtons.firstChild) {
            answerButtons.removeChild(answerButtons.firstChild);
        }
    }
    if (imageContainer) imageContainer.innerHTML = "";
    clearExplainDock();
    hideWhyBtn();
}

// Spiegazione inline durante il quiz
function ensureExplainDock() {
    const quizContent = document.querySelector('.quiz-content');
    if (!quizContent) return;
    let dock = document.getElementById('explainDock');
    if (!dock) {
        dock = document.createElement('div');
        dock.id = 'explainDock';
        dock.className = 'ai-explanation';
        quizContent.appendChild(dock);
    } else {
        dock.innerHTML = '';
    }
}

function clearExplainDock() {
    const dock = document.getElementById('explainDock');
    if (dock) dock.innerHTML = '';
}

function showWhyBtn(ctx) {
    let whyBtn = document.getElementById('whyBtn');
    if (!whyBtn) {
        whyBtn = document.createElement('button');
        whyBtn.id = 'whyBtn';
        whyBtn.className = 'why-btn';
        whyBtn.innerHTML = '<i class="fas fa-lightbulb"></i> Perché?';
        if (nextButton) nextButton.insertAdjacentElement('afterend', whyBtn);
    } else {
        whyBtn.className = 'why-btn';
        whyBtn.style.display = 'inline-flex';
        whyBtn.disabled = false;
        whyBtn.textContent = 'Perché?';
    }

    // reset listeners
    const newBtn = whyBtn.cloneNode(true);
    whyBtn.replaceWith(newBtn);

    newBtn.addEventListener('click', async () => {
        const dock = document.getElementById('explainDock');
        if (!dock) return;
        // toggle
        const open = dock.querySelector('#whyResponse');
        if (open) {
            dock.innerHTML = '';
            newBtn.textContent = 'Perché?';
            return;
        }
        dock.innerHTML = '<div id="whyResponse" class="ai-explanation"><div class="loading-spinner"><div class="spinner"></div><span>Generazione...</span></div></div>';
        newBtn.disabled = true;
        newBtn.classList.add('loading');
        newBtn.textContent = 'Carico...';
        try {
            const data = await (window.askAIExplanation ? window.askAIExplanation(ctx) : Promise.resolve({ text: 'Spiegazione non disponibile.' }));
            const html = data?.html || '';
            const text = data?.text || 'Spiegazione non disponibile.';
            const sources = Array.isArray(data?.sources) ? data.sources : [];
            const box = document.getElementById('whyResponse');
            if (box) {
                box.innerHTML = `<h5>Spiegazione</h5><div>${html || escapeHtml(text)}</div>`;
                if (sources.length) {
                    const ul = document.createElement('ul');
                    ul.className = 'ai-sources-list';
                    sources.forEach((s, i) => {
                        const li = document.createElement('li');
                        const a = document.createElement('a');
                        a.href = s.uri || '#';
                        a.textContent = s.title || s.uri || `Fonte ${i + 1}`;
                        a.target = '_blank';
                        a.rel = 'noopener';
                        li.appendChild(document.createTextNode(`[${i + 1}] `));
                        li.appendChild(a);
                        ul.appendChild(li);
                    });
                    const wrap = document.createElement('div');
                    wrap.className = 'ai-sources';
                    const h = document.createElement('h6');
                    h.textContent = 'Fonti';
                    wrap.appendChild(h);
                    wrap.appendChild(ul);
                    box.appendChild(wrap);
                }
            }
            newBtn.textContent = 'Nascondi';
        } catch (err) {
            const box = document.getElementById('whyResponse');
            if (box) box.innerHTML = `<h5>Errore</h5><p>${escapeHtml(err && err.message || 'Errore')}</p>`;
            newBtn.textContent = 'Riprova';
        } finally {
            newBtn.disabled = false;
            newBtn.classList.remove('loading');
        }
    });
}

function hideWhyBtn() {
    const whyBtn = document.getElementById('whyBtn');
    if (whyBtn) {
        whyBtn.style.display = 'none';
    }
}

function selectAnswer(e) {
    const selectedBtn = e.target.closest('.answer-btn');
    if (!selectedBtn) return;
    
    const isCorrect = selectedBtn.dataset.correct === "true";
    const currentQuestion = shuffledQuestions[currentQuestionIndex];
    
    const correctAnswer = currentQuestion.answers.find(a => a.correct);
    const correctAnswerText = correctAnswer?.text || '';
    const correctAnswerImage = correctAnswer?.image || '';
    
    userAnswers[currentQuestionIndex] = {
        question: currentQuestion.question,
        questionImage: currentQuestion.image || '',
        userAnswer: selectedBtn.querySelector('.answer-text')?.textContent?.trim() || selectedBtn.textContent.trim(),
        isCorrect: isCorrect,
        correctAnswerText: correctAnswerText,
        correctAnswerImage: correctAnswerImage
    };
    
    if (!isCorrect) {
        if (!wrongAnswers.some(q => q.question === currentQuestion.question)) {
            wrongAnswers.push(currentQuestion);
        }
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
        if (!errorFrequencyBySubject[currentSubject]) {
            errorFrequencyBySubject[currentSubject] = {};
        }
        if (!frequentErrorsBySubject[currentSubject]) {
            frequentErrorsBySubject[currentSubject] = [];
        }

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

    if (answerButtons) {
        Array.from(answerButtons.children).forEach(button => {
            if (button.dataset.correct === "true") {
                button.classList.add("correct");
            }
            button.disabled = true;
        });
    }

    if (nextButton) nextButton.disabled = false;
    // Mostra tasto "Perché?" solo se la risposta è errata
    if (!isCorrect) {
        showWhyBtn({
            question: currentQuestion.question,
            userAnswer: selectedBtn.querySelector('.answer-text')?.textContent?.trim() || selectedBtn.textContent.trim(),
            correctAnswer: correctAnswerText,
            subject: (typeof subjectNames !== 'undefined' ? subjectNames[currentSubject] : currentSubject) || currentSubject
        });
    } else {
        hideWhyBtn();
        clearExplainDock();
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < totalQuestions) {
        showQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    clearInterval(quizTimerInterval);
    
    const timeSpent = Math.floor((Date.now() - quizStartTime) / 1000);
    const percentage = Math.round((score / totalQuestions) * 100);
    
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
            userAnswers: userAnswers
        };
        
        userData.quizHistory.push(quizResult);
        localStorage.setItem('quizUsers', JSON.stringify(usersDB));
        updateUserDashboard();
    }
    
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "block";
    // Mostra/nascondi "Ripeti stesso quiz" se presente
    const rsq = document.getElementById('repeat-same-quiz-btn');
    if (rsq) {
        rsq.style.display = inRepeatFrequentErrorsMode ? 'none' : '';
    }
    // Mostra il pulsante "Continua blocco di sessione" SOLO per i risultati della Sessione progressiva
    const pcInlineBtn = document.getElementById('pc-continue-inline-btn');
    if (pcInlineBtn) {
        const lastType = (localStorage.getItem('lastQuizType') || '');
        const lastSubj = (localStorage.getItem('lastQuizSubject') || '');
        const pcCtx = (localStorage.getItem('pc_session_context') || '');
        const isProgressiveContext = (lastType === 'progressive') || (lastType === 'retryWrong' && pcCtx && pcCtx === lastSubj);
        pcInlineBtn.style.display = isProgressiveContext ? '' : 'none';
        if (isProgressiveContext) {
            // bind handler once
            pcInlineBtn.onclick = () => {
                try { continueProgressChallenge(); } catch(e) { console.warn('[PC] continue inline error', e); }
            };
        }
    }
    // Nascondi "Nuovo Quiz" SOLO quando il risultato corrente proviene da una sessione progressiva
    const newQuiz = document.getElementById('new-quiz-btn');
    if (newQuiz) {
        const lastType = (localStorage.getItem('lastQuizType') || '');
        const lastSubj = (localStorage.getItem('lastQuizSubject') || '');
        const pcCtx = (localStorage.getItem('pc_session_context') || '');
        const isProgressiveContext = (lastType === 'progressive') || (lastType === 'retryWrong' && pcCtx && pcCtx === lastSubj);
        newQuiz.style.display = isProgressiveContext ? 'none' : '';
    }
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
    
    try { localStorage.setItem('lastQuizType', 'retryWrong'); } catch {}
    showQuestion();
}

function backToSubjectDashboard() {
    if (quizScreen) quizScreen.style.display = "none";
    if (resultsScreen) resultsScreen.style.display = "none";
    if (userDashboard) userDashboard.style.display = "block";
    subjectDashboard.style.display = "block";

    const quizSettings = document.querySelector('.quiz-settings');
    if (quizSettings && currentSubject && hasQuestions(currentSubject)) {
        quizSettings.style.display = 'block';
    } else if (quizSettings) {
        quizSettings.style.display = 'none';
    }
    
    updateSubjectDashboard();

    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) siteFooter.style.display = 'block';
}

function restoreDashboardView() {
    const dashboardHeader = document.querySelector('.subject-dashboard .dashboard-header');
    const dashboardContent = document.querySelector('.dashboard-content');
    if (dashboardHeader) dashboardHeader.style.display = 'block';
    if (dashboardContent) dashboardContent.style.display = 'block';
    noQuizMessage.style.display = 'none';
    
    const quizSettings = document.querySelector('.quiz-settings');
    if (quizSettings) quizSettings.style.display = 'none';
    
    const siteFooter = document.querySelector('.site-footer');
    if (siteFooter) siteFooter.style.display = 'block';
}

// Funzioni per errori frequenti
function repeatFrequentErrors() {
    inRepeatFrequentErrorsMode = true;
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

    try { localStorage.setItem("lastQuizType", "frequentErrors"); } catch {}
    showQuestion();
}

function updateFrequentErrorsCounter() {
    const repeatBtn = document.getElementById('repeat-frequent-errors-btn');
    if (!repeatBtn) return;
    // supporta sia array che object (compatibilità)
    const subjectErrors = frequentErrorsBySubject[currentSubject];
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
                if (counterBadge && counterBadge.parentNode) {
                    counterBadge.remove();
                }
            }, 400);
        }
        
        repeatBtn.classList.add('disabled');
        repeatBtn.removeAttribute('disabled');
    }
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
    if (!resultsList) {
        console.error('Element results-list non trovato');
        return;
    }
    
    resultsList.innerHTML = '';
    
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
        
        if (!question) continue;
        
        hasContent = true;
        const correctAnswer = question.answers.find(a => a.correct);
        const correctAnswerText = correctAnswer?.text || '';
        const correctAnswerImage = correctAnswer?.image || '';
        
        const userSelectedAnswer = userAnswer ? userAnswer.userAnswer : 'Nessuna risposta';
        const isCorrect = userAnswer ? userAnswer.isCorrect : false;
        
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${isCorrect ? 'correct' : 'wrong'}`;
        
        const explanationButton = !isCorrect ? `
            <button class="explanation-btn" onclick='openAIExplanation({
                question: ${JSON.stringify(question.question)},
                userAnswer: ${JSON.stringify(userSelectedAnswer)},
                correctAnswer: ${JSON.stringify(correctAnswerText)},
                subject: "${subjectNames[currentSubject] || currentSubject}",
                isExplanation: true
            })'>
                <i class="fas fa-lightbulb"></i> Chiedi Spiegazione all'AI
            </button>
        ` : '';
        
        resultItem.innerHTML = `
            <div class="result-item-header">
                <span class="result-status ${isCorrect ? 'correct' : 'wrong'}">
                    ${isCorrect ? '✓' : '✗'}
                </span>
                <span class="result-question">${i + 1}. ${question.question}</span>
            </div>
            
            ${question.image ? `<img src="${question.image}" class="result-image" alt="Domanda">` : ''}
            
            <div class="user-answer ${isCorrect ? 'user-correct' : 'user-wrong'}">
                <i class="fas ${isCorrect ? 'fa-check' : 'fa-times'}"></i>
                <div>
                    <strong>La tua risposta:</strong>
                    <div>${userSelectedAnswer}</div>
                </div>
            </div>
            
            ${!isCorrect ? `
                <div class="result-correct-answer">
                    <i class="fas fa-check-circle"></i>
                    <div>
                        <strong>Risposta corretta:</strong>
                        ${correctAnswerImage ? `<div><img src="${correctAnswerImage}" class="answer-image" alt="Risposta corretta"></div>` : ''}
                        ${correctAnswerText ? `<div>${correctAnswerText}</div>` : ''}
                    </div>
                </div>
                ${explanationButton}
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

// Utility functions
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

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

// Piccola utility per sanificare HTML inline nel dock
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Ripeti lo stesso quiz appena svolto, o fallback su retry/frequent errors
function repeatSameQuiz() {
    const savedQuestions = JSON.parse(localStorage.getItem('lastQuizQuestions') || '[]');
    const savedSubject = localStorage.getItem('lastQuizSubject');
    const savedCount = parseInt(localStorage.getItem('lastQuizCount') || '0');

    if (Array.isArray(savedQuestions) && savedQuestions.length > 0 && savedSubject) {
        currentSubject = savedSubject;
        questions = [...savedQuestions];
        shuffledQuestions = shuffleArray([...savedQuestions]).slice(0, savedCount || savedQuestions.length);
        totalQuestions = savedCount || shuffledQuestions.length;

        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        inRepeatFrequentErrorsMode = false;
        retryMode = false;
        timeLeft = 0;
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (quizScreen) quizScreen.style.display = 'block';
        showQuestion();
        return;
    }

    if (retryMode && Array.isArray(shuffledQuestions) && shuffledQuestions.length > 0) {
        shuffledQuestions = shuffleArray(shuffledQuestions);
        totalQuestions = shuffledQuestions.length;
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        timeLeft = 0;
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (quizScreen) quizScreen.style.display = 'block';
        showQuestion();
        return;
    }

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
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (quizScreen) quizScreen.style.display = 'block';
        showQuestion();
        return;
    }

    alert('Nessun quiz precedente da ripetere');
}

// ===================== Progressive Challenge (PC) =====================
// Implementazione non invasiva: nuove funzioni, nessuna modifica alle funzioni core
(function(){
    const PC_VERSION = 'v1';
    const PC_STATS_VERSION = 'v1';
    const pcQuestionsCache = {}; // { subject: [questions] }
    const pc = {
        active: false,
        subject: null,
        blockSize: 0,
        currentBlockIndexes: [],
        pendingCommit: false
    };

    function pcKey(subject){ return `pc_state_${PC_VERSION}_${subject}`; }

    function pcDefaultState(subject, total){
        const indexes = Array.from({length: total}, (_, i) => i);
        return {
            subject,
            total,
            remainingIndexes: indexes,
            completed: 0,
            lastBlock: 0,
            updatedAt: null
        };
    }

    function pcLoadState(subject, total){
        let state = null;
        try { state = JSON.parse(localStorage.getItem(pcKey(subject)) || 'null'); } catch{}
        if (!state || typeof state !== 'object' || state.total !== total) {
            state = pcDefaultState(subject, total);
            pcSaveState(subject, state);
        } else {
            // normalizza
            if (!Array.isArray(state.remainingIndexes)) state.remainingIndexes = [];
            state.completed = Math.max(0, state.total - state.remainingIndexes.length);
        }
        return state;
    }

    function pcSaveState(subject, state){
        state.updatedAt = new Date().toISOString();
        try { localStorage.setItem(pcKey(subject), JSON.stringify(state)); } catch {}
    }

    function pcResetState(subject, total){
        const state = pcDefaultState(subject, total);
        pcSaveState(subject, state);
        return state;
    }

    function pcEnsureQuestions(subject, cb){
        if (pcQuestionsCache[subject]) { cb(pcQuestionsCache[subject]); return; }
        if (!hasQuestions(subject)) { cb([]); return; }
        loadQuestionsForSubject(subject, function(qs){
            const arr = Array.isArray(qs) ? qs.slice() : [];
            pcQuestionsCache[subject] = arr;
            cb(arr);
        });
    }

    // === Stats cumulative per sessione progressiva ===
    function pcStatsKey(subject){ return `pc_stats_${PC_STATS_VERSION}_${subject}`; }
    function pcLoadStats(subject){
        try {
            const raw = localStorage.getItem(pcStatsKey(subject));
            if (!raw) return { totalCorrect: 0, totalWrong: 0, blocksCompleted: 0, updatedAt: null };
            const obj = JSON.parse(raw);
            return {
                totalCorrect: obj.totalCorrect || 0,
                totalWrong: obj.totalWrong || 0,
                blocksCompleted: obj.blocksCompleted || 0,
                updatedAt: obj.updatedAt || null
            };
        } catch {
            return { totalCorrect: 0, totalWrong: 0, blocksCompleted: 0, updatedAt: null };
        }
    }
    function pcSaveStats(subject, stats){
        try {
            stats.updatedAt = new Date().toISOString();
            localStorage.setItem(pcStatsKey(subject), JSON.stringify(stats));
        } catch {}
    }
    function pcResetStats(subject){ pcSaveStats(subject, { totalCorrect: 0, totalWrong: 0, blocksCompleted: 0 }); }

    function pcUpdateIndicator(state){
        const el = document.getElementById('pc-remaining-indicator');
        if (!el) return;
        const rem = state.remainingIndexes.length;
        el.textContent = `Rimanenti: ${rem} / ${state.total}`;
    }

    function pcSetCustomInputBounds(state){
        const input = document.getElementById('pc-custom-input');
        if (!input) return;
        input.min = '1';
        input.max = String(Math.max(1, state.remainingIndexes.length));
        if (!input.value || Number(input.value) < 1) input.value = '1';
        if (Number(input.value) > state.remainingIndexes.length) input.value = String(state.remainingIndexes.length || 1);
    }

    function pcGetChosenBlockSize(){
        // Il personalizzato ha priorità se > 0
        const custom = document.getElementById('pc-custom-input');
        const vCustom = parseInt((custom && custom.value) || '0') || 0;
        if (vCustom > 0) return vCustom;
        // In alternativa usa il chip selezionato
        const selectedBtn = document.querySelector('.pc-box-btn.selected');
        if (selectedBtn) {
            const v = parseInt(selectedBtn.getAttribute('data-pc-size') || '0');
            if (Number.isFinite(v) && v > 0) return v;
        }
        return 5;
    }

    function pcSelectBox(size){
        document.querySelectorAll('.pc-box-btn').forEach(btn => btn.classList.remove('selected'));
        const target = document.querySelector(`.pc-box-btn[data-pc-size="${size}"]`);
        if (target) target.classList.add('selected');
        const input = document.getElementById('pc-custom-input');
        if (input) input.value = String(size);
    }

    function pcSample(array, n){
        // Fisher-Yates partial sample without replacement
        const a = array.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a.slice(0, n);
    }

    function beginQuizWithQuestions(blockQuestions){
        // replica minimale di startQuiz per avviare con un set definito
        retryMode = false;
        originalWrongAnswers = [];
        totalTimeAllowed = 0; // PC senza tempo
        totalQuestions = blockQuestions.length;
        shuffledQuestions = blockQuestions.slice();
        currentQuestionIndex = 0;
        score = 0;
        wrongAnswers = [];
        quizStartTime = Date.now();
        timeLeft = 0;

        try {
            localStorage.setItem("lastQuizQuestions", JSON.stringify(shuffledQuestions));
            localStorage.setItem("lastQuizSubject", currentSubject);
            localStorage.setItem("lastQuizCount", String(totalQuestions));
            localStorage.setItem("lastQuizType", "progressive");
            localStorage.setItem("pc_session_context", String(currentSubject || ''));
        } catch {}

        const siteFooter = document.querySelector('.site-footer');
        if (siteFooter) siteFooter.style.display = 'none';
        const quizSettings = document.querySelector('.quiz-settings');
        if (quizSettings) quizSettings.style.display = 'none';
        if (userDashboard) userDashboard.style.display = 'none';
        if (resultsScreen) resultsScreen.style.display = 'none';
        if (quizScreen) quizScreen.style.display = 'block';
        if (document.querySelector('.quiz-timer')) {
            document.querySelector('.quiz-timer').style.display = 'none';
        }
        showQuestion();
    }

    function startProgressiveChallenge(customSize){
        if (!currentSubject || !hasQuestions(currentSubject)) {
            alert('Seleziona una materia valida.');
            return;
        }
        pcEnsureQuestions(currentSubject, function(allQs){
            if (!allQs || allQs.length === 0) { alert('Nessuna domanda disponibile per questa materia'); return; }
            let state = pcLoadState(currentSubject, allQs.length);
            pcUpdateIndicator(state);
            pcSetCustomInputBounds(state);
            const available = state.remainingIndexes.length;
            let requestedRaw = (typeof customSize === 'number' ? customSize : pcGetChosenBlockSize());
            let requested = requestedRaw;
            if (!Number.isFinite(requested) || requested < 0) requested = 0;
            if (requested === 0) requested = available; // 0 = tutte le rimanenti
            requested = Math.max(1, requested);
            if (available <= 0) {
                pcShowCompletionModal(state);
                return;
            }
            const size = Math.min(requested, available);

            const chosen = pcSample(state.remainingIndexes, size);
            const blockQuestions = chosen.map(i => allQs[i]);

            pc.active = true;
            pc.subject = currentSubject;
            pc.blockSize = size;
            pc.currentBlockIndexes = chosen;
            pc.pendingCommit = true;
            // salva lastBlock scelto
            state.lastBlock = requested;
            pcSaveState(currentSubject, state);

            beginQuizWithQuestions(blockQuestions);
        });
    }

    function continueProgressChallenge(){
        if (!currentSubject || !hasQuestions(currentSubject)) { alert('Seleziona una materia valida.'); return; }
        pcEnsureQuestions(currentSubject, function(allQs){
            const state = pcLoadState(currentSubject, allQs.length);
            const next = state.lastBlock || 5;
            // Committa il blocco precedente prima di continuare
            pcCommitLastBlock();
            startProgressiveChallenge(next);
        });
    }

    function pcCommitLastBlock(){
        if (!pc.active || !pc.subject || !pc.pendingCommit) return;
        const subject = pc.subject;
        const used = pc.currentBlockIndexes || [];
        pcEnsureQuestions(subject, function(allQs){
            const state = pcLoadState(subject, allQs.length);
            if (used.length) {
                const usedSet = new Set(used);
                state.remainingIndexes = state.remainingIndexes.filter(i => !usedSet.has(i));
                state.completed = state.total - state.remainingIndexes.length;
                pcSaveState(subject, state);
                pcUpdateIndicator(state);
                pcSetCustomInputBounds(state);
            }
            pc.pendingCommit = false;
        });
    }

    function pcRenderResultsSummary(){
        // Mostra pannello progressivo nei risultati con valori cumulativi
        pcEnsureQuestions(currentSubject, function(allQs){
            const state = pcLoadState(currentSubject, allQs.length);
            const stats = pcLoadStats(currentSubject);
            const card = document.getElementById('pc-results-summary');
            if (!card) return;
            // Aggiorna valori
            const remEl = document.getElementById('pc-remaining-now');
            const totEl = document.getElementById('pc-total-questions');
            const blkC = document.getElementById('pc-block-correct'); // ora cumulativo
            const blkW = document.getElementById('pc-block-wrong');   // ora cumulativo
            const totComp = document.getElementById('pc-total-completed');
            const totRem = document.getElementById('pc-total-remaining');
            const totProg = document.getElementById('pc-total-progress');
            if (remEl) remEl.textContent = String(state.remainingIndexes.length);
            if (totEl) totEl.textContent = String(state.total);
            if (blkC) blkC.textContent = String(stats.totalCorrect || 0);
            if (blkW) blkW.textContent = String(stats.totalWrong || 0);
            if (totComp) totComp.textContent = String(state.total - state.remainingIndexes.length);
            if (totRem) totRem.textContent = String(state.remainingIndexes.length);
            if (totProg) {
                const pct = Math.round(((state.total - state.remainingIndexes.length) / (state.total || 1)) * 100);
                totProg.textContent = pct + '%';
            }
            card.style.display = 'block';

            // Toggle totale
            const toggleBtn = document.getElementById('pc-toggle-total-btn');
            const totalBox = document.getElementById('pc-total-stats');
            if (toggleBtn && totalBox) {
                toggleBtn.onclick = () => {
                    const open = totalBox.style.display !== 'none';
                    totalBox.style.display = open ? 'none' : 'flex';
                    toggleBtn.innerHTML = open
                      ? '<i class="fas fa-chart-pie"></i> Vedi progresso totale'
                      : '<i class="fas fa-eye-slash"></i> Nascondi progresso totale';
                };
            }
        });
    }

    function pcShowCompletionModal(state){
        const overlay = document.createElement('div');
        overlay.className = 'pc-overlay';
        overlay.innerHTML = `
            <div class="pc-modal">
                <h3><i class="fas fa-trophy"></i> Tutte le domande completate</h3>
                <p style="margin:8px 0 12px;">Hai terminato tutte le ${state.total} domande di questa materia.</p>
                <div class="pc-actions">
                    <button id="pc-reset-now" class="primary"><i class="fas fa-arrows-rotate"></i> Ripristina sessione</button>
                    <button id="pc-close-complete" class="secondary"><i class="fas fa-times"></i> Chiudi</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        function close(){ overlay.remove(); }
        overlay.querySelector('#pc-reset-now').addEventListener('click', () => {
            pcEnsureQuestions(currentSubject, function(allQs){
                const ns = pcResetState(currentSubject, allQs.length);
                pcUpdateIndicator(ns);
                pcSetCustomInputBounds(ns);
                close();
            });
        });
        overlay.querySelector('#pc-close-complete').addEventListener('click', close);
    }

    function pcInitUIEvents(){
        // Mode switch (fixed vs progressive)
        const modeButtons = document.querySelectorAll('.mode-switch .mode-btn');
        const fixedSection = document.getElementById('fixed-section');
        const pcSection = document.getElementById('pc-section');
        const MODE_KEY = 'quiz_mode';

        function applyMode(mode){
            modeButtons.forEach(b => {
                const isActive = b.getAttribute('data-mode') === mode;
                b.classList.toggle('active', isActive);
                b.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            if (fixedSection) fixedSection.style.display = (mode === 'fixed') ? 'block' : 'none';
            if (pcSection) pcSection.style.display = (mode === 'progressive') ? 'block' : 'none';
            try { localStorage.setItem(MODE_KEY, mode); } catch {}
        }

        const savedMode = (localStorage.getItem(MODE_KEY) || 'fixed');
        applyMode(savedMode);

        modeButtons.forEach(btn => btn.addEventListener('click', () => {
            const mode = btn.getAttribute('data-mode');
            applyMode(mode);
        }));

        // Avvio sessione fissa: svuota contesto progressivo
        const fixedStartBtn = document.getElementById('start-quiz-btn');
        if (fixedStartBtn) fixedStartBtn.addEventListener('click', () => {
            try { localStorage.removeItem('pc_session_context'); } catch {}
        });

        // Chips click (5/15/30/50)
        document.querySelectorAll('.pc-box-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.getAttribute('data-pc-size') || '0') || 0;
                pcSelectBox(size);
            });
        });
        const startBtn = document.getElementById('pc-start-btn');
        if (startBtn) startBtn.addEventListener('click', () => startProgressiveChallenge());

        const customInput = document.getElementById('pc-custom-input');
        if (customInput) customInput.addEventListener('input', () => {
            const v = parseInt(customInput.value || '0') || 1;
            if (v > parseInt(customInput.max || '1')) customInput.value = customInput.max;
            if (v < 1) customInput.value = '1';
        });

        const resetBtn = document.getElementById('pc-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            if (!currentSubject) return;
            pcEnsureQuestions(currentSubject, function(allQs){
                const conf = confirm('Vuoi davvero azzerare i progressi per questa materia?');
                if (!conf) return;
                const ns = pcResetState(currentSubject, allQs.length);
                pcUpdateIndicator(ns);
                pcSetCustomInputBounds(ns);
                pcResetStats(currentSubject);
            });
        });

        // Subject card hook to initialize per subject selection
        document.addEventListener('click', function(e){
            const card = e.target.closest && e.target.closest('.subject-card');
            if (!card) return;
            const subj = card.getAttribute('data-subject');
            const isOral = card.getAttribute('data-type') === 'flashcards' || card.getAttribute('data-type') === 'study-method';
            if (isOral) return;
            if (!subj) return;
            setTimeout(() => pcInitializeForSubject(subj), 50);
        }, true);

        // Se l'utente chiude il popup e torna alla dashboard dai risultati, conferma e committa il blocco
        const ensureCommitOnBack = (ev) => {
            const backBtn = ev?.target?.closest && ev.target.closest('#back-to-dashboard-btn, #back-to-dashboard-btn2');
            if (!backBtn) return;
            if (pc.active && pc.pendingCommit) {
                pcCommitLastBlock();
            }
        };
        document.addEventListener('click', ensureCommitOnBack, true);
    }

    function pcInitializeForSubject(subj){
        if (!hasQuestions(subj)) return;
        pcEnsureQuestions(subj, function(allQs){
            const state = pcLoadState(subj, allQs.length);
            pcUpdateIndicator(state);
            pcSetCustomInputBounds(state);
            // pre-seleziona ultimo blocco se presente
            const last = state.lastBlock || 5;
            pcSelectBox(last);
        });
    }

    function pcOnShowResults(){
        // Mostra il pannello progressivo SOLO se l'ultimo risultato appartiene alla sessione progressiva
        const lastType = localStorage.getItem('lastQuizType') || '';
        const lastSubj = localStorage.getItem('lastQuizSubject') || '';
        const pcCtx = localStorage.getItem('pc_session_context') || '';
        const isProgressiveResult = (lastType === 'progressive') || (lastType === 'retryWrong' && pcCtx && pcCtx === lastSubj);
        if (isProgressiveResult) {
            // Se l'ultimo risultato è un blocco progressivo vero e proprio, aggiorna le stats cumulative + commit
            if (lastType === 'progressive' && currentSubject) {
                if (pc.pendingCommit) pcCommitLastBlock();
                const s = pcLoadStats(currentSubject);
                s.totalCorrect = (s.totalCorrect || 0) + (score || 0);
                s.totalWrong = (s.totalWrong || 0) + Math.max(0, (totalQuestions || 0) - (score || 0));
                s.blocksCompleted = (s.blocksCompleted || 0) + 1;
                pcSaveStats(currentSubject, s);
            }
            pcRenderResultsSummary();
            return;
        }
        // Non progressiva: nascondi pannello
        const card = document.getElementById('pc-results-summary');
        if (card) card.style.display = 'none';
    }

    // Sovrascrivi showResults in modo non distruttivo per intercettare fine blocco
    try {
        const __origShowResults = showResults;
        showResults = function(){
            __origShowResults.apply(this, arguments);
            try { pcOnShowResults(); } catch(e) { console.warn('[PC] onShowResults error', e); }
        };
    } catch(e) { console.warn('[PC] override showResults fallita', e); }

    // Avvio init quando DOM pronto
    document.addEventListener('DOMContentLoaded', function(){
        pcInitUIEvents();
        // Se c'è già una materia corrente (rare), inizializza
        if (currentSubject) pcInitializeForSubject(currentSubject);
    });

    // Espone funzioni per debug opzionale
    window.startProgressiveChallenge = window.startProgressiveChallenge || startProgressiveChallenge;
    window.continueProgressChallenge = window.continueProgressChallenge || continueProgressChallenge;
    window.saveProgressState = window.saveProgressState || function(subject, state){ pcSaveState(subject, state); };
    window.loadProgressState = window.loadProgressState || function(subject, total){ return pcLoadState(subject, total); };
    window.isProgressiveActive = window.isProgressiveActive || function(){
        try {
            const subj = (typeof currentSubject !== 'undefined' && currentSubject) ? currentSubject : (localStorage.getItem('lastQuizSubject') || null);
            if (!subj) return false;
            const key = pcKey(subj);
            const raw = localStorage.getItem(key);
            if (!raw) return false;
            const state = JSON.parse(raw);
            return state && typeof state === 'object' && Array.isArray(state.remainingIndexes) && state.total > 0;
        } catch { return false; }
    };
    window.__pcDebug = { pcLoadState, pcSaveState, pcResetState };
})();
