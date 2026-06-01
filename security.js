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
                const rect = overlay.getBoundingClientRect();
                width = canvas.width = rect.width;
                height = canvas.height = rect.height;
            }
            window.addEventListener('resize', resize);
            resize();
            
            function createParticles(x, y, count, isSpecial) {
                for(let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = isSpecial ? (Math.random() * 15 + 5) : (Math.random() * 10 + 2);
                    particles.push({
                        x: x, y: y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        life: 1,
                        decay: isSpecial ? 0.012 : 0.018,
                        size: isSpecial ? (Math.random() * 8 + 3) : (Math.random() * 5 + 2),
                        hue: isSpecial ? (Math.random() * 50 + 260) : (Math.random() * 60 + 190), // Purple/pink for special, Blue/purple for normal
                        gravity: isSpecial ? 0.15 : 0.08,
                        drag: 0.92
                    });
                }
            }
            
            let pointers = {};
            
            overlay.addEventListener('pointerdown', (e) => {
                if (e.button !== 0 && e.pointerType === 'mouse') return; // only left click
                const rect = canvas.getBoundingClientRect();
                
                if (e.target.classList.contains('lock-chibi') || e.target.closest('.lock-chibi')) {
                    const chibi = e.target.classList.contains('lock-chibi') ? e.target : e.target.closest('.lock-chibi');
                    chibi.classList.remove('chibi-bounce');
                    void chibi.offsetWidth;
                    chibi.classList.add('chibi-bounce');
                    
                    const targetRect = chibi.getBoundingClientRect();
                    const centerX = targetRect.left - rect.left + targetRect.width / 2;
                    const centerY = targetRect.top - rect.top + targetRect.height / 2;
                    createParticles(centerX, centerY, 100, true);
                    return;
                }
                
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;
                
                pointers[e.pointerId] = true;
                createParticles(px, py, 60, false);
                
                // Set capture specifically for the canvas/overlay interaction
                if (typeof overlay.setPointerCapture === 'function' && !overlay.hasPointerCapture(e.pointerId)) {
                    overlay.setPointerCapture(e.pointerId);
                }
            });
            
            overlay.addEventListener('pointermove', (e) => {
                if (!pointers[e.pointerId]) return;
                const rect = canvas.getBoundingClientRect();
                const px = e.clientX - rect.left;
                const py = e.clientY - rect.top;
                createParticles(px, py, 6, false);
            });
            
            const endPointer = (e) => {
                delete pointers[e.pointerId];
            };
            overlay.addEventListener('pointerup', endPointer);
            overlay.addEventListener('pointercancel', endPointer);
            overlay.addEventListener('pointerleave', endPointer);
            
            function animate() {
                // If overlay is hidden, don't waste resources
                if (window.getComputedStyle(overlay).display === 'none') {
                    requestAnimationFrame(animate);
                    return;
                }
                ctx.clearRect(0, 0, width, height);
                ctx.globalCompositeOperation = 'lighter';
                
                for(let i = particles.length - 1; i >= 0; i--) {
                    let p = particles[i];
                    p.vx *= p.drag;
                    p.vy *= p.drag;
                    p.vy += p.gravity;
                    
                    p.x += p.vx;
                    p.y += p.vy;
                    p.life -= p.decay;
                    p.size *= 0.96;
                    
                    if (p.life <= 0) {
                        particles.splice(i, 1);
                        continue;
                    }
                    
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    
                    // Create glowing gradient
                    let grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
                    grad.addColorStop(0, `hsla(${p.hue}, 100%, 80%, ${p.life})`);
                    grad.addColorStop(0.3, `hsla(${p.hue}, 90%, 60%, ${p.life * 0.7})`);
                    grad.addColorStop(1, `hsla(${p.hue}, 80%, 30%, 0)`);
                    
                    ctx.fillStyle = grad;
                    ctx.fill();
                }
                ctx.globalCompositeOperation = 'source-over';
                requestAnimationFrame(animate);
            }
            animate();
        });
    });
})();
