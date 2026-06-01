const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

ctx.imageSmoothingEnabled = false;

let audioCtx: AudioContext | null = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playTone(freq: number, duration: number, type: OscillatorType = "square", vol: number = 0.1) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const COLS = 16;
const ROWS = 13;
const TILE = 16;
let grid: number[][] = []; 

type GameState = 'title' | 'playing' | 'gameover' | 'levelwin' | 'editing';
let gameState: GameState = 'title';

let player = { x: 8, y: 12, hp: 3, maxHp: 3, keys: {} as { [color: string]: number }, level: 1, score: 0 };

interface EnemyDef {
    x: number; y: number;
    type: 'H' | 'V';
    dir: number;
    speed: number;
    cycleLength: number;
    offset: number;
    ox?: number; oy?: number;
}

interface PosColor {
    x: number; y: number; color: string;
}

interface LevelData {
    id: number;
    width: number; height: number;
    playerSpawn: [number, number];
    keyPositions: PosColor[];
    doorPositions: PosColor[];
    stairsPositions: [number, number][];
    enemies: EnemyDef[];
    walls: [number, number][];
}

function buildBorder(w: number, h: number): [number, number][] {
    let wls: [number, number][] = [];
    for(let x=0; x<w; x++) { wls.push([x,0]); wls.push([x,h-1]); }
    for(let y=1; y<h-1; y++) { wls.push([0,y]); wls.push([w-1,y]); }
    return wls;
}

function normalizeColorPos(p: any): PosColor {
    if (Array.isArray(p)) return { x: p[0], y: p[1], color: 'yellow' };
    return p;
}

let LEVELS: LevelData[] = [
    // Fase 1: Exploração Livre
    {
        id: 1, width: 16, height: 13,
        playerSpawn: [1, 11],
        keyPositions: [], doorPositions: [],
        stairsPositions: [[14, 1]], enemies: [],
        walls: buildBorder(16, 13)
    },
    // Fase 2: Chave Simples
    {
        id: 2, width: 16, height: 13,
        playerSpawn: [2, 11],
        keyPositions: [{x: 13, y: 1, color: 'yellow'}], doorPositions: [{x: 13, y: 8, color: 'yellow'}],
        stairsPositions: [[13, 11]], enemies: [],
        walls: [...buildBorder(16, 13), [7,4],[7,5],[7,6],[7,7],[7,8], [8,8],[9,8]]
    },
    // Fase 3: A Porta Central
    {
        id: 3, width: 16, height: 13,
        playerSpawn: [1, 6],
        keyPositions: [{x: 1, y: 1, color: 'yellow'}], doorPositions: [{x: 8, y: 6, color: 'yellow'}],
        stairsPositions: [[14, 6]], enemies: [],
        walls: [...buildBorder(16, 13), 
            [8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[8,9],[8,10],[8,11]
        ]
    },
    // Fase 4: O Primeiro Perigo
    {
        id: 4, width: 16, height: 13,
        playerSpawn: [2, 11],
        keyPositions: [{x: 14, y: 1, color: 'yellow'}], doorPositions: [],
        stairsPositions: [[14, 11]], 
        enemies: [
            {x: 3, y: 6, type: 'H', dir: 1, speed: 1.5, cycleLength: 10, offset: 0}
        ],
        walls: buildBorder(16, 13)
    },
    // Fase 5: O Corredor de Timing
    {
        id: 5, width: 16, height: 13,
        playerSpawn: [1, 11],
        keyPositions: [], doorPositions: [],
        stairsPositions: [[14, 1]], 
        enemies: [
            {x: 5, y: 3, type: 'H', dir: 1, speed: 2, cycleLength: 5, offset: 0},
            {x: 10, y: 9, type: 'H', dir: -1, speed: 2, cycleLength: 5, offset: 0}
        ],
        walls: [...buildBorder(16, 13),
            [4,2],[4,3],[4,4],[4,8],[4,9],[4,10],
            [11,2],[11,3],[11,4],[11,8],[11,9],[11,10]
        ]
    },
    // Fase 6: Dança Simétrica
    {
        id: 6, width: 16, height: 13,
        playerSpawn: [7, 11],
        keyPositions: [{x: 1, y: 1, color: 'yellow'}, {x: 14, y: 1, color: 'yellow'}], doorPositions: [{x: 7, y: 4, color: 'yellow'}, {x: 8, y: 4, color: 'yellow'}],
        stairsPositions: [[7, 2]], 
        enemies: [
            {x: 3, y: 6, type: 'V', dir: -1, speed: 1.5, cycleLength: 4, offset: 0},
            {x: 12, y: 6, type: 'V', dir: 1, speed: 1.5, cycleLength: 4, offset: 0}
        ],
        walls: [...buildBorder(16, 13),
            [6,2],[9,2],[6,3],[9,3],[6,4],[9,4],[6,5],[9,5]
        ]
    }
];

let items: { x: number, y: number, type: string, color?: string }[] = [];
let enemies: EnemyDef[] = [];
let currentLevelData: LevelData;

let lastDamageTime = 0;

const keys: { [key: string]: boolean } = {};
window.addEventListener('keydown', e => { 
    if(e.key === 'F1') {
        e.preventDefault();
        toggleEditor();
        return;
    }
    if ((e.target as Element).tagName === 'TEXTAREA') return;

    initAudio(); 
    keys[e.key.toLowerCase()] = true; 
});
window.addEventListener('keyup', e => { 
    keys[e.key.toLowerCase()] = false; 
});

const input = { up: false, down: false, left: false, right: false, action: false };
['up','down','left','right'].forEach(dir => {
    let btn = document.getElementById('btn-'+dir);
    if(btn) {
        btn.addEventListener('touchstart', e => { e.preventDefault(); (input as any)[dir]=true; initAudio(); });
        btn.addEventListener('touchend', e => { e.preventDefault(); (input as any)[dir]=false; });
        btn.addEventListener('mousedown', e => { e.preventDefault(); (input as any)[dir]=true; initAudio(); });
        btn.addEventListener('mouseup', e => { e.preventDefault(); (input as any)[dir]=false; });
        btn.addEventListener('mouseleave', e => { e.preventDefault(); (input as any)[dir]=false; });
    }
});

function rebuildItemsAndGrid() {
    grid = [];
    for(let y=0; y<ROWS; y++) grid.push(new Array(COLS).fill(0));
    currentLevelData.walls.forEach(w => {
        if(w[0]>=0 && w[0]<COLS && w[1]>=0 && w[1]<ROWS) {
            grid[w[1]][w[0]] = 1;
        }
    });

    items = [];
    currentLevelData.keyPositions.forEach(p => items.push({x: p.x, y: p.y, type: 'key', color: p.color}));
    currentLevelData.doorPositions.forEach(p => items.push({x: p.x, y: p.y, type: 'door', color: p.color}));
    currentLevelData.stairsPositions.forEach(p => items.push({x: p[0], y: p[1], type: 'stairs'}));

    enemies = currentLevelData.enemies.map(e => ({
        ...e, ox: e.x, oy: e.y
    }));
}

function loadLevel() {
    let lIdx = (player.level - 1) % LEVELS.length;
    currentLevelData = JSON.parse(JSON.stringify(LEVELS[lIdx])); 
    player.x = currentLevelData.playerSpawn[0];
    player.y = currentLevelData.playerSpawn[1];
    rebuildItemsAndGrid();
}

function resetGame() {
    player = { x: 8, y: 12, hp: 3, maxHp: 3, keys: {} as { [color: string]: number }, level: 1, score: 0 };
    lastDamageTime = 0;
    loadLevel();
    gameState = 'playing';
    playTone(440, 0.1);
    setTimeout(() => playTone(880, 0.2), 150);
}

let lastMoveTime = 0;
const moveDelay = 150; 

function isSolid(x: number, y: number) {
    if(x<0 || x>=COLS || y<0 || y>=ROWS) return true;
    if(grid[y][x] === 1) return true;
    return false;
}

function updateEnemies(time: number) {
    if (gameState !== 'playing' && gameState !== 'editing') return;
    
    enemies.forEach(e => {
        if (e.ox === undefined || e.oy === undefined) return;
        
        let msPerStep = 300 / e.speed;
        let t = Math.floor(time / msPerStep) + e.offset;
        
        let cycle = e.cycleLength;
        let phase = t % (cycle * 2);
        
        let delta = phase < cycle ? phase : (cycle * 2 - phase);
        delta *= e.dir;
        
        e.x = e.ox + (e.type === 'H' ? delta : 0);
        e.y = e.oy + (e.type === 'V' ? delta : 0);
    });
}

function checkCollisions(time: number) {
    let invulnerable = (time - lastDamageTime < 2000);
    if (!invulnerable && gameState === 'playing') {
        for (let e of enemies) {
            if (e.x === player.x && e.y === player.y) {
                player.hp--;
                lastDamageTime = time;
                playTone(150, 0.4, "sawtooth");
                if (player.hp <= 0) {
                    gameState = 'gameover';
                    playTone(100, 0.8, "sawtooth");
                }
                break;
            }
        }
    }
}

function update(time: number) {
    if(gameState === 'editing') {
        updateEnemies(time); 
        return;
    }

    if(gameState === 'title' || gameState === 'gameover') {
        if(keys['enter'] || input.action || input.up || input.down || input.left || input.right) {
            resetGame();
            keys['enter'] = false; input.action = false;
        }
        return;
    }

    if(gameState === 'playing') {
        updateEnemies(time);
        checkCollisions(time);

        if(time - lastMoveTime > moveDelay && gameState === 'playing') {
            let dx = 0, dy = 0;
            if(keys['w'] || keys['arrowup'] || input.up) dy = -1;
            else if(keys['s'] || keys['arrowdown'] || input.down) dy = 1;
            else if(keys['a'] || keys['arrowleft'] || input.left) dx = -1;
            else if(keys['d'] || keys['arrowright'] || input.right) dx = 1;

            if(dx !== 0 || dy !== 0) {
                let nx = player.x + dx;
                let ny = player.y + dy;
                let attacked = false;

                let enemyHit = enemies.find(e => e.x === nx && e.y === ny);
                if (enemyHit) {
                    attacked = true;
                    if (time - lastDamageTime >= 2000) {
                        player.hp--;
                        lastDamageTime = time;
                        playTone(150, 0.4, "sawtooth");
                        if (player.hp <= 0) {
                            gameState = 'gameover';
                            playTone(100, 0.8, "sawtooth");
                        }
                    }
                }

                let doorIndex = items.findIndex(i => i.type === 'door' && i.x === nx && i.y === ny);
                if(doorIndex > -1 && !attacked) {
                    let doorColor = items[doorIndex].color || 'yellow';
                    if(player.keys[doorColor] > 0) {
                        player.keys[doorColor]--;
                        items.splice(doorIndex, 1);
                        currentLevelData.doorPositions = currentLevelData.doorPositions.filter(p => !(p.x===nx && p.y===ny));
                        playTone(1200, 0.1, "square");
                        attacked = true; 
                    } else {
                        playTone(150, 0.1, "sawtooth");
                        attacked = true; 
                    }
                }

                if(!attacked && !isSolid(nx, ny)) {
                    player.x = nx;
                    player.y = ny;
                    currentLevelData.playerSpawn = [nx, ny]; 
                    playTone(200, 0.02, "triangle");

                    for(let i=0; i<items.length; i++) {
                        let it = items[i];
                        if(it.x === player.x && it.y === player.y) {
                            if(it.type === 'key') {
                                let keyColor = it.color || 'yellow';
                                player.keys[keyColor] = (player.keys[keyColor] || 0) + 1;
                                items.splice(i, 1);
                                currentLevelData.keyPositions = currentLevelData.keyPositions.filter(p => !(p.x===player.x && p.y===player.y));
                                i--;
                                player.score += 50;
                                playTone(1500, 0.05, "square");
                            } else if(it.type === 'stairs') {
                                player.level++;
                                player.score += 500;
                                playTone(400, 0.1, "square");
                                setTimeout(()=>playTone(600,0.1,"square"), 100);
                                setTimeout(()=>playTone(800,0.2,"square"), 200);
                                loadLevel();
                                return;
                            }
                        }
                    }
                    checkCollisions(time);
                }
                lastMoveTime = time;
            }
        }
    }
}

function drawHUD() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 32);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px "Press Start 2P"';
    ctx.fillText('HP', 16, 12);
    
    for(let i=0; i<player.maxHp; i++) {
        ctx.fillStyle = i < player.hp ? '#F83800' : '#000000';
        ctx.fillRect(16 + i*12, 16, 8, 8);
        ctx.strokeStyle = '#F83800';
        ctx.lineWidth = 1;
        ctx.strokeRect(16 + i*12 + 0.5, 16 + 0.5, 7, 7);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('SCORE', 80, 12);
    ctx.fillText(player.score.toString().padStart(5, '0'), 80, 24);

    ctx.fillText('LVL', 150, 12);
    ctx.fillText(player.level.toString(), 150, 24);

    let totalKeys = Object.values(player.keys).reduce((a, b) => a + b, 0);
    ctx.fillText('KEY', 200, 12);
    ctx.fillText(totalKeys.toString(), 200, 24);
}

let lastDrawTime = 0;
function draw(time: number) {
    if(time - lastDrawTime < 33) return;
    lastDrawTime = time;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 256, 240);

    if(gameState === 'title') {
        ctx.fillStyle = '#111111';
        ctx.fillRect(0,0,256,240);
        ctx.fillStyle = '#F83800';
        ctx.font = '16px "Press Start 2P"';
        ctx.textAlign = 'center';
        ctx.fillText('EXTREME Z', 128, 100);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px "Press Start 2P"';
        if(Math.floor(time / 500) % 2 === 0) {
            ctx.fillText('PRESS ENTER TO START', 128, 150);
        }
        ctx.textAlign = 'left';
        return;
    }

    // Floor
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 32, 256, 240-32);

    // Grid lines and walls
    for(let y=0; y<ROWS; y++) {
        for(let x=0; x<COLS; x++) {
            if(grid[y][x] === 1) {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(x*TILE, y*TILE + 32, TILE, TILE);
                ctx.fillStyle = '#000000';
                ctx.fillRect(x*TILE + 1, y*TILE + 1 + 32, TILE-2, TILE-2);
            }
        }
    }

    if (gameState === 'editing') {
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        for(let y=0; y<ROWS; y++) {
            for(let x=0; x<COLS; x++) {
                ctx.strokeRect(x*TILE, y*TILE + 32, TILE, TILE);
            }
        }
    }

const colorMap: {[key: string]: string} = {
    'yellow': '#F8B800',
    'green': '#00F838',
    'blue': '#0058F8',
    'red': '#F83800'
};

    items.forEach(it => {
        let drawColor = colorMap[it.color || 'yellow'] || '#FFFFFF';
        if(it.type === 'door') {
            ctx.fillStyle = drawColor; 
            ctx.fillRect(it.x*TILE, it.y*TILE + 32, TILE, TILE);
            ctx.fillStyle = '#000000';
            ctx.fillRect(it.x*TILE+6, it.y*TILE+6 + 32, 4, 4); 
        } else if(it.type === 'stairs') {
            ctx.fillStyle = '#000000';
            ctx.fillRect(it.x*TILE+2, it.y*TILE+2 + 32, TILE-4, TILE-4);
            ctx.fillStyle = '#333333';
            ctx.fillRect(it.x*TILE+4, it.y*TILE+4 + 32, TILE-4, TILE-4);
        } else if(it.type === 'key') {
            ctx.fillStyle = drawColor;
            ctx.fillRect(it.x*TILE + 5, it.y*TILE + 3 + 32, 6, 6);
            ctx.fillStyle = '#050505'; 
            ctx.fillRect(it.x*TILE + 7, it.y*TILE + 5 + 32, 2, 2);
            ctx.fillStyle = drawColor;
            ctx.fillRect(it.x*TILE + 7, it.y*TILE + 9 + 32, 2, 5);
            ctx.fillRect(it.x*TILE + 9, it.y*TILE + 10 + 32, 3, 2);
            ctx.fillRect(it.x*TILE + 9, it.y*TILE + 13 + 32, 3, 2);
        }
    });

    enemies.forEach(e => {
        ctx.fillStyle = '#F83800';
        let bounce = (Math.floor(time / 200) % 2 === 0) ? +1 : -1;
        ctx.fillRect(e.x*TILE + 2, e.y*TILE + 2 + bounce + 32, TILE-4, TILE-4);
        
        if (gameState === 'editing' && e.ox !== undefined && e.oy !== undefined) {
             ctx.fillStyle = 'rgba(248, 56, 0, 0.3)';
             for(let i=1; i<=e.cycleLength; i++) {
                 let px = e.ox + (e.type === 'H' ? i*e.dir : 0);
                 let py = e.oy + (e.type === 'V' ? i*e.dir : 0);
                 ctx.fillRect(px*TILE+6, py*TILE+6+32, 4, 4);
             }
        }
    });

    let invuln = (time - lastDamageTime < 2000);
    if (!invuln || Math.floor(time / 100) % 2 === 0 || gameState === 'editing') {
        ctx.fillStyle = '#0058F8';
        let pBounce = (Math.floor(time / 250) % 2 === 0) ? +1 : -1;
        ctx.fillRect(player.x*TILE + 2, player.y*TILE + 2 + pBounce + 32, TILE-4, TILE-4);
    }

    drawHUD();

    if(gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.fillRect(0,32,256,240-32);
        ctx.fillStyle = '#F83800';
        ctx.textAlign = 'center';
        ctx.font = '16px "Press Start 2P"';
        ctx.fillText('GAME OVER', 128, 120);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px "Press Start 2P"';
        if(Math.floor(time / 500) % 2 === 0) {
            ctx.fillText('PRESS ENTER TO RETRY', 128, 150);
        }
        ctx.textAlign = 'left';
    } else if (gameState === 'editing') {
        ctx.fillStyle = '#F8B800';
        ctx.font = '8px "Press Start 2P"';
        ctx.fillText('EDITOR MODE (F1)', 8, 230);
    }
}

// ---------------------------
// EDITOR UI
// ---------------------------

let lastState: GameState = 'title';

const editorDiv = document.createElement('div');
editorDiv.id = 'editor-ui';
editorDiv.style.display = 'none';
editorDiv.style.position = 'absolute';
editorDiv.style.top = '0';
editorDiv.style.right = '0';
editorDiv.style.width = '300px';
editorDiv.style.height = '100%';
editorDiv.style.background = '#222';
editorDiv.style.color = '#FFF';
editorDiv.style.padding = '10px';
editorDiv.style.fontFamily = 'monospace';
editorDiv.style.boxSizing = 'border-box';
editorDiv.style.zIndex = '1000';
editorDiv.style.overflowY = 'auto';

let currentTool = 'wall';

editorDiv.innerHTML = `
    <h2 style="margin-top:0">LEVEL EDITOR</h2>
    <div style="display:flex; justify-content:space-between; margin-bottom: 15px;">
        <button id="btn-playtest" style="flex:1; margin-right:5px; padding: 10px; background:#0058F8; color:#fff; border:none; font-weight:bold; cursor:pointer;">PLAYTEST</button>
        <button id="btn-save" style="flex:1; margin-left:5px; padding: 10px; background:#F8B800; color:#000; border:none; font-weight:bold; cursor:pointer;">SAVE LEVEL</button>
    </div>
    
    <label>Select Tool:</label>
    <select id="editor-tool" style="width:100%; margin: 5px 0 15px 0; padding: 5px; background: #000; color: #FFF; border: 1px solid #555;">
        <option value="wall">Wall</option>
        <option value="player">Player Spawn</option>
        <option value="key">Key</option>
        <option value="door">Door</option>
        <option value="stairs">Stairs</option>
        <option value="enemy">Enemy</option>
        <option value="eraser">Eraser</option>
    </select>
    
    <div id="item-config" style="display:none; margin-bottom: 15px; border: 1px solid #555; padding: 10px;">
        <strong>Key/Door Color</strong><br><br>
        <select id="item-color" style="width:100%;"><option value="yellow">Yellow</option><option value="green">Green</option><option value="blue">Blue</option><option value="red">Red</option></select>
    </div>

    <div id="enemy-config" style="display:none; margin-bottom: 15px; border: 1px solid #555; padding: 10px;">
        <strong>Enemy Settings</strong><br><br>
        <label style="display:block; margin-bottom:5px;">Pattern: <select id="enemy-type" style="float:right"><option value="H">Horizontal</option><option value="V">Vertical</option></select></label><br style="clear:both">
        <label style="display:block; margin-bottom:5px;">Dir: <select id="enemy-dir" style="float:right"><option value="1">Positive (+)</option><option value="-1">Negative (-)</option></select></label><br style="clear:both">
        <label style="display:block; margin-bottom:5px;">Speed: <input type="number" id="enemy-speed" value="1" min="0.5" max="10" step="0.5" style="float:right; width: 50px"></label><br style="clear:both">
        <label style="display:block; margin-bottom:5px;">Cycle Len: <input type="number" id="enemy-cycle" value="3" min="1" style="float:right; width: 50px"></label><br style="clear:both">
        <label style="display:block; margin-bottom:5px;">Offset: <input type="number" id="enemy-offset" value="0" min="0" style="float:right; width: 50px"></label><br style="clear:both">
    </div>
    
    <button id="btn-export" style="width:100%; margin-bottom: 5px; padding: 5px;">Export JSON</button>
    <button id="btn-import" style="width:100%; margin-bottom: 5px; padding: 5px;">Import JSON</button>
    <textarea id="io-area" style="width:100%; height: 150px; margin-bottom: 5px; background: #000; color: #0F0; border: 1px solid #555; font-size: 10px;"></textarea>
    
    <p style="font-size: 11px; color: #AAA; line-height: 1.4;">
    <strong>Controls:</strong><br>
    - Left Click: Place Element<br>
    - Right Click: Erase Element<br>
    - F1: Toggle Editor<br><br>
    Ensure there is a fair path!
    </p>
`;
document.body.appendChild(editorDiv);

function toggleEditor() {
    if (gameState !== 'editing') {
        if(gameState === 'title') loadLevel(); 
        lastState = gameState;
        gameState = 'editing';
        editorDiv.style.display = 'block';
    } else {
        gameState = lastState;
        editorDiv.style.display = 'none';
        rebuildItemsAndGrid(); 
    }
}

document.getElementById('editor-tool')?.addEventListener('change', (e) => {
    currentTool = (e.target as HTMLSelectElement).value;
    const enemyConf = document.getElementById('enemy-config');
    const itemConf = document.getElementById('item-config');
    if(enemyConf) enemyConf.style.display = currentTool === 'enemy' ? 'block' : 'none';
    if(itemConf) itemConf.style.display = (currentTool === 'key' || currentTool === 'door') ? 'block' : 'none';
});

document.getElementById('btn-playtest')?.addEventListener('click', () => {
    player.hp = player.maxHp;
    player.keys = {};
    gameState = 'playing';
    editorDiv.style.display = 'none';
    rebuildItemsAndGrid(); 
});

document.getElementById('btn-save')?.addEventListener('click', () => {
    let idx = (player.level - 1) % LEVELS.length;
    LEVELS[idx] = JSON.parse(JSON.stringify(currentLevelData));
    alert("Level saved in memory! Export JSON to keep it forever.");
});

document.getElementById('btn-export')?.addEventListener('click', () => {
    const area = document.getElementById('io-area') as HTMLTextAreaElement;
    if(area) area.value = JSON.stringify(currentLevelData, null, 2);
});

document.getElementById('btn-import')?.addEventListener('click', () => {
    const area = document.getElementById('io-area') as HTMLTextAreaElement;
    if(area && area.value) {
        try {
            let data = JSON.parse(area.value);
            // Normalize old formats
            if(data.keyPositions) data.keyPositions = data.keyPositions.map(normalizeColorPos);
            if(data.doorPositions) data.doorPositions = data.doorPositions.map(normalizeColorPos);
            
            currentLevelData = data;
            rebuildItemsAndGrid();
            alert("Level Imported Successfully!");
        } catch(err) {
            alert("Invalid JSON format.");
        }
    }
});

function eraseAt(x: number, y: number) {
    currentLevelData.walls = currentLevelData.walls.filter(w => !(w[0]===x && w[1]===y));
    currentLevelData.keyPositions = currentLevelData.keyPositions.filter(p => !(p.x===x && p.y===y));
    currentLevelData.doorPositions = currentLevelData.doorPositions.filter(p => !(p.x===x && p.y===y));
    currentLevelData.stairsPositions = currentLevelData.stairsPositions.filter(p => !(p[0]===x && p[1]===y));
    currentLevelData.enemies = currentLevelData.enemies.filter(en => !(en.x===x && en.y===y));
}

canvas.addEventListener('mousedown', e => {
    if(gameState !== 'editing') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    
    const x = Math.floor(px / TILE);
    const y = Math.floor((py - 32) / TILE);
    
    if(x < 0 || x >= COLS || y < 0 || y >= ROWS) return;

    if (e.button === 0) { 
        if (currentTool === 'eraser') {
            eraseAt(x, y);
        } else if(currentTool === 'wall') {
            if(!currentLevelData.walls.some(w => w[0]===x && w[1]===y)) {
                currentLevelData.walls.push([x,y]);
            }
        } else if(currentTool === 'player') {
            currentLevelData.playerSpawn = [x,y];
        } else if(currentTool === 'key') {
            eraseAt(x, y);
            const color = (document.getElementById('item-color') as HTMLSelectElement).value;
            currentLevelData.keyPositions.push({x, y, color});
        } else if(currentTool === 'door') {
            eraseAt(x, y);
            const color = (document.getElementById('item-color') as HTMLSelectElement).value;
            currentLevelData.doorPositions.push({x, y, color});
        } else if(currentTool === 'stairs') {
            eraseAt(x, y);
            currentLevelData.stairsPositions.push([x,y]);
        } else if(currentTool === 'enemy') {
            eraseAt(x, y);
            currentLevelData.enemies.push({
                x, y,
                type: (document.getElementById('enemy-type') as HTMLSelectElement).value as 'H'|'V',
                dir: parseInt((document.getElementById('enemy-dir') as HTMLSelectElement).value),
                speed: parseFloat((document.getElementById('enemy-speed') as HTMLInputElement).value),
                cycleLength: parseInt((document.getElementById('enemy-cycle') as HTMLInputElement).value),
                offset: parseInt((document.getElementById('enemy-offset') as HTMLInputElement).value)
            });
        }
    } else if (e.button === 2) { 
        eraseAt(x, y);
    }
    
    rebuildItemsAndGrid();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());

requestAnimationFrame(function loop(time: number) {
    update(time);
    draw(time);
    requestAnimationFrame(loop);
});
