const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');

// The file got messed up internally from the multiple try{} DOM replacements. Let's fix it manually.
// First, restore the security kernel
s = s.replace(/try \{[\s\S]*?DOM = \{[\s\S]*?cards: document\.querySelectorAll\('\.project-card:not\(\.locked-secret\)'\)\s*\};\s*\} catch\(err\) \{/, `
    try {
        document.body.innerHTML = '<div style="background:#000;color:#ff0000;padding:2rem;font-family:monospace;font-size:1.5rem;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;">ACESSO NEGADO<br><br>' + msg + '</div>';
    } catch(e) {}
    // --- END SECURITY KERNEL ---

    const STATES = {
        STANDBY: 'STANDBY',             
        TRANSITIONING: 'TRANSITIONING', 
        ACTIVE_VOID: 'ACTIVE_VOID',     
        ARCHIVES: 'ARCHIVES'            
    };
    let currentState = STATES.STANDBY;

    let DOM;
    
    try {
        const getEl = (id) => document.getElementById(id) || document.createElement('div');
        DOM = {
            customCursor: document.getElementById('custom-cursor'),
            glassTooltip: getEl('glass-tooltip'),
            phase2: getEl('phase-2'),
            phase3: getEl('phase-3'),
            bgCanvas: document.getElementById('bg-canvas'),
            heroAction: document.getElementById('hero-action') || new Image(),
            heroWrapper: getEl('hero-action-wrapper'),
            blackHole: getEl('black-hole'),
            btnReturn: getEl('btn-return'),
            heroPhase2: document.getElementById('hero-phase2') || new Image(),
            heroPhase2Wrapper: getEl('hero-phase2-wrapper'),
            phase1Text: getEl('phase-1-text'),
            btnReturnWrapper: getEl('btn-return-wrapper'),
            btnReturnP3: getEl('btn-return-p3'),
            btnReturnWrapperP3: getEl('btn-return-wrapper-p3'),
            phase3TextDynamic: getEl('phase3-text-dynamic'),
            phase3TopTitle: getEl('phase3-top-title'),
            cards: document.querySelectorAll('.project-card:not(.locked-secret)')
        };
    } catch(err) {`
);

fs.writeFileSync('script.js', s);
