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
    // ===== GSAP SCROLLTRIGGER + SNAP =====
    const wrapper = document.querySelector('.journal-wrapper');
    const content = document.getElementById('journalVertical');
    const pages = document.querySelectorAll('.journal-page');
    const totalPages = pages.length;

    window.currentPage = 0;

    // --- Точки ---
    const indicator = document.getElementById('pageIndicator');
    if (indicator) {
        indicator.innerHTML = Array(totalPages).fill(0).map(() => '<span class="dot"></span>').join('');
    }
    const dots = document.querySelectorAll('.dot');

    let lastDotUpdate = -1;
    function updateActiveDot(index) {
        if (index === lastDotUpdate) return;
        lastDotUpdate = index;

        index = Math.max(0, Math.min(totalPages - 1, index));
        dots.forEach((dot, i) => {
            const shouldBeActive = i === index;
            if (dot.classList.contains('active') !== shouldBeActive) {
                dot.classList.toggle('active', shouldBeActive);
                dot.style.transitionDelay = `${Math.abs(i - index) * 0.05}s`;
            }
        });
    }

    if (dots.length) {
        dots[0].classList.add('active');
        dots.forEach((dot, i) => dot.addEventListener('click', () => window.scrollToPage(i)));
    }

    // GSAP ScrollTrigger snap setup
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Создаем ScrollTrigger для каждой страницы (native scroll)
        pages.forEach((page, i) => {
            ScrollTrigger.create({
                trigger: page,
                start: 'top center',
                end: 'bottom center',
                invalidateOnRefresh: true,
                onEnter: () => updateActiveDot(i),
                onEnterBack: () => updateActiveDot(i),
            });
        });

        // Global snap для всего документа
        ScrollTrigger.create({
            trigger: '.journal-vertical',
            start: 'top top',
            end: 'bottom bottom',
            invalidateOnRefresh: true,
            snap: {
                snapTo: 1 / (totalPages - 1),
                duration: { min: 0.15, max: 0.35 },
                delay: 0,
                ease: 'power3.inOut',
            },
        });

        // Обработка ресайза
        window.addEventListener('resize', () => {
            ScrollTrigger.refresh();
            const pageHeight = window.innerHeight;
            const scrollPos = window.scrollY || 0;
            updateActiveDot(Math.round(scrollPos / pageHeight));
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                ScrollTrigger.refresh();
                const pageHeight = window.innerHeight;
                const scrollPos = window.scrollY || 0;
                updateActiveDot(Math.round(scrollPos / pageHeight));
            }, 100);
        });
    }

    // Функция навигации
    window.scrollToPage = (index) => {
        index = Math.max(0, Math.min(totalPages - 1, index));
        window.currentPage = index;

        const pageHeight = window.innerHeight;
        const targetY = index * pageHeight;

        window.scrollTo({ top: targetY, behavior: 'smooth' });
        updateActiveDot(index);
    };

    // Стрелки Pinterest
    document.getElementById('pinterestPrevBtn')?.addEventListener('click', () => {
        window.scrollToPage?.(window.currentPage - 1);
    });
    document.getElementById('pinterestNextBtn')?.addEventListener('click', () => {
        window.scrollToPage?.(window.currentPage + 1);
    });

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
        // Duplicate once for smoother endless marquee.
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

                // Ignore legacy cache that contains only plain strings (no URLs).
                if (cachedItems.length && cacheFresh && hasAtLeastOneLink) {
                    setTickerText(parsed.items);
                    return;
                }
            } catch (e) {
                // Ignore broken cache.
            }
        }

        setTickerText(fallbackTickerItems);

        const results = await Promise.all([
            fetchDevToTitles('design', 'DEVTO DESIGN'),
            fetchDevToTitles('webdev', 'DEVTO WEBDEV'),
            fetchDevToTitles('art', 'DEVTO ART'),
            fetchHnTitles('design', 'HN DESIGN'),
            fetchHnTitles('fashion', 'HN FASHION'),
            // Keep one fashion/art RSS path for vibe sources.
            fetchRssViaRss2Json('https://hypebeast.com/feed', 'HYPEBEAST')
        ]);

        const items = results.flat().slice(0, 12);
        if (!items.length) {
            // Stable local fallback (works offline / when APIs fail).
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

    // Desktop: pause handled via CSS :hover.
    // Mobile: press and hold to pause, release to continue.
    if (tickerWrapper) {
        const pauseTicker = () => tickerWrapper.classList.add('is-paused');
        const resumeTicker = () => tickerWrapper.classList.remove('is-paused');

        tickerWrapper.addEventListener('touchstart', pauseTicker, { passive: true });
        tickerWrapper.addEventListener('touchend', resumeTicker, { passive: true });
        tickerWrapper.addEventListener('touchcancel', resumeTicker, { passive: true });
    }

    if (ticker) {
        // Ensure link opening works even while marquee is moving and Lenis handles gestures.
        ticker.addEventListener('click', (event) => {
            const link = event.target.closest('a.ticker-link');
            if (!link) return;
            event.preventDefault();
            event.stopPropagation();
            window.open(link.href, '_blank', 'noopener,noreferrer');
        });
    }

    // ===== КАРУСЕЛЬ =====
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
            }).catch(() => { });
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

    // ===== BEHANCE =====
    document.getElementById('behanceBtn')?.addEventListener('click', () => openModal('behanceDisclaimerModal'));

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

        const placeholderText = 'TYPE TEXT';
        let typingTimer = null, isTyping = true, charIndex = 0;
        function animatePlaceholder() {
            if (typingTimer) clearTimeout(typingTimer);
            if (isTyping) {
                if (charIndex < placeholderText.length) {
                    embeddedInput.placeholder = placeholderText.substring(0, charIndex + 1) + ' █';
                    charIndex++;
                    typingTimer = setTimeout(animatePlaceholder, 120);
                } else {
                    isTyping = false;
                    typingTimer = setTimeout(animatePlaceholder, 1500);
                }
            } else {
                if (charIndex > 0) {
                    charIndex--;
                    embeddedInput.placeholder = placeholderText.substring(0, charIndex) + ' █';
                    typingTimer = setTimeout(animatePlaceholder, 80);
                } else {
                    isTyping = true;
                    embeddedInput.placeholder = ' █';
                    typingTimer = setTimeout(animatePlaceholder, 300);
                }
            }
        }
        function startAnimation() {
            if (embeddedInput.value === '') {
                isTyping = true; charIndex = 0;
                embeddedInput.placeholder = ' █';
                if (typingTimer) clearTimeout(typingTimer);
                typingTimer = setTimeout(animatePlaceholder, 300);
            }
        }
        function stopAnimation() {
            if (typingTimer) clearTimeout(typingTimer);
            embeddedInput.placeholder = '';
        }
        embeddedInput.addEventListener('focus', stopAnimation);
        embeddedInput.addEventListener('blur', () => { if (embeddedInput.value === '') startAnimation(); });
        const page3 = document.querySelector('.journal-page[data-page="3"]');
        if (page3) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => entry.isIntersecting ? startAnimation() : stopAnimation());
            }, { threshold: 0.1 });
            observer.observe(page3);
        } else startAnimation();
    }

    // ===== СКАЧИВАНИЕ АРХИВА =====
    document.getElementById('downloadArchiveBtnEmbedded')?.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = 'assets/morstrix_archive.zip';
        a.download = 'MORSTRIX_FONT.zip';
        a.click();
    });

    // ===== PAINT (Прямой переход на paint.html) =====
    document.getElementById('paintJournalBtn')?.addEventListener('click', () => {
        window.location.href = 'paint.html';
    });

    document.getElementById('paintAnonChoiceBtn')?.addEventListener('click', () => {
        closeModal('paintChoiceModal');
        window.location.href = 'paint.html';
    });

    document.getElementById('paintRegChoiceBtn')?.addEventListener('click', () => {
        closeModal('paintChoiceModal');
        openModal('nicknameModal');
    });

    document.getElementById('nicknameEnterBtn')?.addEventListener('click', () => {
        const nickname = document.getElementById('nicknameInput').value.trim();
        if (nickname) {
            localStorage.setItem('paintNickname', nickname);
            window.location.href = 'paint.html?nick=' + encodeURIComponent(nickname);
            closeModal('nicknameModal');
        } else {
            alert('Enter nickname');
        }
    });

    // Typewriter animation for nickname input
    const nicknameInput = document.getElementById('nicknameInput');
    if (nicknameInput) {
        const nicknamePlaceholder = 'NICKNAME';
        let nicknameTypingTimer = null, isNicknameTyping = true, nicknameCharIndex = 0;
        function animateNicknamePlaceholder() {
            if (nicknameTypingTimer) clearTimeout(nicknameTypingTimer);
            if (isNicknameTyping) {
                if (nicknameCharIndex < nicknamePlaceholder.length) {
                    nicknameInput.placeholder = nicknamePlaceholder.substring(0, nicknameCharIndex + 1) + ' █';
                    nicknameCharIndex++;
                    nicknameTypingTimer = setTimeout(animateNicknamePlaceholder, 120);
                } else {
                    isNicknameTyping = false;
                    nicknameTypingTimer = setTimeout(animateNicknamePlaceholder, 1500);
                }
            } else {
                if (nicknameCharIndex > 0) {
                    nicknameCharIndex--;
                    nicknameInput.placeholder = nicknamePlaceholder.substring(0, nicknameCharIndex) + ' █';
                    nicknameTypingTimer = setTimeout(animateNicknamePlaceholder, 80);
                } else {
                    isNicknameTyping = true;
                    nicknameInput.placeholder = ' █';
                    nicknameTypingTimer = setTimeout(animateNicknamePlaceholder, 300);
                }
            }
        }
        function startNicknameAnimation() {
            if (nicknameInput.value === '') {
                isNicknameTyping = true; nicknameCharIndex = 0;
                nicknameInput.placeholder = ' █';
                if (nicknameTypingTimer) clearTimeout(nicknameTypingTimer);
                nicknameTypingTimer = setTimeout(animateNicknamePlaceholder, 300);
            }
        }
        function stopNicknameAnimation() {
            if (nicknameTypingTimer) clearTimeout(nicknameTypingTimer);
            nicknameInput.placeholder = '';
        }
        nicknameInput.addEventListener('focus', stopNicknameAnimation);
        nicknameInput.addEventListener('blur', () => { if (nicknameInput.value === '') startNicknameAnimation(); });

        // Start animation when modal opens
        const nicknameModal = document.getElementById('nicknameModal');
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('active') && nicknameInput.value === '') {
                    startNicknameAnimation();
                } else {
                    stopNicknameAnimation();
                }
            });
        });
        observer.observe(nicknameModal, { attributes: true, attributeFilter: ['class'] });
    }

    // ===== MOOD (PINTEREST) =====
    const moodTrigger = document.getElementById('moodTrigger');
    if (moodTrigger) {
        moodTrigger.addEventListener('click', () => {
            openModal('moodModal');
            if (!window.pinterestScriptLoaded) {
                const script = document.createElement('script');
                script.src = 'https://assets.pinterest.com/js/pinit.js';
                script.onload = () => {
                    if (window.PinUtils) {
                        window.PinUtils.build();
                        // Refresh ScrollTrigger after Pinterest loads
                        if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
                    }
                };
                script.onerror = () => {
                    console.warn('Pinterest script failed to load');
                    window.pinterestScriptLoaded = false;
                };
                script.timeout = 5000;
                document.head.appendChild(script);
                window.pinterestScriptLoaded = true;
            } else {
                if (window.PinUtils) window.PinUtils.build();
            }
        });
    }

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
                if (image) {
                    preview.src = image;
                }
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

    // ===== ФОРУМ ВКЛАДКИ ==
    const contents = {
        wellness: ['WELLNESS', ''],
        design: ['DESIGN', 'Графічний дизайн, типографіка, UI...'],
        diygear: ['DIY / GEAR', 'Своїми руками, інструменти, майстерня...'],
        itai: ['IT / AI', 'Нейромережі, розробка, технології...'],
        money: ['MONEY', 'Фінанси, інвестиції, крипто...'],
        radio: ['RADIO', 'Музика, подкасти, плейлисти...'],
        tattoo: ['TATTOO', 'Тату-культура, ескізи, майстри...'],
        travel: ['TRAVEL', 'Подорожі, маршрути, лайфхаки...'],
    };

    document.querySelectorAll('.forum-tabs-panel-embedded .forum-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.forum-tabs-panel-embedded .forum-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const id = tab.dataset.tab;
            if (contents[id]) {
                document.getElementById('forumTitleEmbedded').textContent = contents[id][0];
            }
            const drumWrap = document.getElementById('wellnessDrumWrap');
            const textEl = document.getElementById('forumTextEmbedded');
            if (id === 'wellness') {
                if (drumWrap) drumWrap.style.display = '';
                if (textEl) textEl.style.display = 'none';
            } else {
                if (drumWrap) drumWrap.style.display = 'none';
                if (textEl) {
                    textEl.style.display = '';
                    textEl.textContent = contents[id][1];
                }
            }
        });
    });

    // ===== WELLNESS 3D DRUM =====
    (function () {
        const SLIDES = [
            {
                img: 'assets/w1.jpg',
                caption: 'ДІАФРАГМАЛЬНЕ ДИХАННЯ',
                title: 'W1 — ДІАФРАГМАЛЬНЕ ДИХАННЯ',
                body: `Стілець: жорсткий. Забудь про м'які крісла, в яких таз «тоне».
Опора: спина щільно притиснута до рівної вертикальної поверхні (стіна або жорстка спинка стільця). Стопи щільно стоять на підлозі. Кут у колінах 90°.
Руки: одну долоню на живіт (район пупка), другу — на груди.

2. Фаза Вдиху (3–4 секунди)
Вдихай носом. Повільно, беззвучно.
Біомеханіка: уяви, що хочеш розштовхнути свої долоні в сторони не грудьми, а животом і нижніми ребрами.
Контроль: верхня рука (на грудях) має залишатися нерухомою. Нижня — плавно йти вперед.
Нюанс для профі: спробуй відчути, як при вдиху спина ще сильніше тисне в стіну/спинку стільця.

3. Фаза Видиху (6–8 секунд)
Видих через губи «трубочкою» (опір повітря). Видих має бути вдвічі довший за вдих. Це вмикає парасимпатичну нервову систему і знижує кортизол.
Рух: живіт повільно опадає всередину. Не втягуй його силою, просто випускай повітря до кінця.`
            },
            {
                img: 'assets/w2.jpg',
                caption: 'КОРОТКА СТОПА',
                title: 'W2 — КОРОТКА СТОПА',
                body: `Вихідне положення: сядь на стілець, стопи щільно стоять на підлозі паралельно одна одній. Кут у колінах 90°.

Рух: твоя ціль — зробити стопу коротшою і вищою, не згинаючи пальці в «кігті».

Механіка: зосередься на подушечці під великим пальцем і п'ятці. Спробуй «підтягнути» їх одне до одного за рахунок скорочення м'язів склепіння.

Візуальний контроль: внутрішнє склепіння стопи має підніматися над підлогою, утворюючи арку. Пальці залишаються розслабленими і довгими.

Режим: утримуй напругу 5–8 секунд, потім розслаб. Повторюй 2 хвилини для кожної стопи.

Навіщо? Амортизація: піднятий звід гасить ударне навантаження при ходьбі, не пропускаючи його в хребет.`
            },
            {
                img: 'assets/w3.jpg',
                caption: 'СТИСКАННЯ КОЛІНАМИ',
                title: 'W3 — СТИСКАННЯ КОЛІНАМИ',
                body: `Вихідне положення: лежачи на спині, ноги зігнуті в колінах, стопи стоять паралельно.

Рух: на видиху починай плавно стискати подушку. Утримуй помірну напругу 5-10 секунд. 5 секунд розслаблення.

Важливо: не затримуй дихання і не відривай поперек від підлоги. Працюють лише внутрішня поверхня стегон і низ живота.

Навіщо?
— Замок для таза: привідні м'язи безпосередньо пов'язані з м'язами тазового дна. Коли вони вмикаються, таз фіксується в правильному положенні.
— Захист медіального меніска: рівновага тримає колінний суглоб у його природній колії.
— Активація нижнього пресу: допомагає боротися з животом що вивалюється ефективніше за багато вправ на прес.`
            },
            {
                img: 'assets/w4.jpg',
                caption: 'ІЗОМЕТРИЧНИЙ ЯГІДНИЙ МІСТОК',
                title: 'W4 — ІЗОМЕТРИЧНИЙ ЯГІДНИЙ МІСТОК',
                body: `Вихідне положення: лежачи на спині, стопи на підлозі на ширині плечей. Відстань від п'яток до таза — 20–25 см.

Підйом: на видиху штовхай підлогу п'ятками і підіймай таз на 2-3 см.

Пікове скорочення: у верхній точці свідомо стисни сідниці.

Ізометрія: 5 секунд не рухайся. Тримай корпус рівно.

Дихання: не затримуй (це підніме тиск). Дихай коротко і рівно, зберігаючи напругу.

Навіщо?
— Ізометрія змушує нервову систему заново прокласти шлях до м'язів сідниць.
— Стабілізація коліна: великий сідничний м'яз через фасції контролює положення стегна.
— Розвантаження попереку: сідниці беруть на себе 80% навантаження при вставанні зі стільця.`
            },
            {
                img: 'assets/w5.jpg',
                caption: 'МЕРТВИЙ ЖУК',
                title: 'W5 — МЕРТВИЙ ЖУК',
                body: `Вихідне положення: ляж на підлогу. Якщо живіт заважає дихати лежачи — підклади подушку під голову і плечі.

Точка контролю: притисни поперек до підлоги так, ніби намагаєшся роздавити там таргана.

Підйом ніг: підніми 1 ногу (коліна зігнуті під 90°, гомілка паралельна підлозі). Якщо нога «тремтить» — підтягни коліно ближче до грудей.

Рух: повільно, на видиху, опускай ногу вниз. Коліно залишається зігнутим! Ти рухаєш цілим стегном.

Контакт: торкнись підлоги п'яткою і на вдиху міняй ногу.

Навіщо?
— Ізоляція поперечного м'яза: найглибший м'яз пресу, який оперізує органи як живий корсет.
— Стабілізація таза: мозок вчиться розділяти рух ноги і рух хребта.
— Безпечне навантаження без компресії на шийні та грудні хребці.`
            },
            {
                img: 'assets/w6.jpg',
                caption: 'МУШЛЯ',
                title: 'W6 — МУШЛЯ',
                body: `Лягти на бік. Голова на подушці — шия є продовженням хребта.
Ноги зігнуті в колінах під ~90°.
П'ятки притиснуті одна до одної і знаходяться на одній лінії зі сідницями і спиною.

Рух:
— П'ятки склеєні намертво — вони як дверна завіса.
— Фаза зусилля (Видих): повільно підіймай верхнє коліно вгору, розкриваючи ноги як стулки мушлі. Лише до тієї точки, поки таз залишається нерухомим.
— У верхній точці затримайся на 2–3 секунди. Відчуй печіння у верхній боковій частині сідниці.
— Фаза повернення (Вдих): повільно опусти коліно, але не розслабляй м'яз повністю.`
            },
            {
                img: 'assets/w7.jpg',
                caption: 'ДЕКОМПРЕСІЯ «КНИЖКА»',
                title: 'W7 — ДЕКОМПРЕСІЯ «КНИЖКА»',
                body: `Лежачи на боку з подушкою під голову для прямої лінії хребта.
Стегна суворо під 90° до корпусу.
Нижня рука щільно притискає коліна до підлоги. Верхня рука витягнута вперед.

На повільному видиху веди верхню руку вгору і по широкій дузі назад.
Зупиняйся коли коліно під нижньою рукою намагається відірватися від підлоги.
У точці максимального натягу — 3 глибоких цикли дихання. На вдиху роздуй ребра з боку спини.
Розслабляй плече, дозволяючи опускатися під власною вагою.

Навіщо?
— Вага голови при нахилі до монітора збільшується в 3-4 рази. Вправа повертає плечовий пояс у робочий стан.
— Розкриваючи грудну клітку, збільшуєш насичення крові киснем — мозок працює швидше.
— Якщо груди «забетоновані», шия бере надлишкову рухливість і зношується.`
            },
            {
                img: 'assets/w8.jpg',
                caption: '«КІШКА-КОРОВА» БІЛЯ ОПОРИ',
                title: 'W8 — «КІШКА-КОРОВА» БІЛЯ ОПОРИ',
                body: `Вправа на сегментарну мобілізацію.

Опора: позиція біля столу, руки трохи зігнуті в ліктях.

Фаза «Кішка» (Видих):
Максимально вигинай спину вгору дугою. Підборіддя — до грудей. Розштовхуй лопатки якомога ширше. Тягнись серединою спини в стелю.

Фаза «Корова» (Вдих):
М'яко прогинайся лише в грудному відділі. Не кидай поперек вниз (він і так перевантажений). Розправ плечі, подивись трохи вперед.

Темп: повільно, як густа смола.

Навіщо?
— Декомпресія: розвантажує затиснуті фасеткові суглоби хребта.
— Живлення дисків: міжхребцеві диски отримують живлення (дифузію) лише при русі. Ти буквально «годуєш» свій хребет.`
            },
            {
                img: 'assets/w9.jpg',
                caption: 'ІЗОМЕТРИЧНА СТАБІЛІЗАЦІЯ',
                title: 'W9 — ІЗОМЕТРИЧНА СТАБІЛІЗАЦІЯ',
                body: `Встань обличчям до стіни на відстані 50–60 см. Постав долоні трохи ширше плечей і трохи нижче рівня плечового пояса.

Не згинаючи ліктів (руки завжди прямі!), починай штовхати стіну від себе. Лопатки мають розходитися в сторони, простір між ними — ставати плоским або вигинатися назовні.

Ти маєш відчути напругу під пахвами і по боках ребер — це вмикається передній зубчастий м'яз.

Завмри на 30–45 секунд. Плечі не мають «підстрибувати» до вух.

Якщо лопатки починають провалюватися — це відмова. Відпочивай.

Навіщо?
— Єдиний жорсткий зв'язок плечового суглоба з корпусом — лопатка. Якщо зубчастий м'яз слабкий, будь-який рух рукою руйнує суглоб.
— Коли зубчастий м'яз не тримає лопатку, це робить верхня трапеція — звідси вічна напруга в потилиці, спазми і головні болі.
— Без стабільної лопатки ти ніколи не зможеш ефективно відтискатися або жати вагу.`
            }
        ];

        const N = SLIDES.length;
        const cylinder = document.getElementById('drumCylinder');
        const captionEl = document.getElementById('drumCaption'); // может быть null
        const dotsEl = document.getElementById('drumDots');
        const readBtn = document.getElementById('drumReadBtn');
        const prevBtn = document.getElementById('drumPrev');       // может быть null
        const nextBtn = document.getElementById('drumNext');       // может быть null

        if (!cylinder) return;

        const angleStep = 360 / N;

        function getRadius() {
            const w = cylinder.offsetWidth || 220;
            return Math.round((w / 2) / Math.tan(Math.PI / N));
        }

        let faces = [];
        SLIDES.forEach((slide, i) => {
            const face = document.createElement('div');
            face.className = 'drum-face';
            const img = document.createElement('img');
            img.src = slide.img;
            img.alt = slide.caption;
            img.draggable = false;
            face.appendChild(img);
            cylinder.appendChild(face);
            faces.push(face);
        });

        SLIDES.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'drum-dot' + (i === 0 ? ' active' : '');
            dot.addEventListener('click', () => goTo(i));
            dotsEl.appendChild(dot);
        });
        const dots = dotsEl.querySelectorAll('.drum-dot');

        let currentIndex = 0;
        let rotationY = 0;

        function positionFaces() {
            const r = getRadius();
            faces.forEach((face, i) => {
                const angle = angleStep * i;
                face.style.transform = `rotateY(${angle}deg) translateZ(${r}px)`;
            });
        }

        function rotateTo(index, animated = true) {
            currentIndex = ((index % N) + N) % N;
            const targetAngle = -currentIndex * angleStep;
            const cur = rotationY % 360;
            let diff = (targetAngle - cur + 540) % 360 - 180;
            rotationY += diff;

            cylinder.style.transition = animated
                ? 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                : 'none';
            cylinder.style.transform = `rotateY(${rotationY}deg)`;

            if (captionEl) {
                captionEl.style.opacity = '0';
                setTimeout(() => {
                    captionEl.textContent = SLIDES[currentIndex].caption;
                    captionEl.style.opacity = '1';
                }, animated ? 200 : 0);
            }

            dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
        }

        function goTo(index, animated = true) { rotateTo(index, animated); }
        function goNext() { goTo(currentIndex + 1); }
        function goPrev() { goTo(currentIndex - 1); }

        positionFaces();
        rotateTo(0, false);
        window.addEventListener('resize', positionFaces);

        readBtn?.addEventListener('click', () => {
            const slide = SLIDES[currentIndex];
            document.getElementById('wellnessPopupTitle').textContent = slide.title;
            document.getElementById('wellnessPopupBody').textContent = slide.body;
            document.getElementById('wellnessPopup')?.classList.add('active');
            window.playUiMenuBlip?.();
        });

        document.addEventListener('keydown', (e) => {
            const drumWrap = document.getElementById('wellnessDrumWrap');
            if (!drumWrap || drumWrap.style.display === 'none') return;
            if (document.querySelector('.modal-overlay.active')) return;
            if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { e.preventDefault(); goNext(); }
            if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { e.preventDefault(); goPrev(); }
        });

        // Drag / swipe with inertia
        let isDragging = false;
        let dragStartX = 0;
        let lastDragX = 0;
        let dragVelocity = 0;
        let lastDragTime = 0;
        let dragBaseAngle = 0;

        function onDragStart(x) {
            isDragging = true;
            dragStartX = x;
            lastDragX = x;
            dragVelocity = 0;
            dragBaseAngle = rotationY;
            cylinder.style.transition = 'none';
            lastDragTime = Date.now();
        }

        function onDragMove(x) {
            if (!isDragging) return;
            const now = Date.now();
            const dt = now - lastDragTime || 1;
            dragVelocity = (x - lastDragX) / dt;
            lastDragX = x;
            lastDragTime = now;
            const r = getRadius();
            const degPerPx = angleStep / (r * Math.tan(Math.PI / N) * 0.02);
            rotationY = dragBaseAngle - (x - dragStartX) * 0.4;
            cylinder.style.transform = `rotateY(${rotationY}deg)`;
        }

        function onDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            const momentum = dragVelocity * 150;
            const freeAngle = rotationY - momentum * 0.4;
            const rawIndex = -freeAngle / angleStep;
            const snapped = Math.round(rawIndex);
            goTo(((snapped % N) + N) % N);
        }

        const scene = cylinder.parentElement;
        scene.style.cursor = 'grab';
        scene.addEventListener('mousedown', (e) => { e.preventDefault(); scene.style.cursor = 'grabbing'; onDragStart(e.clientX); });
        window.addEventListener('mousemove', (e) => { if (isDragging) onDragMove(e.clientX); });
        window.addEventListener('mouseup', () => { if (isDragging) { scene.style.cursor = 'grab'; onDragEnd(); } });
        scene.addEventListener('touchstart', (e) => { if (e.touches.length === 1) onDragStart(e.touches[0].clientX); }, { passive: true });
        scene.addEventListener('touchmove', (e) => { if (e.touches.length === 1) onDragMove(e.touches[0].clientX); }, { passive: true });
        scene.addEventListener('touchend', onDragEnd);

    })();

    // ===== SUPPORT =====
    document.getElementById('supportBtn')?.addEventListener('click', () => openModal('supportModal'));
    document.getElementById('forumFullBtn')?.addEventListener('click', () => openModal('forumDisclaimerModal'));

    // ===== ЗАКРЫТИЕ МОДАЛОК =====
    document.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.modal;
        if (id) closeModal(id);
    }));
    document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if (e.target === o) o.classList.remove('active'); }));

    // ===== МОДАЛКА "ЗМІСТ" =====
    document.getElementById('contentsBtn')?.addEventListener('click', () => openModal('contentsModal'));
    document.querySelectorAll('.contents-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            const pages = document.querySelectorAll('.journal-page');
            const targetPage = document.querySelector(`.journal-page[data-page="${page}"]`);
            if (targetPage && window.scrollToPage) {
                const index = [...pages].indexOf(targetPage);
                window.scrollToPage(index);
            } else {
                targetPage?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
            }
            closeModal('contentsModal');
        });
    });

    // ===== ESCAPE =====
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active')); });

    // ===== DOUBLE-TAP ZOOM GUARD (JS fallback) =====
    // Some mobile browsers still zoom on a fast double-tap even with
    // `touch-action: manipulation` + viewport `user-scalable=no`, so block
    // the second tap's default action if it lands within 300ms of the last one.
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
            // Top-level navigation (not window.open) so mobile browsers/webviews
            // reliably hand universal links (e.g. the monobank jar link) off to
            // the native app when it's installed, instead of silently no-oping.
            window.location.href = this.dataset.href;
        });
    });

});
