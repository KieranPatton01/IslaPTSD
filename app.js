
const PIN      = '2802';
const GIST_URL = 'https://gist.githubusercontent.com/KieranPatton01/552ef018e65064b38dd46ed29ea0bb3d/raw/gistfile1.json';

/* ============================================================
   STATE
   ============================================================ */
let pages        = [];
let currentIndex = 0;
let isAnimating  = false;
let enteredPin   = '';
let touchStartX  = 0;
let touchStartY  = 0;

/* ============================================================
   PIN SCREEN
   ============================================================ */
function initPin() {
  // Render dots dynamically based on PIN length
  const dotsEl = document.getElementById('pin-dots');
  dotsEl.innerHTML = '';
  for (let i = 0; i < PIN.length; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    dotsEl.appendChild(dot);
  }

  // Number keys
  document.querySelectorAll('.key[data-val]').forEach(key => {
    key.addEventListener('click', () => pressKey(key.dataset.val));
  });

  // Delete key
  document.getElementById('key-delete').addEventListener('click', () => {
    enteredPin = enteredPin.slice(0, -1);
    syncDots();
  });
}

function pressKey(val) {
  if (enteredPin.length >= PIN.length) return;
  enteredPin += val;
  syncDots();
  if (enteredPin.length === PIN.length) {
    setTimeout(checkPin, 200);
  }
}

function syncDots() {
  document.querySelectorAll('#pin-dots .dot').forEach((dot, i) => {
    dot.classList.toggle('filled', i < enteredPin.length);
  });
}

function checkPin() {
  if (enteredPin === PIN) {
    // Correct — fade out PIN screen, load book
    const screen = document.getElementById('pin-screen');
    screen.style.transition = 'opacity 0.38s ease, transform 0.38s ease';
    screen.style.opacity    = '0';
    screen.style.transform  = 'scale(1.04)';
    setTimeout(() => {
      screen.style.display = 'none';
      loadBook();
    }, 380);
  } else {
    // Wrong — shake and show error
    const dotsEl = document.getElementById('pin-dots');
    const errEl  = document.getElementById('pin-error');
    dotsEl.classList.add('shake');
    errEl.style.opacity = '1';
    setTimeout(() => {
      dotsEl.classList.remove('shake');
      errEl.style.opacity = '0';
      enteredPin = '';
      syncDots();
    }, 1000);
  }
}

/* ============================================================
   GIST LOADING
   ============================================================ */
const CACHE_KEY = 'isla-ptsd-data';

async function loadBook() {
  const loadingEl = document.getElementById('loading-screen');
  loadingEl.classList.remove('hidden');

  // Check for cached data first
  const cached = localStorage.getItem(CACHE_KEY);

  if (cached) {
    // Use cached data immediately — no network needed
    try {
      const data = JSON.parse(cached);
      buildPages(data);
      loadingEl.classList.add('hidden');
      document.getElementById('book-screen').classList.remove('hidden');
      renderPage(null);
      return;
    } catch (e) {
      // Cached data was corrupted — clear it and fall through to fetch
      localStorage.removeItem(CACHE_KEY);
    }
  }

  // No cache — fetch from Gist and save for all future visits
  try {
    const res  = await fetch(GIST_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Save to localStorage so it's available offline forever
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));

    buildPages(data);
    loadingEl.classList.add('hidden');
    document.getElementById('book-screen').classList.remove('hidden');
    renderPage(null);

  } catch (err) {
    console.error('Failed to load Gist:', err);
    loadingEl.innerHTML = `
      <div class="loading-inner">
        <p class="loading-text" style="color:rgba(220,100,80,0.75)">
          couldn't open the sookbook.<br>
          <small style="opacity:0.6;font-size:0.7em">needs internet on first open</small>
        </p>
      </div>`;
  }
}

function buildPages(data) {
  pages = [{ type: 'cover', ...data.cover }];

  const entries = data.entries.map((entry, idx) => ({
    type:      'entry',
    number:    idx + 1,
    total:     data.entries.length,
    pageIndex: idx + 2,
    ...entry,
  }));

  pages.push({
    type:    'contents',
    entries: entries.map(e => ({ title: e.title, pageIndex: e.pageIndex, number: e.number })),
  });

  entries.forEach(e => pages.push(e));
}

/* ============================================================
   PAGE RENDERING
   ============================================================ */
function renderPage(direction) {
  const wrapper = document.getElementById('pages-wrapper');
  const data    = pages[currentIndex];

  // Create new page element
  const newPage = document.createElement('div');
  newPage.className = 'page';

  // Start position (off-screen)
  if (direction === 'next') newPage.classList.add('enter-right');
  if (direction === 'prev') newPage.classList.add('enter-left');

  newPage.innerHTML = data.type === 'cover'    ? buildCover(data)
                   : data.type === 'contents' ? buildContents(data)
                   : buildEntry(data);

  const existing = wrapper.querySelector('.page');

  if (existing && direction) {
    // Append new page off-screen
    wrapper.appendChild(newPage);

    // Force reflow so the browser registers the start position
    newPage.offsetHeight;

    // Slide new page into view
    newPage.classList.remove('enter-right', 'enter-left');

    // Slide old page out of view
    existing.classList.add(direction === 'next' ? 'exit-left' : 'exit-right');

    // Remove old page after animation completes
    existing.addEventListener('transitionend', () => {
      existing.remove();
      isAnimating = false;
    }, { once: true });

  } else {
    // First render — no animation needed
    wrapper.innerHTML = '';
    wrapper.appendChild(newPage);
    isAnimating = false;
  }

  updateIndicator();
  updateNavButtons();

  // Wire up contents row taps (must happen after innerHTML is set)
  wrapper.querySelectorAll('.contents-row').forEach(row => {
    row.addEventListener('click', () => navigateTo(parseInt(row.dataset.page)));
  });
}

/* ---- Contents template ---- */
function buildContents(d) {
  const rows = d.entries.map(e => `
    <li class="contents-row" data-page="${e.pageIndex}">
      <span class="contents-num">${String(e.number).padStart(2, '0')}</span>
      <span class="contents-dots"></span>
      <span class="contents-title">${e.title}</span>
    </li>`).join('');

  return `
    <div class="page-contents">
      <div class="corner-ornament tl"></div>
      <div class="corner-ornament tr"></div>
      <div class="corner-ornament bl"></div>
      <div class="corner-ornament br"></div>

      <h2 class="contents-heading">Contents</h2>

      <div class="entry-divider" style="margin-bottom:20px">
        <span class="divider-line"></span>
        <span class="divider-star">✦ ✦ ✦</span>
        <span class="divider-line"></span>
      </div>

      <ol class="contents-list">${rows}</ol>
    </div>`;
}

/* ---- Navigate to a specific page index ---- */
function navigateTo(index) {
  if (isAnimating || index === currentIndex) return;
  const direction = index > currentIndex ? 'next' : 'prev';
  isAnimating  = true;
  currentIndex = index;
  renderPage(direction);
}

/* ---- Cover template ---- */
function buildCover(d) {
  const photo = d.photo
    ? `<img src="${d.photo}" alt="Us" class="cover-photo">`
    : `<div class="photo-placeholder">
         <span class="emoji">📷</span>
         <span class="ph-text">check gist img url</span>
       </div>`;

  return `
    <div class="page-cover">
      <div class="corner-ornament tl"></div>
      <div class="corner-ornament tr"></div>
      <div class="corner-ornament bl"></div>
      <div class="corner-ornament br"></div>

      <div class="photo-wrapper">
        <div class="photo-tape left"></div>
        <div class="photo-tape right"></div>
        <div class="photo-frame">${photo}</div>
      </div>

      <h1 class="cover-title">${d.title || 'Isla PTSD'}</h1>

      <div class="cover-rule">
        <span class="cover-rule-ornament">✦ ✦ ✦</span>
      </div>

      <p class="cover-subtitle">${d.subtitle || 'a collection of our moments'}</p>
    </div>`;
}

/* ---- Entry template ---- */
function buildEntry(d) {
  const num = String(d.number).padStart(2, '0');
  const tot = String(d.total).padStart(2, '0');

  return `
    <div class="page-entry">
      <div class="corner-ornament tl"></div>
      <div class="corner-ornament tr"></div>
      <div class="corner-ornament bl"></div>
      <div class="corner-ornament br"></div>

      <div class="entry-number">${num} / ${tot}</div>

      <h2 class="entry-title">${d.title}</h2>

      ${d.date ? `<div class="entry-date">${d.date}</div>` : ''}

      <div class="entry-divider">
        <span class="divider-line"></span>
        <span class="divider-star">✦ ✦ ✦</span>
        <span class="divider-line"></span>
      </div>

      <div class="entry-text">${d.text}</div>
    </div>`;
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function navigate(direction) {
  if (isAnimating) return;

  if (direction === 'next' && currentIndex < pages.length - 1) {
    isAnimating = true;
    currentIndex++;
    renderPage('next');
  } else if (direction === 'prev' && currentIndex > 0) {
    isAnimating = true;
    currentIndex--;
    renderPage('prev');
  }
}

function updateIndicator() {
  const el = document.getElementById('page-indicator');
  if (!pages.length) return;

  if (currentIndex === 0) {
    el.textContent = 'cover';
  } else if (currentIndex === 1) {
    el.textContent = 'contents';
  } else {
    el.textContent = `${currentIndex - 1} of ${pages.length - 2}`;
  }
}

function updateNavButtons() {
  const home = document.getElementById('btn-home');
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  home.style.opacity = currentIndex === 0               ? '0.2' : '1';
  prev.style.opacity = currentIndex === 0               ? '0.2' : '1';
  next.style.opacity = currentIndex === pages.length - 1 ? '0.2' : '1';
}

/* ============================================================
   SWIPE HANDLING
   ============================================================ */
function initSwipe() {
  const el = document.getElementById('pages-wrapper');

  el.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Only navigate on a clearly horizontal swipe
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      navigate(dx < 0 ? 'next' : 'prev');
    }
  }, { passive: true });
}

/* ============================================================
   KEYBOARD (desktop)
   ============================================================ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') navigate('next');
    if (e.key === 'ArrowLeft')  navigate('prev');
  });
}

/* ============================================================
   SERVICE WORKER
   ============================================================ */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err =>
      console.warn('SW registration failed:', err)
    );
  }
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initPin();
  initSwipe();
  initKeyboard();
  registerSW();

  document.getElementById('btn-home').addEventListener('click', () => navigateTo(0));
  document.getElementById('btn-prev').addEventListener('click', () => navigate('prev'));
  document.getElementById('btn-next').addEventListener('click', () => navigate('next'));
});