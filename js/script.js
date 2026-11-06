// ===== PIXEL CANVAS WEB COMPONENT =====
class Pixel {
    constructor(canvas, context, x, y, color, speed, delay) {
        this.width = canvas.width;
        this.height = canvas.height;
        this.ctx = context;
        this.x = x;
        this.y = y;
        this.color = color;
        this.speed = this.getRandomValue(0.1, 0.9) * speed;
        this.size = 0;
        this.sizeStep = Math.random() * 0.4;
        this.minSize = 0.5;
        this.maxSizeInteger = 2;
        this.maxSize = this.getRandomValue(this.minSize, this.maxSizeInteger);
        this.delay = delay;
        this.counter = 0;
        this.counterStep = Math.random() * 4 + (this.width + this.height) * 0.01;
        this.isIdle = false;
        this.isReverse = false;
        this.isShimmer = false;
    }
    getRandomValue(min, max) {
        return Math.random() * (max - min) + min;
    }
    draw() {
        const centerOffset = this.maxSizeInteger * 0.5 - this.size * 0.5;
        this.ctx.fillStyle = this.color;
        this.ctx.fillRect(this.x + centerOffset, this.y + centerOffset, this.size, this.size);
    }
    appear() {
        this.isIdle = false;
        if (this.counter <= this.delay) {
            this.counter += this.counterStep;
            return;
        }
        if (this.size >= this.maxSize) this.isShimmer = true;
        if (this.isShimmer) this.shimmer();
        else this.size += this.sizeStep;
        this.draw();
    }
    disappear() {
        this.isShimmer = false;
        this.counter = 0;
        if (this.size <= 0) {
            this.isIdle = true;
            return;
        }
        this.size -= 0.1;
        this.draw();
    }
    shimmer() {
        if (this.size >= this.maxSize) this.isReverse = true;
        else if (this.size <= this.minSize) this.isReverse = false;
        if (this.isReverse) this.size -= this.speed;
        else this.size += this.speed;
    }
}

class PixelCanvas extends HTMLElement {
    static register(tag = "pixel-canvas") {
        if ("customElements" in window) customElements.define(tag, this);
    }
    static css = `
        :host {
            display: grid;
            inline-size: 100%;
            block-size: 100%;
            overflow: hidden;
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
        }
    `;
    get colors() {
        return this.dataset.colors?.split(",") || ["#f8fafc", "#f1f5f9", "#cbd5e1"];
    }
    get gap() {
        const value = this.dataset.gap || 5;
        const min = 4, max = 50;
        if (value <= min) return min;
        if (value >= max) return max;
        return parseInt(value);
    }
    get speed() {
        const value = this.dataset.speed || 35;
        const min = 0, max = 100, throttle = 0.001;
        if (value <= min || this.reducedMotion) return min;
        if (value >= max) return max * throttle;
        return parseInt(value) * throttle;
    }
    connectedCallback() {
        const canvas = document.createElement("canvas");
        const sheet = new CSSStyleSheet();
        this._parent = this.parentNode;
        this.shadowroot = this.attachShadow({ mode: "open" });
        sheet.replaceSync(PixelCanvas.css);
        this.shadowroot.adoptedStyleSheets = [sheet];
        this.shadowroot.append(canvas);
        this.canvas = this.shadowroot.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.timeInterval = 1000 / 60;
        this.timePrevious = performance.now();
        this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        this.init();
        this.resizeObserver = new ResizeObserver(() => this.init());
        this.resizeObserver.observe(this);
        this._parent.addEventListener("mouseenter", this);
        this._parent.addEventListener("mouseleave", this);
    }
    disconnectedCallback() {
        this.resizeObserver.disconnect();
        this._parent.removeEventListener("mouseenter", this);
        this._parent.removeEventListener("mouseleave", this);
        delete this._parent;
    }
    handleEvent(event) {
        this[`on${event.type}`](event);
    }
    onmouseenter() { this.handleAnimation("appear"); }
    onmouseleave() { this.handleAnimation("disappear"); }
    handleAnimation(name) {
        cancelAnimationFrame(this.animation);
        this.animation = this.animate(name);
    }
    init() {
        const rect = this.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        this.pixels = [];
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.createPixels();
    }
    getDistanceToCanvasCenter(x, y) {
        const dx = x - this.canvas.width / 2;
        const dy = y - this.canvas.height / 2;
        return Math.sqrt(dx * dx + dy * dy);
    }
    createPixels() {
        for (let x = 0; x < this.canvas.width; x += this.gap) {
            for (let y = 0; y < this.canvas.height; y += this.gap) {
                const color = this.colors[Math.floor(Math.random() * this.colors.length)];
                const delay = this.reducedMotion ? 0 : this.getDistanceToCanvasCenter(x, y);
                this.pixels.push(new Pixel(this.canvas, this.ctx, x, y, color, this.speed, delay));
            }
        }
    }
    animate(fnName) {
        this.animation = requestAnimationFrame(() => this.animate(fnName));
        const timeNow = performance.now();
        const timePassed = timeNow - this.timePrevious;
        if (timePassed < this.timeInterval) return;
        this.timePrevious = timeNow - (timePassed % this.timeInterval);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (let i = 0; i < this.pixels.length; i++) this.pixels[i][fnName]();
        if (this.pixels.every(pixel => pixel.isIdle)) cancelAnimationFrame(this.animation);
    }
}
PixelCanvas.register();

// ===== FONT MAP =====
const FONT_MAP = {
    'А': 'ᴀ', 'а': 'ᴀ', 'В': 'ʙ', 'в': 'ʙ', 'Е': 'ᴇ', 'е': 'ᴇ', 'К': 'ᴋ', 'к': 'ᴋ',
    'М': 'ᴍ', 'м': 'ᴍ', 'О': 'ᴏ', 'о': 'ᴏ', 'Р': 'ᴘ', 'р': 'ᴘ', 'С': 'ᴄ', 'с': 'ᴄ',
    'Т': 'ᴛ', 'т': 'ᴛ', 'Н': 'н', 'н': 'н', 'І': 'і', 'і': 'і', 'У': 'у', 'у': 'у',
    'Л': 'ʌ', 'л': 'ʌ', 'A': 'ᴀ', 'a': 'ᴀ', 'B': 'ʙ', 'b': 'ʙ', 'C': 'ᴄ', 'c': 'ᴄ',
    'D': 'ᴅ', 'd': 'ᴅ', 'E': 'ᴇ', 'e': 'ᴇ', 'F': 'ꜰ', 'f': 'ꜰ', 'G': 'ɢ', 'g': 'ɢ',
    'H': 'ʜ', 'h': 'ʜ', 'I': 'ɪ', 'i': 'ɪ', 'J': 'ᴊ', 'j': 'ᴊ', 'K': 'ᴋ', 'k': 'ᴋ',
    'L': 'ʟ', 'l': 'ʟ', 'M': 'ᴍ', 'm': 'ᴍ', 'N': 'ɴ', 'n': 'ɴ', 'O': 'ᴏ', 'o': 'ᴏ',
    'P': 'ᴘ', 'p': 'ᴘ', 'Q': 'ǫ', 'q': 'ǫ', 'R': 'ʀ', 'r': 'ʀ', 'S': 'ꜱ', 's': 'ꜱ',
    'T': 'ᴛ', 't': 'ᴛ', 'U': 'ᴜ', 'u': 'ᴜ', 'V': 'ᴠ', 'v': 'ᴠ', 'W': 'ᴡ', 'w': 'ᴡ',
    'X': 'x', 'x': 'x', 'Y': 'ʏ', 'y': 'ʏ', 'Z': 'ᴢ', 'z': 'ᴢ',
};

function convertTextToFont(text) {
    return text.split('').map(char => FONT_MAP[char] || FONT_MAP[char.toUpperCase()] || char).join('');
}

document.addEventListener('DOMContentLoaded', () => {

        // ===== UI BLIP (Звук только при закрытии) =====
    const uiBlipAudio = new Audio('assets/blip.mp3');
    uiBlipAudio.preload = 'auto';
    uiBlipAudio.playsInline = true;
    uiBlipAudio.load();

    function warmUpUiBlip() {
        const playAttempt = uiBlipAudio.play();
        if (playAttempt && typeof playAttempt.then === 'function') {
            playAttempt.then(() => {
                uiBlipAudio.pause();
                uiBlipAudio.currentTime = 0;
            }).catch(() => {});
        }
    }

    document.addEventListener('pointerdown', warmUpUiBlip, { once: true });
    document.addEventListener('touchstart', warmUpUiBlip, { once: true });
    document.addEventListener('keydown', warmUpUiBlip, { once: true });

    function playUiMenuBlip() {
        uiBlipAudio.pause();
        uiBlipAudio.currentTime = 0;
        const playAttempt = uiBlipAudio.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
            playAttempt.catch(error => console.warn('UI blip failed', error));
        }
    }
    window.playUiMenuBlip = playUiMenuBlip;

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
            modal.style.display = 'none';
            playUiMenuBlip(); // Звук только при закрытии
        }
    }

    document.querySelectorAll('[data-modal-trigger]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modalTrigger;
            openModal(modalId);
        });
    });

    document.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.modal;
        if (id) closeModal(id);
    }));
    document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => {
        if (e.target === o) {
            const modalId = o.id;
            if (modalId) closeModal(modalId);
        }
    }));

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => {
                if (m.id) closeModal(m.id);
            });
        }
    });

    // ===== CAROUSEL (twitter) =====
    const carousel = document.getElementById('mainCarousel');
    let carouselInterval;
    if (carousel) {
        const imgs = carousel.querySelectorAll('img');
        carouselInterval = setInterval(() => {
            const active = carousel.querySelector('.active');
            let next = active ? active.nextElementSibling : null;
            if (!next) next = imgs[0];
            if (active) active.classList.remove('active');
            if (next) next.classList.add('active');
        }, 3000);
        carousel.addEventListener('click', () => clearInterval(carouselInterval));
    }

    // ===== FONT STYLER (стилизатор текста: основная страница + вкладка GARAGE) =====
    function initTextStyler(inputId, previewId) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if (!input || !preview) return;
        function update() {
            const rawText = input.value.trim();
            preview.textContent = rawText === '' ? convertTextToFont('tap to copy') : convertTextToFont(rawText);
        }
        update();
        input.addEventListener('input', update);
        preview.addEventListener('click', () => {
            navigator.clipboard.writeText(preview.textContent).then(() => {
                const original = preview.textContent;
                preview.textContent = convertTextToFont('copied!');
                setTimeout(() => preview.textContent = original, 800);
            }).catch(err => console.warn('Clipboard error:', err));
        });
    }
    initTextStyler('fontInputEmbedded', 'stylerPreviewEmbedded');
    initTextStyler('garageFontInput', 'garageStylerPreview');


    // ===== DOWNLOAD ARCHIVE =====
    document.getElementById('downloadArchiveBtnEmbedded')?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = 'assets/morstrix_archive.zip';
        a.download = 'MORSTRIX_FONT.zip';
        a.click();
    });

    // ===== PAINT =====
    document.getElementById('paintJournalBtn')?.addEventListener('click', () => {
        window.location.href = 'paint.html';
    });

    // ===== ART FEED =====
    let firebaseDbPromise = null;
    async function getFirestoreDb() {
        if (!firebaseDbPromise) {
            firebaseDbPromise = (async () => {
                try {
                    const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
                    const { getFirestore } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
                    const firebaseConfig = {
                        apiKey: 'AIzaSyD7HW4Ec9n3vl5l_WgTSwiK5NpyQYE6tlU',
                        authDomain: 'helper-e10b2.firebaseapp.com',
                        projectId: 'helper-e10b2',
                        storageBucket: 'helper-e10b2.firebasestorage.app',
                        messagingSenderId: '131536876451',
                        appId: '1:131536876451:web:eeaef494c83dfc4849e016'
                    };
                    const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
                    return getFirestore(app);
                } catch (e) {
                    console.warn('Firebase init failed', e);
                    return null;
                }
            })();
        }
        return firebaseDbPromise;
    }

    async function loadCurrentArt() {
        const preview = document.getElementById('currentArtPreview');
        if (!preview) return;
        try {
            const db = await getFirestoreDb();
            if (!db) return;
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
            const currentSnap = await getDoc(doc(db, 'global_canvas', 'current'));
            if (currentSnap.exists()) {
                const data = currentSnap.data();
                const image = data?.imageUrl || data?.imageBase64 || '';
                if (image) preview.src = image;
            }
        } catch (e) { console.warn('loadCurrentArt failed', e); }
    }

    function formatFeedTime(value) {
        const date = value?.toDate ? value.toDate() : (value instanceof Date ? value : null);
        if (!date) return 'unknown time';
        return date.toLocaleString();
    }

    function openFeedPreview(imageSrc) {
        const imageEl = document.getElementById('feedPreviewImage');
        if (!imageEl) return;
        imageEl.src = imageSrc;
        openModal('feedPreviewModal');
    }

    async function loadFeed() {
        const container = document.getElementById('feedContainer');
        if (!container) return;
        container.innerHTML = '<p class="text-secondary">Loading feed...</p>';
        try {
            const db = await getFirestoreDb();
            if (!db) { container.innerHTML = '<p class="text-secondary">Feed unavailable</p>'; return; }
            const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
            const historyRef = collection(db, 'global_canvas', 'current', 'history');
            const feedQuery = query(historyRef, orderBy('timestamp', 'desc'), limit(20));
            const snap = await getDocs(feedQuery);
            if (snap.empty) {
                container.innerHTML = '<p class="text-secondary">No feed entries yet.</p>';
                return;
            }
            container.innerHTML = '';
            snap.forEach(entry => {
                const data = entry.data();
                const image = data?.imageUrl || data?.imageBase64 || '';
                if (!image) return;
                const item = document.createElement('div');
                item.className = 'feed-item';
                item.innerHTML = `<img class="feed-thumb" src="${image}" alt="Feed item"><div class="feed-meta">${(data.authorName || 'ANON')}<br>${formatFeedTime(data.timestamp)}</div>`;
                item.addEventListener('click', () => openFeedPreview(image));
                container.appendChild(item);
            });
        } catch (e) {
            console.warn('loadFeed failed', e);
            container.innerHTML = '<p class="text-secondary">Failed to load feed.</p>';
        }
    }

    document.getElementById('archiveBtn')?.addEventListener('click', async () => {
        const titleEl = document.getElementById('stubModalTitle');
        if (titleEl) titleEl.textContent = 'FEED';
        openModal('stubModal');
        await loadFeed();
    });

    loadCurrentArt();

    // ===== GARAGE: плейсхолдер «TYPE TEXT» печатается, как на машинке =====
    (function () {
        const input = document.getElementById('garageFontInput');
        if (!input) return;
        const PHRASE = 'TYPE TEXT';
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) { input.placeholder = PHRASE; return; }

        const TYPE_MS = 130, ERASE_MS = 70, HOLD_MS = 1500, PAUSE_MS = 500, HIDDEN_POLL_MS = 400;
        let shown = 0, erasing = false, timer = null;

        function paint() {
            // «_» играет роль курсора; пока набрано 0 символов, поле не остаётся пустым
            input.placeholder = PHRASE.slice(0, shown) + (shown < PHRASE.length || erasing ? '_' : '');
        }

        function schedule(ms) { clearTimeout(timer); timer = setTimeout(tick, ms); }

        function tick() {
            // вкладка/модалка скрыты — ничего не двигаем, просто ждём
            if (input.offsetParent === null) { schedule(HIDDEN_POLL_MS); return; }
            if (!erasing) {
                if (shown < PHRASE.length) { shown++; paint(); schedule(TYPE_MS); }
                else { paint(); erasing = true; schedule(HOLD_MS); }
            } else {
                if (shown > 0) { shown--; paint(); schedule(ERASE_MS); }
                else { erasing = false; schedule(PAUSE_MS); }
            }
        }

        function stop() { clearTimeout(timer); timer = null; input.placeholder = PHRASE; }
        function resume() { if (!input.value && timer === null) { shown = 0; erasing = false; paint(); schedule(TYPE_MS); } }

        input.addEventListener('focus', stop);
        input.addEventListener('blur', resume);
        paint();
        schedule(TYPE_MS);
    })();

    // ===== TATTOO: виджет Pinterest-доски =====
    function initPinterestWidget() {
        const wrap = document.getElementById('pinterestWidget');
        const embed = document.getElementById('pinterestEmbed');
        if (!wrap || !embed || wrap.dataset.ready) return;
        wrap.dataset.ready = '1';

        // Виджету нужен полный адрес доски вида https://www.pinterest.com/<user>/<board>/ (pin.it не подходит)
        const boardUrl = (wrap.dataset.boardUrl || '').trim();
        if (!/^https:\/\/([a-z]{2,3}\.)?pinterest\.[a-z.]+\/[^/?#]+\/[^/?#]+\/?/i.test(boardUrl)) {
            embed.hidden = true; // остаётся только кнопка OPEN BOARD
            return;
        }

        const link = document.createElement('a');
        link.href = boardUrl;
        link.setAttribute('data-pin-do', 'embedBoard');
        link.setAttribute('data-pin-board-width', String(Math.max(200, Math.min(400, embed.clientWidth || 400))));
        link.setAttribute('data-pin-scale-height', '260');
        link.setAttribute('data-pin-scale-width', '80');
        embed.appendChild(link);

        if (window.PinUtils) { window.PinUtils.build(embed); return; }
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://assets.pinterest.com/js/pinit.js'; // сам найдёт ссылку выше при загрузке
        script.onerror = () => { embed.hidden = true; };
        document.body.appendChild(script);
    }


    // ===== TOP PLAYERS =====
    async function loadTopPlayers() {
        const containers = document.querySelectorAll('.top-players-list');
        if (!containers.length) return;
        const setAll = html => containers.forEach(c => { c.innerHTML = html; });
        try {
            const { initializeApp, getApps, getApp } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js');
            const { getFirestore, collection, query, orderBy, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
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
            const q = query(collection(db, "top_players"), orderBy("score", "desc"), limit(10));
            const snap = await getDocs(q);
            if (!snap.empty) {
                let html = ''; let rank = 1;
                snap.forEach(d => { const data = d.data(); html += `<div class="top-row"><span>${rank}. ${(data.name || 'ANON').slice(0, 10)}</span><span>${data.score}</span></div>`; rank++; });
                setAll(html);
            } else {
                setAll('<div style="text-align:center;padding:10px;">— пусто —</div>');
            }
        } catch (e) {
            console.warn('loadTopPlayers failed', e);
            setAll('⚠️ ERROR');
        }
    }
    if (document.querySelector('.top-players-list')) loadTopPlayers();

    // ===== TELEGRAM FORUM TABS + WELLNESS CAROUSEL =====
    (function () {
        const tabs = document.querySelectorAll('#tgForumTabs .tg-forum-tab');
        const contents = document.querySelectorAll('#tgForumContent .tg-tab-content');
        if (!tabs.length || !contents.length) return;

        let carouselInitialized = false;

        function initWellnessCarousel() {
            if (carouselInitialized) return;
            const track = document.getElementById('telegramSwipeTrack');
            const dotsContainer = document.getElementById('telegramSwipeDots');
            const prevBtn = document.getElementById('carouselPrev');
            const nextBtn = document.getElementById('carouselNext');
            if (!track || !dotsContainer) return;
            if (track.children.length > 0) { carouselInitialized = true; return; }

            const SLIDES_DATA = [
                { img: 'assets/w1.jpg', caption: 'ДІАФРАГМАЛЬНЕ ДИХАННЯ', title: 'W1', body: `Стілець: жорсткий.\nОпора: спина притиснута.\nВдих: носом, живіт вперед.\nВидих: губи трубочкою.` },
                { img: 'assets/w2.jpg', caption: 'КОРОТКА СТОПА', title: 'W2', body: `Сядь на стілець.\nПідтягни подушечку до п'ятки.\nУтримуй 5-8 сек.` },
                { img: 'assets/w3.jpg', caption: 'СТИСКАННЯ КОЛІНАМИ', title: 'W3', body: `Лежачи на спині.\nСтискай подушку 5-10 сек.` },
                { img: 'assets/w4.jpg', caption: 'ЯГІДНИЙ МІСТОК', title: 'W4', body: `Підійми таз.\nСтисни сідниці 5 сек.` },
                { img: 'assets/w5.jpg', caption: 'МЕРТВИЙ ЖУК', title: 'W5', body: `Поперек притиснутий.\nОпускай ногу.` },
                { img: 'assets/w6.jpg', caption: 'МУШЛЯ', title: 'W6', body: `На боку.\nПідіймай коліно.` },
                { img: 'assets/w7.jpg', caption: 'ДЕКОМПРЕСІЯ', title: 'W7', body: `Руку по дузі назад.\nТримай 3 дихання.` },
                { img: 'assets/w8.jpg', caption: 'КІШКА-КОРОВА', title: 'W8', body: `Кішка: вигинай спину.\nКорова: прогин у грудях.` },
                { img: 'assets/w9.jpg', caption: 'СТАБІЛІЗАЦІЯ', title: 'W9', body: `Долоні на стіну.\nШтовхай 30-45 сек.` }
            ];

            let currentIndex = 0;

            SLIDES_DATA.forEach((slide, i) => {
                const div = document.createElement('div');
                div.className = 'swipe-slide';
                div.innerHTML = `<img src="${slide.img}" alt="${slide.caption}" draggable="false">`;
                track.appendChild(div);
                const dot = document.createElement('div');
                dot.className = 'swipe-dot' + (i === 0 ? ' active' : '');
                dotsContainer.appendChild(dot);
            });

            function goTo(index) {
                currentIndex = Math.max(0, Math.min(SLIDES_DATA.length - 1, index));
                const slideWidth = track.children[0]?.offsetWidth || track.offsetWidth || 200;
                track.style.transition = 'transform 0.3s ease';
                track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
                dotsContainer.querySelectorAll('.swipe-dot').forEach((d, i) => d.classList.toggle('active', i === currentIndex));
            }

            prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
            nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));

            document.addEventListener('keydown', e => {
                if (!document.getElementById('telegramModal')?.classList.contains('active')) return;
                if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
                if (e.key === 'ArrowRight') goTo(currentIndex + 1);
            });

            document.getElementById('drumReadBtn')?.addEventListener('click', () => {
                const slide = SLIDES_DATA[currentIndex];
                const titleEl = document.getElementById('wellnessPopupTitle');
                const bodyEl = document.getElementById('wellnessPopupBody');
                if (titleEl) titleEl.textContent = slide.title;
                if (bodyEl) bodyEl.textContent = slide.body;
                openModal('wellnessPopup');
                window.playUiMenuBlip?.();
            });

            setTimeout(() => goTo(0), 50);
            carouselInitialized = true;
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                contents.forEach(c => c.classList.remove('active'));
                const activeContent = document.querySelector(`#tgForumContent .tg-tab-content[data-content="${tabName}"]`);
                if (activeContent) activeContent.classList.add('active');
                if (tabName === 'wellness') setTimeout(initWellnessCarousel, 50);
                if (tabName === 'tattoo') setTimeout(initPinterestWidget, 50);
                window.playUiMenuBlip?.();
            });
        });

        const modal = document.getElementById('telegramModal');
        if (modal) {
            const observer = new MutationObserver(() => {
                if (modal.classList.contains('active')) setTimeout(initWellnessCarousel, 100);
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
        }

        if (document.querySelector('#tgForumTabs .tg-forum-tab.active[data-tab="wellness"]')) {
            setTimeout(initWellnessCarousel, 100);
        }
    })();

    // ===== GENERIC MODAL TRIGGER =====
    document.querySelectorAll('[data-modal-trigger]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modalTrigger;
            openModal(modalId);
            window.playUiMenuBlip?.();
        });
    });

    // ===== MERCH CONSTRUCTOR =====
    (function () {
        const canvas = document.getElementById('printCanvas');
        const upload = document.getElementById('imageUpload');
        const reset = document.getElementById('resetPrint');
        if (!canvas || !upload) return;
        const ctx = canvas.getContext('2d');
        canvas.width = 80;
        canvas.height = 80;
        upload.addEventListener('change', event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = loadEvent => {
                const img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, 80, 80);
                    ctx.drawImage(img, 0, 0, 80, 80);
                };
                img.src = loadEvent.target?.result;
            };
            reader.readAsDataURL(file);
        });
        reset?.addEventListener('click', () => {
            ctx.clearRect(0, 0, 80, 80);
            upload.value = '';
        });
    })();

    // ===== CLOSE MODALS =====
    document.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.modal;
        if (id) closeModal(id);
    }));
    document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => {
        if (e.target === o) o.classList.remove('active');
    }));

    // ===== ESCAPE =====
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
    });

    // ===== DOUBLE-TAP ZOOM GUARD =====
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
    }, { passive: false });

    // ===== DISCLAIMER BUTTONS =====
    document.querySelectorAll('[data-href]').forEach(btn => {
        btn.addEventListener('click', function () {
            const modalToClose = this.dataset.modalClose;
            if (modalToClose) closeModal(modalToClose);
            window.location.href = this.dataset.href;
        });
    });

});