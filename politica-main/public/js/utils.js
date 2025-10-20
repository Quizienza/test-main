// utils.js - Funzioni di utilità generale

// Mescola array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Formatta tempo
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Testo risultato in base al punteggio
function getResultText(percentage) {
    if (percentage >= 90) return "Perfetto!";
    if (percentage >= 70) return "Eccellente!";
    if (percentage >= 50) return "Buono";
    if (percentage >= 30) return "Discreto";
    return "Da migliorare";
}

// Mostra notifica
function showNotification(message, type = 'info') {
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        warning: 'fa-exclamation-triangle',
        error: 'fa-times-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 4000);
}

function getNotificationColor(type) {
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    return colors[type] || '#3b82f6';
}

// Carica domande per materia
function loadQuestionsForSubject(subject, callback) {
    const subjectQuestionFiles = {
        'politica': 'domande/domandepoleco.js',
        'organizzazione': 'domande/domandeorganizzazione.js',
        'eoi': 'domande/domandeeoi.js',
        'empi': 'domande/domandeempi.js',
        'ecopol': 'domande/domandeecopol.js',
        'privatoad': 'domande/domandeprivatoad.js',
        'dirittoprivato': 'domande/domandedirittoprivato.js',
    };
    
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

// Verifica se una materia ha domande
function hasQuestions(subject) {
    const subjectQuestionFiles = {
        'politica': '/public/domande/domandepoleco.js',
        'organizzazione': '/public/domande/domandeorganizzazione.js',
        'eoi': '/public/domande/domandeeoi.js',
        'empi': '/public/domande/domandeempi.js',
        'ecopol': '/public/domande/domandeecopol.js',
        'privatoad': '/public/domande/domandeprivatoad.js',
        'dirittoprivato': '/public/domande/domandedirittoprivato.js',
    };
    
    return Object.keys(subjectQuestionFiles).includes(subject);
}

// Aggiungi stili per le animazioni
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(notificationStyles);


// Helper generici usati dalla streak
window.isoToday = window.isoToday || (() => new Date().toISOString().slice(0,10));