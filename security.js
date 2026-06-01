(function() {
    'use strict';
    let _lockdownActive = false;
    const triggerLockdown = (msg) => {
        if (window._isLockdownActive) return;
        window._isLockdownActive = true;
        try {
            const overlay = document.createElement('div');
            overlay.style.cssText = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:#050505; color:#ffffff; z-index: 99999998; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; box-sizing:border-box; cursor: none !important;";
            overlay.innerHTML = `
                <div style="font-family: var(--font-bold, 'Courier New', Courier, monospace); font-size:3.5rem; font-weight:700; text-shadow: 0 0 15px rgba(255, 255, 255, 0.4); margin-bottom: 20px; text-transform: uppercase;">Acesso Negado</div>
                <div style="font-family: var(--font-medium, 'Courier New', Courier, monospace); font-size:1.2rem; font-weight:500; text-shadow: 0 0 10px rgba(255, 255, 255, 0.3); color: rgba(255,255,255,0.8);">${msg}</div>
            `;
            document.body.appendChild(overlay);
            
            // Force cursor visibility immediately on lockdown
            const cursor = document.getElementById('custom-cursor');
            if (cursor) {
                cursor.style.opacity = '1';
                cursor.style.transition = 'none'; // bypass transitions just in case
            }
        } catch(e) {}
    };

    // Right click - do not trigger lockdown, just prevent context menu so it can be used for custom logic
    window.addEventListener('contextmenu', e => {
        e.preventDefault();
    });

    // Simulate left click actions on right click
    window.addEventListener('mousedown', e => {
        if (e.button === 2) {
            e.stopPropagation();
            const fakeMousedown = new MouseEvent('mousedown', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.clientX,
                clientY: e.clientY,
                button: 0,
                buttons: 1
            });
            e.target.dispatchEvent(fakeMousedown);
        }
    }, { capture: true });

    window.addEventListener('mouseup', e => {
        if (e.button === 2) {
            e.stopPropagation();
            const fakeMouseup = new MouseEvent('mouseup', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.clientX,
                clientY: e.clientY,
                button: 0,
                buttons: 0
            });
            e.target.dispatchEvent(fakeMouseup);

            const fakeClick = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: e.clientX,
                clientY: e.clientY,
                button: 0
            });
            e.target.dispatchEvent(fakeClick);
        }
    }, { capture: true });

    // Keys - prevent default for inspection shortcuts without triggering lockdown screen
    window.addEventListener('keydown', e => {
        if (
            e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
            (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
            (e.metaKey && (e.key === 'U' || e.key === 'u'))
        ) {
            e.preventDefault();
            return false;
        }
    });

    // Debugger Loop - this STILL triggers the lockdown screen
    setInterval(function() {
        const start = performance.now();
        debugger;
        if (performance.now() - start > 100) {
            triggerLockdown('DevTools bloqueado. Recarregue a página.');
        }
    }, 500);

    // Disable dragging globally for native elements (images, etc)
    window.addEventListener('dragstart', (e) => e.preventDefault());
})();
