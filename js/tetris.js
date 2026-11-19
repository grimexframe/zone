import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, collection, addDoc } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyD7HW4Ec9n3vl5l_WgTSwiK5NpyQYE6tlU",
    authDomain: "helper-e10b2.firebaseapp.com",
    projectId: "helper-e10b2",
    storageBucket: "helper-e10b2.firebasestorage.app",
    messagingSenderId: "131536876451",
    appId: "1:131536876451:web:eeaef494c83dfc4849e016"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('tetris-canvas');
    const ctx = canvas.getContext('2d');
    const nextCanvas = document.getElementById('next-piece-canvas');
    const nCtx = nextCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');

    let animationId = null;
    let gameActive = true;
    let lastTimestamp = 0;
    const GAME_STATE_KEY = 'morstrix_tetris_state_v1';

    const COLS = 18;
    const ROWS = 22;
    const BASE_FALL_SPEED = 0.002;
    const MAX_FALL_SPEED = 0.0072;

    let smoothY = 0;
    let targetY = 0;
    let fallSpeed = BASE_FALL_SPEED;
    let lastFallTime = 0;

    const colors = [null, '#6b3a4d', '#c47a8a', '#5a2a3a', '#7a4a5a', '#c4a4a4', '#5a5a5a', '#8a5a6a'];

    function resize() {
        const container = canvas.parentElement;
        if (!container) return;
        const maxWidth = container.clientWidth - 20;
        const cellSize = Math.floor(maxWidth / COLS);
        canvas.width = cellSize * COLS;
        canvas.height = cellSize * ROWS;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(cellSize, cellSize);

        const nextSize = Math.max(14, cellSize * 0.6);
        nextCanvas.width = nextSize * 4;
        nextCanvas.height = nextSize * 4;
        nCtx.setTransform(1, 0, 0, 1, 0, 0);
        nCtx.scale(nextSize, nextSize);
    }

    function createPiece(t) {
        if (t === 'I') return [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]];
        if (t === 'L') return [[0,2,0],[0,2,0],[0,2,2]];
        if (t === 'J') return [[0,3,0],[0,3,0],[3,3,0]];
        if (t === 'O') return [[4,4],[4,4]];
        if (t === 'Z') return [[5,5,0],[0,5,5],[0,0,0]];
        if (t === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
        if (t === 'T') return [[0,7,0],[7,7,7],[0,0,0]];
    }

    function drawMatrix(m, o, context, alpha = 1, yOffset = 0) {
        context.save();
        if (alpha < 1) context.globalAlpha = alpha;
        m.forEach((row, y) => {
            row.forEach((v, x) => {
                if (v !== 0) {
                    context.fillStyle = colors[v];
                    context.fillRect(x + o.x, y + o.y + yOffset, 1, 1);
                }
            });
        });
        context.restore();
    }

    function draw() {
        if (!gameActive) return;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawMatrix(arena, {x:0, y:0}, ctx);

        // РџСЂРёР·СЂР°Рє (РїРѕРєР°Р·С‹РІР°РµРј РЅР° С†РµР»РµРІРѕР№ РїРѕР·РёС†РёРё)
        let ghostY = targetY;
        while (!collideArena(arena, player.matrix, player.pos.x, ghostY + 1)) {
            ghostY++;
        }
        ctx.save();
        ctx.globalAlpha = 0.25;
        drawMatrix(player.matrix, {x: player.pos.x, y: ghostY}, ctx);
        ctx.restore();

        // РџР°РґР°СЋС‰РёР№ Р±Р»РѕРє СЃ РїР»Р°РІРЅРѕР№ Y-РїРѕР·РёС†РёРµР№
        const yOffset = smoothY - targetY;
        drawMatrix(player.matrix, {x: player.pos.x, y: targetY}, ctx, 1, yOffset);

        nCtx.fillStyle = '#000';
        nCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (player.next) {
            const offX = (4 - player.next[0].length)/2;
            const offY = (4 - player.next.length)/2;
            drawMatrix(player.next, {x: offX, y: offY}, nCtx);
        }
    }

    function collideArena(arena, matrix, posX, posY) {
        const intPosY = Math.floor(posY);
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x] !== 0) {
                    const arenaY = intPosY + y;
                    const arenaX = posX + x;
                    if (arenaY >= ROWS || arenaY < 0 || arenaX >= COLS || arenaX < 0) return true;
                    if (arenaY >= 0 && arena[arenaY][arenaX] !== 0) return true;
                }
            }
        }
        return false;
    }

    const arena = Array(ROWS).fill().map(() => Array(COLS).fill(0));
    const player = { 
        pos: {x: 0, y: 0}, 
        matrix: null, 
        next: null, 
        score: 0
    };

    function updateDifficulty() {
        const levelBoost = Math.floor(player.score / 120) * 0.00028;
        const curveBoost = Math.min(player.score * 0.0000035, 0.0024);
        fallSpeed = Math.min(MAX_FALL_SPEED, BASE_FALL_SPEED + levelBoost + curveBoost);
    }

    function syncScore() {
        scoreElement.innerText = player.score;
        updateDifficulty();
        persistGameState();
    }

    function persistGameState() {
        if (!gameActive || !player.matrix || !player.next) return;
        const state = {
            arena,
            player: {
                pos: player.pos,
                matrix: player.matrix,
                next: player.next,
                score: player.score
            },
            targetY,
            smoothY,
            fallSpeed
        };
        localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
    }

    function clearSavedGame() {
        localStorage.removeItem(GAME_STATE_KEY);
    }

    function restoreSavedGame() {
        const raw = localStorage.getItem(GAME_STATE_KEY);
        if (!raw) return false;
        try {
            const saved = JSON.parse(raw);
            if (!saved || !Array.isArray(saved.arena) || !saved.player?.matrix || !saved.player?.next) return false;

            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    arena[y][x] = saved.arena[y]?.[x] || 0;
                }
            }

            player.pos = {
                x: Number(saved.player.pos?.x ?? 0),
                y: Number(saved.player.pos?.y ?? 0)
            };
            player.matrix = saved.player.matrix;
            player.next = saved.player.next;
            player.score = Number(saved.player.score || 0);
            targetY = Number(saved.targetY || 0);
            smoothY = Number(saved.smoothY || targetY);
            fallSpeed = Number(saved.fallSpeed || BASE_FALL_SPEED);

            if (collideArena(arena, player.matrix, player.pos.x, targetY)) {
                clearSavedGame();
                return false;
            }

            scoreElement.innerText = player.score;
            updateDifficulty();
            draw();
            return true;
        } catch (error) {
            console.warn('Failed to restore saved tetris state', error);
            clearSavedGame();
            return false;
        }
    }

    function mergeToArena() {
        const intTargetY = Math.floor(targetY);
        for (let y = 0; y < player.matrix.length; y++) {
            for (let x = 0; x < player.matrix[y].length; x++) {
                if (player.matrix[y][x] !== 0) {
                    const arenaY = intTargetY + y;
                    const arenaX = player.pos.x + x;
                    if (arenaY >= 0 && arenaY < ROWS && arenaX >= 0 && arenaX < COLS) {
                        arena[arenaY][arenaX] = player.matrix[y][x];
                    }
                }
            }
        }
    }

    function rotate(matrix) {
        return matrix[0].map((_, idx) => matrix.map(row => row[idx]).reverse());
    }

    function arenaSweep() {
        let rowsCleared = 0;
        for (let y = arena.length - 1; y >= 0; y--) {
            let full = true;
            for (let x = 0; x < arena[y].length; x++) {
                if (arena[y][x] === 0) { full = false; break; }
            }
            if (full) {
                arena.splice(y, 1);
                arena.unshift(Array(COLS).fill(0));
                y++;
                rowsCleared++;
            }
        }
        if (rowsCleared > 0) {
            const points = [0, 10, 30, 60, 100];
            player.score += points[Math.min(rowsCleared, 4)];
            syncScore();
        }
    }

    // РћР±РЅРѕРІР»РµРЅРёРµ РїР°РґРµРЅРёСЏ (РІС‹Р·С‹РІР°РµС‚СЃСЏ РєР°Р¶РґС‹Р№ РєР°РґСЂ)
    function updateFall(deltaTime) {
        if (!gameActive) return;
        
        // РџР»Р°РІРЅРѕРµ РґРІРёР¶РµРЅРёРµ РІРЅРёР·
        smoothY += fallSpeed * deltaTime;
        
        // Р•СЃР»Рё РґРѕС€Р»Рё РґРѕ СЃР»РµРґСѓСЋС‰РµР№ РєР»РµС‚РєРё
        while (smoothY >= targetY + 1) {
            targetY++;
            smoothY = targetY;
            
            // РџСЂРѕРІРµСЂСЏРµРј СЃС‚РѕР»РєРЅРѕРІРµРЅРёРµ РїРѕСЃР»Рµ РїРµСЂРµРјРµС‰РµРЅРёСЏ РЅР° РєР»РµС‚РєСѓ
            if (collideArena(arena, player.matrix, player.pos.x, targetY + 1)) {
                // Р‘Р»РѕРє РїСЂРёР·РµРјР»РёР»СЃСЏ
                mergeToArena();
                playerReset();
                arenaSweep();
                smoothY = targetY;
                break;
            }
        }
        
        // РћРіСЂР°РЅРёС‡РёРІР°РµРј smoothY, С‡С‚РѕР±С‹ РЅРµ СѓР»РµС‚РµР» РґР°Р»РµРєРѕ
        if (smoothY > targetY + 1) smoothY = targetY + 1;
    }

    function hardDrop() {
        if (!gameActive) return;
        while (!collideArena(arena, player.matrix, player.pos.x, targetY + 1)) {
            targetY++;
            smoothY = targetY;
        }
        mergeToArena();
        playerReset();
        arenaSweep();
    }

    function getRandomPiece() {
        const pieces = 'ILJOTSZ';
        return createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
    }

    function getRandomStartX(matrix) {
        const maxX = COLS - matrix[0].length;
        return Math.floor(Math.random() * (maxX + 1));
    }

    function playerReset() {
        if (!gameActive) return;
        player.matrix = player.next || getRandomPiece();
        player.next = getRandomPiece();
        player.pos.y = 0;
        player.pos.x = getRandomStartX(player.matrix);
        targetY = 0;
        smoothY = 0;
        if (collideArena(arena, player.matrix, player.pos.x, targetY)) {
            gameOver();
        }
        draw();
        persistGameState();
    }

    // РўР°Рї РїРѕ РїР°РґР°СЋС‰РµРјСѓ Р±Р»РѕРєСѓ
    function isTapOnFallingBlock(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        const canvasX = (clientX - rect.left) * scaleX;
        const canvasY = (clientY - rect.top) * scaleY;
        
        const cellSizeX = canvas.width / COLS;
        const cellSizeY = canvas.height / ROWS;
        
        const col = Math.floor(canvasX / cellSizeX);
        const row = Math.floor(canvasY / cellSizeY);
        
        const matrix = player.matrix;
        const posX = player.pos.x;
        const posY = targetY;
        
        for (let y = 0; y < matrix.length; y++) {
            for (let x = 0; x < matrix[y].length; x++) {
                if (matrix[y][x] !== 0) {
                    const blockCol = posX + x;
                    const blockRow = Math.floor(posY) + y;
                    if (blockRow === row && blockCol === col) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    function destroyWholeFallingBlock() {
        if (!gameActive) return;
        
        let blockCount = 0;
        for (let y = 0; y < player.matrix.length; y++) {
            for (let x = 0; x < player.matrix[y].length; x++) {
                if (player.matrix[y][x] !== 0) blockCount++;
            }
        }
        
        player.score += blockCount * 10;
        syncScore();
        
        player.matrix = player.next || getRandomPiece();
        player.next = getRandomPiece();
        player.pos.x = getRandomStartX(player.matrix);
        targetY = 0;
        smoothY = 0;
        
        if (collideArena(arena, player.matrix, player.pos.x, targetY)) {
            gameOver();
        }
        draw();
        persistGameState();
    }

    canvas.addEventListener('click', (e) => {
        if (!gameActive) return;
        if (isTapOnFallingBlock(e.clientX, e.clientY)) {
            destroyWholeFallingBlock();
        }
    });

    canvas.addEventListener('touchstart', (e) => {
        if (!gameActive) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (isTapOnFallingBlock(touch.clientX, touch.clientY)) {
            destroyWholeFallingBlock();
        }
    });

    async function gameOver() {
        gameActive = false;
        if (animationId) cancelAnimationFrame(animationId);
        clearSavedGame();
        const finalScore = player.score;
        showScoreModal(finalScore);
    }

function showScoreModal(score) {
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.innerHTML = `
        <div class="score-modal">
            <div class="modal-header">
                <span class="modal-title-text">GAME OVER</span>
                <button class="modal-close-btn" id="modalCloseBtn"><img src="assets/close.png" alt="close"></button>
            </div>
            <div class="modal-inner">
                <p>SCORE: ${score}</p>
                <input type="text" id="playerName" maxlength="12" placeholder="ENTER NAME" autocomplete="off">
                <button id="saveScoreBtn">SAVE</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalDiv);

    const closeBtn = modalDiv.querySelector('#modalCloseBtn');
    const saveBtn = modalDiv.querySelector('#saveScoreBtn');
    const input = modalDiv.querySelector('#playerName');

    const closeModal = () => {
        modalDiv.remove();
        resetGame();
    };

    // Закрывается только крестиком (с анимацией нажатия)
    closeBtn.onclick = () => {
        if (closeBtn.classList.contains('closing')) return;
        closeBtn.classList.add('closing');
        setTimeout(closeModal, 180);
    };

    saveBtn.onclick = async () => {
        let name = input.value.trim();
        if (name === '') name = 'ANON';
        if (name.length > 12) name = name.slice(0,12);
        
        try {
            // Проверяем, входит ли счёт в топ-10
            const { getFirestore, collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
            const db = getFirestore(app);
            const q = query(collection(db,"top_players"), orderBy("score","desc"), limit(10));
            const snap = await getDocs(q);
            let minScoreInTop = 0;
            let count = 0;
            snap.forEach(doc => { minScoreInTop = doc.data().score; count++; });
            
            if (count < 10 || score > minScoreInTop) {
                await addDoc(collection(db, "top_players"), {
                    name: name,
                    score: score,
                    date: new Date().toISOString()
                });
                console.log('Saved!', name, score);
            } else {
                console.log('Score not in top 10, not saved');
            }
        } catch(e) {
            console.error('Firestore error:', e);
        }
        closeModal();
    };

    input.onkeypress = (e) => {
        if (e.key === 'Enter') saveBtn.click();
    };
    input.focus();
}
        
    function resetGame() {
        for (let y = 0; y < arena.length; y++) {
            for (let x = 0; x < arena[y].length; x++) arena[y][x] = 0;
        }
        player.score = 0;
        clearSavedGame();
        gameActive = true;
        fallSpeed = BASE_FALL_SPEED;
        player.next = getRandomPiece();
        syncScore();
        playerReset();
        startGameLoop();
    }

    let lastFrameTime = 0;
    function startGameLoop() {
        if (animationId) cancelAnimationFrame(animationId);
        
        function update(currentTime = 0) {
            if (!gameActive) return;
            
            if (lastFrameTime === 0) {
                lastFrameTime = currentTime;
                requestAnimationFrame(update);
                return;
            }
            
            const deltaTime = Math.min(16, currentTime - lastFrameTime); // РѕРіСЂР°РЅРёС‡РёРІР°РµРј РґРѕ 16ms
            lastFrameTime = currentTime;
            
            // РџР»Р°РІРЅРѕРµ РїР°РґРµРЅРёРµ РєР°Р¶РґС‹Р№ РєР°РґСЂ
            updateFall(deltaTime);
            draw();
            
            animationId = requestAnimationFrame(update);
        }
        
        lastFrameTime = 0;
        animationId = requestAnimationFrame(update);
    }

    document.getElementById('left-btn').onclick = () => {
        if (!gameActive) return;
        const newX = player.pos.x - 1;
        if (!collideArena(arena, player.matrix, newX, targetY)) {
            player.pos.x = newX;
            draw();
            persistGameState();
        }
    };
    document.getElementById('right-btn').onclick = () => {
        if (!gameActive) return;
        const newX = player.pos.x + 1;
        if (!collideArena(arena, player.matrix, newX, targetY)) {
            player.pos.x = newX;
            draw();
            persistGameState();
        }
    };
    document.getElementById('rotate-btn').onclick = () => {
        if (!gameActive) return;
        const rotated = rotate(player.matrix);
        const old = player.matrix;
        player.matrix = rotated;
        if (collideArena(arena, player.matrix, player.pos.x, targetY)) {
            player.matrix = old;
        }
        draw();
        persistGameState();
    };
    document.getElementById('down-btn').onclick = (e) => {
        e.preventDefault();
        if (!gameActive) return;
        hardDrop();
    };

    window.addEventListener('keydown', (e) => {
        if (!gameActive) return;
        switch (e.key) {
            case 'ArrowLeft': document.getElementById('left-btn').click(); break;
            case 'ArrowRight': document.getElementById('right-btn').click(); break;
            case 'ArrowUp': document.getElementById('rotate-btn').click(); break;
            case 'ArrowDown': document.getElementById('down-btn').click(); break;
            case ' ': case 'Space': e.preventDefault(); hardDrop(); break;
        }
    });

    window.addEventListener('pagehide', persistGameState);
    window.addEventListener('beforeunload', persistGameState);
    window.addEventListener('resize', () => { resize(); draw(); });
    resize();
    if (!restoreSavedGame()) {
        player.next = getRandomPiece();
        syncScore();
        playerReset();
    }
    startGameLoop();
});
