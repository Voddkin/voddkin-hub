const fs = require('fs');

let foxtyHtml = fs.readFileSync('foxty.html', 'utf8');

// 1. Extract and combine styles
let sharedStyles = fs.readFileSync('styles.css', 'utf8');
const foxtyStyleMatch = foxtyHtml.match(/<style>([\s\S]*?)<\/style>/);

if (foxtyStyleMatch) {
    sharedStyles += '\n\n/* FOXTY STYLES */\n' + foxtyStyleMatch[1].trim();
}
fs.writeFileSync('styles.css', sharedStyles.trim());

// 2. Extract Foxty script and combine
let scriptJS = fs.readFileSync('script.js', 'utf8');

if (!scriptJS.includes('if (!DOM.cards || DOM.cards.length === 0) return;')) {
    scriptJS = scriptJS.replace('function updateLayoutMetrics() {', 'function updateLayoutMetrics() {\n        if (!DOM.cards || DOM.cards.length === 0) return;');
}

if (!scriptJS.includes('if (!DOM.bgCanvas) return;')) {
    scriptJS = scriptJS.replace('function initGalaxy() {', 'function initGalaxy() {\n        if (!DOM.bgCanvas) return;');
}

scriptJS = scriptJS.replace(/const hoverBlackHole = target\.closest\('#black-hole'\);[\s\S]*?if \(isHoveringInteractable\) \{/m, (match) => {
    return `const hoverBlackHole = target.closest('#black-hole');
        const isHoveringInteractable = hoverCards || hoverBlackHole || target.closest('.play-button') || target.closest('.btn-return') || target.closest('.btn-return-wrapper');
        
        if (isHoveringInteractable) {`;
});

scriptJS = scriptJS.replace('if (!isGalaxyPaused) {', 'if (!isGalaxyPaused && ctx) {');

const magneticBtnSnippet = `
        // Magnetic button global check
        const btnReturnWrappers = document.querySelectorAll('.btn-return-wrapper');
        btnReturnWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.btn-return');
            if (btn && (wrapper.classList.contains('revealed') || window.getComputedStyle(wrapper).pointerEvents === 'auto' || window.getComputedStyle(wrapper).pointerEvents === '')) {
                const rect = wrapper.getBoundingClientRect();
                if (rawMouseX >= rect.left && rawMouseX <= rect.right && rawMouseY >= rect.top && rawMouseY <= rect.bottom) {
                    btn.style.transform = \`translate(\${(rawMouseX - rect.left - rect.width / 2) * 0.3}px, \${(rawMouseY - rect.top - rect.height / 2) * 0.3}px) translateZ(0)\`;
                    wrapper.classList.add('hovered');
                } else {
                    btn.style.transform = \`translate(0px, 0px) translateZ(0)\`;
                    wrapper.classList.remove('hovered');
                }
            }
        });
`;

if (!scriptJS.includes('Magnetic button global check')) {
    scriptJS = scriptJS.replace("velocityX = rawMouseX - lastMouseX;", magneticBtnSnippet + "\n        velocityX = rawMouseX - lastMouseX;");
}

const foxtyScriptMatch = foxtyHtml.match(/<script>([\s\S]*?)<\/script>/);
if (foxtyScriptMatch) {
    let rawContent = foxtyScriptMatch[1];
    rawContent = rawContent.replace(/\/\/ --- CURSOR AND MAGNETIC BUTTON SYSTEM ---[\s\S]*/, '');
    
    // Add null-safe checks to foxty logic so it doesn't crash on index.html
    // Replace: const progressBar = document.getElementById('progress'); etc.
    // Wrap it in an if check for a foxty-specific element
    const safeContent = `
    if (document.getElementById('terminal-container')) {
${rawContent}
    }
    `;

    if (scriptJS.endsWith('})();')) {
        scriptJS = scriptJS.replace(/}\)\(\);$/, `\n    // FOXTY HTML SCRIPT LOGIC\n    (function() {\n${safeContent}\n    })();\n})();`);
    } else {
        scriptJS += `\n\n// FOXTY SCRIPT LOGIC\n(function() {\n${safeContent}\n})();`;
    }
}

fs.writeFileSync('script.js', scriptJS);

// 3. Clean foxty.html
function removeStyleScriptAndLink(html) {
    let newHtml = html;
    if (!newHtml.includes('<link rel="stylesheet" href="styles.css">')) {
        newHtml = newHtml.replace(/<style>[\s\S]*?<\/style>/, '');
        newHtml = newHtml.replace('</head>', '    <link rel="stylesheet" href="styles.css">\n</head>');
    }
    if (!newHtml.includes('<script src="script.js"></script>')) {
        newHtml = newHtml.replace(/<script>[\s\S]*?<\/script>\s*/, '');
        newHtml = newHtml.replace('</body>', '    <script src="script.js"></script>\n</body>');
    }
    return newHtml;
}

foxtyHtml = removeStyleScriptAndLink(foxtyHtml);
fs.writeFileSync('foxty.html', foxtyHtml);
