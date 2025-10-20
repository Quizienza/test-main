
// Intervalli di tempo in millisecondi
const INTERVALS = {
    ONE_MINUTE: 1 * 60 * 1000,      // 1 minuto
    FIFTEEN_MINUTES: 15 * 60 * 1000, // 15 minuti
    ONE_HOUR: 60 * 60 * 1000,        // 1 ora
    ONE_DAY: 24 * 60 * 60 * 1000,    // 1 giorno
    THREE_DAYS: 3 * 24 * 60 * 60 * 1000, // 3 giorni
    SEVEN_DAYS: 7 * 24 * 60 * 60 * 1000  // 7 giorni
};

// Configurazione tipologie carte
const cardTypes = {
    BASIC: 'basic',
    REVERSIBLE: 'reversible',
    MULTIPLE_CHOICE: 'multiple_choice',
    IMAGE_OCLUSION: 'image_occlusion'
};

// Variabili globali flashcards
let dirittoPrivatoFlashcards = [];
let userCustomFlashcards = [];
let currentDeck = [];
let currentCardIndex = 0;
let sessionCards = [];
let isAnswerShown = false;
let sessionStartTime = null;
let sessionTimer = null;
let sessionCorrectAnswers = 0;
let currentStudyMode = 'new';
let studyOptions = {};
let flashcardSessionLimit = parseInt(localStorage.getItem('flashcardSessionLimit') || '20', 10);
if (Number.isNaN(flashcardSessionLimit)) {
    flashcardSessionLimit = 20;
}

// Variabili per il drag gesture
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let dragThreshold = 100; // pixel necessari per flip

// Storage keys per localStorage
const STORAGE_KEYS = {
    FLASHCARDS: 'quizienza_flashcards_data',
    USER_FLASHCARDS: 'quizienza_user_flashcards_data',
    PROGRESS: 'quizienza_flashcards_progress',
    SESSION: 'quizienza_flashcards_session',
    STATS: 'quizienza_flashcards_stats'
};

/** Persistenza "tasti rapidi" a livello utente+sezione **/
const KEYBOARD_HINT_BASEKEY = 'quizienza_keyboard_hint_shown';
function getKeyboardHintKey() {
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
    // sezione specifica: flashcards Diritto Privato
    return `${KEYBOARD_HINT_BASEKEY}_${user}_diritto_privato`;
}
function hasSeenKeyboardHint() {
    try { return localStorage.getItem(getKeyboardHintKey()) === 'true'; } catch { return false; }
}
function markKeyboardHintSeen() {
    try { localStorage.setItem(getKeyboardHintKey(), 'true'); } catch { }
}

function resetKeyboardHintSeen() {
    try { localStorage.removeItem(getKeyboardHintKey()); } catch { }
}

/** Persistenza "Tab hint" per modalità in scadenza (due/user_due) **/
const TAB_HINT_BASEKEY = 'quizienza_tab_hint_shown';
function getTabHintKey(mode) {
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
    const m = mode === 'user_due' ? 'user_due' : 'due';
    return `${TAB_HINT_BASEKEY}_${user}_diritto_privato_${m}`;
}
function hasSeenTabHint(mode) {
    try { return localStorage.getItem(getTabHintKey(mode)) === 'true'; } catch { return false; }
}
function markTabHintSeen(mode) {
    try { localStorage.setItem(getTabHintKey(mode), 'true'); } catch { }
}
function resetTabHintSeen() {
    try {
        const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
        localStorage.removeItem(`${TAB_HINT_BASEKEY}_${user}_diritto_privato_due`);
        localStorage.removeItem(`${TAB_HINT_BASEKEY}_${user}_diritto_privato_user_due`);
    } catch { }
}

// Persistenza "guida modalità" a livello utente+sezione
const MODES_HELP_BASEKEY = 'quizienza_modes_help_shown';
function getModesHelpKey() {
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
    return `${MODES_HELP_BASEKEY}_${user}_diritto_privato`;
}
function hasSeenModesHelp() {
    try { return localStorage.getItem(getModesHelpKey()) === 'true'; } catch { return false; }
}
function markModesHelpSeen() {
    try { localStorage.setItem(getModesHelpKey(), 'true'); } catch { }
}

let originalFlashcardsSnapshot = [];

function normalizeCard(card) {
    const normalized = { ...card };
    normalized.reviews = normalized.reviews || 0;
    normalized.ease = normalized.ease || 2.5;
    normalized.dueDate = normalized.dueDate
        ? (normalized.dueDate instanceof Date ? normalized.dueDate : new Date(normalized.dueDate))
        : null;
    normalized.lastReviewed = normalized.lastReviewed
        ? (normalized.lastReviewed instanceof Date ? normalized.lastReviewed : new Date(normalized.lastReviewed))
        : null;
    normalized.fromNewCardsCount = normalized.fromNewCardsCount || 0;
    normalized.isDifficult = Boolean(normalized.isDifficult);
    normalized.difficultAddedAt = normalized.difficultAddedAt || null;
    normalized.isUserCard = Boolean(normalized.isUserCard);
    normalized.doNotRepeat = Boolean(normalized.doNotRepeat);
    return normalized;
}

function resetCardState(card) {
    return normalizeCard({
        ...card,
        interval: 0,
        reviews: 0,
        ease: 2.5,
        dueDate: null,
        lastReviewed: null,
        streak: 0,
        fromNewCardsCount: 0,
        isDifficult: false,
        difficultAddedAt: null,
        doNotRepeat: false
    });
}

function captureOriginalSnapshot(cards) {
    if (!Array.isArray(cards) || cards.length === 0) {
        return;
    }

    if (!originalFlashcardsSnapshot.length || cards.length >= originalFlashcardsSnapshot.length) {
        originalFlashcardsSnapshot = cards.map(resetCardState);
    }
}

// Inizializza il sistema flashcards
function initializeFlashcardSystem() {
    loadUserFlashcards();
    loadLegacyFlashcardProgress();
    loadFlashcardProgress();
    dirittoPrivatoFlashcards = dirittoPrivatoFlashcards.map(normalizeCard);
    setupFlashcardEventListeners();
    startRealTimeUpdates();
}

// Carica le flashcard utente
function loadUserFlashcards() {
    try {
        const savedUserFlashcards = localStorage.getItem(STORAGE_KEYS.USER_FLASHCARDS);
        if (savedUserFlashcards) {
            userCustomFlashcards = JSON.parse(savedUserFlashcards).map(normalizeCard);
            console.log('Flashcard utente caricate:', userCustomFlashcards.length, 'carte');
        }
    } catch (error) {
        console.warn('Errore nel caricamento delle flashcard utente:', error);
        userCustomFlashcards = [];
    }
}

// Salva le flashcard utente
function saveUserFlashcards() {
    try {
        const userFlashcardsData = {
            cards: userCustomFlashcards.map(card => ({
                id: card.id,
                front: card.front,
                back: card.back,
                interval: card.interval || 0,
                reviews: card.reviews || 0,
                ease: card.ease || 2.5,
                dueDate: card.dueDate || null,
                lastReviewed: card.lastReviewed || null,
                streak: card.streak || 0,
                difficultCount: card.difficultCount || 0,
                isDifficult: card.isDifficult || false,
                fromNewCardsCount: card.fromNewCardsCount || 0,
                difficultAddedAt: card.difficultAddedAt || null,
                isUserCard: true,
                doNotRepeat: !!card.doNotRepeat
            })),
            lastSave: new Date().toISOString(),
            version: '2.0',
            username: currentUser
        };

        localStorage.setItem(STORAGE_KEYS.USER_FLASHCARDS, JSON.stringify(userFlashcardsData));
        console.log('✅ Flashcard utente salvate:', userFlashcardsData.cards.length, 'carte');
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio flashcard utente:', error);
        return false;
    }
}

// Carica il progresso legacy (vecchio formato)
function loadLegacyFlashcardProgress() {
    try {
        const savedProgress = localStorage.getItem('flashcardProgress');
        if (savedProgress) {
            const progress = JSON.parse(savedProgress);
            dirittoPrivatoFlashcards = (progress.cards || dirittoPrivatoFlashcards).map(normalizeCard);
            console.log('Progresso flashcards caricato:', progress.cards?.length || 0, 'carte');
            saveFlashcardProgress();
            localStorage.removeItem('flashcardProgress');
        }
    } catch (error) {
        console.warn('Errore nel caricamento del progresso flashcards:', error);
        // Non carichiamo le default qui, aspettiamo il caricamento dal file esterno
    }
}

// ===================== //
// SISTEMA DI STORAGE AVANZATO //
// ===================== //

function saveFlashcardProgress() {
    try {
        // Combina flashcard predefinite e utente
        const allFlashcards = [...dirittoPrivatoFlashcards, ...userCustomFlashcards];

        const progressData = {
            cards: allFlashcards.map(card => ({
                id: card.id,
                front: card.front,
                back: card.back,
                interval: card.interval || 0,
                reviews: card.reviews || 0,
                ease: card.ease || 2.5,
                dueDate: card.dueDate || null,
                lastReviewed: card.lastReviewed || null,
                streak: card.streak || 0,
                difficultCount: card.difficultCount || 0,
                isDifficult: card.isDifficult || false,
                fromNewCardsCount: card.fromNewCardsCount || 0,
                difficultAddedAt: card.difficultAddedAt || null,
                isUserCard: card.isUserCard || false,
                doNotRepeat: !!card.doNotRepeat
            })),
            lastSave: new Date().toISOString(),
            version: '2.0',
            username: currentUser
        };

        localStorage.setItem(STORAGE_KEYS.FLASHCARDS, JSON.stringify(progressData));
        console.log('✅ Progresso flashcards salvato:', progressData.cards.length, 'carte');
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio flashcards:', error);
        return false;
    }
}

function loadFlashcardProgress() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEYS.FLASHCARDS);

        if (savedData) {
            const progressData = JSON.parse(savedData);

            if (progressData.username === currentUser) {
                const allCards = progressData.cards.map(normalizeCard);
                // Separa le carte predefinite da quelle utente
                dirittoPrivatoFlashcards = allCards.filter(card => !card.isUserCard);
                userCustomFlashcards = allCards.filter(card => card.isUserCard);

                console.log('✅ Progresso caricato:', dirittoPrivatoFlashcards.length, 'carte predefinite,', userCustomFlashcards.length, 'carte utente');
                return true;
            }
        }

        console.log('ℹ️ Nessun progresso trovato, caricherò flashcards dal file esterno');
        return false;
    } catch (error) {
        console.error('❌ Errore caricamento flashcards:', error);
        return false;
    }
}

function saveSessionState() {
    try {
        const sessionData = {
            mode: currentStudyMode,
            cardIndex: currentCardIndex,
            cardsInSession: sessionCards.map(card => card.id),
            startTime: sessionStartTime,
            correctAnswers: sessionCorrectAnswers,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio sessione:', error);
        return false;
    }
}

function loadSessionState() {
    try {
        const savedSession = localStorage.getItem(STORAGE_KEYS.SESSION);

        if (savedSession) {
            const sessionData = JSON.parse(savedSession);

            const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
            if (sessionAge < 24 * 60 * 60 * 1000) {
                return sessionData;
            }
        }

        return null;
    } catch (error) {
        console.error('❌ Errore caricamento sessione:', error);
        return null;
    }
}

function clearSessionState() {
    try {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        return true;
    } catch (error) {
        console.error('❌ Errore cancellazione sessione:', error);
        return false;
    }
}

function saveFlashcardStats(stats) {
    try {
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify({
            ...stats,
            lastUpdate: new Date().toISOString(),
            username: currentUser
        }));
        return true;
    } catch (error) {
        console.error('❌ Errore salvataggio statistiche:', error);
        return false;
    }
}

function loadFlashcardStats() {
    try {
        const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);

        if (savedStats) {
            const stats = JSON.parse(savedStats);
            if (stats.username === currentUser) {
                return stats;
            }
        }

        return null;
    } catch (error) {
        console.error('❌ Errore caricamento statistiche:', error);
        return null;
    }
}

// ===================== //
// GESTIONE FLASHCARD UTENTE //
// ===================== //

function showAddFlashcardModal() {
    const modalHTML = `
        <div class="modal-overlay" id="add-flashcard-modal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Aggiungi Nuova Flashcard</h3>
                    <button class="close-modal-btn" onclick="closeAddFlashcardModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="new-flashcard-front">Domanda</label>
                        <textarea id="new-flashcard-front" rows="3" placeholder="Inserisci la domanda..." class="form-textarea"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="new-flashcard-back">Risposta</label>
                        <textarea id="new-flashcard-back" rows="3" placeholder="Inserisci la risposta..." class="form-textarea"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="secondary-btn" onclick="closeAddFlashcardModal()">
                        <i class="fas fa-times"></i> Annulla
                    </button>
                    <button class="primary-btn" onclick="addNewFlashcard()">
                        <i class="fas fa-save"></i> Salva Flashcard
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Focus sul primo campo
    setTimeout(() => {
        document.getElementById('new-flashcard-front').focus();
    }, 100);
}

function closeAddFlashcardModal() {
    const modal = document.getElementById('add-flashcard-modal');
    if (modal) {
        modal.remove();
    }
}

function addNewFlashcard() {
    const front = document.getElementById('new-flashcard-front').value.trim();
    const back = document.getElementById('new-flashcard-back').value.trim();

    if (!front || !back) {
        showNotification('Inserisci sia la domanda che la risposta!', 'error');
        return;
    }

    const newCard = {
        id: 'user_' + Date.now(),
        front: front,
        back: back,
        isUserCard: true,
        interval: 0,
        reviews: 0,
        ease: 2.5,
        dueDate: null, // Nessuna scadenza iniziale
        lastReviewed: null,
        streak: 0,
        fromNewCardsCount: 0, // Contatore per diventare difficile
        isDifficult: false,   // Non difficile inizialmente
        difficultAddedAt: null,
        doNotRepeat: false
    };

    userCustomFlashcards.push(normalizeCard(newCard));
    saveUserFlashcards();
    saveFlashcardProgress();

    showNotification('Flashcard aggiunta con successo!', 'success');
    closeAddFlashcardModal();

    // Aggiorna l'interfaccia in tempo reale
    updateModeCounters();
    updateGlobalStats();

    console.log('🆕 Nuova flashcard utente creata - Posizione: Le tue Flashcard');
}

function showManageFlashcardsModal() {
    const modalHTML = `
        <div class="modal-overlay" id="manage-flashcards-modal">
            <div class="modal-container large-modal">
                <div class="modal-header">
                    <h3><i class="fas fa-cog"></i> Gestisci le tue Flashcard</h3>
                    <button class="close-modal-btn" onclick="closeManageFlashcardsModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="user-flashcards-section">
                        <div class="section-header">
                            <h4>Le tue Flashcard Personalizzate</h4>
                            <button class="primary-btn small-btn" onclick="showAddFlashcardModal()">
                                <i class="fas fa-plus"></i> Aggiungi Nuova
                            </button>
                        </div>
                        <div class="user-flashcards-list" id="user-flashcards-list">
                            ${generateUserFlashcardsList()}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="primary-btn" onclick="closeManageFlashcardsModal()">
                        <i class="fas fa-check"></i> Chiudi
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeManageFlashcardsModal() {
    const modal = document.getElementById('manage-flashcards-modal');
    if (modal) {
        modal.remove();
    }
}

// Accesso rapido alla gestione/creazione delle carte utente
function openUserCardsPanel() {
    try {
        // Se esiste già il modale di gestione, non duplicarlo
        if (!document.getElementById('manage-flashcards-modal')) {
            showManageFlashcardsModal();
        }
        // Porta in primo piano e, se la lista è vuota, invita a creare
        setTimeout(() => {
            const list = document.getElementById('user-flashcards-list');
            if (!list || list.children.length === 0) {
                // Apri direttamente la creazione se non ci sono carte
                try { showAddFlashcardModal(); } catch(_) {}
            }
        }, 150);
    } catch(e) { console.warn('openUserCardsPanel failed:', e); }
}

function generateUserFlashcardsList() {
    if (userCustomFlashcards.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Non hai ancora creato nessuna flashcard personalizzata</p>
                <button class="primary-btn" onclick="showAddFlashcardModal()">
                    <i class="fas fa-plus"></i> Crea la tua prima flashcard
                </button>
            </div>
        `;
    }

    return userCustomFlashcards.map((card, index) => `
        <div class="user-flashcard-item">
            <div class="flashcard-preview">
                <div class="preview-front">
                    <strong>D:</strong> ${card.front.substring(0, 100)}${card.front.length > 100 ? '...' : ''}
                </div>
                <div class="preview-back">
                    <strong>R:</strong> ${card.back.substring(0, 100)}${card.back.length > 100 ? '...' : ''}
                </div>
            </div>
            <div class="flashcard-actions">
                <button class="icon-btn edit-btn" onclick="editUserFlashcard('${card.id}')" title="Modifica">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn delete-btn" onclick="deleteFlashcard('${card.id}', true)" title="Elimina">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function generateDefaultFlashcardsList() {
    if (dirittoPrivatoFlashcards.length === 0) {
        return `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>Nessuna flashcard predefinita disponibile</p>
            </div>
        `;
    }

    return dirittoPrivatoFlashcards.map((card, index) => `
        <div class="default-flashcard-item">
            <div class="flashcard-preview">
                <div class="preview-front">
                    <strong>D:</strong> ${card.front.substring(0, 100)}${card.front.length > 100 ? '...' : ''}
                </div>
                <div class="preview-back">
                    <strong>R:</strong> ${card.back.substring(0, 100)}${card.back.length > 100 ? '...' : ''}
                </div>
            </div>
            <div class="flashcard-actions">
                <button class="icon-btn delete-btn" onclick="deleteFlashcard('${card.id}', false)" title="Elimina">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function editUserFlashcard(cardId) {
    const card = userCustomFlashcards.find(c => c.id === cardId);
    if (!card) return;

    const modalHTML = `
        <div class="modal-overlay" id="edit-flashcard-modal">
            <div class="modal-container">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Modifica Flashcard</h3>
                    <button class="close-modal-btn" onclick="closeEditFlashcardModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="edit-flashcard-front">Domanda</label>
                        <textarea id="edit-flashcard-front" rows="3" class="form-textarea">${card.front}</textarea>
                    </div>
                    <div class="form-group">
                        <label for="edit-flashcard-back">Risposta</label>
                        <textarea id="edit-flashcard-back" rows="3" class="form-textarea">${card.back}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="secondary-btn" onclick="closeEditFlashcardModal()">
                        <i class="fas fa-times"></i> Annulla
                    </button>
                    <button class="primary-btn" onclick="saveEditedFlashcard('${cardId}')">
                        <i class="fas fa-save"></i> Salva Modifiche
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeEditFlashcardModal() {
    const modal = document.getElementById('edit-flashcard-modal');
    if (modal) {
        modal.remove();
    }
}

function saveEditedFlashcard(cardId) {
    const front = document.getElementById('edit-flashcard-front').value.trim();
    const back = document.getElementById('edit-flashcard-back').value.trim();

    if (!front || !back) {
        showNotification('Inserisci sia la domanda che la risposta!', 'error');
        return;
    }

    const cardIndex = userCustomFlashcards.findIndex(c => c.id === cardId);
    if (cardIndex !== -1) {
        userCustomFlashcards[cardIndex].front = front;
        userCustomFlashcards[cardIndex].back = back;
        saveUserFlashcards();
        saveFlashcardProgress();

        showNotification('Flashcard modificata con successo!', 'success');
        closeEditFlashcardModal();

        // Aggiorna la lista
        const listContainer = document.getElementById('user-flashcards-list');
        if (listContainer) {
            listContainer.innerHTML = generateUserFlashcardsList();
        }
    }
}

function deleteFlashcard(cardId, isUserCard) {
    if (!isUserCard) {
        showNotification('Le flashcard predefinite non possono essere eliminate.', 'info');
        return;
    }

    const cardType = 'personale';
    if (!confirm(`Sei sicuro di voler eliminare questa flashcard ${cardType}? Questa azione non può essere annullata.`)) {
        return;
    }

    userCustomFlashcards = userCustomFlashcards.filter(c => c.id !== cardId);
    saveUserFlashcards();
    saveFlashcardProgress();

    showNotification('Flashcard personale eliminata!', 'info');

    const userListContainer = document.getElementById('user-flashcards-list');
    if (userListContainer) {
        userListContainer.innerHTML = generateUserFlashcardsList();
    }

    updateModeCounters();
    updateGlobalStats();
}

// ===================== //
// NUOVE FUNZIONI PER STUDIO FLASHCARD PERSONALIZZATE //
// ===================== //

// Sostituisci la funzione studyUserCards esistente
function studyUserCards(mode = 'new') {
    console.log(`👤 Avvio studio carte utente - Modalità: ${mode}`);

    if (startStudySession(`user_${mode}`)) {
        showStudySessionScreen();
    }
}

function studyDefaultCards() {
    console.log('📚 Avvio studio carte predefinite');

    if (startStudySession('default')) {
        showStudySessionScreen();
    }
}

function getUserDueCards() {
    return userCustomFlashcards.filter(card =>
        card.isUserCard &&
        card.dueDate &&
        !card.movedFromDifficultAt && // <— esclude schedulate da "difficili"
        !isCardDue(card) &&
        !card.isDifficult &&
        !card.doNotRepeat
    ).sort((a, b) => {
        const aTime = new Date(a.dueDate).getTime();
        const bTime = new Date(b.dueDate).getTime();
        return aTime - bTime;
    });
}

function getUserCards() {
    // Scadute utente NON dai "difficili": restano prioritarie
    const dueNowRegular = userCustomFlashcards.filter(card =>
        card.isUserCard && !card.isDifficult && !card.doNotRepeat && card.dueDate && isCardDue(card) && !card.movedFromDifficultAt
    ).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    // Scadute utente dai "difficili": rientrano in ordine sparso
    const dueFromDifficultUser = userCustomFlashcards.filter(card =>
        card.isUserCard && !card.isDifficult && !card.doNotRepeat && card.dueDate && isCardDue(card) && typeof card.movedFromDifficultAt === 'number'
    );

    // Senza scadenza
    const noDue = userCustomFlashcards.filter(card =>
        card.isUserCard && !card.isDifficult && !card.doNotRepeat && !card.dueDate
    );
    const noDueMoved = noDue
        .filter(c => typeof c.movedFromUserDueAt === 'number')
        .sort((a, b) => b.movedFromUserDueAt - a.movedFromUserDueAt);
    const noDueOther = noDue.filter(c => typeof c.movedFromUserDueAt !== 'number');

    const mixedTail = shuffleArray([...dueFromDifficultUser, ...noDueMoved, ...noDueOther]);
    return [...dueNowRegular, ...mixedTail];
}

function startRealTimeUpdates() {
    // Aggiorna i contatori ogni 5 secondi
    setInterval(() => {
        const flashcardsScreen = document.getElementById('flashcards-screen');
        if (flashcardsScreen && flashcardsScreen.style.display === 'block') {
            updateModeCounters();
        }
    }, 5000); // 5 secondi

    console.log('🔄 Sistema aggiornamento tempo reale attivato');
}

function getDefaultCards() {
    return dirittoPrivatoFlashcards.filter(card => !card.doNotRepeat);
}

// ===================== //
// ALGORITMO DI RIPETIZIONE SPAZIATA //
// ===================== //

function updateCardWithInterval(card, intervalMs) {
    const now = new Date();
    const shortIntervals = [
        INTERVALS.ONE_MINUTE,       // Ripeti Subito
        INTERVALS.FIFTEEN_MINUTES,  // Ripeti Presto
        INTERVALS.ONE_HOUR          // Ripeti Dopo
    ];
    const isShortInterval = shortIntervals.includes(intervalMs);

    if (!card.reviews) card.reviews = 0;
    if (!card.streak) card.streak = 0;
    if (!card.ease) card.ease = 2.5;
    if (!card.fromNewCardsCount) card.fromNewCardsCount = 0;
    if (!card.difficultAddedAt) card.difficultAddedAt = null;

    // USER CARD: mai in "Carte Difficili"
    if (card.isUserCard) {
        if (currentStudyMode === 'user_new') {
            if (isShortInterval) {
                // conteggio valido solo in "Le tue Flashcard"
                card.fromNewCardsCount = (card.fromNewCardsCount || 0) + 1;
                if (card.fromNewCardsCount >= 2) {
                    // 2 scelte brevi consecutive → diventa "Carta Difficile"
                    card.isDifficult = true;
                    card.difficultAddedAt = now.getTime();
                    card.dueDate = null; // non in scadenza
                } else {
                    // prima scelta breve → va in "Le tue carte in scadenza"
                    card.isDifficult = false;
                    card.difficultAddedAt = null;
                    card.dueDate = new Date(now.getTime() + intervalMs);
                }
            } else {
                // intervallo lungo → resta in "Le tue Flashcard"
                card.fromNewCardsCount = 0;
                card.isDifficult = false;
                card.difficultAddedAt = null;
                card.dueDate = null;
            }
        } else if (currentStudyMode === 'user_due') {
            if (isShortInterval) {
                card.dueDate = new Date(now.getTime() + intervalMs);       // riprogramma
            } else {
                // torna in "Le tue Flashcard" e mettila davanti
                card.movedFromUserDueAt = now.getTime();
                card.lastDueDate = card.dueDate ? new Date(card.dueDate).getTime() : null;
                card.dueDate = null;
            }
            card.isDifficult = false;
            card.difficultAddedAt = null;
        } else if (currentStudyMode === 'difficult') {
            // Da "Carte Difficili": rispetta l'intervallo scelto e sospendi la carta
            card.fromNewCardsCount = 0;
            card.isDifficult = false;
            card.difficultAddedAt = null;
            card.movedFromDifficultAt = now.getTime();
            card.dueDate = new Date(now.getTime() + intervalMs); // non appare in nessuna modalità finché non scade
        } else {
            card.isDifficult = false;
            card.difficultAddedAt = null;
        }

        card.lastReviewed = now;
        card.reviews = (card.reviews || 0) + 1;
        card.interval = intervalMs;
        return card;
    }

    // PREDEFINITE
    if (currentStudyMode === 'new') {
        if (isShortInterval) {
            card.fromNewCardsCount = (card.fromNewCardsCount || 0) + 1;     // conteggio valido solo qui
            if (card.fromNewCardsCount >= 2) {
                card.isDifficult = true;                                     // solo predefinite diventano difficili
                card.difficultAddedAt = now.getTime();
                card.dueDate = null;
            } else {
                card.isDifficult = false;
                card.difficultAddedAt = null;
                card.dueDate = new Date(now.getTime() + intervalMs);        // va in "Carte in Scadenza"
            }
        } else {
            card.fromNewCardsCount = 0;
            card.isDifficult = false;
            card.difficultAddedAt = null;
            card.dueDate = new Date(now.getTime() + intervalMs);
        }
    } else if (currentStudyMode === 'due') {
        // nessun conteggio in "Carte in Scadenza"
        card.dueDate = new Date(now.getTime() + intervalMs);
    } else if (currentStudyMode === 'difficult') {
        // Da "Carte Difficili": rispetta l'intervallo scelto e sospendi la carta
        card.isDifficult = false;
        card.difficultAddedAt = null;
        card.fromNewCardsCount = 0;
        card.movedFromDifficultAt = now.getTime();
        card.dueDate = new Date(now.getTime() + intervalMs); // rientra dopo la scadenza
    } else {
        // 'all'/'default'
        card.dueDate = new Date(now.getTime() + intervalMs);
    }

    if (intervalMs >= INTERVALS.ONE_DAY && !card.isDifficult) {
        card.streak = (card.streak || 0) + 1;
    }
    card.lastReviewed = now;
    card.reviews = (card.reviews || 0) + 1;
    card.interval = intervalMs;
    return card;
}

function getCardLocation(card) {
    if (!card.isUserCard) return 'Predefinita';

    if (card.isDifficult) return 'Carte Difficili';

    if (card.dueDate && !isCardDue(card)) {
        return card.isUserCard ? 'Le tue carte in scadenza' : 'Carte in Scadenza';
    }
    if (card.movedFromDifficultAt && currentStudyMode !== 'difficult') {
        card.movedFromDifficultAt = null;
    }

    return 'Le tue Flashcard';
}

function debugUserCardStates() {
    console.log('=== DEBUG STATO CARTE UTENTE ===');

    userCustomFlashcards.forEach((card, index) => {
        console.log(`Carta ${index + 1}: "${card.front.substring(0, 30)}..."`);
        console.log(`   ├─ Posizione: ${getCardLocation(card)}`);
        console.log(`   ├─ Reviews: ${card.reviews}`);
        console.log(`   ├─ fromNewCardsCount: ${card.fromNewCardsCount}`);
        console.log(`   ├─ isDifficult: ${card.isDifficult}`);
        console.log(`   ├─ dueDate: ${card.dueDate ? formatDateTime(card.dueDate) : 'Nessuna'}`);
        console.log(`   └─ isDue: ${isCardDue(card)}`);
    });

    console.log('=== CONTATORI ===');
    console.log(`Le tue Flashcard: ${getUserCards().length}`);
    console.log(`Le tue carte in scadenza: ${getUserDueCards().length}`);
    console.log(`Carte in Scadenza (predefinite): ${getDueCards().length}`);
    console.log(`Carte Difficili: ${getDifficultCards().length}`);
}

function isCardDue(card) {
    if (!card.dueDate) return false;
    if (!card.reviews || card.reviews === 0) return false;

    const now = new Date();
    const dueDate = new Date(card.dueDate);

    return now >= dueDate;
}

function getAllFlashcards() {
    // Esclude le carte segnate come "non ripetere più"
    return [...dirittoPrivatoFlashcards, ...userCustomFlashcards].filter(card => !card.doNotRepeat);
}

function getNewCards() {
    const allCards = getAllFlashcards();

    // Scadute NON dai "difficili": prioritarie come prima
    const dueRegular = allCards
        .filter(card =>
            !card.isUserCard &&
            card.reviews && card.reviews > 0 &&
            isCardDue(card) &&
            !card.isDifficult &&
            !card.movedFromDifficultAt
        )
        .sort((a, b) => {
            const aTime = a.dueDate ? new Date(a.dueDate).getTime() : -Infinity;
            const bTime = b.dueDate ? new Date(b.dueDate).getTime() : -Infinity;
            return bTime - aTime;
        });

    // Scadute dai "difficili": rientrano in ordine sparso
    const dueFromDifficult = allCards.filter(card =>
        !card.isUserCard &&
        card.reviews && card.reviews > 0 &&
        isCardDue(card) &&
        !card.isDifficult &&
        typeof card.movedFromDifficultAt === 'number'
    );

    // Completamente nuove
    const brandNew = allCards.filter(card =>
        !card.isUserCard &&
        (!card.reviews || card.reviews === 0) &&
        !card.isDifficult
    );

    const mixed = shuffleArray([...brandNew, ...dueFromDifficult]);
    return [...dueRegular, ...mixed];
}

function getDueCards() {
    // Solo carte PREDEFINITE: esclude "le tue flashcard"
    const allCards = getAllFlashcards();
    return allCards
        .filter(card =>
            !card.isUserCard &&
            card.reviews &&
            card.reviews > 0 &&
            card.dueDate &&
            !card.movedFromDifficultAt &&
            !isCardDue(card) &&
            !card.isDifficult
        )
        .sort((a, b) => {
            const aTime = new Date(a.dueDate).getTime();
            const bTime = new Date(b.dueDate).getTime();
            return aTime - bTime;
        });
}

function getDifficultCards() {
    const allCards = getAllFlashcards();
    return allCards
        .filter(card => card.isDifficult === true) // include sia predefinite che utente
        .sort((a, b) => cardTime(b) - cardTime(a));
}

function cardTime(card) {
    if (card.difficultAddedAt) return card.difficultAddedAt;
    if (card.lastReviewed) return new Date(card.lastReviewed).getTime();
    return 0;
}

function getAllCards() {
    const allCards = getAllFlashcards();
    return shuffleArray([...allCards]);
}

function rateCardWithInterval(intervalMs) {
    if (!sessionCards || sessionCards.length === 0) return;

    const currentCard = sessionCards[currentCardIndex];

    // Gestione speciale per le modalità "in scadenza"
    if (currentStudyMode === 'due' || currentStudyMode === 'user_due') {
        currentCard.lastReviewed = new Date();
        currentCard.reviews = (currentCard.reviews || 0) + 1;

        if (currentCard.isUserCard) {
            saveUserFlashcards();
        }
        saveFlashcardProgress();
        saveSessionState();

        // sincronizza badge e span anche durante la sessione
        try {
            updateModeCounters();
            if (typeof updateGlobalStats === 'function') updateGlobalStats();
        } catch (e) { console.warn('updateModeCounters failed:', e); }

        // Hook slancio: conteggia una carta completata; se raggiungi la soglia, apri la tendina
        try {
            if (typeof recordStudySession === 'function') {
                const reached = recordStudySession(1);
                if (reached) {
                    try { window.__lastSessionStudiedCount = getTodayStudiedCount(); } catch (_) { }
                    // Non aprire il pannello qui; lo apriremo su endSession
                }
            }
        } catch (e) { console.warn('streak record (due) failed:', e); }

        currentCardIndex++;

        if (currentCardIndex < sessionCards.length) {

            showCurrentCard();
        } else {
            endSession();
        }
        return;
    }

    // Comportamento normale per le altre modalità
    if (currentStudyMode !== 'all' && currentStudyMode !== 'user' && currentStudyMode !== 'default') {
        updateCardWithInterval(currentCard, intervalMs);

        // Salva nel posto giusto in base al tipo di carta
        if (currentCard.isUserCard) {
            saveUserFlashcards();
        }
        saveFlashcardProgress();
        saveSessionState();

        setTimeout(() => {
            updateModeCounters();
        }, 100);
        // Hook slancio: ogni carta completata incrementa; se raggiungi la soglia, apri la tendina
        try {
            if (typeof recordStudySession === 'function') {
                const reached = recordStudySession(1);
                if (reached) {
                    try { window.__lastSessionStudiedCount = getTodayStudiedCount(); } catch(_) {}
                    // Non aprire il pannello qui; lo apriremo su endSession
                }
            }
        } catch (e) { console.warn('streak record failed:', e); }
    } else {
        console.log(`📚 Modalità "${currentStudyMode}": carta NON modificata`);
        // Hook slancio anche in 'all', 'default' e varianti user: ogni carta vale per la soglia giornaliera; se raggiungi la soglia, apri la tendina
        try {
            if (typeof recordStudySession === 'function') {
                const reached = recordStudySession(1);
                if (reached) {
                    try { window.__lastSessionStudiedCount = getTodayStudiedCount(); } catch(_) {}
                    // Non aprire il pannello qui; lo apriremo su endSession
                }
            }
        } catch (e) { console.warn('streak record (readonly) failed:', e); }
    }

    if (intervalMs > INTERVALS.ONE_HOUR) {
        sessionCorrectAnswers++;
    }

    currentCardIndex++;

    if (currentCardIndex < sessionCards.length) {
        showCurrentCard();
    } else {
        endSession();
    }
}

function updateRatingSectionForMode() {
    const ratingTitle = document.getElementById('rating-title');
    const ratingHint = document.getElementById('rating-hint-text');
    const normalRating = document.getElementById('normal-rating-buttons');
    const dueRating = document.getElementById('due-mode-rating');
    const dueNextBtn = document.getElementById('due-next-button');

    if (currentStudyMode === 'due' || currentStudyMode === 'user_due' || currentStudyMode === 'all') {
        // Modalità "in scadenza": niente titolo, niente icone. Solo CTA.
        if (ratingTitle) {
            ratingTitle.textContent = '';
            ratingTitle.style.display = 'none'; // nasconde anche eventuale ::before
        }
        if (ratingHint) ratingHint.textContent = '';
        if (normalRating) normalRating.style.display = 'none';
        if (dueRating) dueRating.style.display = 'block';
        if (dueNextBtn) {
            // assicurati che non ci siano icone o HTML interni
            dueNextBtn.textContent = 'Continua con la prossima carta';
        }
    } else {
        // Modalità normale: ripristina titolo e hint
        if (ratingTitle) {
            ratingTitle.style.display = '';
            ratingTitle.textContent = 'Quando vuoi ripassare questa carta?';
        }
        if (ratingHint) ratingHint.textContent = 'Scegli quando rivedere questa carta';
        if (normalRating) normalRating.style.display = 'grid';
        if (dueRating) dueRating.style.display = 'none';
    }
}

function formatIntervalName(intervalMs) {
    if (intervalMs === INTERVALS.ONE_MINUTE) return '1 minuto';
    if (intervalMs === INTERVALS.FIFTEEN_MINUTES) return '15 minuti';
    if (intervalMs === INTERVALS.ONE_HOUR) return '1 ora';
    if (intervalMs === INTERVALS.ONE_DAY) return '1 giorno';
    if (intervalMs === INTERVALS.THREE_DAYS) return '3 giorni';
    if (intervalMs === INTERVALS.SEVEN_DAYS) return '7 giorni';
    return 'Sconosciuto';
}

// Segna la carta corrente come "non ripetere più" e passa alla successiva
function neverRepeatCurrentCard() {
    if (!sessionCards || sessionCards.length === 0) return;
    const currentCard = sessionCards[currentCardIndex];
    if (!currentCard) return;

    currentCard.doNotRepeat = true;

    try {
        if (currentCard.isUserCard) {
            saveUserFlashcards();
        }
        saveFlashcardProgress();
        saveSessionState();
        updateModeCounters();
        if (typeof updateGlobalStats === 'function') updateGlobalStats();
    } catch (e) {
        console.warn('Errore salvataggio doNotRepeat:', e);
    }

    currentCardIndex++;
    if (currentCardIndex < sessionCards.length) {
        showCurrentCard();
    } else {
        endSession();
    }
}

function formatDateTime(date) {
    if (!date) return 'Mai';

    const d = new Date(date);
    const now = new Date();
    const diffMs = d - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMs < 0) return 'Scaduta';
    if (diffMins < 1) return 'meno di 1 minuto';
    if (diffMins < 60) return `tra ${diffMins} minuti`;
    if (diffHours < 24) return `tra ${diffHours} ore`;
    return `tra ${diffDays} giorni`;
}

function debugCardStates() {
    const allCards = getAllFlashcards();
    console.log('=== DEBUG STATO CARTE ===');
    console.log('Totali:', allCards.length);
    console.log('Predefinite:', dirittoPrivatoFlashcards.length);
    console.log('Utente:', userCustomFlashcards.length);
    console.log('Nuove:', getNewCards().length);
    console.log('In scadenza:', getDueCards().length);
    console.log('Difficili:', getDifficultCards().length);

    console.log('\nEsempio carte in scadenza:');
    getDueCards().slice(0, 3).forEach(card => {
        console.log(`- "${card.front.substring(0, 30)}..." → ${formatDateTime(card.dueDate)}`);
    });

    console.log('\nEsempio carte scadute (tornano in nuove):');
    allCards.filter(c => isCardDue(c)).slice(0, 3).forEach(card => {
        console.log(`- "${card.front.substring(0, 30)}..." → SCADUTA, torna in nuove`);
    });

    console.log('========================');
}

// ===================== //
// SISTEMA DRAG & DROP PER FLIP FLASHCARD //
// ===================== //

function initDragFlip(flashcardElement) {
    if (!flashcardElement) return;

    flashcardElement.addEventListener('mousedown', handleDragStart);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    flashcardElement.addEventListener('touchstart', handleDragStart, { passive: false });
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);

    console.log('✅ Sistema drag inizializzato per flashcard');
}

function handleDragStart(e) {
    if (e.type === 'touchstart') {
        e.preventDefault();
    }

    isDragging = true;

    if (e.type === 'mousedown') {
        startX = e.clientX;
        startY = e.clientY;
    } else if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }

    const flashcard = document.getElementById('current-flashcard');
    if (flashcard) {
        flashcard.classList.add('dragging');
    }

    console.log('🖱️ Drag iniziato:', startX, startY);
}

function handleDragMove(e) {
    if (!isDragging) return;

    if (e.type === 'touchmove') {
        e.preventDefault();
    }

    if (e.type === 'mousemove') {
        currentX = e.clientX;
        currentY = e.clientY;
    } else if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
    }

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const flashcard = document.getElementById('current-flashcard');
    if (flashcard) {
        const limitedX = Math.max(Math.min(deltaX, 160), -160);
        const limitedY = Math.max(Math.min(deltaY, 160), -160);
        const rotateY = limitedX / 12;
        const rotateX = -limitedY / 14;
        const translateX = limitedX * 0.25;
        const translateY = limitedY * 0.2;
        const glow = Math.min(distance / 220, 1);

        flashcard.style.transform = `perspective(1200px) translate3d(${translateX}px, ${translateY}px, 0) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
        flashcard.style.setProperty('--drag-glow', glow.toFixed(2));
    }
}

function handleDragEnd(e) {
    if (!isDragging) return;

    isDragging = false;

    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    const flashcard = document.getElementById('current-flashcard');
    if (flashcard) {
        flashcard.classList.remove('dragging');
        flashcard.style.transform = '';
        flashcard.style.removeProperty('--drag-glow');
    }

    console.log('🖱️ Drag terminato. Distanza:', distance);

    if (distance > dragThreshold) {
        console.log('✅ Soglia superata, flippo la carta');
        flipCard();
    } else {
        console.log('❌ Soglia non raggiunta, nessun flip');
    }

    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;
}

function removeDragListeners() {
    const flashcard = document.getElementById('current-flashcard');
    if (flashcard) {
        flashcard.removeEventListener('mousedown', handleDragStart);
        flashcard.removeEventListener('touchstart', handleDragStart);
    }

    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);

    console.log('🗑️ Listener drag rimossi');
}

function flipCard() {
    const flashcard = document.getElementById('current-flashcard');
    const ratingSection = document.getElementById('rating-section');

    if (!flashcard) return;

    if (!isAnswerShown) {
        flashcard.classList.add('flipped');
        if (ratingSection) {
            ratingSection.style.display = 'block';
            // Aggiorna la sezione rating quando si mostra la risposta
            updateRatingSectionForMode();
            addKeyboardIndicators();
        }
        isAnswerShown = true;
        console.log('🔄 Carta flippata: risposta mostrata');
    } else {
        flashcard.classList.remove('flipped');
        if (ratingSection) {
            ratingSection.style.display = 'none';
        }
        removeKeyboardIndicators();
        isAnswerShown = false;
        console.log('🔄 Carta flippata: domanda mostrata');
    }
}

// Setup event listeners per le flashcards
function setupFlashcardEventListeners() {
    document.addEventListener('keydown', handleFlashcardKeyboard);
}

function handleFlashcardKeyboard(e) {
    const flashcardsScreen = document.getElementById('flashcards-screen');
    if (!flashcardsScreen) return;
    const screenDisplay = window.getComputedStyle(flashcardsScreen).display;
    if (screenDisplay === 'none') return;

    const studySession = document.querySelector('.study-session');
    if (!studySession) return;
    const sessionDisplay = window.getComputedStyle(studySession).display;
    if (sessionDisplay === 'none') return;

    const activeElement = document.activeElement;
    if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
    )) {
        return;
    }

    const numericKeyMap = {
        Numpad1: '1',
        Numpad2: '2',
        Numpad3: '3',
        Numpad4: '4',
        Numpad5: '5',
        Numpad6: '6',
        Digit1: '1',
        Digit2: '2',
        Digit3: '3',
        Digit4: '4',
        Digit5: '5',
        Digit6: '6'
    };

    const normalizedKey = numericKeyMap[e.code] || e.key;

    if (normalizedKey === '?' || (e.shiftKey && normalizedKey === '/')) {
        e.preventDefault();
        showKeyboardShortcutsHint();
        return;
    }

    if (normalizedKey === ' ' || normalizedKey === 'Spacebar' || e.code === 'Space') {
        e.preventDefault();
        if (!isAnswerShown) {
            flipCard();
        } else {
            // Se siamo in modalità 'due' o 'user_due', allora spazio deve funzionare come "Avanti"
            if (currentStudyMode === 'due' || currentStudyMode === 'user_due' || currentStudyMode === 'all') {
                rateCardWithInterval(0);
            } else {
                reviewFlashcardAgain();
            }
        }
    }

    // Tab: passa alla prossima carta nelle modalità semplificate
    if (normalizedKey === 'Tab') {
        e.preventDefault();
        if (!isAnswerShown) {
            flipCard();
        } else {
            if (currentStudyMode === 'due' || currentStudyMode === 'user_due' || currentStudyMode === 'all') {
                rateCardWithInterval(0);
            } else {
                reviewFlashcardAgain();
            }
        }
    }

    if (isAnswerShown && normalizedKey >= '1' && normalizedKey <= '6') {
        e.preventDefault();
        // Se siamo in modalità 'due' o 'user_due', ignoriamo i tasti 1-6
        if (currentStudyMode === 'due' || currentStudyMode === 'user_due') {
            return;
        }
        e.preventDefault();
        const intervalMap = {
            '1': INTERVALS.ONE_MINUTE,        // Ripeti Subito
            '2': INTERVALS.FIFTEEN_MINUTES,   // Ripeti Presto
            '3': INTERVALS.ONE_HOUR,          // Ripeti Dopo
            '4': INTERVALS.ONE_DAY,           // Rivedi Domani
            '5': INTERVALS.THREE_DAYS,        // Rivedi tra 3 Giorni
            '6': INTERVALS.SEVEN_DAYS         // Rivedi tra 1 Settimana
        };
        rateCardWithInterval(intervalMap[normalizedKey]);
    }

    if (normalizedKey === 'r' || normalizedKey === 'R') {
        e.preventDefault();
        if (isAnswerShown) {
            reviewFlashcardAgain();
        }
    }

    if (normalizedKey === 'Escape' || e.code === 'Escape') {
        e.preventDefault();
        if (isAnswerShown) {
            reviewFlashcardAgain();
        } else {
            backToStudyOptions();
        }
    }
}

function showKeyboardShortcutsHint() {
    closeKeyboardHint(true);

    const hint = document.createElement('div');
    hint.className = 'keyboard-shortcuts-hint';
    hint.innerHTML = `
        <div class="shortcuts-content">
            <h4><i class="fas fa-keyboard"></i> Tasti Rapidi</h4>
            <div class="shortcuts-list">
                <div class="shortcut-item">
                    <kbd>Spazio</kbd>
                    <span>Gira carta / Rivedi</span>
                </div>
                <div class="shortcut-item">
                    <kbd>Tab</kbd>
                    <span>Avanti (scadenza / tutte le carte)</span>
                </div>
                <div class="shortcut-item">
                    <kbd>1-6</kbd>
                    <span>Valutazione rapida</span>
                </div>
                <div class="shortcut-item">
                    <kbd>R</kbd>
                    <span>Rivedi flashcard</span>
                </div>
                <div class="shortcut-item">
                    <kbd>ESC</kbd>
                    <span>Indietro</span>
                </div>
            </div>
        </div>
        <button class="close-hint-btn" onclick="closeKeyboardHint()">
            <i class="fas fa-times"></i>
        </button>
    `;

    document.body.appendChild(hint);

    setTimeout(() => {
        closeKeyboardHint();
    }, 5000);
}

function closeKeyboardHint(instant = false) {
    const hint = document.querySelector('.keyboard-shortcuts-hint');
    if (hint) {
        if (instant) {
            hint.remove();
            return;
        }
        hint.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (hint.parentNode) {
                hint.parentNode.removeChild(hint);
            }
        }, 300);
    }
}

function addKeyboardIndicators() {
}

function removeKeyboardIndicators() {
}

// ===================== //
// MODALITÀ DI STUDIO MIGLIORATE //
// ===================== //

function updateModeCounters() {
    const stats = getFlashcardStats();

    console.log('🔄 Aggiorno contatori:');
    console.log(`   ├─ Nuove: ${stats.newCards}`);
    console.log(`   ├─ In scadenza: ${stats.dueCards}`);
    console.log(`   ├─ Difficili: ${stats.difficultCards}`);
    console.log(`   ├─ Utente nuove: ${stats.userNewCards}`);
    console.log(`   ├─ Utente in scadenza: ${stats.userDueCards}`);
    console.log(`   └─ Predefinite: ${stats.defaultCardsCount}`);

    // Aggiorna solo i badge senza testo aggiuntivo
    const badges = {
        'new-cards': stats.newCards,
        'due-cards': stats.dueCards,
        'difficult-cards': stats.difficultCards,
        'user-new-cards': stats.userNewCards,
        'user-due-cards': stats.userDueCards,
        'default-cards': stats.defaultCardsCount
    };

    Object.entries(badges).forEach(([className, count]) => {
        const badge = document.querySelector(`.study-option-card.${className} .card-badge`);
        if (badge) {
            // Aggiorna solo se il numero è cambiato
            if (badge.textContent !== count.toString()) {
                badge.textContent = count;
                badge.classList.add('badge-update');
                // Rallenta la rimozione della classe (1.5 secondi invece di 0.5)
                setTimeout(() => badge.classList.remove('badge-update'), 1500);
            }
        }
    });

    // Aggiorna le barre di progresso (mantenuto per compatibilità)
    const totalCards = stats.totalCards;

    const progressElements = {
        'new-cards': stats.newCards,
        'due-cards': stats.dueCards,
        'difficult-cards': stats.difficultCards,
        'user-new-cards': stats.userNewCards,
        'user-due-cards': stats.userDueCards,
        'default-cards': stats.defaultCardsCount
    };

    Object.entries(progressElements).forEach(([className, count]) => {
        const progressFill = document.querySelector(`.study-option-card.${className} .progress-fill`);
        if (progressFill) {
            progressFill.style.width = totalCards > 0 ? `${(count / totalCards) * 100}%` : '0%';
        }

        const progressText = document.querySelector(`.study-option-card.${className} .card-progress span`);
        if (progressText) {
            // lo span segue il valore del badge
            progressText.textContent = String(count);
        }
    });
}

let counterUpdateInterval = null;

function startCounterAutoUpdate() {
    if (counterUpdateInterval) {
        clearInterval(counterUpdateInterval);
    }

    counterUpdateInterval = setInterval(() => {
        const flashcardsScreen = document.getElementById('flashcards-screen');
        if (flashcardsScreen && flashcardsScreen.style.display === 'block') {
            const studyOptions = document.querySelector('.study-options');
            if (studyOptions && studyOptions.style.display !== 'none') {
                updateModeCounters();
                if (typeof updateGlobalStats === 'function') updateGlobalStats();
            }
        }
    }, 1000);
}

function stopCounterAutoUpdate() {
    if (counterUpdateInterval) {
        clearInterval(counterUpdateInterval);
        counterUpdateInterval = null;
    }
}

// ===================== //
// GESTIONE SESSIONI DI STUDIO //
// ===================== //

function startStudySession(mode) {
    currentStudyMode = mode;

    let cardsToStudy = [];
    let shouldShuffle = false;

    // Nel blocco switch di startStudySession - sostituisci solo questa parte
    switch (mode) {
        case 'new':
            cardsToStudy = getNewCards();
            shouldShuffle = false;
            break;
        case 'due':
            cardsToStudy = getDueCards();
            shouldShuffle = true;
            break;
        case 'difficult':
            cardsToStudy = getDifficultCards();
            shouldShuffle = true;
            break;
        case 'all':
            cardsToStudy = getAllCards();
            shouldShuffle = true;
            break;
        case 'user_new':
            cardsToStudy = getUserCards();
            shouldShuffle = false;
            break;
        case 'user_due':
            cardsToStudy = getUserDueCards();
            shouldShuffle = true;
            break;
        case 'default':
            cardsToStudy = getDefaultCards();
            shouldShuffle = true;
            break;
        default:
            console.error('❌ Modalità non valida:', mode);
            return false;
    }

    if (cardsToStudy.length === 0) {
        showNotification(`Nessuna carta disponibile per la modalità "${getModeLabel(mode)}"!`, 'info');
        return false;
    }

    if (shouldShuffle) {
        cardsToStudy = shuffleArray(cardsToStudy);
    }

    // Applica il limite di sessione SOLO per modalità "all"
    if (mode === 'all' && flashcardSessionLimit > 0 && cardsToStudy.length > flashcardSessionLimit) {
        cardsToStudy = cardsToStudy.slice(0, flashcardSessionLimit);
    }

    sessionCards = cardsToStudy;
    currentCardIndex = 0;
    isAnswerShown = false;
    sessionCorrectAnswers = 0;
    sessionStartTime = new Date();

    saveSessionState();

    console.log(`✅ Sessione avviata: ${mode} - ${sessionCards.length} carte`);

    showCurrentCard();
    startSessionTimer();

    return true;
}

function showCurrentCard() {
    if (!sessionCards || sessionCards.length === 0) {
        console.error('❌ Nessuna carta nella sessione');
        endSession();
        return;
    }

    if (currentCardIndex >= sessionCards.length) {
        console.log('✅ Tutte le carte completate');
        endSession();
        return;
    }

    const currentCard = sessionCards[currentCardIndex];
    if (!currentCard) {
        console.error('❌ Carta corrente non valida');
        return;
    }

    console.log(`📄 Mostro carta ${currentCardIndex + 1}/${sessionCards.length}`);

    isAnswerShown = false;

    updateCardDisplay(currentCard);
    updateProgressBar();
    updateSessionStats();

    // Aggiorna la sezione rating in base alla modalità corrente
    updateRatingSectionForMode();

    setTimeout(() => {
        const flashcard = document.getElementById('current-flashcard');
        if (flashcard) {
            initDragFlip(flashcard);
        }
    }, 100);
}

function updateCardDisplay(card) {
    const flashcard = document.getElementById('current-flashcard');
    const frontElement = document.getElementById('flashcard-front');
    const backElement = document.getElementById('flashcard-back');
    const ratingSection = document.getElementById('rating-section');

    if (flashcard) {
        flashcard.classList.remove('flipped');
    }

    const cardNumbers = document.querySelectorAll('.card-number');
    cardNumbers.forEach(el => {
        el.textContent = currentCardIndex + 1;
    });

    if (frontElement) {
        frontElement.textContent = card.front || "Domanda non disponibile";
    }

    if (backElement) {
        backElement.textContent = card.back || "Risposta non disponibile";
    }

    if (ratingSection) {
        ratingSection.style.display = 'none';
        removeKeyboardIndicators();
    }
}

function updateProgressBar() {
    const progressBar = document.getElementById('session-progress-bar');
    const progressPercent = document.getElementById('progress-percent');
    const deckProgress = document.getElementById('deck-progress');

    if (progressBar && sessionCards.length > 0) {
        const progress = (currentCardIndex / sessionCards.length) * 100;
        progressBar.style.width = `${progress}%`;
    }

    if (progressPercent) {
        const percent = sessionCards.length > 0
            ? Math.round((currentCardIndex / sessionCards.length) * 100)
            : 0;
        progressPercent.textContent = `${percent}%`;
    }

    if (deckProgress) {
        deckProgress.textContent = `${currentCardIndex}/${sessionCards.length}`;
    }
}

function updateSessionStats() {
    const cardsReviewed = document.getElementById('cards-reviewed');
    const sessionAccuracy = document.getElementById('session-accuracy');

    if (cardsReviewed) {
        cardsReviewed.textContent = currentCardIndex;
    }

    if (sessionAccuracy && currentCardIndex > 0) {
        const accuracy = Math.round((sessionCorrectAnswers / currentCardIndex) * 100);
        sessionAccuracy.textContent = `${accuracy}%`;
    }
}

function endSession() {
    console.log('🏁 Sessione terminata');

    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    removeDragListeners();

    const sessionDuration = sessionStartTime
        ? Math.floor((new Date() - sessionStartTime) / 1000)
        : 0;

    const studiedCount = currentCardIndex; // carte effettivamente svolte in questa sessione
    // salva il numero reale di carte studiate in questa sessione
    try { window.__lastSessionStudiedCount = studiedCount; } catch (_) { }
    const accuracy = studiedCount > 0
        ? Math.round((sessionCorrectAnswers / studiedCount) * 100)
        : 0;

    updateCompletionUI(studiedCount, sessionDuration, accuracy);

    clearSessionState();

    showCompletionScreen();
    // La logica di apertura del popup "Slancio" viene gestita dall'integrazione StreakSystem
    // dopo aver registrato la sessione, per garantire che appaia SOLO quando il giorno è completo.
}

function updateCompletionUI(cardsStudied, duration, accuracy) {
    const summaryCorrect = document.getElementById('summary-correct');
    const summaryTime = document.getElementById('summary-time');
    const summaryAccuracy = document.getElementById('summary-accuracy');

    if (summaryCorrect) {
        summaryCorrect.textContent = cardsStudied;
    }

    if (summaryTime) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        summaryTime.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    if (summaryAccuracy) {
        summaryAccuracy.textContent = `${accuracy}%`;
    }
}

function showCompletionScreen() {
    hideEndSessionButton();
    const studySession = document.querySelector('.study-session');
    const sessionComplete = document.querySelector('.session-complete');

    if (studySession) {
        studySession.style.display = 'none';
    }

    if (sessionComplete) {
        sessionComplete.style.display = 'flex';
    }

    console.log('✅ Schermata completamento mostrata');
}

function streakPopupFixNumbers(source){
    try{
      const goal = (typeof streakData !== 'undefined' && streakData && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 1;
      const n = (source === 'session_end' && typeof window.__lastSessionStudiedCount === 'number')
        ? window.__lastSessionStudiedCount
        : (typeof getTodayStudiedCount === 'function' ? getTodayStudiedCount() : 0);
  
      const tryPatch = () => {
        const root = document.querySelector('#study-streak-modal, .study-streak-modal, #streak-popup, .streak-popup');
        if (!root) { setTimeout(tryPatch, 120); return; }
  
        const numEls = root.querySelectorAll('[data-cards-today], #cards-today, .cards-today, .today-cards-count, .streak-today-count');
        numEls.forEach(el => { el.textContent = String(n); });
  
        const goalText = root.querySelector('[data-goal-text], #streak-goal-text, .goal-text');
        if (goalText) goalText.textContent = `${n}/${goal}`;
  
        const fill = root.querySelector('.streak-progress-fill, [data-progress-fill], .progress-fill');
        if (fill) fill.style.width = `${Math.min(100, Math.round((n/goal)*100))}%`;
      };
      setTimeout(tryPatch, 100);
    } catch(e){ console.warn('streakPopupFixNumbers error:', e); }
  }

function startSessionTimer() {
    if (sessionTimer) {
        clearInterval(sessionTimer);
    }

    let seconds = 0;

    sessionTimer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        const timerElement = document.getElementById('session-time');
        if (timerElement) {
            timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }
    }, 1000);
}

function getModeLabel(mode) {
    const labels = {
        'new': 'Flashcard predefinite',
        'due': 'Predefinite in scadenza',
        'difficult': 'Carte Difficili',
        'all': 'Tutte le Carte',
        'user_new': 'Le tue Flashcard',
        'user_due': 'Le tue carte in scadenza',
        'default': 'Flashcard predefinite'
    };
    return labels[mode] || mode;
}


function showModesHelp() {
    const stats = (typeof getFlashcardStats === 'function') ? getFlashcardStats() : {
        totalCards: 0, newCards: 0, dueCards: 0, difficultCards: 0,
        userNewCards: 0, userDueCards: 0
    };

    const modalHTML = `
<div class="modal-overlay" id="modes-help-modal">
  <div class="modal-container large-modal">
    <div class="modal-header">
      <h3><i class="fas fa-circle-question"></i> Guida modalità</h3>
      <button class="close-modal-btn" onclick="closeModesHelp()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="help-section">
        <h4>Guida rapida</h4>
        <ul>
          <li><strong>Termina sessione</strong>: Pulsante situato in basso a destra. Chiude la sessione usando <em>solo</em> le carte realmente svolte.</li>
          <li><strong>Slancio</strong>: imposta quante carte al giorno. Il popup appare <em>una volta al giorno</em> al primo accesso, finché non raggiungi l’obiettivo.</li>
          <li><strong>Reset slancio</strong>: nella tendina “Slancio di Studio” azzeri lo storico (non riapre l’avviso del giorno corrente).</li>
          <li><strong>Tasti rapidi</strong>: <kbd>Spazio</kbd> flip/avanti; <kbd>1–6</kbd> intervalli; <kbd>ESC</kbd> indietro; <kbd>Tab</kbd> avanti nelle modalità in scadenza e in <em>Tutte le Carte</em>.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Modalità predefinite</h4>
        <ul>
          <li><strong>Predefinite</strong> — mescola carte mai viste e scadute che rientrano in priorità. Scegli l’intervallo di ripasso. Conteggio: <strong>${stats.newCards}</strong>.</li>
          <li><strong>Predefinite in scadenza</strong> — carte programmate e non ancora scadute. In sessione c’è un solo tasto: <em>Continua con la prossima carta</em> (tasti: <kbd>Spazio</kbd>/<kbd>Tab</kbd>). Conteggio: <strong>${stats.dueCards}</strong>.</li>
          <li><strong>Carte Difficili</strong> — una carta (predefinita o personale) diventa “Difficile” dopo <em>due scelte brevi consecutive</em> (1m, 15m, 1h). Qui scegli quando rivederla; resterà sospesa finché non scade.</li>
          <li><strong>Tutte le Carte</strong> — ripasso libero, non modifica la pianificazione. Puoi impostare un <em>limite di sessione</em> dal riquadro.</li>
        </ul>
      </div>

      <div class="help-section">
        <h4>Le tue flashcard</h4>
        <ul>
          <li><strong>Le tue Flashcard</strong> — le carte create da te. Con una scelta breve vanno in <em>Le tue carte in scadenza</em>; con due scelte brevi consecutive diventano <em>Difficili</em>. Conteggio: <strong>${stats.userNewCards}</strong>.</li>
          <li><strong>Le tue carte in scadenza</strong> — personali programmate e non ancora scadute. Sessione semplificata con un solo bottone (tasti: <kbd>Spazio</kbd>/<kbd>Tab</kbd>). Conteggio: <strong>${stats.userDueCards}</strong>.</li>
        </ul>
        <p>Vuoi aggiungere carte personali? <a href="#" onclick="closeModesHelp(); showAddFlashcardModal(); return false;"><u>Crea una nuova carta</u></a>.</p>
      </div>

      <div class="help-section">
        <h4>Slancio di Studio</h4>
        <ul>
          <li><strong>Oggi X/Y</strong>: ogni carta studiata in qualsiasi modalità aumenta il contatore del giorno (X). Y è la soglia giornaliera che imposti tu.</li>
          <li><strong>Obiettivo giorni</strong>: scegli la striscia di giorni consecutivi da raggiungere (es. 7, 14, 30…).</li>
          <li><strong>Reset slancio</strong>: azzera i dati di slancio e riparti da 0; riapparirà l’avviso dal giorno successivo.</li>
        </ul>
      </div>
    </div>
    <div class="modal-footer">
      <button class="primary-btn" onclick="closeModesHelp()"><i class="fas fa-check"></i> Chiudi</button>
    </div>
  </div>
</div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeModesHelp() {
    const modal = document.getElementById('modes-help-modal');
    if (modal) modal.remove();
    try { if (typeof maybeShowDailyStreakPopup === 'function') maybeShowDailyStreakPopup('auto'); } catch (_) { }
}

// ===================== //
// MODALITÀ DI STUDIO //
// ===================== //

function studyNewCards() {
    console.log('🆕 Avvio studio carte nuove');

    if (startStudySession('new')) {
        showStudySessionScreen();
    }
}

function studyDueCards() {
    console.log('⏰ Avvio studio carte in scadenza');

    if (startStudySession('due')) {
        showStudySessionScreen();
    }
}

function studyDifficultCards() {
    console.log('🔥 Avvio studio carte difficili');

    if (startStudySession('difficult')) {
        showStudySessionScreen();
    }
}

function studyAllCards() {
    console.log('📚 Avvio studio tutte le carte');

    if (startStudySession('all')) {
        showStudySessionScreen();
    }
}

function showStudySessionScreen() {
    const studyOptions = document.querySelector('.study-options');
    const studySession = document.querySelector('.study-session');
    const sessionComplete = document.querySelector('.session-complete');

    if (studyOptions) {
        studyOptions.style.display = 'none';
    }

    if (studySession) {
        studySession.style.display = 'block';
    }

    if (sessionComplete) {
        sessionComplete.style.display = 'none';
    }

    console.log('✅ Schermata studio mostrata');

    if (!hasSeenKeyboardHint()) {
        setTimeout(() => {
            showKeyboardShortcutsHint();
            markKeyboardHintSeen();
        }, 1000);
    }
    // Mostra sempre il FAB in sessione
    ensureEndSessionButton();
}

function backToStudyOptions() {
    const studyOptions = document.querySelector('.study-options');
    const studySession = document.querySelector('.study-session');
    const sessionComplete = document.querySelector('.session-complete');

    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    removeDragListeners();

    saveFlashcardProgress();
    clearSessionState();

    if (studyOptions) {
        studyOptions.style.display = 'block';
    }

    if (studySession) {
        studySession.style.display = 'none';
    }

    if (sessionComplete) {
        sessionComplete.style.display = 'none';
    }

    updateModeCounters();
    updateGlobalStats();
    hideEndSessionButton();

    console.log('🔙 Tornato alla selezione modalità');
}

function studyMoreCards() {
    backToStudyOptions();
}

function reviewFlashcardAgain() {
    const flashcard = document.getElementById('current-flashcard');
    const ratingSection = document.getElementById('rating-section');

    if (flashcard) {
        flashcard.classList.remove('flipped');
    }

    if (ratingSection) {
        ratingSection.style.display = 'none';
    }
    removeKeyboardIndicators();

    isAnswerShown = false;

    console.log('👁️ Rivedo flashcard corrente');
}

// ===================== //
// FUNZIONI DI NAVIGAZIONE CORRETTE //
// ===================== //

function handleFlashcardsBack() {
    const studyOptions = document.querySelector('.study-options');
    const studySession = document.querySelector('.study-session');
    const sessionComplete = document.querySelector('.session-complete');

    const isOptionsVisible = studyOptions && window.getComputedStyle(studyOptions).display !== 'none';
    const isSessionVisible = studySession && window.getComputedStyle(studySession).display !== 'none';
    const isCompleteVisible = sessionComplete && window.getComputedStyle(sessionComplete).display !== 'none';

    if (isOptionsVisible && !isSessionVisible && !isCompleteVisible) {
        // Sei nella schermata "Modalità di Studio": torna alla dashboard principale
        closeFlashcardsToMainDashboard();
    } else {
        // Sei in sessione o schermata di completamento: torna alle modalità di studio
        closeFlashcardsToDashboard();
    }
}

function closeFlashcardsToDashboard() {
    console.log('🔙 Tornando alle opzioni di studio...');

    stopCounterAutoUpdate();

    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    removeDragListeners();

    saveFlashcardProgress();
    clearSessionState();

    // Mostra le opzioni di studio e nascondi le altre schermate
    const studyOptions = document.querySelector('.study-options');
    const studySession = document.querySelector('.study-session');
    const sessionComplete = document.querySelector('.session-complete');

    if (studyOptions) {
        studyOptions.style.display = 'block';
    }

    if (studySession) {
        studySession.style.display = 'none';
    }

    if (sessionComplete) {
        sessionComplete.style.display = 'none';
    }

    // Aggiorna i contatori
    updateModeCounters();
    updateGlobalStats();
    hideEndSessionButton();

    console.log('✅ Tornato alla selezione modalità di studio');
}

// Azione globale per il bottone "Continua a studiare" nel popup Slancio
function continueStudyingFromStreakPopup() {
    try {
        const el = document.getElementById('streak-popup');
        if (el) el.remove();
    } catch (_) { }

    try {
        // Se sei già in una sessione attiva, continua semplicemente
        const studySession = document.querySelector('.study-session');
        if (studySession && window.getComputedStyle(studySession).display !== 'none') {
            return; // niente altro: prosegui la sessione corrente
        }

        // Se sei nella schermata di completamento, avvia una nuova sessione nella stessa modalità
        const sessionComplete = document.querySelector('.session-complete');
        if (sessionComplete && window.getComputedStyle(sessionComplete).display !== 'none') {
            if (typeof startStudySession === 'function' && typeof showStudySessionScreen === 'function' && typeof currentStudyMode !== 'undefined') {
                const ok = startStudySession(currentStudyMode);
                if (ok) {
                    showStudySessionScreen();
                    return;
                }
            }
        }
    } catch (_) { }

    // Fallback: torna alla schermata delle modalità
    try { if (typeof backToStudyOptions === 'function') backToStudyOptions(); } catch (_) { }
}

function closeFlashcardsToMainDashboard() {
    console.log('🚪 Chiusura flashcards e ritorno alla dashboard principale...');

    stopCounterAutoUpdate();

    if (sessionTimer) {
        clearInterval(sessionTimer);
        sessionTimer = null;
    }

    removeDragListeners();

    saveFlashcardProgress();
    clearSessionState();
    hideEndSessionButton();

    document.body.classList.remove('flashcards-open');

    const flashcardsScreen = document.getElementById('flashcards-screen');
    if (flashcardsScreen) {
        flashcardsScreen.style.display = 'none';
    }

    // Mostra la dashboard principale
    document.getElementById('user-dashboard').style.display = 'block';

    console.log('✅ Flashcards chiuse, dashboard principale mostrata');
}

// ===================== //
// APERTURA E INIZIALIZZAZIONE FLASHCARDS //
// ===================== //

function openDirittoPrivatoFlashcards() {
    console.log('📖 Apertura flashcards Diritto Privato...');

    document.getElementById('user-dashboard').style.display = 'none';
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('quiz-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'none';

    document.body.classList.add('flashcards-open');

    loadDirittoPrivatoFlashcards(function () {
        console.log('✅ Flashcards caricate, inizializzo UI...');

        const progressLoaded = loadFlashcardProgress();

        if (!progressLoaded) {
            console.log('ℹ️ Inizializzo flashcards dal file caricato');
            enhanceFlashcardStructure();
        }

        renderFlashcardsScreen();
        console.log('✅ Flashcards aperte con successo');
    });
}

function generateFlashcardsHTML(stats) {
    return `
        <div class="flashcards-container">
            <!-- Header -->
            <div class="flashcards-header">
                <button class="back-arrow-btn-small" onclick="handleFlashcardsBack()" title="Indietro" data-tooltip="Indietro">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <div class="header-title">
                    <i class="fas fa-balance-scale"></i>
                    <h3>Flashcards - Diritto Privato</h3>
                </div>
                <div class="header-stats">
                    <div class="stat-badge" data-tooltip="Totale flashcards disponibili" title="Totale flashcards">
                        <i class="fas fa-layer-group"></i>
                        <span>${stats.totalCards}</span>
                    </div>
                    <div class="management-buttons">
                        <button class="management-btn" onclick="showManageFlashcardsModal()" title="Gestisci Flashcard" data-tooltip="Le tue flashcard">
                            <i class="fas fa-plus-circle"></i>
                        </button>
                        <button class="management-btn" onclick="exportFlashcardsAsText()" title="Esporta come Testo" data-tooltip="Esporta riepilogo">
                            <i class="fas fa-file-export"></i>
                        </button>
                        <button class="management-btn" onclick="showStats()" title="Statistiche" data-tooltip="Statistiche dettagliate">
                            <i class="fas fa-chart-bar"></i>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="flashcard-content">
                <!-- Opzioni Studio -->
                ${generateStudyOptionsHTML(stats)}
                
                <!-- Sessione Studio -->
                ${generateStudySessionHTML()}
                
                <!-- Completamento -->
                ${generateCompletionHTML()}
            </div>
        </div>
    `;
}

function renderFlashcardsScreen() {
    const stats = getFlashcardStats();
    let flashcardsScreen = document.getElementById('flashcards-screen');

    if (dirittoPrivatoFlashcards.length > 0 && !originalFlashcardsSnapshot.length) {
        captureOriginalSnapshot(dirittoPrivatoFlashcards);
    }

    if (!flashcardsScreen) {
        flashcardsScreen = document.createElement('div');
        flashcardsScreen.id = 'flashcards-screen';
        flashcardsScreen.className = 'flashcards-screen';
        document.body.appendChild(flashcardsScreen);
    }

    flashcardsScreen.innerHTML = generateFlashcardsHTML(stats);
    flashcardsScreen.style.display = 'block';
    document.body.classList.add('flashcards-open');
    injectFlashcardsNotificationsTheme();

    updateGlobalStats();
    updateModeCounters();

    setTimeout(() => {
        updateModeStats();
    }, 100);

    setTimeout(() => {
        updateModeCounters();
        startCounterAutoUpdate();
    }, 200);

    // Mostra guida per prima cosa al primo accesso
    if (!hasSeenModesHelp()) {
        setTimeout(() => { 
            try { 
                showModesHelp(); 
                markModesHelpSeen(); 
                // Evita che il popup Slancio automatico si apra sopra la guida al primo accesso
                try {
                    if (typeof STREAK_CONFIG !== 'undefined') {
                        const today = (new Date()).toISOString().slice(0,10);
                        localStorage.setItem(STREAK_CONFIG.popupShownKey, today);
                    }
                } catch(_){}
            } catch (e) { }
        }, 100);
    }

    initializeFlashcardSettings();
    // Streak popup automatico al primo accesso del giorno se non completato
    try {
        // Usa il wrapper con controllo "una volta al giorno"
        if (hasSeenModesHelp() && typeof maybeShowDailyStreakPopup === 'function') {
            maybeShowDailyStreakPopup('auto');
        }
    } catch (e) { console.warn('streak auto popup failed:', e); }
}

function initializeFlashcardSettings() {
    // Inizializzazione rimossa perché abbiamo rimosso il session-settings-card
    // Il limite di sessione ora si applica solo alla modalità "Tutte le carte"
}

// Forza i colori delle notifiche "info" nelle flashcards per allinearli al tema del sito
function injectFlashcardsNotificationsTheme() {
    if (document.getElementById('fc-notify-theme')) return;
    const style = document.createElement('style');
    style.id = 'fc-notify-theme';
    style.textContent = `
    /* Notifiche INFO coerenti con la palette del sito */
    .flashcards-open .notification.info,
    .flashcards-open .toast.info,
    .flashcards-open .alert.info,
    .flashcards-open [class*="notification"].info {
        background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
        color: var(--white);
        border: 1px solid rgba(128, 36, 51, 0.25);
        box-shadow: 0 14px 30px rgba(128, 36, 51, 0.28);
    }
    .flashcards-open .notification.info .icon,
    .flashcards-open .toast.info .icon,
    .flashcards-open .alert.info .icon { color: var(--white); opacity: 0.95; }

    .flashcards-open .notification.info .close-btn,
    .flashcards-open .toast.info .close-btn,
    .flashcards-open .alert.info .close-btn { color: var(--white); opacity: 0.85; }
    .flashcards-open .notification.info .close-btn:hover,
    .flashcards-open .toast.info .close-btn:hover,
    .flashcards-open .alert.info .close-btn:hover { opacity: 1; }

    /* Link o testo enfatizzato dentro la notifica */
    .flashcards-open .notification.info a { color: #fff; text-decoration: underline; }
    `;
    document.head.appendChild(style);
}
// === STREAK HELPERS (conteggio odierno + UI) ===
function getTodayStudiedCount() {
    try {
        if (typeof streakData === 'undefined') return 0;
        const fmt = (d) => (typeof formatDateForStorage === 'function') ? formatDateForStorage(d) : d.toISOString().slice(0, 10);
        const todayStr = fmt(new Date());
        const entry = (streakData.history || []).find(e => fmt(new Date(e.date)) === todayStr);
        return entry ? (parseInt(entry.cardsStudied || 0, 10) || 0) : 0;
    } catch (_) { return 0; }
}

function updateStreakProgressBar(overrideCount) {
    try {
        const current = (typeof overrideCount === 'number') ? overrideCount : getTodayStudiedCount();
        const goal = (streakData && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 1;
        const percent = Math.max(0, Math.min(100, Math.round((current / goal) * 100)));
        const bar = document.querySelector('.streak-progress .streak-fill');
        const msg = document.querySelector('.streak-progress .streak-msg');
        if (bar) bar.style.width = percent + '%';
        if (msg) msg.textContent = `${current}/${goal}`;
    } catch (e) { console.warn('updateStreakProgressBar failed:', e); }
}

function refreshStreakTodaySummary(overrideCount) {
    try {
        const current = (typeof overrideCount === 'number') ? overrideCount : getTodayStudiedCount();
        const goal = (streakData && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 1;
        const curEl = document.getElementById('streak-today-count');
        const tgtEl = document.getElementById('streak-today-target');
        if (curEl) curEl.textContent = String(current);
        if (tgtEl) tgtEl.textContent = String(goal);
        updateStreakProgressBar(current);
    } catch (e) { console.warn('refreshStreakTodaySummary failed:', e); }
}

function resetStreakData() {
    try {
        if (typeof streakData === 'undefined') return;
        streakData.streak = 0;
        streakData.lastDate = null;
        streakData.history = [];
        if (typeof saveStreakData === 'function') saveStreakData();
        if (typeof updateStreakIndicator === 'function') updateStreakIndicator();
        // Non riproporre il popup per il resto della giornata
        try { if (typeof markStreakPopupShownToday === 'function') markStreakPopupShownToday(); } catch (_) { }
        refreshStreakTodaySummary(0);
        if (typeof showNotification === 'function') showNotification('Slancio azzerato.', 'info');
    } catch (e) { console.warn('resetStreakData failed:', e); }
}
// === AUTO-POPUP STREAK: 1 volta al giorno dopo la mezzanotte ===
var STREAK_POPUP_KEY_BASE = 'quizienza_streak_autopopup_shown';
function getStreakPopupKey() {
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
    return `${STREAK_POPUP_KEY_BASE}_${user}_diritto_privato`;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function hasShownStreakPopupToday() {
    try { return localStorage.getItem(getStreakPopupKey()) === todayISO(); } catch { return false; }
}
function markStreakPopupShownToday() {
    try { localStorage.setItem(getStreakPopupKey(), todayISO()); } catch { }
}

// === Missed-day popup (tendina Slancio) ===
const MISSED_POPUP_KEY_BASE = 'quizienza_streak_missed_popup_shown';
function getMissedPopupKey() {
    const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
    return `${MISSED_POPUP_KEY_BASE}_${user}_diritto_privato`;
}
function hasShownMissedPopupToday() {
    try { return localStorage.getItem(getMissedPopupKey()) === todayISO(); } catch { return false; }
}
function markMissedPopupShownToday() {
    try { localStorage.setItem(getMissedPopupKey(), todayISO()); } catch { }
}
function _missedYesterday() {
    try {
        // Preferisci il nuovo sistema
        if (typeof getTodayDate === 'function' && typeof formatDateStorage === 'function' && typeof streakState !== 'undefined') {
            const y = new Date(getTodayDate());
            y.setDate(y.getDate() - 1);
            const yStr = formatDateStorage(y);
            const entry = (streakState.history || []).find(e => formatDateStorage(e.date) === yStr);
            const goal = (streakState.dailyCardGoal || 1);
            return !(entry && (entry.cardsStudied || 0) >= goal);
        }
    } catch (_) { /* fall-through */ }
    try {
        // Fallback sistema precedente
        if (typeof streakData !== 'undefined') {
            const fmt = (d) => (typeof formatDateForStorage === 'function') ? formatDateForStorage(d) : d.toISOString().slice(0,10);
            const now = new Date();
            const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
            const yStr = fmt(y);
            const entry = (streakData.history || []).find(e => fmt(new Date(e.date)) === yStr);
            const goal = (streakData.dailyCardGoal || 1);
            return !(entry && (entry.cardsStudied || 0) >= goal);
        }
    } catch (_) { }
    return false;
}

// === Completion popup (mostra solo una volta quando completi la soglia) ===
const STREAK_COMPLETION_KEY_BASE = 'quizienza_streak_completion_popup_shown';
function getCompletionPopupKey() {
  const user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : 'anonymous';
  return `${STREAK_COMPLETION_KEY_BASE}_${user}_diritto_privato`;
}
function hasShownCompletionPopupToday() {
  try { return localStorage.getItem(getCompletionPopupKey()) === todayISO(); } catch { return false; }
}
function markCompletionPopupShownToday() {
  try { localStorage.setItem(getCompletionPopupKey(), todayISO()); } catch { }
}
function maybeShowDailyStreakPopup(context = 'auto') {
    if (context !== 'auto') return;
    try {
        if (hasShownStreakPopupToday()) return;
        if (typeof _streakTodayCompleted === 'function' && _streakTodayCompleted()) return;

        const tryShow = () => {
            // Streak popup: 1 volta al giorno, solo dopo la guida
            try {
                if (typeof window.showStreakPopup === 'function') {
                    window.showStreakPopup('auto');
                    // marca come mostrato per oggi
                    markStreakPopupShownToday();
                    try { if (typeof streakPopupFixNumbers === 'function') streakPopupFixNumbers('auto'); } catch(_){ }
                }
            } catch (_) { }
        };

        const waitGuide = () => {
            // aspetta chiusura guida e della tendina Slancio se aperta per altri motivi
            if (document.getElementById('modes-help-modal') || document.getElementById('streak-popup')) {
                setTimeout(waitGuide, 800);
            } else {
                tryShow();
            }
        };
        waitGuide();
    } catch (e) { console.warn('maybeShowDailyStreakPopup error:', e); }
}

// === Augment non distruttivo per lo Streak Popup ===
function ensureStreakAugmentation(context) {
    // prova a individuare l'overlay esistente
    let overlay = document.getElementById('streak-popup') || document.querySelector('.streak-overlay');
    if (!overlay) {
        // crea overlay minimale se manca
        overlay = document.createElement('div');
        overlay.id = 'streak-popup';
        overlay.className = 'streak-overlay';
        document.body.appendChild(overlay);
    }

    // Assicura una sheet/dialog
    let sheet = overlay.querySelector('.streak-sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.className = 'streak-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.innerHTML = '<button class="streak-close" type="button" aria-label="Chiudi">×</button>' +
            '<div class="streak-header">' +
            '  <h3 class="streak-number">Slancio</h3>' +
            '  <p class="streak-msg"></p>' +
            '</div>' +
            '<div class="streak-actions"><button class="streak-primary" type="button">OK</button></div>';
        overlay.appendChild(sheet);
        const okBtn = sheet.querySelector('.streak-primary');
        const closeBtn = sheet.querySelector('.streak-close');
        if (okBtn) okBtn.addEventListener('click', () => overlay.remove());
        if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    const header = sheet.querySelector('.streak-header') || sheet;

    // Progress
    if (!sheet.querySelector('.streak-progress')) {
        const prog = document.createElement('div');
        prog.className = 'streak-progress';
        prog.setAttribute('aria-live', 'polite');
        prog.innerHTML = '<div class="streak-bar"><div class="streak-fill" style="width:0%"></div></div><div class="streak-msg"></div>';
        header.insertAdjacentElement('afterend', prog);
    }

    // Daily goal input
    if (!sheet.querySelector('#streak-daily-cards')) {
        const daily = document.createElement('div');
        daily.className = 'streak-daily-goal';
        const val = (typeof streakData !== 'undefined' && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 10;
        daily.innerHTML = '<label for="streak-daily-cards">Carte giornaliere per attivare lo slancio</label>' +
            `<input type="number" id="streak-daily-cards" min="1" step="1" value="${val}" />` +
            '<small class="daily-goal-hint">Il giorno conta nello slancio solo quando raggiungi questa soglia.</small>';
        const prog = sheet.querySelector('.streak-progress');
        (prog ? prog : header).insertAdjacentElement('afterend', daily);

        const dailyInput = daily.querySelector('#streak-daily-cards');
        dailyInput.addEventListener('change', function () {
            const v = parseInt(this.value, 10);
            if (typeof streakData !== 'undefined') {
                streakData.dailyCardGoal = (isNaN(v) || v < 1) ? 1 : v;
                try { if (typeof saveStreakData === 'function') saveStreakData(); } catch (_) { }
            }
            refreshStreakTodaySummary();
        });
    }

    // Today summary
    if (!sheet.querySelector('.streak-today-summary')) {
        const sum = document.createElement('div');
        sum.className = 'streak-today-summary';
        sum.innerHTML = '<span class="label">Carte di oggi:</span><span id="streak-today-count">0</span><span class="sep">/</span><span id="streak-today-target">0</span>';
        const daily = sheet.querySelector('.streak-daily-goal');
        (daily ? daily : header).insertAdjacentElement('afterend', sum);
    }

    // Reset button
    let actions = sheet.querySelector('.streak-actions');
    if (!actions) {
        actions = document.createElement('div');
        actions.className = 'streak-actions';
        actions.innerHTML = '<button class="streak-primary" type="button">OK</button>';
        sheet.appendChild(actions);
        const okBtn = actions.querySelector('.streak-primary');
        if (okBtn) okBtn.addEventListener('click', () => overlay.remove());
    }
    if (!actions.querySelector('.streak-reset')) {
        const reset = document.createElement('button');
        reset.className = 'streak-reset';
        reset.type = 'button';
        reset.title = 'Azzera slancio';
        reset.textContent = 'Reset slancio';
        reset.addEventListener('click', () => { 
            if (!confirm('Vuoi azzerare lo slancio?')) return; 
            try { if (window.StreakSystem && typeof window.StreakSystem.reset === 'function') { window.StreakSystem.reset(); } } catch(_){}
            try { resetStreakData(); } catch(_){}
        });
        actions.appendChild(reset);
    }

    // Titoli coerenti
    try {
        const todayCompleted = (typeof _streakTodayCompleted === 'function') ? _streakTodayCompleted() : false;
        const h3 = sheet.querySelector('.streak-number');
        const p = sheet.querySelector('.streak-msg');
        if (h3) h3.textContent = todayCompleted ? 'Giorno completato ✅' : 'Completa la soglia di oggi';
        if (p) p.textContent = todayCompleted ? 'Hai raggiunto l’obiettivo giornaliero.' : 'Studia ancora qualche carta per sbloccare lo slancio.';
    } catch (_) { }

    // Paint iniziale: se si arriva da fine sessione e non c'è storico, mostra le carte davvero svolte
    let sessionCount = (context === 'session_end' && typeof currentCardIndex === 'number') ? currentCardIndex : undefined;
    const currentStored = getTodayStudiedCount();
    const initialCount = (typeof sessionCount === 'number' && currentStored === 0) ? sessionCount : currentStored;
    refreshStreakTodaySummary(initialCount);
}

// Installa il wrapper non distruttivo DOPO che eventuali definizioni originali sono state caricate
(function () {
    function installStreakWrapper() {
        if (!window.__origShowStreakPopupRef) {
            window.__origShowStreakPopupRef = (typeof window.showStreakPopup === 'function') ? window.showStreakPopup : null;
        }
        window.showStreakPopup = function (context = 'auto') {
            // Regola: 
            // - 'auto' => solo popup leggero "Completa la soglia di oggi" (NO pannello Slancio)
            // - 'session_end' o 'manual' => pannello Slancio originale
            if (context === 'auto') {
                try { ensureStreakAugmentation(context); } catch (e) { console.warn('ensureStreakAugmentation failed:', e); }
                return;
            }
            if (typeof window.__origShowStreakPopupRef === 'function') {
                try { window.__origShowStreakPopupRef(context); } catch (e) { console.warn('orig showStreakPopup failed:', e); }
            }
        };
    }
    // post-macro-task per garantire che definizioni successive siano già presenti
    if (document.readyState === 'loading') { setTimeout(installStreakWrapper, 0); }
    else { setTimeout(installStreakWrapper, 0); }
})();

// ===== Pulsante "Termina sessione" (FAB) =====
function ensureEndSessionButton() {
    let btn = document.getElementById('end-session-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'end-session-btn';
        btn.className = 'end-session-btn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Termina sessione');
        btn.innerHTML = '<i class="fas fa-flag-checkered"></i><span>Termina sessione</span>';
        btn.addEventListener('click', () => { try { endSession(); } catch (e) { console.warn('endSession failed', e); } });
        document.body.appendChild(btn);
    }
    btn.style.display = 'flex';
}
function hideEndSessionButton() {
    const btn = document.getElementById('end-session-btn');
    if (btn) btn.style.display = 'none';
}

// ===== Streak helpers: verifica e mostra popup appena la soglia è raggiunta =====
function _streakTodayCompleted() {
    try {
        if (typeof streakData === 'undefined') return false;
        const fmt = (d) => (typeof formatDateForStorage === 'function') ? formatDateForStorage(d) : d.toISOString().slice(0, 10);
        const todayStr = fmt(new Date());
        const entry = (streakData.history || []).find(e => fmt(new Date(e.date)) === todayStr);
        return entry ? ((entry.cardsStudied || 0) >= (streakData.dailyCardGoal || 1)) : false;
    } catch (_) { return false; }
}
function maybeShowStreakAfterIncrement() {
    // Non aprire più il pannello "Slancio di Studio" al raggiungimento della soglia
    return;
}
// === Streak: carte studiate OGGI ===
function getTodayStudiedCount() {
    try {
        if (typeof streakData === 'undefined') return 0;
        const fmt = d => (typeof formatDateForStorage === 'function') ? formatDateForStorage(d) : d.toISOString().slice(0, 10);
        const todayStr = fmt(new Date());
        const entry = (streakData.history || []).find(e => fmt(new Date(e.date)) === todayStr);
        return entry ? (parseInt(entry.cardsStudied || 0, 10) || 0) : 0;
    } catch (_) { return 0; }
}
function refreshStreakTodaySummary() {
    try {
        const current = getTodayStudiedCount();
        const goal = (streakData && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 1;
        const curEl = document.getElementById('streak-today-count');
        const tgtEl = document.getElementById('streak-today-target');
        if (curEl) curEl.textContent = String(current);
        if (tgtEl) tgtEl.textContent = String(goal);
        if (typeof updateStreakProgressBar === 'function') updateStreakProgressBar();
    } catch (e) { console.warn('refreshStreakTodaySummary failed:', e); }
}
// Fallback minimale per showStreakPopup se non definita altrove
if (typeof window.showStreakPopup !== 'function') {
    window.showStreakPopup = function (context = 'auto') {
        try {
            const todayCompleted = (typeof _streakTodayCompleted === 'function') ? _streakTodayCompleted() : false;
            const id = 'streak-popup';
            let overlay = document.getElementById(id);
            const title = todayCompleted ? 'Giorno completato ✅' : 'Completa la soglia di oggi';
            const subtitle = todayCompleted ? 'Hai raggiunto l’obiettivo giornaliero.' : 'Studia ancora qualche carta per sbloccare lo slancio.';

            if (!overlay) {
                overlay = document.createElement('div');
                overlay.id = id;
                overlay.className = 'streak-overlay';
                overlay.innerHTML = `
          <div class="streak-sheet" role="dialog" aria-modal="true">
            <button class="streak-close" type="button" aria-label="Chiudi">×</button>
            <div class="streak-header">
              <h3 class="streak-number">${title}</h3>
              <p class="streak-msg">${subtitle}</p>
            </div>

            <div class="streak-progress" aria-live="polite">
              <div class="streak-bar"><div class="streak-fill" style="width:0%"></div></div>
              <div class="streak-msg"></div>
            </div>

            <div class="streak-daily-goal">
              <label for="streak-daily-cards">Carte giornaliere per attivare lo slancio</label>
              <input type="number" id="streak-daily-cards" min="1" step="1" value="${(typeof streakData !== 'undefined' && streakData.dailyCardGoal) ? streakData.dailyCardGoal : 10}" />
              <small class="daily-goal-hint">Il giorno conta nello slancio solo quando raggiungi questa soglia.</small>
            </div>

            <div class="streak-today-summary">
              <span class="label">Carte di oggi:</span>
              <span id="streak-today-count">0</span>
              <span class="sep">/</span>
              <span id="streak-today-target">0</span>
            </div>

            <div class="streak-actions">
              <button class="streak-primary" type="button">OK</button>
            </div>
          </div>`;
                document.body.appendChild(overlay);
                // wiring
                const btn = overlay.querySelector('.streak-primary');
                const closeBtn = overlay.querySelector('.streak-close');
                if (btn) btn.addEventListener('click', () => overlay.remove());
                if (closeBtn) closeBtn.addEventListener('click', () => overlay.remove());
                overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

                const dailyInput = overlay.querySelector('#streak-daily-cards');
                if (dailyInput) {
                    dailyInput.addEventListener('change', function () {
                        const v = parseInt(this.value, 10);
                        if (typeof streakData !== 'undefined') {
                            streakData.dailyCardGoal = (isNaN(v) || v < 1) ? 1 : v;
                            try { saveStreakData(); } catch (_) { }
                        }
                        try { refreshStreakTodaySummary(); } catch (_) { }
                        try { updateStreakProgressBar(); } catch (_) { }
                    });
                }

                // primo paint coerente
                try { refreshStreakTodaySummary(); } catch (_) { }
                try { updateStreakProgressBar(); } catch (_) { }
            } else {
                const h3 = overlay.querySelector('.streak-number');
                const p = overlay.querySelector('.streak-msg');
                if (h3) h3.textContent = title;
                if (p) p.textContent = subtitle;
                try { refreshStreakTodaySummary(); } catch (_) { }
                try { updateStreakProgressBar(); } catch (_) { }
                overlay.style.display = 'block';
            }
        } catch (err) { console.warn('showStreakPopup fallback error:', err); }
    };
}
function handleAllCardsLimitChange(selectEl) {
    const val = parseInt(selectEl.value, 10);
    flashcardSessionLimit = Number.isNaN(val) ? 20 : val;
    try { localStorage.setItem('flashcardSessionLimit', String(flashcardSessionLimit)); } catch { }
    // aggiorna il sottotitolo senza rerender
    const sub = document.getElementById('all-cards-subtitle');
    if (sub) {
        sub.textContent = `Studia tutto il mazzo casualmente ${flashcardSessionLimit > 0 ? `(max ${flashcardSessionLimit} carte)` : '(tutte le carte)'}`;
    }
}

function generateStudyOptionsHTML(stats) {
    const totalCards = stats.totalCards;

    return `
        <div class="study-options-container">
            <div class="study-options">
                <div class="study-header">
                    <h2><i class="fas fa-graduation-cap"></i> Modalità di Studio</h2>
                    <div class="study-header-actions">
                        <button class="management-btn" onclick="showModesHelp()" title="Come funzionano le modalità" data-tooltip="Guida modalità">
                            <i class="fas fa-circle-question"></i> Guida
                        </button>
                    </div>
                    <p>Scegli come vuoi studiare le tue flashcards</p>
                </div>

                <div class="study-actions">
                    <button class="reset-deck-btn" onclick="confirmFlashcardsReset()" aria-label="Resetta i progressi">
                        Reset Progressi
                    </button>
                </div>

                <div class="study-option-cards">
                    ${generateStudyModeCardsHTML(stats)}
                </div>
                
                <!-- SEZIONE LE TUE FLASHCARD AGGIORNATA -->
                <div class="user-cards-section">
                    <div class="section-divider">
                        <span>Le tue Flashcard</span>
                    </div>
                    <div class="user-cards-grid">
                        <div class="study-option-card user-new-cards" onclick="studyUserCards('new')">
                            <div class="card-icon">
                                <i class="fas fa-plus-circle"></i>
                                <div class="card-badge">${stats.userNewCards}</div>
                            </div>
                            <div class="card-content">
                                <h4>Le tue Flashcard</h4>
                                <p>Studia le flashcard che hai <a href="#" onclick="event.stopPropagation(); openUserCardsPanel(); return false;"><u>creato tu</u></a></p>
                                <div class="card-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${stats.totalCards > 0 ? (stats.userNewCards / stats.totalCards) * 100 : 0}%"></div>
                                    </div>
                                    <span>${stats.userNewCards}/${stats.totalCards}</span>
                                </div>
                            </div>
                            <div class="card-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                        
                        <div class="study-option-card user-due-cards" onclick="studyUserCards('due')">
                            <div class="card-icon">
                                <i class="fas fa-clock"></i>
                                <div class="card-badge">${stats.userDueCards}</div>
                            </div>
                            <div class="card-content">
                                <h4>Le tue carte in scadenza</h4>
                                <p>Le tue flashcard programmate per il review</p>
                                <div class="card-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${stats.totalCards > 0 ? (stats.userDueCards / stats.totalCards) * 100 : 0}%"></div>
                                    </div>
                                    <span>${stats.userDueCards}/${stats.totalCards}</span>
                                </div>
                            </div>
                            <div class="card-arrow">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="study-footer">
                    <div class="deck-stats">
                        <div class="stat-item">
                            <i class="fas fa-brain"></i>
                            <span>Apprendimento: ${stats.learningPercentage}%</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-fire"></i>
                            <span>Serie: ${stats.currentStreak} giorni</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-target"></i>
                            <span>Ritenzione: ${stats.retentionRate}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Funzione helper per generare le carte delle modalità
function generateStudyModeCardsHTML(stats) {
    return `
        <!-- Flashcard predefinite -->
        <div class="study-option-card new-cards" onclick="studyNewCards()">
            <div class="card-icon">
                <i class="fas fa-plus-circle"></i>
                <div class="card-badge">${stats.newCards}</div>
            </div>
            <div class="card-content">
                <h4>Flashcard Predefinite</h4>
                <p>Studia le flashcard predefinite</p>
                <div class="card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.totalCards > 0 ? (stats.newCards / stats.totalCards) * 100 : 0}%"></div>
                    </div>
                    <span>${stats.newCards}/${stats.totalCards}</span>
                </div>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
        
        <!-- Predefinite in scadenza -->
        <div class="study-option-card due-cards" onclick="studyDueCards()">
            <div class="card-icon">
                <i class="fas fa-clock"></i>
                <div class="card-badge">${stats.dueCards}</div>
            </div>
            <div class="card-content">
                <h4>Predefinite in scadenza</h4>
                <p>Ripassa le carte pronte per il review</p>
                <div class="card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.totalCards > 0 ? (stats.dueCards / stats.totalCards) * 100 : 0}%"></div>
                    </div>
                    <span>${stats.dueCards}/${stats.totalCards}</span>
                </div>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
        
        <!-- Carte Difficili -->
        <div class="study-option-card difficult-cards" onclick="studyDifficultCards()">
            <div class="card-icon">
                <i class="fas fa-fire"></i>
                <div class="card-badge">${stats.difficultCards}</div>
            </div>
            <div class="card-content">
                <h4>Carte Difficili</h4>
                <p>Predefinite e create se +2 volte premi sulle scelte "Ripeti Subito/Presto/Dopo"</p>
                <div class="card-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${stats.totalCards > 0 ? (stats.difficultCards / stats.totalCards) * 100 : 0}%"></div>
                    </div>
                    <span>${stats.difficultCards}/${stats.totalCards}</span>
                </div>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
        
        <!-- Tutte le Carte -->
        <div class="study-option-card all-cards" onclick="studyAllCards()">
            <div class="card-icon">
                <i class="fas fa-random"></i>
            </div>
            <div class="card-content">
                <h4>Tutte le Carte</h4>
                <p id="all-cards-subtitle">
                  Studia tutto il mazzo casualmente ${flashcardSessionLimit > 0 ? `(max ${flashcardSessionLimit} carte)` : '(tutte le carte)'}
                </p>
                <div class="session-limit-control" onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()" ontouchstart="event.stopPropagation()" onclick="event.stopPropagation()">
                    <label for="all-cards-limit">Limite carte:</label>
                    <select id="all-cards-limit" class="session-limit-select"
                            onchange="handleAllCardsLimitChange(this)"
                            onpointerdown="event.stopPropagation()" onmousedown="event.stopPropagation()"
                            ontouchstart="event.stopPropagation()" onclick="event.stopPropagation()">
                        <option value="5"  ${flashcardSessionLimit === 5 ? 'selected' : ''}>5 carte</option>
                        <option value="10" ${flashcardSessionLimit === 10 ? 'selected' : ''}>10 carte</option>
                        <option value="15" ${flashcardSessionLimit === 15 ? 'selected' : ''}>15 carte</option>
                        <option value="20" ${flashcardSessionLimit === 20 ? 'selected' : ''}>20 carte</option>
                        <option value="30" ${flashcardSessionLimit === 30 ? 'selected' : ''}>30 carte</option>
                        <option value="50" ${flashcardSessionLimit === 50 ? 'selected' : ''}>50 carte</option>
                        <option value="70" ${flashcardSessionLimit === 70 ? 'selected' : ''}>70 carte</option>
                        <option value="90" ${flashcardSessionLimit === 90 ? 'selected' : ''}>90 carte</option>
                        <option value="120" ${flashcardSessionLimit === 120 ? 'selected' : ''}>120 carte</option>
                        <option value="150" ${flashcardSessionLimit === 150 ? 'selected' : ''}>150 carte</option>
                        <option value="0"  ${flashcardSessionLimit === 0 ? 'selected' : ''}>Tutte le carte</option>
                    </select>
                </div>
                <div class="card-stats">
                    <div class="stat">
                        <i class="fas fa-check-circle"></i>
                        <span>${stats.learnedCards} imparate</span>
                    </div>
                    <div class="stat">
                        <i class="fas fa-chart-line"></i>
                        <span>${stats.retentionRate}% ritenzione</span>
                    </div>
                </div>
            </div>
            <div class="card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;
}

function generateStudySessionHTML() {
    return `
        <div class="study-session" style="display: none;">
            <!-- Header Sessione -->
            <div class="session-header">
                <div class="session-info">
                    <div class="session-stats">
                        <div class="stat">
                            <i class="fas fa-clock"></i>
                            <span id="session-time">00:00</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-check-circle"></i>
                            <span id="cards-reviewed">0</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-chart-line"></i>
                            <span id="session-accuracy">0%</span>
                        </div>
                    </div>
                </div>
                <div class="session-progress">
                    <div class="progress-info">
                        <span id="deck-progress">0/0</span>
                        <span id="progress-percent">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="session-progress-bar" style="width: 0%"></div>
                    </div>
                </div>
            </div>
            
            <!-- Flashcard -->
            <div class="flashcard-main">
                <div class="flashcard-container-large">
                    <div class="flashcard" id="current-flashcard">
                        <div class="flashcard-inner">
                            <!-- Fronte -->
                            <div class="flashcard-front">
                                <div class="card-content">
                                    <div class="card-header">
                                        <span class="card-number">1</span>
                                        <span class="card-type">Domanda</span>
                                    </div>
                                    <div class="question-content">
                                        <div class="question-scroll-container">
                                            <h3 id="flashcard-front">Caricamento...</h3>
                                        </div>
                                    </div>
                                    <div class="card-hint">
                                        <i class="fas fa-hand-pointer"></i>
                                        <span>Trascina la flashcard per rivelare la risposta</span>
                                    </div>
                                </div>
                            </div>
                            <!-- Retro -->
                            <div class="flashcard-back">
                                <div class="card-content">
                                    <div class="card-header">
                                        <span class="card-number">1</span>
                                        <span class="card-type">Risposta</span>
                                    </div>
                                    <div class="answer-content">
                                        <div class="answer-scroll-container">
                                            <p id="flashcard-back">Caricamento...</p>
                                        </div>
                                    </div>
                                    <div class="card-hint">
                                        <i class="fas fa-star"></i>
                                        <span id="rating-hint-text">Scegli quando rivedere questa carta</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Sezione Rating Dinamica -->
                <div class="rating-section" id="rating-section" style="display: none;">
                    <h4 id="rating-title">Quando vuoi ripassare questa carta?</h4>
                    
                    <!-- Pulsanti Rating Normal (mostrato per default) -->
                    <div class="rating-buttons-grid" id="normal-rating-buttons">
                        <button class="rate-btn difficult" onclick="rateCardWithInterval(${INTERVALS.ONE_MINUTE})">
                            <div class="rate-icon">
                                <i class="fas fa-redo-alt"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Ripeti Subito</span>
                                <span class="rate-interval">1 minuto</span>
                            </div>
                        </button>
                        
                        <button class="rate-btn hard" onclick="rateCardWithInterval(${INTERVALS.FIFTEEN_MINUTES})">
                            <div class="rate-icon">
                                <i class="fas fa-history"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Ripeti Presto</span>
                                <span class="rate-interval">15 minuti</span>
                            </div>
                        </button>
                        
                        <button class="rate-btn good" onclick="rateCardWithInterval(${INTERVALS.ONE_HOUR})">
                            <div class="rate-icon">
                                <i class="fas fa-hourglass-half"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Ripeti Dopo</span>
                                <span class="rate-interval">1 ora</span>
                            </div>
                        </button>
                        
                        <button class="rate-btn success" onclick="rateCardWithInterval(${INTERVALS.ONE_DAY})">
                            <div class="rate-icon">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Rivedi Domani</span>
                                <span class="rate-interval">1 giorno</span>
                            </div>
                        </button>
                        
                        <button class="rate-btn success" onclick="rateCardWithInterval(${INTERVALS.THREE_DAYS})">
                            <div class="rate-icon">
                                <i class="fas fa-calendar-week"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Rivedi tra 3 Giorni</span>
                                <span class="rate-interval">3 giorni</span>
                            </div>
                        </button>
                        
                        <button class="rate-btn easy" onclick="rateCardWithInterval(${INTERVALS.SEVEN_DAYS})">
                            <div class="rate-icon">
                                <i class="fas fa-calendar-alt"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Rivedi tra 1 Settimana</span>
                                <span class="rate-interval">7 giorni</span>
                            </div>
                        </button>

                        <!-- Opzione aggiuntiva: non ripetere più questa carta -->
                        <button class="rate-btn danger" onclick="neverRepeatCurrentCard()">
                            <div class="rate-icon">
                                <i class="fas fa-ban"></i>
                            </div>
                            <div class="rate-info">
                                <span class="rate-title">Non ripetere più</span>
                                <span class="rate-interval">Escludi questa carta</span>
                            </div>
                        </button>
                    </div>
                    
                    <!-- Pulsante Singolo per Modalità In Scadenza (nascosto di default) -->
                    <div class="due-mode-rating" id="due-mode-rating" style="display: none;">
                        <div class="single-rating-button">
                            <button onclick="rateCardWithInterval(0)" id="due-next-button">
                            Continua con la prossima carta
                            </button>
                        </div>
                        </div>
                    
                    <div class="rating-footer">
                        <button class="secondary-btn review-again-btn" onclick="reviewFlashcardAgain()">
                            <i class="fas fa-eye"></i>
                            <span>Rivedi Flashcard</span>
                        </button>
                        <button class="secondary-btn" onclick="backToStudyOptions()">
                            <i class="fas fa-arrow-left"></i>
                            <span>Esci Sessione</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function generateCompletionHTML() {
    return `
        <div class="session-complete" style="display: none;">
            <div class="completion-content">
                <div class="completion-icon">
                    <i class="fas fa-trophy"></i>
                </div>
                <h2>Sessione Completata!</h2>
                <p>Hai completato tutte le carte per oggi</p>
                
                <div class="session-summary">
                    <div class="summary-grid">
                        <div class="summary-item">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <span class="summary-value" id="summary-correct">0</span>
                                <span class="summary-label">Carte riviste</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <i class="fas fa-clock"></i>
                            <div>
                                <span class="summary-value" id="summary-time">00:00</span>
                                <span class="summary-label">Tempo totale</span>
                            </div>
                        </div>
                        <div class="summary-item">
                            <i class="fas fa-chart-line"></i>
                            <div>
                                <span class="summary-value" id="summary-accuracy">0%</span>
                                <span class="summary-label">Precisione</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="completion-actions">
                    <button class="primary-btn" onclick="closeFlashcardsToDashboard()">
                        <i class="fas fa-check"></i>
                        <span>Termina Sessione</span>
                    </button>
                    <button class="secondary-btn" onclick="studyMoreCards()">
                        <i class="fas fa-redo"></i>
                        <span>Studia Altre Carte</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ===================== //
// FUNZIONI FLASHCARDS CORRETTE //
// ===================== //

function initializeOralSubjects() {
    loadFlashcardProgress();
}

// ===================== //
// GESTIONE CONTENUTI FLASHCARDS //
// ===================== //

function enhanceFlashcardStructure() {
    const allCards = [...dirittoPrivatoFlashcards, ...userCustomFlashcards];

    if (allCards.length === 0) {
        console.warn('⚠️ Nessuna flashcard disponibile dal file esterno');
        // Nessun fallback: usiamo solo il file domande/domandedirittoprivato.js
    }

    dirittoPrivatoFlashcards = dirittoPrivatoFlashcards.map(card => {
        return {
            ...card,
            type: card.type || cardTypes.BASIC,
            tags: card.tags || [],
            media: card.media || { images: [], audio: null },
            difficulty: card.difficulty || 'medium',
            created: card.created || new Date(),
            modified: card.modified || new Date(),
            streak: card.streak || 0,
            ease: card.ease || 2.5,
            interval: card.interval || 0,
            reviews: card.reviews || 0,
            fromNewCardsCount: card.fromNewCardsCount || 0,
            isDifficult: Boolean(card.isDifficult),
            difficultAddedAt: card.difficultAddedAt || null,
            isUserCard: false,
            doNotRepeat: !!card.doNotRepeat
        };
    });

    userCustomFlashcards = userCustomFlashcards.map(card => {
        return {
            ...card,
            type: card.type || cardTypes.BASIC,
            tags: card.tags || [],
            media: card.media || { images: [], audio: null },
            difficulty: card.difficulty || 'medium',
            created: card.created || new Date(),
            modified: card.modified || new Date(),
            streak: card.streak || 0,
            ease: card.ease || 2.5,
            interval: card.interval || 0,
            reviews: card.reviews || 0,
            fromNewCardsCount: card.fromNewCardsCount || 0,
            isDifficult: Boolean(card.isDifficult),
            difficultAddedAt: card.difficultAddedAt || null,
            isUserCard: true,
            doNotRepeat: !!card.doNotRepeat
        };
    });
}

function exportFlashcards() {
    enhanceFlashcardStructure();
    const allCards = [...dirittoPrivatoFlashcards, ...userCustomFlashcards];
    const dataStr = JSON.stringify(allCards, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `flashcards_diritto_privato_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Flashcards esportate con successo!', 'info');
}

// ===================== //
// STATISTICHE E ANALISI //
// ===================== //

function getFlashcardStats() {
    const allCards = getAllFlashcards();
    const totalCards = allCards.length;
    const newCards = getNewCards().length;
    const dueCards = getDueCards().length;
    const difficultCards = getDifficultCards().length;
    const userNewCards = getUserCards().length;
    const userDueCards = getUserDueCards().length;
    const defaultCardsCount = getDefaultCards().length;
    const learnedCards = allCards.filter(card =>
        card.reviews && card.reviews > 0
    ).length;

    const learningPercentage = totalCards > 0 ?
        Math.round((learnedCards / totalCards) * 100) : 0;

    const retentionRate = calculateRetentionRate();

    return {
        totalCards,
        newCards,
        dueCards,
        difficultCards,
        userNewCards,
        userDueCards,
        defaultCardsCount,
        learnedCards,
        learningPercentage,
        retentionRate,
        currentStreak: getCurrentStreak(),
        totalReviews: allCards.reduce((sum, card) =>
            sum + (card.reviews || 0), 0
        )
    };
}

function calculateRetentionRate() {
    const allCards = getAllFlashcards();
    const reviewedCards = allCards.filter(card =>
        card.reviews && card.reviews > 0
    );

    if (reviewedCards.length === 0) return 0;

    const successfulCards = reviewedCards.filter(card =>
        (card.streak || 0) >= 2
    );

    return Math.round((successfulCards.length / reviewedCards.length) * 100);
}

function getCurrentStreak() {
    const today = new Date().toDateString();
    const lastSession = localStorage.getItem('lastFlashcardSession');

    if (!lastSession) {
        localStorage.setItem('lastFlashcardSession', today);
        localStorage.setItem('currentFlashcardStreak', '1');
        return 1;
    }

    if (lastSession === today) {
        return parseInt(localStorage.getItem('currentFlashcardStreak') || '1');
    }

    const lastDate = new Date(lastSession);
    const todayDate = new Date(today);
    const diffTime = todayDate - lastDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        const currentStreak = parseInt(localStorage.getItem('currentFlashcardStreak') || '0') + 1;
        localStorage.setItem('currentFlashcardStreak', currentStreak.toString());
        localStorage.setItem('lastFlashcardSession', today);
        return currentStreak;
    } else {
        localStorage.setItem('currentFlashcardStreak', '1');
        localStorage.setItem('lastFlashcardSession', today);
        return 1;
    }
}

// Sostituisci completamente updateModeStats
function updateModeStats() {
    const modes = ['new', 'due', 'difficult', 'all', 'user_new', 'user_due', 'default'];

    modes.forEach(mode => {
        const stats = getModeStats(mode);

        const badge = document.querySelector(`.study-option-card.${mode.replace('_', '-')} .card-badge`);
        if (badge && mode !== 'all') {
            badge.textContent = stats.total;
        }

        const progressFill = document.querySelector(`.study-option-card.${mode.replace('_', '-')} .progress-fill`);
        if (progressFill) {
            progressFill.style.width = `${stats.percentage}%`;
        }

        const progressSpan = document.querySelector(`.study-option-card.${mode.replace('_', '-')} .card-progress span`);
        if (progressSpan && mode !== 'all') {
            const allCards = getAllFlashcards();
            progressSpan.textContent = `${stats.total}/${allCards.length}`;
        }
    });

    updateGlobalStats();
}

function getModeStats(mode) {
    let cards = [];

    switch (mode) {
        case 'new':
            cards = getNewCards();
            break;
        case 'due':
            cards = getDueCards();
            break;
        case 'difficult':
            cards = getDifficultCards();
            break;
        case 'all':
            cards = getAllCards();
            break;
        case 'user_new':
            cards = getUserCards();
            break;
        case 'user_due':
            cards = getUserDueCards();
            break;
        case 'default':
            cards = getDefaultCards();
            break;
    }

    const allCards = getAllFlashcards();

    return {
        total: cards.length,
        percentage: allCards.length > 0
            ? Math.round((cards.length / allCards.length) * 100)
            : 0
    };
}

function updateGlobalStats() {
    const allCards = getAllFlashcards();
    const totalCards = allCards.length;
    const learnedCards = allCards.filter(c => c.reviews > 0).length;
    const learningPercentage = totalCards > 0
        ? Math.round((learnedCards / totalCards) * 100)
        : 0;

    const reviewedCards = allCards.filter(c => c.reviews > 0);
    const successfulCards = reviewedCards.filter(c => c.streak >= 2);
    const retentionRate = reviewedCards.length > 0
        ? Math.round((successfulCards.length / reviewedCards.length) * 100)
        : 0;

    const currentStreak = getCurrentStreak();

    const statItems = document.querySelectorAll('.deck-stats .stat-item');

    if (statItems[0]) {
        statItems[0].querySelector('span').textContent = `Apprendimento: ${learningPercentage}%`;
    }

    if (statItems[1]) {
        statItems[1].querySelector('span').textContent = `Serie: ${currentStreak} giorni`;
    }

    if (statItems[2]) {
        statItems[2].querySelector('span').textContent = `Ritenzione: ${retentionRate}%`;
    }
}

// ===================== //
// ESPORTAZIONE E IMPORT //
// ===================== //

function exportFlashcardsAsText() {
    enhanceFlashcardStructure();
    const allCards = getAllFlashcards();

    let textContent = "RIEPILOGO FLASHCARDS DIRITTO PRIVATO\n";
    textContent += "========================================\n\n";

    // Flashcard predefinite
    if (dirittoPrivatoFlashcards.length > 0) {
        textContent += "FLASHCARD PREDEFINITE:\n";
        textContent += "---------------------\n";
        dirittoPrivatoFlashcards.forEach((card, index) => {
            textContent += `CARTA ${index + 1}:\n`;
            textContent += `DOMANDA: ${card.front}\n`;
            textContent += `RISPOSTA: ${card.back}\n`;

            if (card.reviews > 0) {
                textContent += `STATISTICHE: ${card.reviews} ripetizioni, streak: ${card.streak || 0}\n`;
            }

            textContent += "─".repeat(50) + "\n\n";
        });
    }

    // Flashcard utente
    if (userCustomFlashcards.length > 0) {
        textContent += "\nLE TUE FLASHCARD PERSONALIZZATE:\n";
        textContent += "-----------------------------\n";
        userCustomFlashcards.forEach((card, index) => {
            textContent += `CARTA PERSONALE ${index + 1}:\n`;
            textContent += `DOMANDA: ${card.front}\n`;
            textContent += `RISPOSTA: ${card.back}\n`;

            if (card.reviews > 0) {
                textContent += `STATISTICHE: ${card.reviews} ripetizioni, streak: ${card.streak || 0}\n`;
            }

            textContent += "─".repeat(50) + "\n\n";
        });
    }

    textContent += `\nTOTALE: ${allCards.length} carte (${dirittoPrivatoFlashcards.length} predefinite + ${userCustomFlashcards.length} personalizzate)\n`;
    textContent += `Data esportazione: ${new Date().toLocaleDateString('it-IT')}\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `riepilogo_flashcards_diritto_privato_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showNotification('Riepilogo esportato come testo!', 'info');
}

function confirmFlashcardsReset() {
    const confirmed = confirm('Sei sicuro di voler resettare tutte le flashcard? Questa operazione ripristina le carte iniziali e cancella ogni progresso. Le tue flashcard personalizzate verranno mantenute.');
    if (!confirmed) {
        return;
    }

    if (resetFlashcardsProgress()) {
        showNotification('Flashcards resettate. Tutto è tornato allo stato iniziale.', 'success');
    }
}

function importFlashcards(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const importedCards = JSON.parse(e.target.result);
            if (Array.isArray(importedCards)) {
                const normalized = importedCards.map(normalizeCard);
                // Distingui tra carte utente e predefinite
                const userCards = normalized.filter(card => card.isUserCard);
                const defaultCards = normalized.filter(card => !card.isUserCard);

                userCustomFlashcards.push(...userCards);
                dirittoPrivatoFlashcards.push(...defaultCards);

                saveUserFlashcards();
                saveFlashcardProgress();
                showNotification('Flashcards importate con successo!', 'info');
                renderFlashcardsScreen();
            }
        } catch (error) {
            console.error('Errore importazione:', error);
            showNotification('Errore nell\'importazione del file', 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function resetFlashcardsProgress() {
    stopCounterAutoUpdate();
    /* Consenti di rivedere i tasti rapidi una sola volta dopo il reset */
    resetKeyboardHintSeen();

    let baseCards = originalFlashcardsSnapshot.length
        ? originalFlashcardsSnapshot
        : (window.dirittoPrivatoFlashcards && window.dirittoPrivatoFlashcards.length
            ? window.dirittoPrivatoFlashcards.map(normalizeCard)
            : []);

    if (!originalFlashcardsSnapshot.length) {
        captureOriginalSnapshot(baseCards);
    }

    // Resetta solo le flashcard predefinite, mantieni quelle utente
    dirittoPrivatoFlashcards = baseCards.map(resetCardState);
    sessionCards = [];
    currentCardIndex = 0;
    isAnswerShown = false;
    sessionCorrectAnswers = 0;
    clearSessionState();
    localStorage.removeItem(STORAGE_KEYS.FLASHCARDS);
    localStorage.removeItem('flashcardProgress');
    enhanceFlashcardStructure();
    saveFlashcardProgress();
    renderFlashcardsScreen();
    return true;
}

// ===================== //
// STATISTICHE DETTAGLIATE //
// ===================== //

function showStats() {
    const stats = getFlashcardStats();

    const statsHTML = `
        <div class="stats-modal-overlay">
            <div class="stats-modal-container">
                <div class="stats-modal-header">
                    <div class="stats-header-content">
                        <i class="fas fa-chart-line"></i>
                        <h3>Statistiche di Apprendimento</h3>
                    </div>
                    <button class="close-stats-btn" onclick="closeStats()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="stats-modal-body">
                    <!-- Statistiche Principali -->
                    <div class="stats-cards-grid">
                        <div class="stats-card primary">
                            <div class="stats-card-icon">
                                <i class="fas fa-layer-group"></i>
                            </div>
                            <div class="stats-card-content">
                                <div class="stats-card-value">${stats.totalCards}</div>
                                <div class="stats-card-label">Carte Totali</div>
                            </div>
                        </div>
                        
                        <div class="stats-card success">
                            <div class="stats-card-icon">
                                <i class="fas fa-graduation-cap"></i>
                            </div>
                            <div class="stats-card-content">
                                <div class="stats-card-value">${stats.learningPercentage}%</div>
                                <div class="stats-card-label">Apprendimento</div>
                            </div>
                        </div>
                        
                        <div class="stats-card info">
                            <div class="stats-card-icon">
                                <i class="fas fa-brain"></i>
                            </div>
                            <div class="stats-card-content">
                                <div class="stats-card-value">${stats.retentionRate}%</div>
                                <div class="stats-card-label">Ritenzione</div>
                            </div>
                        </div>
                        
                        <div class="stats-card warning">
                            <div class="stats-card-icon">
                                <i class="fas fa-fire"></i>
                            </div>
                            <div class="stats-card-content">
                                <div class="stats-card-value">${stats.currentStreak}</div>
                                <div class="stats-card-label">Serie Giorni</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Dettagli Statistiche -->
                    <div class="stats-details-section">
                        <h4><i class="fas fa-list-ul"></i> Dettagli</h4>
                        <div class="stats-details-list">
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-plus-circle"></i> Carte nuove
                                </span>
                                <span class="stats-detail-value">${stats.newCards}</span>
                            </div>
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-clock"></i> Carte in scadenza
                                </span>
                                <span class="stats-detail-value">${stats.dueCards}</span>
                            </div>
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-exclamation-triangle"></i> Carte difficili
                                </span>
                                <span class="stats-detail-value">${stats.difficultCards}</span>
                            </div>
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-user-edit"></i> Carte personalizzate
                                </span>
                                <span class="stats-detail-value">${stats.userCardsCount}</span>
                            </div>
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-book"></i> Carte predefinite
                                </span>
                                <span class="stats-detail-value">${stats.defaultCardsCount}</span>
                            </div>
                            <div class="stats-detail-item">
                                <span class="stats-detail-label">
                                    <i class="fas fa-redo"></i> Ripetizioni totali
                                </span>
                                <span class="stats-detail-value">${stats.totalReviews}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-modal-footer">
                    <button class="stats-export-btn" onclick="exportFlashcardsAsText()">
                        <i class="fas fa-download"></i> Esporta Riepilogo
                    </button>
                    <button class="stats-close-btn" onclick="closeStats()">
                        <i class="fas fa-check"></i> Chiudi
                    </button>
                </div>
            </div>
        </div>
    `;

    const existingStats = document.querySelector('.stats-modal-overlay');
    if (existingStats) existingStats.remove();

    document.body.insertAdjacentHTML('beforeend', statsHTML);

    setTimeout(() => {
        const overlay = document.querySelector('.stats-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) {
                    closeStats();
                }
            });
        }
    }, 100);
}

function closeStats() {
    const statsOverlay = document.querySelector('.stats-modal-overlay');
    if (statsOverlay) {
        statsOverlay.classList.add('closing');
        setTimeout(() => {
            if (statsOverlay.parentNode) {
                statsOverlay.parentNode.removeChild(statsOverlay);
            }
        }, 300);
    }
}

// ===================== //
// CARICAMENTO FLASHCARDS - MODIFICATO PER CARICARE DAL FILE ESTERNO //
// ===================== //

function loadDirittoPrivatoFlashcards(callback) {
    console.log("Caricamento flashcards Diritto Privato...");

    const oldScript = document.getElementById('diritto-privato-script');
    if (oldScript) {
        document.head.removeChild(oldScript);
    }

    const script = document.createElement('script');
    script.id = 'diritto-privato-script';
    // MODIFICA: Percorso corretto per la sottocartella domande
    script.src = 'domande/domandedirittoprivato.js';

    script.onload = function () {
        console.log('Flashcards Diritto Privato caricate con successo');
        console.log('Window flashcards:', window.dirittoPrivatoFlashcards);

        if (window.dirittoPrivatoFlashcards && window.dirittoPrivatoFlashcards.length > 0) {
            dirittoPrivatoFlashcards = window.dirittoPrivatoFlashcards.map(normalizeCard);
            captureOriginalSnapshot(dirittoPrivatoFlashcards);
            console.log("✅ Flashcards caricate dal file esterno:", dirittoPrivatoFlashcards.length, "carte");
        } else {
            console.warn("⚠️ Nessuna flashcard trovata in window.dirittoPrivatoFlashcards. Nessun fallback caricato.");
            dirittoPrivatoFlashcards = [];
            captureOriginalSnapshot(dirittoPrivatoFlashcards);
        }

        enhanceFlashcardStructure();

        setTimeout(() => {
            debugFlashcardState();
            testFlashcards();
        }, 100);

        if (callback) callback();
    };

    script.onerror = function () {
        console.error('❌ Errore nel caricamento delle flashcards Diritto Privato');
        console.log('⚠️ Nessun fallback: verranno mostrate 0 flashcards.');
        dirittoPrivatoFlashcards = [];
        captureOriginalSnapshot(dirittoPrivatoFlashcards);
        enhanceFlashcardStructure();

        if (callback) callback();
    };

    document.head.appendChild(script);
}


// ===================== //
// SISTEMA SLANCIO GIORNI (STREAK) //
// ===================== //

// Costanti per lo streak
const STREAK_GOALS = [7, 14, 30, 90, 180, 365];
const STORAGE_KEYS_STREAK = {
    STREAK_DATA: 'quizienza_flashcards_streak_data',
    STREAK_POPUP_SHOWN: 'quizienza_flashcards_streak_popup_shown'
};

// Struttura dati per lo streak
let streakData = {
    current: 0,
    longest: 0,
    lastDate: null,
    goal: 7,                 // obiettivo giorni consecutivi
    dailyCardGoal: 10,       // NUOVO: quante carte servono per attivare lo slancio odierno
    history: [],             // [{date: ISO|string|Date, cardsStudied: number, sessionCount: number}]
    totalSessions: 0,
    totalCardsStudied: 0
};

// Inizializza il sistema streak
function initializeStreakSystem() {
    loadStreakData();
    setupStreakEventListeners();
}

// Carica i dati dello streak
function loadStreakData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS_STREAK.STREAK_DATA);
        if (saved) {
            const data = JSON.parse(saved);

            // Merge con i default per compatibilità
            streakData = {
                current: data.current || 0,
                longest: data.longest || 0,
                lastDate: data.lastDate ? new Date(data.lastDate) : null,
                goal: data.goal || 7,
                dailyCardGoal: data.dailyCardGoal || 10,
                history: data.history || [],
                totalSessions: data.totalSessions || 0,
                totalCardsStudied: data.totalCardsStudied || 0
            };

            // Verifica e aggiorna lo streak corrente
            updateCurrentStreak();
        }
    } catch (error) {
        console.warn('Errore nel caricamento dati streak:', error);
        resetStreakData();
    }
}

// Salva i dati dello streak
function saveStreakData() {
    try {
        localStorage.setItem(STORAGE_KEYS_STREAK.STREAK_DATA, JSON.stringify(streakData));
    } catch (error) {
        console.warn('Errore nel salvataggio dati streak:', error);
    }
}

// Resetta i dati dello streak
function resetStreakData() {
    streakData = {
        current: 0,
        longest: 0,
        lastDate: null,
        goal: 7,
        history: [],
        totalSessions: 0,
        totalCardsStudied: 0
    };
    saveStreakData();
}

// Aggiorna lo streak corrente in base alla data
function updateCurrentStreak() {
    if (!streakData.lastDate) return;

    const today = getTodayDate();
    const lastDate = new Date(streakData.lastDate);
    const daysDiff = getDaysDifference(lastDate, today);

    // Se è passato più di un giorno, resetta lo streak
    if (daysDiff > 1) {
        streakData.current = 0;
        saveStreakData();
    }
}

// Registra una sessione di studio completata
function recordStudySession(cardsStudied = 0) {
    const today = getTodayDate();
    const todayStr = formatDateForStorage(today);

    // Trova o crea l'entry di oggi
    let entry = streakData.history.find(e => formatDateForStorage(new Date(e.date)) === todayStr);
    const wasCompleted = entry ? (entry.cardsStudied || 0) >= (streakData.dailyCardGoal || 1) : false;

    if (!entry) {
        entry = { date: today, cardsStudied: 0, sessionCount: 0 };
        streakData.history.unshift(entry);
        // Mantieni ultimi 400 giorni
        if (streakData.history.length > 400) streakData.history = streakData.history.slice(0, 400);
    }

    // Aggiorna conteggi di oggi
    entry.cardsStudied = (entry.cardsStudied || 0) + (cardsStudied || 0);
    entry.sessionCount = (entry.sessionCount || 0) + 1;

    const nowCompleted = entry.cardsStudied >= (streakData.dailyCardGoal || 1);

    // Se abbiamo appena raggiunto la soglia, aggiorna lo streak
    if (!wasCompleted && nowCompleted) {
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const yStr = formatDateForStorage(yesterday);
        const yEntry = streakData.history.find(e => formatDateForStorage(new Date(e.date)) === yStr);
        const yCompleted = yEntry ? (yEntry.cardsStudied || 0) >= (streakData.dailyCardGoal || 1) : false;

        streakData.current = yCompleted ? (streakData.current || 0) + 1 : 1;
        if (streakData.current > (streakData.longest || 0)) streakData.longest = streakData.current;
        streakData.lastDate = today; // ultima data completata
    }

    // Aggiorna totali
    streakData.totalSessions++;
    streakData.totalCardsStudied += (cardsStudied || 0);

    saveStreakData();
    updateStreakIndicator();

    // Ritorna true solo se oggi ha appena raggiunto la soglia
    return (!wasCompleted && nowCompleted);
}

// Restituisce la data di oggi a mezzanotte
function getTodayDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Differenza in giorni tra due date
function getDaysDifference(date1, date2) {
    const timeDiff = date2.getTime() - date1.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
}

// Formatta la data per storage
function formatDateForStorage(date) {
    return date.toISOString().split('T')[0];
}

// Formatta la data per visualizzazione
function formatDateForDisplay(date) {
    return new Intl.DateTimeFormat('it-IT', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
    }).format(date);
}
// =====================================================
// SISTEMA STREAK FLASHCARDS - VERSIONE CORRETTA
// =====================================================
// Incolla questo ALLA FINE di flashcard-system.js
// oppure crea un file separato e includilo dopo
// =====================================================

(function () {
    'use strict';

    // =====================================================
    // CONFIGURAZIONE
    // =====================================================

    const STREAK_CONFIG = {
        goals: [7, 14, 30, 60, 90, 180, 365],
        defaultGoal: 7,
        defaultDailyCards: 10,
        storageKey: 'quizienza_streak_v2',
        popupShownKey: 'quizienza_streak_popup_v2'
    };

    // =====================================================
    // STATO STREAK
    // =====================================================

    let streakState = {
        current: 0,
        longest: 0,
        lastDate: null,
        goal: STREAK_CONFIG.defaultGoal,
        dailyCardGoal: STREAK_CONFIG.defaultDailyCards,
        history: [],
        totalSessions: 0,
        totalCardsStudied: 0
    };

    // =====================================================
    // UTILITY FUNCTIONS
    // =====================================================

    function getTodayDate() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function formatDateStorage(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function formatDateDisplay(date) {
        return new Intl.DateTimeFormat('it-IT', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        }).format(new Date(date));
    }

    function getDaysDiff(date1, date2) {
        const d1 = new Date(date1).setHours(0, 0, 0, 0);
        const d2 = new Date(date2).setHours(0, 0, 0, 0);
        return Math.floor((d2 - d1) / 86400000);
    }

    // =====================================================
    // STORAGE
    // =====================================================

    function loadStreak() {
        try {
            const saved = localStorage.getItem(STREAK_CONFIG.storageKey);
            if (!saved) return;

            const data = JSON.parse(saved);

            streakState.current = data.current || 0;
            streakState.longest = data.longest || 0;
            streakState.lastDate = data.lastDate ? new Date(data.lastDate) : null;
            streakState.goal = data.goal || STREAK_CONFIG.defaultGoal;
            streakState.dailyCardGoal = data.dailyCardGoal || STREAK_CONFIG.defaultDailyCards;
            streakState.history = Array.isArray(data.history) ? data.history : [];
            streakState.totalSessions = data.totalSessions || 0;
            streakState.totalCardsStudied = data.totalCardsStudied || 0;

            checkStreakValidity();
        } catch (e) {
            console.warn('Errore caricamento streak:', e);
        }
    }

    function saveStreak() {
        try {
            const data = {
                current: streakState.current,
                longest: streakState.longest,
                lastDate: streakState.lastDate ? streakState.lastDate.toISOString() : null,
                goal: streakState.goal,
                dailyCardGoal: streakState.dailyCardGoal,
                history: streakState.history,
                totalSessions: streakState.totalSessions,
                totalCardsStudied: streakState.totalCardsStudied
            };
            localStorage.setItem(STREAK_CONFIG.storageKey, JSON.stringify(data));
        } catch (e) {
            console.warn('Errore salvataggio streak:', e);
        }
    }

    function checkStreakValidity() {
        if (!streakState.lastDate) return;

        const today = getTodayDate();
        const daysDiff = getDaysDiff(streakState.lastDate, today);

        if (daysDiff > 1) {
            streakState.current = 0;
            saveStreak();
        }
    }

    // =====================================================
    // LOGICA STREAK
    // =====================================================

    function recordSession(cardsStudied) {
        if (!cardsStudied || cardsStudied <= 0) return false;

        const today = getTodayDate();
        const todayStr = formatDateStorage(today);

        // Trova entry di oggi
        let todayEntry = streakState.history.find(e =>
            formatDateStorage(e.date) === todayStr
        );

        const wasCompleted = todayEntry ?
            (todayEntry.cardsStudied >= streakState.dailyCardGoal) : false;

        if (!todayEntry) {
            todayEntry = { date: today.toISOString(), cardsStudied: 0, sessionCount: 0 };
            streakState.history.unshift(todayEntry);

            // Mantieni solo 365 giorni
            if (streakState.history.length > 365) {
                streakState.history = streakState.history.slice(0, 365);
            }
        }

        // Aggiorna conteggi
        todayEntry.cardsStudied += cardsStudied;
        todayEntry.sessionCount += 1;

        const nowCompleted = todayEntry.cardsStudied >= streakState.dailyCardGoal;

        // Se appena completato oggi
        if (!wasCompleted && nowCompleted) {
            // Controlla ieri
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = formatDateStorage(yesterday);

            const yesterdayEntry = streakState.history.find(e =>
                formatDateStorage(e.date) === yesterdayStr
            );

            const yesterdayCompleted = yesterdayEntry ?
                (yesterdayEntry.cardsStudied >= streakState.dailyCardGoal) : false;

            // Aggiorna streak
            streakState.current = yesterdayCompleted ? streakState.current + 1 : 1;

            if (streakState.current > streakState.longest) {
                streakState.longest = streakState.current;
            }

            streakState.lastDate = today;
        }

        // Totali
        streakState.totalSessions += 1;
        streakState.totalCardsStudied += cardsStudied;

        saveStreak();
        updateIndicator();

        return !wasCompleted && nowCompleted;
    }

    // =====================================================
    // UI - INDICATORE
    // =====================================================

    function updateIndicator() {
        const indicator = document.getElementById('streak-indicator');
        if (!indicator) return;

        const count = indicator.querySelector('.streak-count');
        if (count) {
            count.textContent = streakState.current;
        }

        indicator.title = `Slancio: ${streakState.current} giorni\nObiettivo: ${streakState.goal}\nRecord: ${streakState.longest}`;
    }

    function createIndicatorHTML() {
        return `
            <div class="streak-indicator" id="streak-indicator" 
                 style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1rem;
                        background:linear-gradient(135deg,#802433,#660a1f);color:white;
                        border-radius:12px;cursor:pointer;min-width:70px;justify-content:center;
                        box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:all 0.3s;">
                <i class="fas fa-fire" style="color:#FFD700;font-size:1.2rem;"></i>
                <span class="streak-count" style="font-weight:700;font-size:1.1rem;">${streakState.current}</span>
            </div>
        `;
    }

    // =====================================================
    // UI - POPUP
    // =====================================================

    function generateWeekHTML() {
        const today = getTodayDate();
        const weekStart = new Date(today);
        const dayOfWeek = today.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        weekStart.setDate(today.getDate() + diff);

        let html = '';

        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dayStr = formatDateStorage(day);

            const entry = streakState.history.find(e =>
                formatDateStorage(e.date) === dayStr
            );

            const cardsStudied = entry ? entry.cardsStudied : 0;
            const meetsGoal = cardsStudied >= streakState.dailyCardGoal;
            const isToday = formatDateStorage(day) === formatDateStorage(today);
            const isPast = day < today;

            let state = 'future';
            let bgColor = '#e9ecef';
            let textColor = '#6c757d';

            if (isToday) {
                state = meetsGoal ? 'studied' : 'today';
                bgColor = meetsGoal ? '#27ae60' : '#f39c12';
                textColor = 'white';
            } else if (isPast) {
                state = meetsGoal ? 'studied' : 'missed';
                bgColor = meetsGoal ? '#27ae60' : '#e74c3c';
                textColor = 'white';
            }

            const dayName = formatDateDisplay(day).split(' ')[0];

            html += `
                <div style="text-align:center;">
                    <div style="width:100%;aspect-ratio:1;border-radius:50%;
                                background:${bgColor};color:${textColor};
                                display:flex;flex-direction:column;justify-content:center;
                                align-items:center;font-size:0.75rem;position:relative;
                                box-shadow:0 2px 8px rgba(0,0,0,0.1);">
                        <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;">${dayName}</span>
                        <span style="font-size:1rem;font-weight:800;margin-top:2px;">${day.getDate()}</span>
                        ${cardsStudied > 0 ? `<span style="position:absolute;top:-4px;right:-4px;
                            background:#802433;color:white;border-radius:50%;width:20px;height:20px;
                            font-size:0.65rem;display:flex;align-items:center;justify-content:center;
                            border:2px solid white;">${cardsStudied}</span>` : ''}
                    </div>
                </div>
            `;
        }

        return html;
    }

    function showPopup(context) {
        // Controlla se già mostrato oggi (solo per auto)
        if (context === 'auto') {
            const today = formatDateStorage(getTodayDate());
            const lastShown = localStorage.getItem(STREAK_CONFIG.popupShownKey);

            if (lastShown === today) return;

            // Controlla se oggi è già completato
            const todayEntry = streakState.history.find(e =>
                formatDateStorage(e.date) === today
            );
            if (todayEntry && todayEntry.cardsStudied >= streakState.dailyCardGoal) {
                return;
            }

            localStorage.setItem(STREAK_CONFIG.popupShownKey, today);
        }

        // Rimuovi popup esistente
        const existing = document.getElementById('streak-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'streak-popup';
        const isDark = document.body.classList.contains('dark-mode');
        const sheetBg   = isDark ? '#151517' : '#ffffff';
        const summaryBg = isDark ? 'linear-gradient(135deg,#1f2024,#191a1e)' : 'linear-gradient(135deg,#f8f9fa,#e9ecef)';
        const muted     = isDark ? '#c7cad1' : '#6c757d';
        const surface   = isDark ? '#0f1012' : '#ffffff';
        const surface2  = isDark ? '#131417' : '#f8f9fa';
        const hairline  = isDark ? '#2a2b31' : '#dee2e6';
        const textMain  = isDark ? '#e9ecef' : '#495057';

        popup.style.cssText = `
            position:fixed;top:0;left:0;width:100%;height:100%;
            background:rgba(0,0,0,${isDark? '0.65':'0.6'});backdrop-filter:blur(8px);
            display:flex;justify-content:center;align-items:center;
            z-index:10000;opacity:0;transition:opacity 0.3s;
        `;

        // Footer dinamico in base al contesto: dalle modalità (manual/auto) mostra SOLO reset;
        // al termine sessione (session_end) mostra Continua + Torna + Reset
        const footerHTML = (context === 'session_end')
            ? `
                <button class="streak-btn streak-btn--primary" onclick="continueStudyingFromStreakPopup()">
                    <i class="fas fa-fire"></i><span>Continua a studiare</span>
                </button>
                <button class="streak-btn streak-btn--ghost" onclick="(function(){ try{document.getElementById('streak-popup').remove();}catch(_){ } try{ if (typeof backToStudyOptions==='function') backToStudyOptions(); }catch(_){ } })()">
                    <i class="fas fa-th-large"></i><span>Torna alle modalità</span>
                </button>
                <button class="streak-btn streak-btn--ghost" id="streak-reset-btn">
                    <i class="fas fa-undo"></i><span>Reset slancio</span>
                </button>`
            : `
                <button class="streak-btn streak-btn--ghost" id="streak-reset-btn">
                    <i class="fas fa-undo"></i><span>Reset slancio</span>
                </button>`;

        popup.innerHTML = `
            <div style="background:${sheetBg};border-radius:18px;width:90%;max-width:480px;
                        max-height:90vh;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.35);
                        transform:perspective(1200px) translateY(8px) scale(0.96) rotateX(2deg);
                        transition:transform 280ms cubic-bezier(.2,.8,.2,1);">
                <style>
                  #streak-popup .streak-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 1.2rem;border-radius:12px;border:1px solid ${hairline};cursor:pointer;font-weight:700;letter-spacing:.2px;transition:transform .15s ease, box-shadow .15s ease, background .2s ease;box-shadow:0 6px 14px rgba(0,0,0,.08)}
                  #streak-popup .streak-btn i{opacity:.95}
                  #streak-popup .streak-btn--primary{background:linear-gradient(135deg,#802433,#660a1f);color:#fff;border:none;box-shadow:0 10px 20px rgba(128,36,51,.35), inset 0 1px 0 rgba(255,255,255,.08)}
                  #streak-popup .streak-btn--primary:hover{transform:translateY(-2px);box-shadow:0 14px 26px rgba(128,36,51,.45)}
                  #streak-popup .streak-btn--primary:active{transform:translateY(0)}
                  #streak-popup .streak-btn--ghost{background:${surface};color:${isDark?'#f3f4f6':'#222'};}
                  #streak-popup .streak-btn--ghost:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.12)}
                  #streak-popup .streak-btn--ghost:active{transform:translateY(0)}
                  #streak-popup .streak-week .day{transform:translateZ(0);transition:transform .2s ease, box-shadow .2s ease}
                  #streak-popup .streak-week .day:hover{transform:translateY(-2px);box-shadow:0 8px 16px rgba(0,0,0,.08)}
                </style>
                
                <!-- Header -->
                <div style="background:linear-gradient(135deg,#802433,#660a1f);
                            color:white;padding:1.5rem;display:flex;
                            justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:0.75rem;">
                        <i class="fas fa-fire" style="font-size:1.8rem;color:#FFD700;"></i>
                        <h3 style="margin:0;font-size:1.4rem;">Slancio di Studio</h3>
                    </div>
                    <button onclick="document.getElementById('streak-popup').remove()" 
                            style="background:rgba(255,255,255,0.2);border:none;color:white;
                                   width:36px;height:36px;border-radius:50%;cursor:pointer;
                                   font-size:1.2rem;display:flex;align-items:center;
                                   justify-content:center;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Body -->
                <div style="padding:1.5rem;max-height:60vh;overflow-y:auto;">
                    
                    <!-- Summary -->
                    <div style="text-align:center;margin-bottom:2rem;padding:1.5rem;
                                background:${summaryBg};
                                border-radius:12px;">
                        <div style="font-size:4rem;font-weight:800;
                                    background:linear-gradient(135deg,#802433,#c41e3a);
                                    -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                                    line-height:1;">${streakState.current}</div>
                        <div style="color:${muted};font-size:1rem;font-weight:500;margin-top:0.5rem;">
                            giorni consecutivi
                        </div>
                        <div style="margin-top:.75rem;font-weight:700;color:${textMain};">
                            Oggi: <span class="streak-today-count" data-cards-today>0</span>
                            <span class="sep">/</span>
                            <span id="streak-daily-target" data-goal-text>0</span>
                        </div>
                        
                        <!-- Progress -->
                        <div style="background:${surface};border-radius:10px;padding:1rem;margin-top:1rem;">
                            <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;font-size:0.9rem;font-weight:600;color:${textMain};">
                                <span>Obiettivo: ${streakState.current}/${streakState.goal}</span>
                                <span style="color:#802433;">${Math.min(100, Math.round((streakState.current / streakState.goal) * 100))}%</span>
                            </div>
                            <div style="height:8px;background:${hairline};border-radius:4px;overflow:hidden;">
                                <div style="height:100%;background:linear-gradient(90deg,#27ae60,#2ecc71);
                                            width:${Math.min(100, (streakState.current / streakState.goal) * 100)}%;
                                            transition:width 0.6s;border-radius:4px;"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Calendario -->
                    <div style="margin:2rem 0;">
                        <div style="text-align:center;margin-bottom:1rem;font-weight:600;color:${textMain};font-size:1.05rem;">
                            <i class="fas fa-calendar-week" style="margin-right:0.5rem;"></i>
                            Settimana Corrente
                        </div>
                        <div class="streak-week" style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.5rem;">
                            ${generateWeekHTML()}
                        </div>
                    </div>

                    <!-- Settings -->
                    <div style="background:${surface2};border-radius:12px;padding:1.5rem;margin:2rem 0;border:1px solid ${hairline};">
                        <div style="margin-bottom:1.5rem;">
                            <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;font-weight:600;color:${textMain};">
                                <i class="fas fa-bullseye" style="color:#802433;"></i>
                                Obiettivo giorni
                            </label>
                            <select id="streak-goal" style="width:100%;padding:0.75rem;border:1px solid ${hairline};background:${surface};color:${isDark?'#f3f4f6':'#222'};border-radius:10px;font-size:0.95rem;">
                                ${STREAK_CONFIG.goals.map(g => `
                                    <option value="${g}" ${g === streakState.goal ? 'selected' : ''}>${g} giorni</option>
                                `).join('')}
                            </select>
                        </div>

                        <div>
                            <label style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;font-weight:600;color:${textMain};">
                                <i class="fas fa-layer-group" style="color:#802433;"></i>
                                Carte per completare il giorno
                            </label>
                            <input type="number" id="streak-daily" min="1" value="${streakState.dailyCardGoal}"
                                   style="width:100%;padding:0.75rem;border:1px solid ${hairline};background:${surface};color:${isDark?'#f3f4f6':'#222'};border-radius:10px;font-size:0.95rem;">
                            <small style="display:block;margin-top:0.5rem;font-size:0.8rem;color:${muted};">
                                Il giorno conta solo quando raggiungi questa soglia
                            </small>
                        </div>
                    </div>

                    <!-- Stats -->
                    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:2rem 0;">
                        <div style="background:${surface};border-radius:12px;padding:1rem;text-align:center;
                                    box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                            <i class="fas fa-trophy" style="font-size:1.8rem;color:#802433;margin-bottom:0.5rem;"></i>
                            <div style="font-size:1.8rem;font-weight:800;">${streakState.longest}</div>
                            <div style="font-size:0.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Record</div>
                        </div>
                        <div style="background:${surface};border-radius:12px;padding:1rem;text-align:center;
                                    box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                            <i class="fas fa-graduation-cap" style="font-size:1.8rem;color:#802433;margin-bottom:0.5rem;"></i>
                            <div style="font-size:1.8rem;font-weight:800;">${streakState.totalSessions}</div>
                            <div style="font-size:0.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Sessioni</div>
                        </div>
                        <div style="background:${surface};border-radius:12px;padding:1rem;text-align:center;
                                    box-shadow:0 4px 12px rgba(0,0,0,0.08);">
                            <i class="fas fa-layer-group" style="font-size:1.8rem;color:#802433;margin-bottom:0.5rem;"></i>
                            <div style="font-size:1.8rem;font-weight:800;">${streakState.totalCardsStudied}</div>
                            <div style="font-size:0.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Carte</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding:1.5rem;background:${surface2};border-top:1px solid ${hairline};display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">
                    ${footerHTML}
                </div>
            </div>
        `;

        document.body.appendChild(popup);

        // Event listeners
        const goalSelect = popup.querySelector('#streak-goal');
        const dailyInput = popup.querySelector('#streak-daily');
        const resetBtn = popup.querySelector('#streak-reset-btn');

        if (goalSelect) {
            goalSelect.addEventListener('change', function () {
                streakState.goal = parseInt(this.value);
                saveStreak();
                // Aggiorna progress bar
                const progressBar = popup.querySelector('[style*="width:"]');
                if (progressBar) {
                    progressBar.style.width = `${Math.min(100, (streakState.current / streakState.goal) * 100)}%`;
                }
            });
        }

        if (dailyInput) {
            dailyInput.addEventListener('change', function () {
                const val = parseInt(this.value);
                streakState.dailyCardGoal = val > 0 ? val : 1;
                saveStreak();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function(){
                if (!confirm('Vuoi azzerare lo slancio? Questa azione non può essere annullata.')) return;
                // Reset del nuovo sistema
                streakState = {
                    current: 0,
                    longest: 0,
                    lastDate: null,
                    goal: STREAK_CONFIG.defaultGoal,
                    dailyCardGoal: STREAK_CONFIG.defaultDailyCards,
                    history: [],
                    totalSessions: 0,
                    totalCardsStudied: 0
                };
                saveStreak();
                try { updateIndicator(); } catch(_){}
                try {
                    const todayEls = popup.querySelectorAll('[data-cards-today]');
                    todayEls.forEach(el => el.textContent = '0');
                    const goalText = popup.querySelector('[data-goal-text]');
                    if (goalText) goalText.textContent = String(streakState.dailyCardGoal||1);
                    const fill = popup.querySelector('.streak-progress-fill');
                    if (fill) fill.style.width = '0%';
                } catch(_){}
                // Prova a sincronizzare anche il vecchio sistema
                try {
                    if (typeof streakData !== 'undefined') {
                        streakData.current = 0; streakData.longest = 0; streakData.lastDate = null;
                        streakData.history = []; streakData.totalSessions = 0; streakData.totalCardsStudied = 0;
                        if (typeof saveStreakData === 'function') saveStreakData();
                    }
                } catch(_){ }
            });
        }

        // Imposta valori iniziali Oggi X/Y nel popup
        try {
            const todayStr = formatDateStorage(getTodayDate());
            const entry = streakState.history.find(e => formatDateStorage(e.date) === todayStr);
            const n = entry ? (entry.cardsStudied||0) : 0;
            const goalText = popup.querySelector('[data-goal-text]');
            const todayEls = popup.querySelectorAll('[data-cards-today]');
            if (todayEls.length) todayEls.forEach(el => el.textContent = String(n));
            if (goalText) goalText.textContent = String(streakState.dailyCardGoal||1);
        } catch(_){ }

        // Animazione entrata
        setTimeout(() => {
            popup.style.opacity = '1';
            const container = popup.querySelector('[style*="transform"]');
            if (container) container.style.transform = 'scale(1)';
        }, 10);

        // Chiudi con ESC
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                popup.remove();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

        // Chiudi cliccando fuori
        popup.addEventListener('click', (e) => {
            if (e.target === popup) popup.remove();
        });
    }

    // =====================================================
    // INTEGRAZIONE
    // =====================================================

    function integrateWithExisting() {
        // Salva originali
        if (typeof window.endSession === 'function' && !window._origEndSession) {
            window._origEndSession = window.endSession;

            window.endSession = function () {
                // Esegui originale
                window._origEndSession.apply(this, arguments);

                // Registra slancio usando SOLO le carte effettivamente studiate in sessione
                let cardsStudied = 0;
                try {
                    if (typeof window.__lastSessionStudiedCount === 'number') {
                        cardsStudied = window.__lastSessionStudiedCount;
                    } else if (typeof currentCardIndex === 'number') {
                        cardsStudied = currentCardIndex; // numero reale svolto nella sessione
                    }
                } catch (_) { /* noop */ }

                // Registra nel nuovo sistema (streakState) il numero reale di carte della sessione
                let justCompleted = false;
                if (cardsStudied > 0) {
                    try { justCompleted = !!recordSession(cardsStudied); } catch (_) { justCompleted = false; }
                }

                // Mostra il popup "Slancio di studio" SOLO se la giornata è appena stata completata
                try {
                    if (justCompleted && !hasShownCompletionPopupToday()) {
                        try {
                            if (typeof window.StreakSystem !== 'undefined' && typeof window.StreakSystem.show === 'function') {
                                window.StreakSystem.show('session_end');
                            } else if (typeof window.showStreakPopup === 'function') {
                                window.showStreakPopup('session_end');
                            }
                            try { if (typeof streakPopupFixNumbers === 'function') streakPopupFixNumbers('session_end'); } catch(_){}
                            markCompletionPopupShownToday();
                        } catch(_){ }
                    }
                } catch (e) { console.warn('streak popup show (post endSession) failed:', e); }
            };
        }

        // Inietta indicatore nell'header
        const injectIndicator = () => {
            const header = document.querySelector('.flashcards-header .header-stats');
            if (header && !document.getElementById('streak-indicator')) {
                const firstBadge = header.querySelector('.stat-badge');
                if (firstBadge) {
                    firstBadge.insertAdjacentHTML('beforebegin', createIndicatorHTML());

                    // Click listener
                    const indicator = document.getElementById('streak-indicator');
                    if (indicator) {
                        indicator.addEventListener('click', () => showPopup('manual'));
                    }
                }
            }
        };

        // Observer per quando si apre la schermata flashcards
        const observer = new MutationObserver(() => {
            const flashcardsScreen = document.getElementById('flashcards-screen');
            if (flashcardsScreen && flashcardsScreen.style.display !== 'none') {
                injectIndicator();
                // Disabilitato: non aprire automaticamente il popup "Slancio di Studio".
                // La logica giornaliera ora è gestita da maybeShowDailyStreakPopup() che mostra
                // solo il popup leggero "Completa la soglia di oggi" una volta al giorno.
                // Non aprire più automaticamente la tendina in caso di giorno saltato:
                // il pannello grande deve comparire SOLO nel momento in cui completi la soglia odierna
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Prova subito
        setTimeout(injectIndicator, 1000);
    }

    // =====================================================
    // API PUBBLICA
    // =====================================================

    window.StreakSystem = {
        show: (context) => showPopup(context || 'manual'),
        hide: () => {
            const popup = document.getElementById('streak-popup');
            if (popup) popup.remove();
        },
        getState: () => ({ ...streakState }),
        reset: () => {
            streakState = {
                current: 0,
                longest: 0,
                lastDate: null,
                goal: STREAK_CONFIG.defaultGoal,
                dailyCardGoal: STREAK_CONFIG.defaultDailyCards,
                history: [],
                totalSessions: 0,
                totalCardsStudied: 0
            };
            saveStreak();
            updateIndicator();
            console.log('✅ Streak resettato');
        },
        version: '2.0'
    };

    // =====================================================
    // INIT
    // =====================================================

    function init() {
        loadStreak();
        integrateWithExisting();
        console.log('✅ Sistema Streak inizializzato');
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

// =====================================================
// FINE SISTEMA STREAK
// =====================================================


// ===================== //
// DEBUG E UTILITY //
// ===================== //

function debugFlashcardState() {
    const allCards = getAllFlashcards();
    console.log("=== DEBUG STATO FLASHCARDS ===");
    console.log("DirittoPrivatoFlashcards:", dirittoPrivatoFlashcards.length, "carte");
    console.log("UserCustomFlashcards:", userCustomFlashcards.length, "carte");
    console.log("Totale:", allCards.length, "carte");
    console.log("SessionCards:", sessionCards);
    console.log("CurrentCardIndex:", currentCardIndex);
    console.log("CurrentCard:", sessionCards ? sessionCards[currentCardIndex] : "Nessuna");
    console.log("Study session element:", document.querySelector('.study-session'));
    console.log("Flashcard element:", document.getElementById('current-flashcard'));
    console.log("Front element:", document.getElementById('flashcard-front'));
    console.log("Back element:", document.getElementById('flashcard-back'));
    console.log("==============================");
}

function testFlashcards() {
    console.log("=== TEST FLASHCARDS ===");
    const allCards = getAllFlashcards();
    if (allCards && allCards.length > 0) {
        console.log("Flashcards caricate:", allCards.length);
        console.log("Predefinite:", dirittoPrivatoFlashcards.length);
        console.log("Utente:", userCustomFlashcards.length);
        console.log("Prima flashcard:", allCards[0]);

        sessionCards = [allCards[0]];
        currentCardIndex = 0;
        showCurrentCard();
    } else {
        console.log("Nessuna flashcard caricata!");
    }
    console.log("======================");
}

// Inizializza il limite di sessione per la modalità "Tutte le carte"
document.addEventListener('DOMContentLoaded', function () {
    loadUserFlashcards();
    loadFlashcardProgress();
    initializeOralSubjects();
    startRealTimeUpdates();

    // Inizializza il listener per il limite di sessione nella modalità "Tutte le carte"
    setTimeout(() => {
        const allCardsLimit = document.getElementById('all-cards-limit');
        if (allCardsLimit) {
            allCardsLimit.addEventListener('change', function (e) {
                const value = parseInt(e.target.value, 10);
                flashcardSessionLimit = Number.isNaN(value) ? 0 : value;
                localStorage.setItem('flashcardSessionLimit', String(flashcardSessionLimit));
                console.log('🔄 Limite sessione aggiornato:', flashcardSessionLimit);

                // Aggiorna il sottotitolo
                const sub = document.getElementById('all-cards-subtitle');
                if (sub) {
                    sub.textContent = `Studia tutto il mazzo casualmente ${flashcardSessionLimit > 0 ? `(max ${flashcardSessionLimit} carte)` : '(tutte le carte)'}`;
                }
            });
        }
    }, 500);
});





// === Slancio di studio: popup dark-mode aware (override) ===
(function(){
  function safeToday(){
    const d = new Date();
    d.setHours(0,0,0,0);
    return d;
  }
  function fmtStore(d){
    if (!d) return '';
    if (typeof formatDateForStorage === 'function') return formatDateForStorage(d);
    return new Date(d).toISOString().slice(0,10);
  }
  function dayNameIT(d){
    try { return d.toLocaleDateString('it-IT',{ weekday:'short'}); } catch(_) { return ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][d.getDay()]||''; }
  }
  function generateWeekHTML_local(state){
    const today = safeToday();
    const weekStart = new Date(today);
    const dow = today.getDay(); // 0=Dom
    const diff = dow === 0 ? -6 : 1 - dow; // settimana Lunedì-Domenica
    weekStart.setDate(today.getDate() + diff);

    const isDark = document.body.classList.contains('dark-mode');
    let html = '';

    for (let i=0;i<7;i++){
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate()+i);
      const key = fmtStore(day);
      const entry = (state.history||[]).find(e => fmtStore(e.date) === key);
      const cards = entry ? (entry.cardsStudied||0) : 0;
      const meets = cards >= (state.dailyCardGoal||1);
      const isToday = fmtStore(day) === fmtStore(today);
      const isPast = day < today;

      let bg = isDark ? '#2a2b31' : '#e9ecef';
      let fg = isDark ? '#c7cad1' : '#6c757d';
      if (isToday) { bg = meets ? '#27ae60' : (isDark ? '#c98b0f' : '#f39c12'); fg = '#ffffff'; }
      else if (isPast) { bg = meets ? '#27ae60' : '#e74c3c'; fg = '#ffffff'; }

      html += `
        <div class="day" style="text-align:center;">
          <div style="width:100%;aspect-ratio:1;border-radius:50%;background:${bg};color:${fg};
                      display:flex;flex-direction:column;justify-content:center;align-items:center;
                      font-size:0.75rem;position:relative;box-shadow:0 2px 8px rgba(0,0,0,0.10);">
            <span style="font-size:0.65rem;font-weight:700;text-transform:uppercase;">${dayNameIT(day)}</span>
            <span style="font-size:1rem;font-weight:800;margin-top:2px;">${day.getDate()}</span>
            ${cards>0 ? `<span style="position:absolute;top:-4px;right:-4px;background:#802433;color:#fff;border-radius:50%;width:20px;height:20px;font-size:0.65rem;display:flex;align-items:center;justify-content:center;border:2px solid ${isDark ? '#0f1012' : 'white'};">${cards}</span>` : ''}
          </div>
        </div>`;
    }
    return html;
  }

  function showStreakPopup(context){
    const state = (typeof streakData !== 'undefined' && streakData) ? streakData : {current:0, goal:7, dailyCardGoal:5, history:[], longest:0, totalSessions:0, totalCardsStudied:0};
    const cfg = (typeof STREAK_CONFIG !== 'undefined' && STREAK_CONFIG) ? STREAK_CONFIG : { popupShownKey: 'quizienza_streak_popup_shown' };

    // AUTO: non mostrare il pannello grande. Usa solo il popup leggero
    if (context === 'auto') {
      try {
        const today = fmtStore(safeToday());
        const last = localStorage.getItem(cfg.popupShownKey);
        if (last !== today) { try { localStorage.setItem(cfg.popupShownKey, today); } catch(_){} }
        if (typeof ensureStreakAugmentation === 'function') ensureStreakAugmentation('auto');
      } catch(_) { }
      return;
    }

    const prev = document.getElementById('streak-popup');
    if (prev) prev.remove();

    const isDark = document.body.classList.contains('dark-mode');
    const sheetBg   = isDark ? '#151517' : '#ffffff';
    const summaryBg = isDark ? 'linear-gradient(135deg,#1f2024,#191a1e)' : 'linear-gradient(135deg,#f8f9fa,#e9ecef)';
    const muted     = isDark ? '#c7cad1' : '#6c757d';
    const surface   = isDark ? '#0f1012' : '#ffffff';
    const surface2  = isDark ? '#131417' : '#f8f9fa';
    const hairline  = isDark ? '#2a2b31' : '#dee2e6';

    const overlay = document.createElement('div');
    overlay.id = 'streak-popup';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,${isDark? '0.65':'0.6'});backdrop-filter:blur(8px);display:flex;justify-content:center;align-items:center;z-index:10000;opacity:0;transition:opacity .25s;`;

    const pct = Math.min(100, (state.current||0) / (state.goal||1) * 100);

    overlay.innerHTML = `
      <style id="streak-popup-btn-styles">#streak-popup .streak-btn{display:inline-flex;align-items:center;gap:.5rem;padding:.9rem 1.2rem;border-radius:12px;border:1px solid ${hairline};cursor:pointer;font-weight:700;letter-spacing:.2px;transition:transform .15s ease, box-shadow .15s ease, background .2s ease;box-shadow:0 6px 14px rgba(0,0,0,.08)}#streak-popup .streak-btn i{opacity:.95}#streak-popup .streak-btn--primary{background:linear-gradient(135deg,#802433,#660a1f);color:#fff;border:none;box-shadow:0 10px 20px rgba(128,36,51,.35), inset 0 1px 0 rgba(255,255,255,.08)}#streak-popup .streak-btn--primary:hover{transform:translateY(-2px);box-shadow:0 14px 26px rgba(128,36,51,.45)}#streak-popup .streak-btn--primary:active{transform:translateY(0)}#streak-popup .streak-btn--ghost{background:${surface};color:${isDark?'#f3f4f6':'#222'};}#streak-popup .streak-btn--ghost:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(0,0,0,.12)}#streak-popup .streak-btn--ghost:active{transform:translateY(0)}</style>
      <div style="background:${sheetBg};border-radius:18px;width:90%;max-width:480px;max-height:90vh;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.35);transform:perspective(1200px) translateY(8px) scale(0.96) rotateX(2deg);transition:transform 280ms cubic-bezier(.2,.8,.2,1);">
        <div style="background:linear-gradient(135deg,#802433,#660a1f);color:#fff;padding:1.5rem;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:.75rem;"><i class=\"fas fa-fire\" style=\"font-size:1.8rem;color:#FFD700;\"></i><h3 style=\"margin:0;font-size:1.4rem;\">Slancio di Studio</h3></div>
          <button style="background:rgba(255,255,255,0.2);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:1.2rem;display:flex;align-items:center;justify-content:center;" onclick="document.getElementById('streak-popup').remove()"><i class=\"fas fa-times\"></i></button>
        </div>
        <div style="padding:1.5rem;max-height:60vh;overflow:auto;">
          <div style="text-align:center;margin-bottom:2rem;padding:1.5rem;background:${summaryBg};border-radius:12px;">
            <div style="font-size:4rem;font-weight:800;background:linear-gradient(135deg,#802433,#c41e3a);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;" id="streak-current">${state.current||0}</div>
            <div style="color:${muted};font-size:1rem;font-weight:500;margin-top:.5rem;">giorni consecutivi</div>
            <div style="background:${surface};border-radius:10px;padding:1rem;margin-top:1rem;">
              <div style="display:flex;justify-content:space-between;margin-bottom:.75rem;font-size:.9rem;font-weight:600;">
                <span data-goal-text>Obiettivo: ${state.current||0}/${state.goal||1}</span>
                <span style="color:#802433;">${Math.round(pct)}%</span>
              </div>
              <div style="height:8px;background:${hairline};border-radius:4px;overflow:hidden;"><div class="streak-progress-fill" style="height:100%;background:linear-gradient(90deg,#27ae60,#2ecc71);width:${pct}%;transition:width .6s;border-radius:4px;"></div></div>
            </div>
          </div>

          <div style="margin:2rem 0;">
            <div style="text-align:center;margin-bottom:1rem;font-weight:600;color:${isDark?'#e9ecef':'#495057'};font-size:1.05rem;"><i class=\"fas fa-calendar-week\" style=\"margin-right:.5rem;\"></i>Settimana Corrente</div>
            <div class="streak-week" style="display:grid;grid-template-columns:repeat(7,1fr);gap:.5rem;">${generateWeekHTML_local(state)}</div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:1rem 0;">
            <div style="background:${surface};border:1px solid ${hairline};border-radius:10px;padding:.75rem;">
              <label for="streak-goal" style="display:block;font-size:.8rem;color:${muted};margin-bottom:.35rem;font-weight:600;">Obiettivo giorni</label>
              <select id="streak-goal" style="width:100%;padding:.6rem;border-radius:8px;border:1px solid ${hairline};background:${surface};color:${isDark?'#f3f4f6':'#222'};">
                ${[3,5,7,14,21,30].map(v=>`<option value="${v}" ${v===(state.goal||0)?'selected':''}>${v}</option>`).join('')}
              </select>
            </div>
            <div style="background:${surface};border:1px solid ${hairline};border-radius:10px;padding:.75rem;">
              <label for="streak-daily" style="display:block;font-size:.8rem;color:${muted};margin-bottom:.35rem;font-weight:600;">Carte al giorno</label>
              <input id="streak-daily" type="number" min="1" step="1" value="${state.dailyCardGoal||1}" style="width:100%;padding:.6rem;border-radius:8px;border:1px solid ${hairline};background:${surface};color:${isDark?'#f3f4f6':'#222'};" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.75rem;">
            <div style="background:${surface};border:1px solid ${hairline};border-radius:12px;padding:1rem;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <i class="fas fa-trophy" style="font-size:1.8rem;color:#802433;margin-bottom:.5rem;"></i>
              <div style="font-size:1.8rem;font-weight:800;">${state.longest||0}</div>
              <div style="font-size:.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Record</div>
            </div>
            <div style="background:${surface};border:1px solid ${hairline};border-radius:12px;padding:1rem;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <i class="fas fa-calendar-day" style="font-size:1.8rem;color:#802433;margin-bottom:.5rem;"></i>
              <div style="font-size:1.8rem;font-weight:800;">${state.totalSessions||0}</div>
              <div style="font-size:.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Sessioni</div>
            </div>
            <div style="background:${surface};border:1px solid ${hairline};border-radius:12px;padding:1rem;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
              <i class="fas fa-layer-group" style="font-size:1.8rem;color:#802433;margin-bottom:.5rem;"></i>
              <div style="font-size:1.8rem;font-weight:800;" data-cards-today>${state.totalCardsStudied||0}</div>
              <div style="font-size:.75rem;color:${muted};font-weight:600;text-transform:uppercase;">Carte</div>
            </div>
          </div>
        </div>
        <div style="padding:1.5rem;background:${surface2};border-top:1px solid ${hairline};display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;">${(context==='session_end')
          ? `
              <button class=\"streak-btn streak-btn--primary\" onclick=\"continueStudyingFromStreakPopup()\"><i class=\"fas fa-fire\"></i><span>Continua a studiare</span></button>
              <button class=\"streak-btn streak-btn--ghost\" onclick=\"(function(){ try{document.getElementById('streak-popup').remove();}catch(_){ } try{ if (typeof backToStudyOptions==='function') backToStudyOptions(); }catch(_){ } })()\"><i class=\"fas fa-th-large\"></i><span>Torna alle modalità</span></button>
              <button class=\"streak-btn streak-btn--ghost\" id=\"streak-reset-btn\"><i class=\"fas fa-undo\"></i><span>Reset slancio</span></button>
            `
          : `
              <button class=\"streak-btn streak-btn--ghost\" id=\"streak-reset-btn\"><i class=\"fas fa-undo\"></i><span>Reset slancio</span></button>
            `}
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Listeners per impostazioni
    const goalSel = overlay.querySelector('#streak-goal');
    const dailyInp = overlay.querySelector('#streak-daily');
    const resetBtn = overlay.querySelector('#streak-reset-btn');
    if (goalSel) goalSel.addEventListener('change', function(){ if (typeof streakData !== 'undefined') { streakData.goal = parseInt(this.value)||7; if (typeof saveStreak === 'function') saveStreak(); const fill = overlay.querySelector('.streak-progress-fill'); if (fill) { const p = Math.min(100, (streakData.current||0)/(streakData.goal||1)*100); fill.style.width = p+'%'; } const t = overlay.querySelector('[data-goal-text]'); if (t) t.textContent = `Obiettivo: ${(streakData.current||0)}/${(streakData.goal||1)}`; } });
    if (dailyInp) dailyInp.addEventListener('change', function(){ if (typeof streakData !== 'undefined') { const v = parseInt(this.value); streakData.dailyCardGoal = v>0? v:1; if (typeof saveStreak === 'function') saveStreak(); }});
    if (resetBtn) resetBtn.addEventListener('click', function(){
      if (!confirm('Vuoi azzerare lo slancio?')) return;
      try {
        if (typeof streakData !== 'undefined') {
          streakData.current = 0; streakData.longest = 0; streakData.lastDate = null;
          streakData.history = []; streakData.totalSessions = 0; streakData.totalCardsStudied = 0;
          if (typeof saveStreakData === 'function') saveStreakData();
        }
      } catch(_){ }
      try { if (window.StreakSystem && typeof window.StreakSystem.reset === 'function') window.StreakSystem.reset(); } catch(_){ }
    });

    // ESC + click fuori
    const esc = (e)=>{ if (e.key==='Escape'){ overlay.remove(); document.removeEventListener('keydown',esc);} };
    document.addEventListener('keydown', esc);
    overlay.addEventListener('click', (e)=>{ if (e.target===overlay) overlay.remove(); });

    // Animazione entrata
    setTimeout(()=>{ overlay.style.opacity='1'; const card = overlay.querySelector('[style*="perspective(1200px)"]'); if (card) card.style.transform='perspective(1200px) translateY(0) scale(1) rotateX(0)'; },10);
  }

  // Pubblica override
  window.showStreakPopup = showStreakPopup;
})();
