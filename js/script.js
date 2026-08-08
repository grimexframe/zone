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
        this.ctx.fillRect(
            this.x + centerOffset,
            this.y + centerOffset,
            this.size,
            this.size
        );
    }
    appear() {
        this.isIdle = false;
        if (this.counter <= this.delay) {
            this.counter += this.counterStep;
            return;
        }
        if (this.size >= this.maxSize) {
            this.isShimmer = true;
        }
        if (this.isShimmer) {
            this.shimmer();
        } else {
            this.size += this.sizeStep;
        }
        this.draw();
    }
    disappear() {
        this.isShimmer = false;
        this.counter = 0;
        if (this.size <= 0) {
            this.isIdle = true;
            return;
        } else {
            this.size -= 0.1;
        }
        this.draw();
    }
    shimmer() {
        if (this.size >= this.maxSize) {
            this.isReverse = true;
        } else if (this.size <= this.minSize) {
            this.isReverse = false;
        }
        if (this.isReverse) {
            this.size -= this.speed;
        } else {
            this.size += this.speed;
        }
    }
}

class PixelCanvas extends HTMLElement {
    static register(tag = "pixel-canvas") {
        if ("customElements" in window) {
            customElements.define(tag, this);
        }
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
        const min = 4;
        const max = 50;
        if (value <= min) return min;
        else if (value >= max) return max;
        else return parseInt(value);
    }
    get speed() {
        const value = this.dataset.speed || 35;
        const min = 0;
        const max = 100;
        const throttle = 0.001;
        if (value <= min || this.reducedMotion) return min;
        else if (value >= max) return max * throttle;
        else return parseInt(value) * throttle;
    }
    get noFocus() {
        return this.hasAttribute("data-no-focus");
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
    onmouseenter() {
        this.handleAnimation("appear");
    }
    onmouseleave() {
        this.handleAnimation("disappear");
    }
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
        for (let i = 0; i < this.pixels.length; i++) {
            this.pixels[i][fnName]();
        }
        if (this.pixels.every((pixel) => pixel.isIdle)) {
            cancelAnimationFrame(this.animation);
        }
    }
}
PixelCanvas.register();

// ===== FONT STYLER (SMALL CAPS MAPPING) =====
const FONT_MAP = {
    'А': 'ᴀ', 'а': 'ᴀ', 'В': 'в', 'в': 'ʙ', 'Е': 'ᴇ', 'е': 'ᴇ', 'К': 'ᴋ', 'к': 'ᴋ',
    'М': 'ᴍ', 'м': 'ᴍ', 'О': 'ᴏ', 'о': 'ᴏ', 'Р': 'ᴘ', 'р': 'ᴘ', 'С': 'ᴄ', 'с': 'ᴄ',
    'Т': 'т', 'т': 'ᴛ', 'Н': 'н', 'н': 'н', 'І': 'і', 'і': 'і', 'У': 'у', 'у': 'у',
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
    // ===== RSS ТИКЕР =====
    const ticker = document.getElementById('rssTicker');
    const fallbackTickerItems = [
        { title: "MORSTRIX V2.0", url: "https://t.me/morstrix" },
        { title: "NEW PRINTS", url: "https://t.me/morstrix" },
        { title: "TELEGRAM", url: "https://t.me/morstrix" }
    ];
    const TICKER_CACHE_KEY = 'journalTickerCacheV2';
    const tickerWrapper = document.querySelector('.ticker-wrapper');

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function setTickerText(items) {
        if (!ticker) return;
        const normalizeItem = (item) => {
            if (typeof item === 'string') return { title: item, url: '' };
            if (item && typeof item === 'object' && typeof item.title === 'string') {
                return { title: item.title, url: typeof item.url === 'string' ? item.url : '' };
            }
            return null;
        };
        const normalized = (Array.isArray(items) ? items : [])
            .map(normalizeItem)
            .filter(Boolean);
        const safeItems = normalized.length ? normalized : fallbackTickerItems;

        const toAnchor = (item) => {
            const title = escapeHtml(item?.title || '');
            const url = typeof item?.url === 'string' && item.url.startsWith('http') ? item.url : '';
            if (!title) return '';
            if (!url) return `<span class="ticker-item">${title}</span>`;
            return `<a class="ticker-link ticker-item" href="${encodeURI(url)}" target="_blank" rel="noopener noreferrer">${title}</a>`;
        };

        const line = safeItems.map(toAnchor).filter(Boolean).join('<span class="ticker-sep"> ☻ </span>');
        if (!line) {
            ticker.textContent = "MORSTRIX V2.0";
            return;
        }
        ticker.innerHTML = `${line}<span class="ticker-sep"> ☻ </span>${line}`;
    }

    async function fetchJson(url, timeoutMs = 7000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    async function fetchDevToTitles(tag, sourceName, limit = 2) {
        const data = await fetchJson(`https://dev.to/api/articles?per_page=${limit}&tag=${encodeURIComponent(tag)}`);
        if (!Array.isArray(data)) return [];
        return data
            .map(item => ({
                title: (item?.title || '').replace(/\s+/g, ' ').trim(),
                url: item?.url || item?.canonical_url || ''
            }))
            .filter(item => item.title)
            .slice(0, limit)
            .map(item => ({ title: `${sourceName}: ${item.title}`, url: item.url }));
    }

    async function fetchHnTitles(query, sourceName, limit = 2) {
        const data = await fetchJson(`https://hn.algolia.com/api/v1/search_by_date?tags=story&hitsPerPage=${limit}&query=${encodeURIComponent(query)}`);
        const hits = Array.isArray(data?.hits) ? data.hits : [];
        return hits
            .map(item => ({
                title: (item?.title || '').replace(/\s+/g, ' ').trim(),
                url: item?.url || `https://news.ycombinator.com/item?id=${item?.objectID || ''}`
            }))
            .filter(item => item.title)
            .slice(0, limit)
            .map(item => ({ title: `${sourceName}: ${item.title}`, url: item.url }));
    }

    async function fetchRssViaRss2Json(feedUrl, sourceName, limit = 2) {
        const encoded = encodeURIComponent(feedUrl);
        const data = await fetchJson(`https://api.rss2json.com/v1/api.json?rss_url=${encoded}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        return items
            .map(item => ({
                title: (item?.title || '').replace(/\s+/g, ' ').trim(),
                url: item?.link || ''
            }))
            .filter(item => item.title)
            .slice(0, limit)
            .map(item => ({ title: `${sourceName}: ${item.title}`, url: item.url }));
    }

    async function loadRssTicker() {
        if (!ticker) return;
        const cached = localStorage.getItem(TICKER_CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                const cachedItems = Array.isArray(parsed.items) ? parsed.items : [];
                const cacheFresh = Date.now() - parsed.ts < 30 * 60 * 1000;
                const hasAtLeastOneLink = cachedItems.some(item => item && typeof item === 'object' && typeof item.url === 'string' && item.url.startsWith('http'));
                if (cachedItems.length && cacheFresh && hasAtLeastOneLink) {
                    setTickerText(parsed.items);
                    return;
                }
            } catch (e) {}
        }
        setTickerText(fallbackTickerItems);
        const results = await Promise.all([
            fetchDevToTitles('design', 'DEVTO DESIGN'),
            fetchDevToTitles('webdev', 'DEVTO WEBDEV'),
            fetchDevToTitles('art', 'DEVTO ART'),
            fetchHnTitles('design', 'HN DESIGN'),
            fetchHnTitles('fashion', 'HN FASHION'),
            fetchRssViaRss2Json('https://hypebeast.com/feed', 'HYPEBEAST')
        ]);
        const items = results.flat().slice(0, 12);
        if (!items.length) {
            const localData = await fetchJson('assets/news-fallback.json', 3000);
            const localItems = Array.isArray(localData?.items) ? localData.items : [];
            if (localItems.length) {
                setTickerText(localItems);
                localStorage.setItem(TICKER_CACHE_KEY, JSON.stringify({ items: localItems, ts: Date.now() }));
            }
            return;
        }
        setTickerText(items);
        localStorage.setItem(TICKER_CACHE_KEY, JSON.stringify({ items, ts: Date.now() }));
    }

    loadRssTicker();

    if (tickerWrapper) {
        const pauseTicker = () => tickerWrapper.classList.add('is-paused');
        const resumeTicker = () => tickerWrapper.classList.remove('is-paused');
        tickerWrapper.addEventListener('touchstart', pauseTicker, { passive: true });
        tickerWrapper.addEventListener('touchend', resumeTicker, { passive: true });
        tickerWrapper.addEventListener('touchcancel', resumeTicker, { passive: true });
    }

    if (ticker) {
        ticker.addEventListener('click', (event) => {
            const link = event.target.closest('a.ticker-link');
            if (!link) return;
            event.preventDefault();
            event.stopPropagation();
            window.open(link.href, '_blank', 'noopener,noreferrer');
        });
    }

    // ===== КАРУСЕЛЬ (twitter) =====
    const carousel = document.getElementById('mainCarousel');
    let carouselInterval;
    if (carousel) {
        const imgs = carousel.querySelectorAll('img');
        carouselInterval = setInterval(() => {
            const active = carousel.querySelector('.active');
            let next = active.nextElementSibling;
            if (!next) next = imgs[0];
            active.classList.remove('active');
            next.classList.add('active');
        }, 3000);
        carousel.addEventListener('click', () => clearInterval(carouselInterval));
    }

    // ===== UI BLIP =====
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

    // ===== УТИЛИТЫ МОДАЛОК =====
    function openModal(id, withSound = true) {
        document.getElementById(id)?.classList.add('active');
        if (withSound) playUiMenuBlip();
    }
    function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

    // ===== FONT STYLER =====
    const embeddedInput = document.getElementById('fontInputEmbedded');
    const embeddedPreview = document.getElementById('stylerPreviewEmbedded');
    if (embeddedInput && embeddedPreview) {
        function updateStylerPreview() {
            const rawText = embeddedInput.value.trim();
            embeddedPreview.textContent = rawText === '' ? convertTextToFont('tap to copy') : convertTextToFont(rawText);
        }
        updateStylerPreview();
        embeddedInput.addEventListener('input', updateStylerPreview);
        embeddedPreview.addEventListener('click', () => {
            navigator.clipboard.writeText(embeddedPreview.textContent).then(() => {
                const original = embeddedPreview.textContent;
                embeddedPreview.textContent = convertTextToFont('copied!');
                setTimeout(() => embeddedPreview.textContent = original, 800);
            }).catch(err => console.warn('Clipboard error:', err));
        });
    }

    // ===== СКАЧИВАНИЕ АРХИВА =====
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

    // ===== ART FEED (FIRESTORE) =====
    let firebaseDbPromise = null;
    async function getFirestoreDb() {
        if (!firebaseDbPromise) {
            firebaseDbPromise = (async () => {
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
            })();
        }
        return firebaseDbPromise;
    }

    async function loadCurrentArt() {
        const preview = document.getElementById('currentArtPreview');
        if (!preview) return;
        try {
            const db = await getFirestoreDb();
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
            const currentSnap = await getDoc(doc(db, 'global_canvas', 'current'));
            if (currentSnap.exists()) {
                const data = currentSnap.data();
                const image = data?.imageUrl || data?.imageBase64 || '';
                if (image) preview.src = image;
            }
        } catch (e) {
            console.warn('loadCurrentArt failed', e);
        }
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
            const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js');
            const historyRef = collection(db, 'global_canvas', 'current', 'history');
            const feedQuery = query(historyRef, orderBy('timestamp', 'desc'), limit(20));
            const snap = await getDocs(feedQuery);
            if (snap.empty) {
                container.innerHTML = '<p class="text-secondary">No feed entries yet.</p>';
                return;
            }
            container.innerHTML = '';
            snap.forEach((entry) => {
                const data = entry.data();
                const image = data?.imageUrl || data?.imageBase64 || '';
                if (!image) return;
                const item = document.createElement('div');
                item.className = 'feed-item';
                item.innerHTML = `
                    <img class="feed-thumb" src="${image}" alt="Feed item">
                    <div class="feed-meta">${(data.authorName || 'ANON')}<br>${formatFeedTime(data.timestamp)}</div>
                `;
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

    // ===== TEXT SYNTH (TTS) =====
    const ttsSpeakBtn = document.getElementById('ttsSpeakBtn');
    const ttsTextInput = document.getElementById('ttsTextInput');
    const ttsVoiceSelect = document.getElementById('ttsVoiceSelect');
    const ttsStatus = document.getElementById('ttsStatus');
    let voices = [];
    function loadVoices() {
        voices = speechSynthesis.getVoices();
        if (ttsVoiceSelect) {
            ttsVoiceSelect.innerHTML = '';
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.lang} - ${voice.name}`;
                ttsVoiceSelect.appendChild(option);
            });
            const ukrVoice = voices.find(v => v.lang.startsWith('uk'));
            const rusVoice = voices.find(v => v.lang.startsWith('ru'));
            if (ukrVoice) ttsVoiceSelect.value = ukrVoice.name;
            else if (rusVoice) ttsVoiceSelect.value = rusVoice.name;
        }
    }
    if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.onvoiceschanged = loadVoices;
        loadVoices();
    }
    function speakWithSpeechSynthesis(text) {
        if (!text.trim()) { ttsStatus.textContent = 'Введите текст'; return; }
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const selectedVoiceName = ttsVoiceSelect?.value;
        if (selectedVoiceName) {
            const voice = voices.find(v => v.name === selectedVoiceName);
            if (voice) utterance.voice = voice;
        }
        utterance.rate = 1.0; utterance.pitch = 1.0;
        utterance.onstart = () => ttsStatus.textContent = '▶ Воспроизведение';
        utterance.onend = () => ttsStatus.textContent = '';
        utterance.onerror = (e) => ttsStatus.textContent = 'Ошибка: ' + e.error;
        speechSynthesis.speak(utterance);
    }
    if (ttsSpeakBtn) ttsSpeakBtn.addEventListener('click', () => speakWithSpeechSynthesis(ttsTextInput.value));
    if (ttsTextInput) ttsTextInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') ttsSpeakBtn?.click(); });

    // ===== ТОП ИГРОКОВ (FIREBASE) =====
    async function loadTopPlayers() {
        const container = document.querySelector('.top-players-list');
        if (!container) return;
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
                container.innerHTML = html;
            } else {
                container.innerHTML = '<div style="text-align:center;padding:10px;">— пусто —</div>';
            }
        } catch (e) {
            console.warn('loadTopPlayers failed', e);
            container.innerHTML = '⚠️ ERROR';
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
        if (!track || !dotsContainer) return;
        if (track.children.length > 0) {
            carouselInitialized = true;
            return;
        }

        const SLIDES_DATA = [
            { img: 'assets/w1.jpg', caption: 'ДІАФРАГМАЛЬНЕ ДИХАННЯ', title: 'W1', body: `Стілець: жорсткий.\nОпора: спина притиснута до стіни. Стопи на підлозі.\nВдих (3-4 сек): носом, живіт вперед.\nВидих (6-8 сек): губи трубочкою.` },
            { img: 'assets/w2.jpg', caption: 'КОРОТКА СТОПА', title: 'W2', body: `Сядь на стілець, стопи на підлозі.\nПідтягни подушечку до п'ятки.\nУтримуй 5-8 сек, розслаб.` },
            { img: 'assets/w3.jpg', caption: 'СТИСКАННЯ КОЛІНАМИ', title: 'W3', body: `Лежачи на спині, ноги зігнуті.\nСтискай подушку колінами 5-10 сек.` },
            { img: 'assets/w4.jpg', caption: 'ЯГІДНИЙ МІСТОК', title: 'W4', body: `Лежачи на спині.\nПідійми таз, стисни сідниці на 5 сек.` },
            { img: 'assets/w5.jpg', caption: 'МЕРТВИЙ ЖУК', title: 'W5', body: `Лежачи, поперек притиснутий.\nОпускай ногу на видиху.` },
            { img: 'assets/w6.jpg', caption: 'МУШЛЯ', title: 'W6', body: `На боку, ноги зігнуті.\nПідіймай верхнє коліно.` },
            { img: 'assets/w7.jpg', caption: 'ДЕКОМПРЕСІЯ', title: 'W7', body: `На боку, руку по дузі назад.\nТримай 3 цикли дихання.` },
            { img: 'assets/w8.jpg', caption: 'КІШКА-КОРОВА', title: 'W8', body: `Кішка: вигинай спину вгору.\nКорова: прогин у грудях.` },
            { img: 'assets/w9.jpg', caption: 'СТАБІЛІЗАЦІЯ', title: 'W9', body: `Долоні на стіну, руки прямі.\nШтовхай стіну 30-45 сек.` }
        ];

        let currentIndex = 0;
        let startX = 0, currentX = 0, isDragging = false;

        SLIDES_DATA.forEach((slide, i) => {
            const div = document.createElement('div');
            div.className = 'swipe-slide';
            div.innerHTML = `<img src="${slide.img}" alt="${slide.caption}" draggable="false">`;
            track.appendChild(div);
            const dot = document.createElement('div');
            dot.className = 'swipe-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => goTo(i));
            dotsContainer.appendChild(dot);
        });

        function goTo(index, animate = true) {
            currentIndex = Math.max(0, Math.min(SLIDES_DATA.length - 1, index));
            track.style.transition = animate ? 'transform 0.3s ease' : 'none';
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
            dotsContainer.querySelectorAll('.swipe-dot').forEach((d, i) => d.classList.toggle('active', i === currentIndex));
        }

        function handleStart(x) { isDragging = true; startX = x; currentX = x; track.style.transition = 'none'; }
        function handleMove(x) {
            if (!isDragging) return;
            currentX = x;
            track.style.transform = `translateX(${-currentIndex * track.offsetWidth + (currentX - startX)}px)`;
        }
        function handleEnd() {
            if (!isDragging) return;
            isDragging = false;
            const diff = currentX - startX;
            if (diff < -50 && currentIndex < SLIDES_DATA.length - 1) goTo(currentIndex + 1);
            else if (diff > 50 && currentIndex > 0) goTo(currentIndex - 1);
            else goTo(currentIndex);
        }

        track.addEventListener('pointerdown', (e) => handleStart(e.clientX));
        track.addEventListener('pointermove', (e) => handleMove(e.clientX));
        track.addEventListener('pointerup', handleEnd);
        track.addEventListener('pointerleave', handleEnd);
        track.addEventListener('touchstart', (e) => { if (e.touches.length === 1) handleStart(e.touches[0].clientX); }, { passive: true });
        track.addEventListener('touchmove', (e) => { if (isDragging) { handleMove(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
        track.addEventListener('touchend', handleEnd);

        document.getElementById('drumReadBtn')?.addEventListener('click', () => {
            const slide = SLIDES_DATA[currentIndex];
            document.getElementById('wellnessPopupTitle').textContent = slide.title;
            document.getElementById('wellnessPopupBody').textContent = slide.body;
            document.getElementById('wellnessPopup')?.classList.add('active');
            window.playUiMenuBlip?.();
        });

        goTo(0, false);
        carouselInitialized = true;
    }

    // Переключение вкладок
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            contents.forEach(c => c.classList.remove('active'));
            const activeContent = document.querySelector(`#tgForumContent .tg-tab-content[data-content="${tabName}"]`);
            if (activeContent) activeContent.classList.add('active');
            if (tabName === 'wellness') setTimeout(initWellnessCarousel, 50);
            window.playUiMenuBlip?.();
        });
    });

    // Запуск при открытии модалки
    const modal = document.getElementById('telegramModal');
    if (modal) {
        const observer = new MutationObserver(() => {
            if (modal.classList.contains('active')) {
                setTimeout(initWellnessCarousel, 100);
            }
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }

    // Если wellness уже активна — запускаем сразу
    if (document.querySelector('#tgForumTabs .tg-forum-tab.active[data-tab="wellness"]')) {
        setTimeout(initWellnessCarousel, 100);
    }
})();

    // ===== TAB SWITCHING (LAB / INFO) =====
    (function () {
        const tabButtons = document.querySelectorAll('.tab-btn[data-tab]');
        const tabPanels = {
            lab: document.getElementById('tab-lab'),
            info: document.getElementById('tab-info')
        };
        const FADE_OUT_MS = 110;
        let currentTab = null;
        let transitionTimer = null;

        function switchTab(name) {
            const toPanel = tabPanels[name];
            if (!toPanel || name === currentTab) return;
            const fromPanel = currentTab ? tabPanels[currentTab] : null;

            if (transitionTimer) clearTimeout(transitionTimer);
            Object.values(tabPanels).forEach(p => {
                if (!p || p === fromPanel || p === toPanel) return;
                p.classList.remove('active', 'tab-outgoing', 'fade-out');
                p.style.display = 'none';
            });

            tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === name));

            toPanel.classList.remove('tab-outgoing', 'fade-out');
            toPanel.style.display = 'block';
            toPanel.classList.add('active');

            if (fromPanel && fromPanel !== toPanel) {
                fromPanel.classList.add('tab-outgoing');
                void fromPanel.offsetWidth;
                fromPanel.classList.add('fade-out');
            }

            currentTab = name;
            transitionTimer = setTimeout(() => {
                if (fromPanel && fromPanel !== toPanel) {
                    fromPanel.classList.remove('active', 'tab-outgoing', 'fade-out');
                    fromPanel.style.display = 'none';
                }
                transitionTimer = null;
            }, FADE_OUT_MS);
        }

        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                btn.classList.remove('activate');
                void btn.offsetWidth;
                btn.classList.add('activate');
                switchTab(btn.dataset.tab);
                window.playUiMenuBlip?.();
            });
        });

        tabPanels.info?.classList.add('active');
        if (tabPanels.info) tabPanels.info.style.display = 'block';
        currentTab = 'info';
    })();

    // ===== GENERIC MODAL TRIGGER =====
    document.querySelectorAll('[data-modal-trigger]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.modalTrigger)?.classList.add('active');
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

    // ===== ЗАКРЫТИЕ МОДАЛОК =====
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