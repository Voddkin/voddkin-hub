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

    // Mobile Overlay Interactive Logic
    window.addEventListener('DOMContentLoaded', () => {
        const overlays = document.querySelectorAll('.mobile-lock-overlay');
        overlays.forEach(overlay => {
            if (!overlay) return;
            const canvas = document.createElement('canvas');
            canvas.className = 'interactive-canvas';
            overlay.insertBefore(canvas, overlay.firstChild);
            
            const ctx = canvas.getContext('2d');
            let width, height;
            let particles = [];
            
            function resize() {
                width = canvas.width = window.innerWidth;
                height = canvas.height = window.innerHeight;
            }
            window.addEventListener('resize', resize);
            resize();
            
            function createParticles(x, y, count) {
                for(let i = 0; i < count; i++) {
                    particles.push({
                        x: x, y: y,
                        vx: (Math.random() - 0.5) * 8,
                        vy: (Math.random() - 0.5) * 8,
                        life: 1,
                        size: Math.random() * 3 + 1,
                        hue: 200 + Math.random() * 60 // Blues/purples
                    });
                }
            }
            
            overlay.addEventListener('click', (e) => {
                if (e.target.classList.contains('lock-chibi')) {
                    e.target.classList.remove('chibi-bounce');
                    void e.target.offsetWidth; // trigger reflow
                    e.target.classList.add('chibi-bounce');
                    const rect = e.target.getBoundingClientRect();
                    createParticles(rect.left + rect.width/2, rect.top + rect.height/2, 40);
                    return;
                }
                createParticles(e.clientX, e.clientY, 15);
            });
            
            overlay.addEventListener('touchstart', (e) => {
                if (e.target.classList.contains('lock-chibi')) return;
                for (let i = 0; i < e.touches.length; i++) {
                    createParticles(e.touches[i].clientX, e.touches[i].clientY, 15);
                }
            }, {passive: true});
            
            function animate() {
                // If overlay is hidden, don't waste resources
                if (window.getComputedStyle(overlay).display === 'none') {
                    requestAnimationFrame(animate);
                    return;
                }
                ctx.clearRect(0, 0, width, height);
                for(let i = particles.length - 1; i >= 0; i--) {
                    let p = particles[i];
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= 0.02;
                    p.size *= 0.96;
                    
                    if (p.life <= 0) {
                        particles.splice(i, 1);
                        continue;
                    }
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, ${p.life})`;
                    ctx.fill();
                }
                requestAnimationFrame(animate);
            }
            animate();
        });
    });
})();
