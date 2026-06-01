(() => {
    'use strict';

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
    } catch(err) {
        console.error("DOM Init Error", err);
        alert("DOM Init Error: " + err.message);
    }

    let rawMouseX = window.innerWidth / 2;
    let rawMouseY = window.innerHeight / 2;
    let cursorX = rawMouseX;
    let cursorY = rawMouseY;
    let lastMouseX = rawMouseX;
    let velocityX = 0;
    let currentSkew = 0;

    let scrollTarget = 0;
    let scrollCurrent = 0;
    let cardSpacing = 0; 
    let initialOffset = 0;
    let maxScroll = 0;
    let isDragging = false;
    let startX = 0;
    let scrollStart = 0;

    // Função dinâmica para calcular métricas baseadas no tamanho da janela
    function updateLayoutMetrics() {
        if (!DOM.cards || DOM.cards.length === 0) return;
        // Redefine DOM.cards caso novos cards tenham sido injetados dinamicamente
        DOM.cards = document.querySelectorAll('.project-card:not(.locked-secret)');

        cardSpacing = window.innerWidth * 0.35; 
        initialOffset = window.innerWidth * 0.25;
        
        // Pega a largura real geométrica do card (25vw ou o limite de 400px)
        const cardWidth = Math.min(window.innerWidth * 0.25, 400); 
        
        // O container direito começa em 35vw. O meio exato do monitor é 50vw.
        // A matemática para o centro do card parar cirurgicamente em 50vw:
        // O container direito '.phase3-right' tem largura de 65vw.
        // O ponto 50% do monitor fica na posição rawX = window.innerWidth * 0.5.
        // A posição relativa desse ponto dentro do container direito é (50vw - 35vw) = 15vw.
        const targetXPosInsideRight = (window.innerWidth * 0.15) - (cardWidth / 2);
        
        // A posição bruta final da raposa no array inteiro (x0 inicial)
        const lastCardX0 = initialOffset + ((DOM.cards.length - 1) * cardSpacing);
        
        // Define o novo limite absoluto "ancorado" ao centro.
        // maxScroll é a quantidade de scroll necessário para que o x0 final chegue em targetXPosInsideRight.
        maxScroll = lastCardX0 - targetXPosInsideRight;
    }
    
    // Inicia a matemática antes da animação rodar
    updateLayoutMetrics();

    const offscreenCanvas = document.createElement('canvas');
    const offCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    let isImageLoaded = false;
    let isHoveringPixel = false;
    let isCORSBlocked = false;

    const offscreenCanvas2 = document.createElement('canvas');
    const offCtx2 = offscreenCanvas2.getContext('2d', { willReadFrequently: true });
    let isImage2Loaded = false;
    let isHoveringPixelPhase2 = false;

    const ctx = DOM.bgCanvas ? DOM.bgCanvas.getContext('2d', { alpha: false }) : null;
    let width, height, halfW, halfH;
    let stars = [];
    let renderList = [];
    
    // ============================================
    // OTIMIZAÇÃO DE PERFORMANCE EXTREMA (HARDWARE TIER DETECT)
    // ============================================
    const hwCores = navigator.hardwareConcurrency || 4;
    const devRAM = navigator.deviceMemory || 4;
    const isExtremelyLowEnd = hwCores <= 2 || devRAM <= 2;
    const isLowEndDevice = hwCores <= 4 || devRAM <= 4;
    
    // Scale de renderização geométrica
    let canvasScale = 1.0;
    if (isExtremelyLowEnd) {
        canvasScale = 0.35; // Batata PC
    } else if (isLowEndDevice) {
        canvasScale = 0.6; // Low Tier
    } else {
        // Dispositivos HighEnd as vezes tem Retina (DPR 2 ou 3) com 4K.
        // Forçar no máximo ~1.0 equivalente a 1080p interno previne que a placa de vídeo
        // queime no canvas com telas 4k de proporção gigante.
        const dpr = window.devicePixelRatio || 1;
        canvasScale = Math.min(1.0, 1.25 / dpr); 
    }
    
    console.log(`Device profile determined: Scale: ${canvasScale}`);
    
    const STAR_COUNT = 1200; /* REDUZIDO de 2800 para 1200: Menos iterações = Mais FPS, e mantivemos o volume aumentando o raio delas! */
    const GALAXY_RADIUS = 2200;
 /* Raio de expansão da tela muito maior */
    const SPIRAL_ARMS = 4;
    const ARM_SPREAD = 0.8; /* Braços mais largos para preencher espaços */
    
    let targetRotX = Math.PI / 3;
    let targetRotY = 0;
    let currentRotX = targetRotX;
    let currentRotY = targetRotY;
    let autoRotY = 0;
    /* Adicionado os tons da identidade Void/Vortex na paleta de estrelas */
    const starColors = ['#06b6d4', '#8b5cf6', '#3b82f6', '#0284c7', '#c084fc', '#4c1d95'];
    const spriteCache = {};
    let globalTimeScale = 1.0;
    let isGalaxyPaused = false;
    let isCataclysmActive = false;
    let decelerationInterval = null;

    let holdTimeout = null;
    let isHoldingPhase2 = false;

    const TARGET_WORD = "voddkin";
    let currentKeyIndex = 0;
    let easterEggTriggered = false;
    const AudioContextObj = window.AudioContext || window.webkitAudioContext;
    let audioCtx;
    const FREQ = { LOW_C: 130.81, C: 261.63, D: 293.66, E: 329.63, F: 349.23, G: 392.00, A: 440.00, B: 493.88 };
    const SCALE = [FREQ.C, FREQ.D, FREQ.E, FREQ.F, FREQ.G, FREQ.A, FREQ.B];
    const EXCEPTION_KEYS = ['v', 'o', 'd', 'k', 'i', 'n'];
    const successAudio = new Audio("https://cdn.freesound.org/previews/772/772277_12520441-lq.mp3");
    successAudio.volume = 1.0;

    function createStarSprite(color, type) {
        const c = document.createElement('canvas');
        const cCtx = c.getContext('2d');
        // OTIMIZAÇÃO: Sprites maiores! Como temos um número menor de detritos flutuando, 
        // os gases se fundem muito mais para criar a densidade espacial e compensar a contagem.
        const radius = type === 'gas' ? 140 : (type === 'nebula' ? 50 : 6);
        
        c.width = radius * 2; c.height = radius * 2;
        const grad = cCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
        
        // Transições bem suaves para não deixar as bordas quadradas marcarem sobreposição no canvas
        if (type === 'gas') { 
            grad.addColorStop(0, color); 
            grad.addColorStop(0.15, color); 
            grad.addColorStop(1, 'transparent'); 
        } else if (type === 'nebula') { 
            grad.addColorStop(0, color); 
            grad.addColorStop(0.4, color); 
            grad.addColorStop(1, 'transparent'); 
        } else { 
            grad.addColorStop(0, color); 
            grad.addColorStop(0.1, color); 
            grad.addColorStop(1, 'transparent'); 
        }
        cCtx.fillStyle = grad; cCtx.fillRect(0, 0, c.width, c.height);
        return { canvas: c, radius: radius };
    }

    function preRenderSprites() {
        starColors.forEach(color => {
            spriteCache[color + '_star'] = createStarSprite(color, 'star');
            spriteCache[color + '_nebula'] = createStarSprite(color, 'nebula');
            spriteCache[color + '_gas'] = createStarSprite(color, 'gas');
        });
    }

    function initGalaxy() {
        if (!DOM.bgCanvas) return;
        width = window.innerWidth;
        height = window.innerHeight;
        
        DOM.bgCanvas.width = width * canvasScale;
        DOM.bgCanvas.height = height * canvasScale;
        DOM.bgCanvas.style.width = width + 'px';
        DOM.bgCanvas.style.height = height + 'px';
        
        // Ajustamos os cálculos internos do canvas para lidarem com a escala redimensionada
        ctx.setTransform(canvasScale, 0, 0, canvasScale, 0, 0);
        
        halfW = width / 2; halfH = height / 2;
        stars = [];
        renderList = new Array(STAR_COUNT);

        for (let i = 0; i < STAR_COUNT; i++) {
            let ox, oy, oz;

            if (i < STAR_COUNT * 0.4) {
                // Esfera estelar para preencher a tela inteira, independente do ângulo
                const u = Math.random();
                const v = Math.random();
                const theta = u * 2.0 * Math.PI;
                const phi = Math.acos(2.0 * v - 1.0);
                const r = Math.cbrt(Math.random()) * (GALAXY_RADIUS * 1.8);
                ox = r * Math.sin(phi) * Math.cos(theta);
                oy = r * Math.sin(phi) * Math.sin(theta);
                oz = r * Math.cos(phi);
            } else {
                // Os braços giratórios da galáxia no meio
                const distance = Math.pow(Math.random(), 3) * GALAXY_RADIUS;
                const armOffset = (Math.PI * 2 / SPIRAL_ARMS) * Math.floor(Math.random() * SPIRAL_ARMS);
                const finalAngle = distance * 0.004 + armOffset + (Math.random() - 0.5) * ARM_SPREAD;

                ox = Math.cos(finalAngle) * distance;
                oz = Math.sin(finalAngle) * distance;
                oy = (Math.random() - 0.5) * ((1 - (distance / GALAXY_RADIUS)) * 180); 
            }

            const color = starColors[Math.floor(Math.random() * starColors.length)];
            const roll = Math.random();
            let type = roll > 0.9 ? 'gas' : (roll > 0.7 ? 'nebula' : 'star');
            let baseScale = roll > 0.9 ? Math.random() * 4 + 3 : (roll > 0.7 ? Math.random() * 2 + 1 : Math.random() * 1.2 + 0.3);

            const distFromCenter = Math.sqrt(ox*ox + oz*oz);
            const speed = 0.001 + (0.005 * (Math.max(0, 1 - (distFromCenter / GALAXY_RADIUS))));
            const sprite = spriteCache[color + '_' + type];

            stars.push({
                ox, oy, oz, baseScale, type,
                speed: speed,
                spriteCanvas: sprite.canvas, spriteRadius: sprite.radius,
                vx: 0, vy: 0, vz: 0,
                // OTIMIZAÇÃO/CRAFT: Adicionamos um brilho oscilante paras estrelas piscarem ao vivo
                twinkleSpeed: type === 'star' ? (0.01 + Math.random() * 0.04) : 0, 
                twinklePhase: Math.random() * Math.PI * 2 
            });
            renderList[i] = { px: 0, py: 0, pz: 0, scale: 0, ref: stars[i] };
        }
    }

    const HIT_TEST_SCALE = isExtremelyLowEnd ? 0.1 : 0.25; // OTIMIZAÇÃO: Redução gigantesca de custo de CPU/RAM no rastreamento de hover do mouse.

    if (DOM.heroAction) {
        DOM.heroAction.onload = () => {
            offscreenCanvas.width = Math.max(1, (DOM.heroAction.naturalWidth * HIT_TEST_SCALE) || 1);
            offscreenCanvas.height = Math.max(1, (DOM.heroAction.naturalHeight * HIT_TEST_SCALE) || 1);
            try { offCtx.drawImage(DOM.heroAction, 0, 0, offscreenCanvas.width, offscreenCanvas.height); } catch (e) { }
            isImageLoaded = true;
        };
        if (DOM.heroAction.complete) DOM.heroAction.onload();
    }

    if (DOM.heroPhase2) {
        DOM.heroPhase2.onload = () => {
            offscreenCanvas2.width = Math.max(1, (DOM.heroPhase2.naturalWidth * HIT_TEST_SCALE) || 1);
            offscreenCanvas2.height = Math.max(1, (DOM.heroPhase2.naturalHeight * HIT_TEST_SCALE) || 1);
            try { offCtx2.drawImage(DOM.heroPhase2, 0, 0, offscreenCanvas2.width, offscreenCanvas2.height); } catch (e) { }
            isImage2Loaded = true;
        };
        if (DOM.heroPhase2.complete) DOM.heroPhase2.onload();
    }

    preRenderSprites();
    initGalaxy();

    let lastTime = performance.now();
    let animFrameId = null;

    function updateTooltipPosition(x, y) {
        if (currentState !== STATES.ARCHIVES || isDragging) {
            DOM.glassTooltip.classList.remove('active');
            return;
        }

        DOM.glassTooltip.style.pointerEvents = 'none'; 
        const hoveredElement = document.elementFromPoint(x, y);
        let hoveredCard = hoveredElement ? hoveredElement.closest('.project-card') : null;
        
        if (hoveredCard) {
            const text = hoveredCard.getAttribute('data-tooltip');
            if (text) {
                DOM.glassTooltip.innerHTML = text;
                DOM.glassTooltip.classList.add('active');
                
                let tx = x + 25;
                let ty = y + 25;
                if (tx + DOM.glassTooltip.offsetWidth > window.innerWidth) tx = x - DOM.glassTooltip.offsetWidth - 15;
                if (ty + DOM.glassTooltip.offsetHeight > window.innerHeight) ty = y - DOM.glassTooltip.offsetHeight - 15;
                
                DOM.glassTooltip.style.left = tx + 'px';
                DOM.glassTooltip.style.top = ty + 'px';
            }
        } else {
            DOM.glassTooltip.classList.remove('active');
        }
    }

    function engineTick(timestamp) {
        let dt = timestamp - lastTime;
        if (dt > 50) dt = 16.6;
        lastTime = timestamp;

        const timeFactor = dt / 16.666;

        cursorX += (rawMouseX - cursorX) * 0.2 * timeFactor;
        cursorY += (rawMouseY - cursorY) * 0.2 * timeFactor;
        DOM.customCursor.style.left = `${cursorX}px`;
        DOM.customCursor.style.top = `${cursorY}px`;

        
        // Magnetic button global check
        const btnReturnWrappers = document.querySelectorAll('.btn-return-wrapper');
        btnReturnWrappers.forEach(wrapper => {
            const btn = wrapper.querySelector('.btn-return');
            if (btn && (wrapper.classList.contains('revealed') || window.getComputedStyle(wrapper).pointerEvents !== 'none')) {
                const rect = wrapper.getBoundingClientRect();
                if (rawMouseX >= rect.left && rawMouseX <= rect.right && rawMouseY >= rect.top && rawMouseY <= rect.bottom) {
                    btn.style.transform = `translate(${(rawMouseX - rect.left - rect.width / 2) * 0.3}px, ${(rawMouseY - rect.top - rect.height / 2) * 0.3}px) translateZ(0)`;
                    wrapper.classList.add('hovered');
                } else {
                    btn.style.transform = `translate(0px, 0px) translateZ(0)`;
                    wrapper.classList.remove('hovered');
                }
            }
        });

        velocityX = rawMouseX - lastMouseX;
        lastMouseX = rawMouseX;

        if (currentState === STATES.ACTIVE_VOID || (currentState === STATES.TRANSITIONING && DOM.phase2.classList.contains('active'))) {
            const absVel = Math.abs(velocityX);
            let targetSkew = 0;
            if (absVel > 10) { targetSkew = Math.min(absVel * 0.1, 8) * (velocityX > 0 ? 1 : -1); }
            currentSkew += (targetSkew - currentSkew) * 0.1 * timeFactor;

            const xPercent = (rawMouseX / window.innerWidth) * 2 - 1;
            const yPercent = (rawMouseY / window.innerHeight) * 2 - 1;

            document.documentElement.style.setProperty('--skew-voddkin', `${currentSkew}deg`);
            document.documentElement.style.setProperty('--parallax-x', `${xPercent * -20}px`);
            document.documentElement.style.setProperty('--parallax-y', `${-50 + (yPercent * -10)}%`);
        }

        if (DOM.phase3.classList.contains('active') && !DOM.phase3.classList.contains('exiting')) {
            
            if (!isDragging) {
                if (scrollTarget > maxScroll) {
                    scrollTarget += (maxScroll - scrollTarget) * 0.15 * timeFactor;
                } else if (scrollTarget < 0) {
                    scrollTarget += (0 - scrollTarget) * 0.15 * timeFactor;
                }
            }

            scrollCurrent += (scrollTarget - scrollCurrent) * 0.08 * timeFactor;

            if (DOM.phase3TextDynamic) {
                let textOpacity = Math.max(0, 1 - (scrollCurrent / 600));
                let translateFactor = -(scrollCurrent * 0.15);
                DOM.phase3TextDynamic.style.opacity = textOpacity;
                DOM.phase3TextDynamic.style.transform = `translateX(${translateFactor}px) translateZ(0)`;
            }

            DOM.cards.forEach((card, i) => {
                let x0 = initialOffset + (i * cardSpacing);
                let xPos = x0 - scrollCurrent;
                let absX = Math.abs(xPos);

                let scale = 1 - Math.min(absX / 1500, 0.4);
                let opacity = 1 - Math.min(absX / 800, 1);
                let rotateY = xPos * -0.02;

                card.style.transform = `translateX(${xPos}px) scale(${scale}) rotateY(${rotateY}deg) translateZ(0)`;
                card.style.opacity = opacity;
            });

            const vortexCard = document.querySelector('.mascot-card'); 
            if (vortexCard) {
                const wrapper = vortexCard.querySelector('.card-entrance-wrapper');
                if (wrapper) {
                    const rect = wrapper.getBoundingClientRect();
                    const x = rawMouseX - rect.left;
                    const y = rawMouseY - rect.top;
                    wrapper.style.setProperty('--mouse-x', `${x}px`);
                    wrapper.style.setProperty('--mouse-y', `${y}px`);
                }
            }
        }

        if (!isGalaxyPaused && ctx) {
                ctx.clearRect(0, 0, width, height);
                ctx.globalCompositeOperation = 'lighter';

            currentRotX += (targetRotX - currentRotX) * 0.05 * globalTimeScale * timeFactor;
            currentRotY += (targetRotY - currentRotY) * 0.05 * globalTimeScale * timeFactor;
            autoRotY += 0.0005 * globalTimeScale * timeFactor;

            const totalRotY = currentRotY + autoRotY;
            const cosX = Math.cos(currentRotX);
            const sinX = Math.sin(currentRotX);
            const cosY = Math.cos(totalRotY);
            const sinY = Math.sin(totalRotY);

            const fov = 800; const zOffset = 1000;
            let visibleCount = 0;

            for (let i = 0; i < STAR_COUNT; i++) {
                let s = stars[i];

                if (isCataclysmActive) {
                    s.ox += s.vx * timeFactor;
                    s.oy += s.vy * timeFactor;
                    s.oz += s.vz * timeFactor;
                    const limit = 4000;
                    if (s.ox > limit || s.ox < -limit) s.vx *= -1;
                    if (s.oy > limit || s.oy < -limit) s.vy *= -1;
                    if (s.oz > limit || s.oz < -limit) s.vz *= -1;
                } else {
                    if (globalTimeScale > 0.01) {
                        const currentSpeed = s.speed * globalTimeScale * timeFactor;
                        const scaledCos = Math.cos(currentSpeed);
                        const scaledSin = Math.sin(currentSpeed);
                        const nx = s.ox * scaledCos - s.oz * scaledSin;
                        const nz = s.ox * scaledSin + s.oz * scaledCos;
                        s.ox = nx; s.oz = nz;
                    }
                }

                const y1 = s.oy * cosX - s.oz * sinX;
                const z1 = s.oy * sinX + s.oz * cosX;
                const finalX = s.ox * cosY + z1 * sinY;
                const finalZ = -s.ox * sinY + z1 * cosY;
                const zPos = finalZ + zOffset;

                if (zPos > 0) {
                    const scale = fov / zPos;
                    const projX = halfW + finalX * scale;
                    const projY = halfH + y1 * scale;

                    if (projX > -100 && projX < width + 100 && projY > -100 && projY < height + 100) {
                        let rl = renderList[visibleCount];
                        rl.px = Math.trunc(projX);
                        rl.py = Math.trunc(projY);
                        rl.pz = finalZ;
                        rl.scale = scale; rl.ref = s;
                        visibleCount++;
                    }
                }
            }

            let activeRenderList = renderList.slice(0, visibleCount);

            // ============================================
            // OTIMIZAÇÃO & EFEITOS: Renderização Final Poupando GPU
            // ============================================
            for (let i = 0; i < visibleCount; i++) {
                let p = activeRenderList[i];
                let s = p.ref;
                let finalScale = s.baseScale * p.scale;
                let drawRadius = s.spriteRadius * finalScale;
                let distAlpha = Math.min(1, Math.max(0.05, p.scale * 1.5));
                
                let finalAlpha;
                if (s.type === 'gas') {
                    finalAlpha = distAlpha * 0.02; // Suaviza o gás para mesclar melhor em larga escala
                } else if (s.type === 'nebula') {
                    finalAlpha = distAlpha * 0.15;
                } else {
                    // Adiciona o efeito vivo e reluzente (Twinkle) apenas para as pequenas estrelas
                    s.twinklePhase += s.twinkleSpeed * timeFactor;
                    let twinkle = 0.3 + 0.7 * Math.abs(Math.sin(s.twinklePhase)); 
                    finalAlpha = distAlpha * 0.9 * twinkle;
                }

                // CHECK DE PERFORMANCE GIGANTE OTIMIZADA:
                // Apenas desenha se o alpha for visível (>0.01), poupando a GPU e CPU
                // de calcular e desenhar milhares de transparências inúteis.
                if (finalAlpha > 0.01) {
                    ctx.globalAlpha = finalAlpha;
                    ctx.drawImage(s.spriteCanvas, p.px - drawRadius, p.py - drawRadius, Math.trunc(drawRadius * 2), Math.trunc(drawRadius * 2));
                }
            }

            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1.0;
        }

        animFrameId = requestAnimationFrame(engineTick);
    }

    animFrameId = requestAnimationFrame(engineTick);

    window.addEventListener('resize', () => { 
        initGalaxy(); 
        updateLayoutMetrics(); 
    });

    window.addEventListener('mousemove', (e) => {
        rawMouseX = e.clientX;
        rawMouseY = e.clientY;

        if(width && height) {
            const nx = (e.clientX / width) * 2 - 1;
            const ny = (e.clientY / height) * 2 - 1;
            targetRotX = (Math.PI / 3) + ny * 0.3;
            targetRotY = nx * 0.5;
        }

        if (currentState === STATES.STANDBY) {
            if (isImageLoaded && !DOM.heroWrapper.classList.contains('ghost')) {
                const rect = DOM.heroAction.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    isHoveringPixel = true; 
                    if (!isCORSBlocked) {
                        try {
                            const scaleX = (DOM.heroAction.naturalWidth * HIT_TEST_SCALE) / rect.width;
                            const scaleY = (DOM.heroAction.naturalHeight * HIT_TEST_SCALE) / rect.height;
                            const x = Math.round((e.clientX - rect.left) * scaleX);
                            const y = Math.round((e.clientY - rect.top) * scaleY);

                            if (x >= 0 && x < offscreenCanvas.width && y >= 0 && y < offscreenCanvas.height) {
                                isHoveringPixel = offCtx.getImageData(x, y, 1, 1).data[3] > 0;
                            } else {
                                isHoveringPixel = false;
                            }
                        } catch (err) {
                            isCORSBlocked = true;
                        }
                    }
                    if (isHoveringPixel) DOM.customCursor.classList.add('hovering');
                    else DOM.customCursor.classList.remove('hovering');
                } else {
                    isHoveringPixel = false;
                    DOM.customCursor.classList.remove('hovering');
                }
            }
        } else if (currentState === STATES.ACTIVE_VOID) {
            if (isImage2Loaded && !DOM.phase2.classList.contains('fade-out')) {
                const rect2 = DOM.heroPhase2.getBoundingClientRect();
                if (e.clientX >= rect2.left && e.clientX <= rect2.right && e.clientY >= rect2.top && e.clientY <= rect2.bottom) {
                    isHoveringPixelPhase2 = true;
                    if (!isCORSBlocked) {
                        try {
                            const scaleX = (DOM.heroPhase2.naturalWidth * HIT_TEST_SCALE) / rect2.width;
                            const scaleY = (DOM.heroPhase2.naturalHeight * HIT_TEST_SCALE) / rect2.height;
                            const x = Math.round((e.clientX - rect2.left) * scaleX);
                            const y = Math.round((e.clientY - rect2.top) * scaleY);
                            if (x >= 0 && x < offscreenCanvas2.width && y >= 0 && y < offscreenCanvas2.height) {
                                isHoveringPixelPhase2 = offCtx2.getImageData(x, y, 1, 1).data[3] > 0;
                            } else {
                                isHoveringPixelPhase2 = false;
                            }
                        } catch (err) {
                            isCORSBlocked = true;
                        }
                    }
                } else {
                    isHoveringPixelPhase2 = false;
                }

                if (!isHoveringPixelPhase2 && holdTimeout) {
                    cancelPhase2Hold();
                }
            }

            const rect = DOM.btnReturnWrapper.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                DOM.customCursor.classList.add('hovering');
            } else {
                if (!holdTimeout && !DOM.customCursor.classList.contains('releasing')) DOM.customCursor.classList.remove('hovering');
            }

        } else if (currentState === STATES.ARCHIVES) {
            if (isDragging) {
                let rawTarget = scrollStart + ((startX - e.clientX) * 1.5);
                
                if (rawTarget > maxScroll) {
                    let overscroll = rawTarget - maxScroll;
                    scrollTarget = maxScroll + ((overscroll * 350) / (overscroll + 350));
                } else if (rawTarget < 0) {
                    let overscroll = Math.abs(rawTarget);
                    scrollTarget = -((overscroll * 350) / (overscroll + 350));
                } else {
                    scrollTarget = rawTarget;
                }
            }

            const r3Rect = DOM.btnReturnWrapperP3.getBoundingClientRect();
            
            // Check specifically for vortex-secret-btn
            const overSecretBtn = e.target.closest('#vortex-secret-btn');
            
            if (e.clientX >= r3Rect.left && e.clientX <= r3Rect.right && e.clientY >= r3Rect.top && e.clientY <= r3Rect.bottom) {
                DOM.customCursor.classList.add('hovering');
            } else if (overSecretBtn) {
                DOM.customCursor.classList.add('hovering');
            } else {
                if(!isDragging) DOM.customCursor.classList.remove('hovering');
            }

            updateTooltipPosition(rawMouseX, rawMouseY);
        }
    });

    window.addEventListener('mouseup', () => {
        if (currentState === STATES.ARCHIVES && isDragging) {
            isDragging = false;
            DOM.customCursor.classList.remove('dragging');
            updateTooltipPosition(rawMouseX, rawMouseY);
        }
    });

    window.addEventListener('wheel', (e) => {
        if (currentState === STATES.ARCHIVES && DOM.phase3.classList.contains('active') && !DOM.phase3.classList.contains('exiting')) {
            scrollTarget += e.deltaY * 0.8;
            
            if (scrollTarget > maxScroll + 200) scrollTarget = maxScroll + 200;
            if (scrollTarget < -200) scrollTarget = -200;
            
            DOM.glassTooltip.classList.remove('active'); 
        }
    });

    window.addEventListener('click', (e) => {
        if (currentState === STATES.STANDBY && isHoveringPixel) {
            currentState = STATES.TRANSITIONING;
            DOM.customCursor.classList.remove('hovering');

            const rect = DOM.heroWrapper.getBoundingClientRect();
            DOM.blackHole.style.left = `${rect.left + rect.width / 2}px`;
            DOM.blackHole.style.top = `${rect.top + rect.height / 2}px`;

            DOM.heroWrapper.classList.add('ghost');
            DOM.phase1Text.classList.add('ghost');

            setTimeout(() => {
                if (currentState !== STATES.STANDBY) {
                    DOM.heroWrapper.classList.add('hidden-force');
                    DOM.phase1Text.classList.add('hidden-force');
                }
            }, 800);

            if(decelerationInterval) clearInterval(decelerationInterval);
            decelerationInterval = setInterval(() => { globalTimeScale = Math.max(0, globalTimeScale - 0.1); }, 50);

            requestAnimationFrame(() => requestAnimationFrame(() => DOM.blackHole.classList.add('active') ));

            setTimeout(() => {
                DOM.heroPhase2.removeAttribute('style');
                DOM.phase2.classList.remove('hidden-force');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        DOM.phase2.classList.add('active');
                        isGalaxyPaused = true;
                        setTimeout(() => {
                            if (currentState === STATES.TRANSITIONING) {
                                currentState = STATES.ACTIVE_VOID;
                            }
                        }, 3000);
                    });
                });
            }, 1000);
            return;
        }

        if (currentState === STATES.ACTIVE_VOID) {
            const rect = DOM.btnReturnWrapper.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                currentState = STATES.TRANSITIONING;
                DOM.customCursor.classList.remove('hovering');

                DOM.heroPhase2.removeAttribute('style');
                DOM.phase2.classList.remove('active');
                setTimeout(() => {
                    if (currentState === STATES.STANDBY || currentState === STATES.TRANSITIONING) {
                        DOM.phase2.classList.add('hidden-force');
                    }
                }, 800);

                isGalaxyPaused = false;

                if(decelerationInterval) clearInterval(decelerationInterval);
                decelerationInterval = setInterval(() => { globalTimeScale = Math.min(1.0, globalTimeScale + 0.05); }, 50);

                setTimeout(() => {
                    DOM.heroWrapper.classList.remove('hidden-force');
                    DOM.phase1Text.classList.remove('hidden-force');
                    
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            DOM.blackHole.classList.remove('active');
                            DOM.heroWrapper.classList.remove('ghost');
                            
                            setTimeout(() => {
                                DOM.phase1Text.classList.remove('ghost');
                            }, 500);

                            setTimeout(() => {
                                if (currentState === STATES.TRANSITIONING) {
                                    currentState = STATES.STANDBY;
                                }
                            }, 1200);
                        });
                    });
                }, 800);
            }
            return;
        }

        if (currentState === STATES.ARCHIVES && DOM.phase3.classList.contains('active') && !DOM.phase3.classList.contains('exiting')) {
            const rect = DOM.btnReturnWrapperP3.getBoundingClientRect();
            if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                currentState = STATES.TRANSITIONING;
                DOM.customCursor.classList.remove('hovering');
                DOM.glassTooltip.classList.remove('active');

                DOM.phase3.classList.add('exiting');
                window.dispatchEvent(new Event('reset-vortex-secret'));

                setTimeout(() => {
                    DOM.phase3.classList.remove('active');
                    DOM.phase3.classList.remove('exiting');

                    scrollTarget = 0;
                    scrollCurrent = 0;

                    DOM.phase2.classList.remove('hidden-force');
                    
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            DOM.phase2.classList.add('active');
                            DOM.phase2.classList.remove('fade-out');
                            
                            let phase2Hero = DOM.heroPhase2;
                            phase2Hero.style.transform = 'scale(1.03) translateZ(0)';
                            phase2Hero.style.filter = 'blur(15px)';
                            phase2Hero.style.opacity = '0';
                            phase2Hero.style.transition = 'none';
                            
                            void phase2Hero.offsetWidth; // Force reflow for inline initial states
                            
                            setTimeout(() => {
                                phase2Hero.style.transition = 'opacity 1s ease-out, transform 1s cubic-bezier(0.2, 0.8, 0.2, 1), filter 1s ease-out';
                                phase2Hero.style.transform = 'scale(1) translateZ(0)';
                                phase2Hero.style.filter = 'blur(0px)';
                                phase2Hero.style.opacity = '1';
                                
                                setTimeout(() => {
                                    if (currentState === STATES.TRANSITIONING) {
                                        currentState = STATES.ACTIVE_VOID;
                                        phase2Hero.removeAttribute('style');
                                    }
                                }, 3000);
                            }, 50);
                        });
                    });

                }, 1000);
            }
            return;
        }
    });

    function cancelPhase2Hold() {
        if (holdTimeout) {
            clearTimeout(holdTimeout);
            holdTimeout = null;
        }
        
        if (isHoldingPhase2) {
            isHoldingPhase2 = false;
            DOM.customCursor.classList.remove('holding');
            
            DOM.customCursor.classList.add('releasing');
            setTimeout(() => {
                DOM.customCursor.classList.remove('releasing');
            }, 600);
        }
    }

    window.addEventListener('mousedown', (e) => {
        if (currentState !== STATES.ACTIVE_VOID || !isHoveringPixelPhase2) return;
        e.preventDefault();
        
        isHoldingPhase2 = true; 
        DOM.customCursor.classList.remove('releasing'); 
        DOM.customCursor.classList.add('holding');
        
        holdTimeout = setTimeout(() => {
            isHoldingPhase2 = false; 
            DOM.customCursor.classList.remove('holding');
            DOM.customCursor.classList.add('exploding');
            
            currentState = STATES.TRANSITIONING;
            DOM.phase2.classList.add('fade-out');
            DOM.phase3.classList.add('active');
            
            setTimeout(() => { 
                if (currentState === STATES.TRANSITIONING) {
                    currentState = STATES.ARCHIVES; 
                }
            }, 2500); 

            setTimeout(() => {
                DOM.phase2.classList.remove('active');
                DOM.phase2.classList.remove('fade-out');
                DOM.phase2.classList.add('hidden-force');
            }, 1500); 

            setTimeout(() => {
                DOM.customCursor.classList.add('resetting');
                DOM.customCursor.classList.remove('exploding');
                void DOM.customCursor.offsetWidth; 
                DOM.customCursor.classList.remove('resetting');
            }, 700); 

        }, 3000); 
    });

    window.addEventListener('mouseup', () => {
        if (isHoldingPhase2) cancelPhase2Hold();
    });

    DOM.phase3.addEventListener('mousedown', (e) => {
        if (currentState === STATES.ARCHIVES && DOM.phase3.classList.contains('active') && !DOM.phase3.classList.contains('exiting')) {
            isDragging = true; startX = e.clientX; scrollStart = scrollTarget;
            DOM.customCursor.classList.add('dragging'); 
            DOM.glassTooltip.classList.remove('active'); 
        }
    });

    function playRetroBeep(frequency) {
        if (!audioCtx) audioCtx = new AudioContextObj();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);

        osc.connect(gainNode); gainNode.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 0.35);
    }

    function triggerGalaxyExplosion() {
        isCataclysmActive = true;
        if (isGalaxyPaused) isGalaxyPaused = false;
        stars.forEach(s => {
            s.vx = (Math.random() - 0.5) * 15;
            s.vy = (Math.random() - 0.5) * 15;
            s.vz = (Math.random() - 0.5) * 15;
            s.baseScale = s.baseScale * 3;
        });
    }

    window.addEventListener('keydown', (e) => {
        if (window._isLockdownActive) return;
        if (easterEggTriggered) return;

        if (currentState !== STATES.STANDBY) return; 
        if (!document.getElementById('phase-1-text')) return; // Only allow on index.html with phase 1

        const key = e.key.toLowerCase();

        if (key === TARGET_WORD[currentKeyIndex]) {
            playRetroBeep(SCALE[currentKeyIndex]);
            currentKeyIndex++;

            if (currentKeyIndex === TARGET_WORD.length) {
                easterEggTriggered = true;
                setTimeout(() => {
                    successAudio.play().catch(e => console.log("Áudio bloqueado pelo navegador", e));
                    triggerGalaxyExplosion();
                }, 150);
            }
        } else {
            currentKeyIndex = 0;
            if (key === TARGET_WORD[0]) {
                playRetroBeep(SCALE[0]);
                currentKeyIndex = 1;
            } else if (EXCEPTION_KEYS.includes(key)) {
                playRetroBeep(FREQ.C);
            } else {
                playRetroBeep(FREQ.LOW_C);
            }
        }
    });

    const vortexFoxContainer = document.querySelector('.mascot-card'); 
    const vortexAudioSource = document.getElementById('vortex-sound');

    if (vortexFoxContainer) {
        let vortexTimeoutId = null;
        let comboCount = 0;
        let comboTimer = null;
        
        const counterEl = document.getElementById('vortex-counter');
        const secretBtn = document.getElementById('vortex-secret-btn');
        const secretContainer = document.getElementById('vortex-secret-container');

        window.addEventListener('reset-vortex-secret', () => {
            comboCount = 0;
            if (counterEl) {
                counterEl.classList.remove('visible', 'shake', 'pulse-hit');
                counterEl.style.transform = `translateY(-50%) scale(0.8)`;
                counterEl.style.color = 'rgba(255, 255, 255, 0)';
                counterEl.style.textShadow = '0 0 10px rgba(255, 255, 255, 0)';
            }
            const secretCard = document.getElementById('vortex-secret-card');
            if (secretCard && secretCard.classList.contains('unlocked-reveal')) {
                setTimeout(() => {
                    secretCard.classList.add('locked-secret');
                    secretCard.classList.remove('unlocked-reveal');
                    secretCard.style.display = 'none';
                    
                    const pinkBoom = document.getElementById('secret-pink-boom');
                    if (pinkBoom) pinkBoom.classList.remove('active');
                    
                    if (secretContainer) secretContainer.classList.remove('revealed');
                    if (typeof updateLayoutMetrics === 'function') updateLayoutMetrics();
                }, 1500);
            } else if (secretCard) {
                secretCard.classList.add('locked-secret');
                secretCard.classList.remove('unlocked-reveal');
                secretCard.style.display = 'none';
                
                const pinkBoom = document.getElementById('secret-pink-boom');
                if (pinkBoom) {
                    pinkBoom.classList.remove('active');
                }
                if (secretContainer) {
                    secretContainer.classList.remove('revealed');
                }
                if (typeof updateLayoutMetrics === 'function') updateLayoutMetrics();
            }
        });

        vortexFoxContainer.addEventListener('click', () => {
            comboCount++;
            
            if (vortexAudioSource && comboCount !== 100) {
                vortexAudioSource.currentTime = 0; 
                vortexAudioSource.play().catch(e => console.log("Áudio bloqueado", e));
            }
            
            const wrapper = vortexFoxContainer.querySelector('.card-entrance-wrapper');
            if (wrapper) {
                wrapper.classList.remove('vortex-poked');
                void wrapper.offsetWidth; 
                
                wrapper.classList.add('vortex-poked');
                
                if (vortexTimeoutId) clearTimeout(vortexTimeoutId);
                vortexTimeoutId = setTimeout(() => {
                    wrapper.classList.remove('vortex-poked');
                }, 600);
            }

            if (comboTimer) clearTimeout(comboTimer);
            
            comboTimer = setTimeout(() => {
                comboCount = 0;
                if (counterEl) {
                    counterEl.classList.remove('visible');
                    counterEl.classList.remove('shake');
                    counterEl.classList.remove('pulse-hit');
                    counterEl.style.transform = `translateY(-50%) scale(0.8)`;
                    counterEl.style.color = 'rgba(255, 255, 255, 0)';
                    counterEl.style.textShadow = '0 0 10px rgba(255, 255, 255, 0)';
                }
            }, 1200);

            if (counterEl) {
                if (comboCount > 100) {
                    counterEl.innerText = "+100!";
                } else {
                    counterEl.innerText = comboCount;
                }
                
                if (comboCount >= 7) {
                    counterEl.classList.add('visible');
                    
                    // Pulso no momento do clique
                    counterEl.classList.remove('pulse-hit');
                    void counterEl.offsetWidth; 
                    counterEl.classList.add('pulse-hit');
                    
                    // Tamanho original base (sem crescer)
                    counterEl.style.transform = `translateY(-50%) scale(0.8)`;
                    
                    let intensity = Math.floor((Math.min(comboCount, 100)) / 10);
                    
                    // Vai saindo do azul claro para o vermelho/laranja neon (Cores mais interessantes que puro branco)
                    // Mas a pedido do usuário: "Esse brilho externo do texto também deve mudar de cor. Ele está branco a todo momento e ele não pode estar assim"
                    
                    let r = 255;
                    let g = Math.max(0, 255 - (intensity * 25));
                    let b = Math.max(0, 255 - (intensity * 25));
                    
                    if (comboCount === 100) {
                        let revSound = document.getElementById('revelation-sound');
                        if (!revSound) {
                            revSound = new Audio('assets/aud/revelation.mp3');
                            revSound.id = 'revelation-sound';
                            revSound.preload = 'auto';
                            document.body.appendChild(revSound);
                        }
                        
                        revSound.volume = 1.0;
                        revSound.currentTime = 0;
                        revSound.play().catch(e => console.error("Revealing sound blocked or error:", e));

                        const secretCard = document.getElementById('vortex-secret-card');
                        if (secretCard && secretCard.classList.contains('locked-secret')) {
                            secretCard.classList.remove('locked-secret');
                            secretCard.style.display = 'block';
                            secretCard.classList.add('unlocked-reveal');
                            
                            const pinkBoom = document.getElementById('secret-pink-boom');
                            if (pinkBoom) {
                                // Pequeno delay pra dar o "impacto" após o card aparecer
                                setTimeout(() => {
                                    pinkBoom.classList.add('active');
                                }, 300);
                            }

                            updateLayoutMetrics();
                            
                            setTimeout(() => {
                                if (secretContainer) {
                                    secretContainer.classList.add('revealed');
                                }
                            }, 50);
                        }
                    }

                    if (comboCount >= 100) {
                        counterEl.classList.add('shake');
                        counterEl.style.color = 'rgba(255, 30, 50, 1)';
                        counterEl.style.textShadow = '0 0 35px rgba(255, 30, 50, 1)';
                        if (secretContainer && comboCount > 100) {
                            secretContainer.classList.add('revealed');
                        }
                    } else if (comboCount >= 10) {
                        counterEl.style.color = `rgba(255, ${g}, ${b}, 1)`;
                        counterEl.style.textShadow = `0 0 ${10 + intensity * 2}px rgba(255, ${g}, ${b}, 1)`;
                    } else {
                        counterEl.style.color = 'rgba(255, 255, 255, 1)';
                        counterEl.style.textShadow = '0 0 15px rgba(255, 255, 255, 1)';
                    }
                }
            }
        });

        if (secretBtn) {
            secretBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Add the extreme click effect
                secretBtn.classList.remove('btn-clicked-effect');
                void secretBtn.offsetWidth; // force reflow
                secretBtn.classList.add('btn-clicked-effect');
                
                // Add slight press effect
                secretBtn.classList.add('btn-clicking');
                setTimeout(() => secretBtn.classList.remove('btn-clicking'), 150);

                // Generate a single-use high entropy token
                const authHash = Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2);
                
                // Store the token and expiry (15 seconds from now)
                sessionStorage.setItem('_vkAuthToken', authHash);
                sessionStorage.setItem('_vkAuthExp', Date.now() + 15000);

                // Delay the redirect to allow the premium animation to play out
                setTimeout(() => {
                    window.location.href = `foxty.html?t=${authHash}`;
                }, 850);
            });
        }
    }

    // =========================================
    // LOADER LOGIC
    // =========================================
    const checkAllImagesLoaded = () => {
        const images = Array.from(document.images);
        const promises = images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                const imgTimeout = setTimeout(resolve, 3000);
                img.onload = () => { clearTimeout(imgTimeout); resolve(); };
                img.onerror = () => { clearTimeout(imgTimeout); resolve(); };
            });
        });
        
        // Also wait for fonts if possible
        const fontsPromise = document.fonts ? document.fonts.ready : Promise.resolve();
        promises.push(fontsPromise);
        
        const allLoaded = Promise.all(promises);
        const fallbackTimeout = new Promise(resolve => setTimeout(resolve, 3500));
        
        return Promise.race([allLoaded, fallbackTimeout]);
    };

    window.addEventListener('load', () => {
        checkAllImagesLoaded().catch(e => console.warn('Load check error', e)).finally(() => {
            setTimeout(() => {
                const loaderWrapper = document.getElementById('loader-wrapper');
                const loaderOrb = document.getElementById('loader-orb');
                
                if (!loaderWrapper || !loaderOrb) {
                    if (DOM && DOM.customCursor) {
                         DOM.customCursor.classList.add('instant-reveal');
                         setTimeout(() => {
                             DOM.customCursor.classList.remove('instant-reveal');
                             DOM.customCursor.classList.add('revealed');
                         }, 50);
                    }
                    return;
                }
                
                // 1. Fade out black background, morph orb into white bouncy cursor
                loaderWrapper.classList.add('transparent');
                loaderOrb.classList.add('shrunk');
                
                // 2. Wait for morphing visually (1.2s transition)
                setTimeout(() => {
                    
                    // 3. Stop bouncing, start tracking
                    loaderOrb.classList.remove('bouncing');
                    loaderOrb.classList.add('tracking');
                    
                    let orbX = window.innerWidth / 2;
                    let orbY = window.innerHeight / 2;
                    
                    loaderOrb.style.left = orbX + 'px';
                    loaderOrb.style.top = orbY + 'px';
                    
                    let trackSpeed = 0.015;
                    let animationId;
                    const trackCursor = () => {
                        const dx = rawMouseX - orbX;
                        const dy = rawMouseY - orbY;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        
                        // Lerp with a smooth factor increasing over time
                        trackSpeed = Math.min(0.25, trackSpeed + 0.003);
                        orbX += dx * trackSpeed;
                        orbY += dy * trackSpeed;
                        
                        loaderOrb.style.left = orbX + 'px';
                        loaderOrb.style.top = orbY + 'px';
                        
                        // Se aproximou o suficiente do cursor real = substitui e encerra
                        if (dist < 4.0) {
                            loaderOrb.style.display = 'none';
                            
                            DOM.customCursor.classList.add('instant-reveal');
                            setTimeout(() => {
                                DOM.customCursor.classList.remove('instant-reveal');
                                DOM.customCursor.classList.add('revealed');
                                
                                const p1Contact = document.querySelector('.phase1-contact');
                                if (p1Contact) p1Contact.classList.add('revealed');
                            }, 50);
                            
                            // Força a alinhamento impecável instantâneo no momento da fusão
                            cursorX = rawMouseX;
                            cursorY = rawMouseY;
                            DOM.customCursor.style.left = cursorX + 'px';
                            DOM.customCursor.style.top = cursorY + 'px';
                            
                            setTimeout(() => loaderWrapper.remove(), 100);
                            return; 
                        }
                        
                        animationId = requestAnimationFrame(trackCursor);
                    };
                    
                    trackCursor();
                    
                }, 1400); 
            }, 800); 
        });
    });


    // FOXTY HTML SCRIPT LOGIC
    (function() {

    if (document.getElementById('terminal-container')) {

        const logs = [
            "Contornando os protocolos de segurança do mainframe...",
            "Acessando os 'Voddkin files'...",
            "Ajustando o short do papagaio...",
            "Verificando trovões em cabras planadoras...Nada.",
            "Compilando pacotes de processos Aurora's...",
            "Baixando vídeo de apresentação...",
            "Sincronizando estado quântico voddkano... Sucesso.",
            "Entrada de acesso único aprovada."
        ];

        let progress = 0;
        const progressBar = document.getElementById('progress');
        const percentageText = document.getElementById('percentage');
        const logContainer = document.getElementById('log-container');
        const terminalContainer = document.getElementById('terminal-container');
        
        const videoContainer = document.getElementById('video-container');
        const foxtyVideo = document.getElementById('foxty-video');
        const playButton = document.getElementById('play-button');
        const btnReturnWrapper = document.getElementById('btn-return-wrapper');
        const btnReturn = document.getElementById('btn-return');

        let logIndex = 0;

        function addLog() {
            if (logIndex < logs.length) {
                const logEl = document.createElement('div');
                logEl.className = 'log-item';
                logEl.innerText = "> " + logs[logIndex];
                logContainer.appendChild(logEl);
                logContainer.scrollTop = logContainer.scrollHeight;
                logIndex++;
                setTimeout(addLog, 400 + Math.random() * 400);
            }
        }

        function updateProgress() {
            progress += Math.random() * 2.5; // Random increment
            if (progress > 100) progress = 100;
            
            progressBar.style.width = progress + '%';
            percentageText.innerText = Math.floor(progress) + '%';

            if (progress < 100) {
                setTimeout(updateProgress, 50 + Math.random() * 100);
            } else {
                percentageText.innerText = "100% - FINALIZANDO...";
                percentageText.classList.add('blink');
                
                // Hide terminal and show video
                setTimeout(transitionToVideo, 1200);
            }
        }

        function transitionToVideo() {
            // Fade out terminal
            terminalContainer.classList.add('hide');

            setTimeout(() => {
                terminalContainer.style.display = 'none';
                
                // Show video container
                videoContainer.classList.add('active');

                // Subtle entry for the play button Only
                setTimeout(() => {
                    playButton.classList.add('revealed');
                }, 500);

            }, 1000);
        }

        // Setup Play Button Logic
        playButton.addEventListener('click', () => {
            playButton.classList.add('hidden');
            
            setTimeout(() => {
                foxtyVideo.classList.add('revealed');
                
                // Unmute and play (assuming video is loaded. preload="auto" handles loading)
                foxtyVideo.muted = false;
                let playPromise = foxtyVideo.play();
                if (playPromise !== undefined) {
                    playPromise.catch(err => {
                        console.error("Auto-play was prevented. Muting to allow play...", err);
                        foxtyVideo.muted = true;
                        foxtyVideo.play();
                    });
                }
            }, 1500);

            // Exatos 26 segundos depois, insere o botão voltar
            setTimeout(() => {
                btnReturnWrapper.classList.add('revealed');
            }, 26000);
        });

        // Initialize loader
        setTimeout(() => {
            updateProgress();
            addLog();
        }, 800);

        
    }
    
    })();
})();