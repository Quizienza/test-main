// ui-manager.js - Gestione dell'interfaccia utente

function initializeUIManager() {
    console.log('🎨 UI Manager inizializzato');
    setupTooltips();
    setupAccessibility();
}

// Setup tooltips
function setupTooltips() {
    const tooltipContainers = document.querySelectorAll('.tooltip-container');
    
    tooltipContainers.forEach(container => {
        // Per dispositivi touch
        container.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.preventDefault();
                e.stopPropagation();
                
                tooltipContainers.forEach(other => {
                    if (other !== container) {
                        other.classList.remove('active');
                    }
                });
                
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
}

// Setup accessibilità
function setupAccessibility() {
    // Migliora accessibilità tastiera
    document.addEventListener('keydown', function(e) {
        // Navigazione con Tab migliorata
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('mousedown', function() {
        document.body.classList.remove('keyboard-navigation');
    });
}

// Gestione responsive
function handleResize() {
    const isMobile = window.innerWidth <= 768;
    
    // Aggiorna classi responsive
    if (isMobile) {
        document.body.classList.add('mobile-view');
        document.body.classList.remove('desktop-view');
    } else {
        document.body.classList.add('desktop-view');
        document.body.classList.remove('mobile-view');
    }
}

// Inizializza responsive
window.addEventListener('resize', handleResize);
window.addEventListener('load', handleResize);

// Gestione scroll smooth
function setupSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Setup iniziale
document.addEventListener('DOMContentLoaded', function() {
    setupSmoothScroll();
});
