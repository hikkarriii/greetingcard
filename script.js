/* ============================================================
   Логика открытки. Менять не нужно — всё в content.js
   ============================================================ */

const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

/* Определяем iOS один раз — на нём нельзя менять громкость из JS */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
               (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- СЦЕНЫ ---------- */
const scenes = $$('.scene');
let currentScene = 'scene-intro';

function goTo(id){
  if (id === currentScene) return;
  const cur = document.getElementById(currentScene);
  const nxt = document.getElementById(id);
  if (cur) cur.classList.remove('active');
  if (nxt){ nxt.classList.add('active'); nxt.scrollTop = 0; }
  currentScene = id;

  const track = getTrackForScene(id);
  if (track && musicEnabled){
    crossfadeTo(track.src, track.volume, track.fade);
  }
}

$$('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => goTo(btn.dataset.next));
});

/* ---------- ЗАПОЛНЕНИЕ ТЕКСТОВ ---------- */
$('#introDate').textContent    = CONFIG.startDate;
$('#introLine').textContent    = CONFIG.introLine;
$('#introSub').textContent     = CONFIG.introSub;
$('#startBtnText').textContent = CONFIG.startBtn;

$('#envHint').textContent       = CONFIG.envHint || 'нажми на конверт';
$('#letterTitle').textContent   = CONFIG.letter.title;
$('#letterText').textContent    = CONFIG.letter.text;
$('#letterSign').textContent    = CONFIG.letter.sign;
$('#toTimelineBtn').textContent = CONFIG.letter.nextBtn || 'Дальше →';

$('#timelineTitle').textContent = CONFIG.timelineTitle || 'А помнишь?';
$('#timelineSub').textContent   = CONFIG.timelineSub   || '';
$('#toPhotosBtn').textContent   = CONFIG.timelineNext  || 'Дальше →';

$('#photosTitle').textContent = CONFIG.photosTitle || 'Наши моменты';
$('#photosSub').textContent   = CONFIG.photosSub   || '';
$('#toFinalBtn').textContent  = CONFIG.photosNext  || 'Дальше →';

$('#finaleBtnText').textContent = CONFIG.finale.button;
$('#finaleTitle').textContent   = CONFIG.finale.title;
$('#finaleText').textContent    = CONFIG.finale.text;
$('#finaleSign').textContent    = CONFIG.finale.sign;

/* ============================================================
   МУЗЫКА С КРОССФЕЙДОМ
   ============================================================ */
const audioA = $('#bgMusicA');
const audioB = $('#bgMusicB');
const musicBtn = $('#musicBtn');

let activeAudio  = audioA;
let otherAudio   = audioB;
let musicEnabled = false;
let currentVol   = 0.45;

const fadeTimers = new WeakMap();

function fadeTo(audio, target, duration){
  const prev = fadeTimers.get(audio);
  if (prev) clearInterval(prev);

  target = Math.max(0, Math.min(1, target));

  if (duration <= 0 || IS_IOS){
    // на iOS всё равно не сработает — не тратим время
    audio.volume = target;
    return;
  }

  const start = audio.volume;
  const steps = Math.max(1, Math.round(duration * 30));
  let i = 0;

  const timer = setInterval(() => {
    i++;
    const t = i / steps;
    audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
    if (i >= steps){
      clearInterval(timer);
      fadeTimers.delete(audio);
    }
  }, 1000 / 30);

  fadeTimers.set(audio, timer);
}

function crossfadeTo(src, volume, duration){
  if (!src) return;

  const targetVol = (volume != null) ? volume : 0.45;
  const dur = (duration != null) ? duration : 2;

  const cur = activeAudio;
  const nxt = otherAudio;

  // Уже играет этот же трек — ничего не делаем
  if (cur.dataset.src === src && !cur.paused){
    currentVol = targetVol;
    return;
  }

  /* ---------- iOS: без плавности, но чисто ---------- */
  if (IS_IOS){
    try {
      cur.pause();
      cur.currentTime = 0;
    } catch(e){}

    nxt.dataset.src = src;
    nxt.src = src;
    nxt.volume = 1;   // iOS игнорирует volume, но пусть будет
    nxt.currentTime = 0;

    const p = nxt.play();
    if (p) p.catch(() => {});

    activeAudio = nxt;
    otherAudio  = cur;
    currentVol  = targetVol;
    return;
  }

  /* ---------- Остальные: плавный кроссфейд ---------- */
  nxt.dataset.src = src;
  nxt.src = src;
  nxt.volume = 0;
  nxt.currentTime = 0;

  const playPromise = nxt.play();
  if (playPromise) playPromise.catch(() => {});

  fadeTo(cur, 0, dur);

  // Жёстко глушим старый трек через dur секунд — не полагаемся на volume
  setTimeout(() => {
    try {
      if (cur !== activeAudio){
        cur.pause();
        cur.currentTime = 0;
      }
    } catch(e){}
  }, dur * 1000 + 100);

  fadeTo(nxt, targetVol, dur);

  activeAudio = nxt;
  otherAudio  = cur;
  currentVol  = targetVol;
}

function getTrackForScene(sceneId){
  const m = CONFIG.music;
  if (!m) return null;

  if (typeof m === 'string'){
    return { src: m, volume: CONFIG.musicVolume ?? 0.45, fade: 1.5, from: 'scene-intro' };
  }
  if (Array.isArray(m)){
    return m.find(t => t.from === sceneId) || null;
  }
  return null;
}

[audioA, audioB].forEach(a => {
  a.addEventListener('error', () => {
    if (a.dataset.src) musicBtn.style.display = 'none';
  });
});

/* ---------- КНОПКА ПЛЕЙ/ПАУЗ ---------- */
musicBtn.addEventListener('click', () => {
  if (activeAudio.paused){
    if (IS_IOS){
      activeAudio.play().then(() => {
        musicBtn.classList.add('playing');
      }).catch(() => {});
    } else {
      activeAudio.volume = 0;
      activeAudio.play().then(() => {
        fadeTo(activeAudio, currentVol, 0.6);
        musicBtn.classList.add('playing');
      }).catch(() => {});
    }
  } else {
    if (IS_IOS){
      activeAudio.pause();
    } else {
      fadeTo(activeAudio, 0, 0.4);
      setTimeout(() => activeAudio.pause(), 400);
    }
    musicBtn.classList.remove('playing');
  }
});

/* ---------- СТАРТ ПО КНОПКЕ «НАЧАТЬ» ---------- */
$('#startBtn').addEventListener('click', () => {
  const first = getTrackForScene('scene-intro')
             || (Array.isArray(CONFIG.music) ? CONFIG.music[0] : null);

  // если музыка уже играет — не перезапускаем
  if (!musicEnabled && first){
    musicEnabled = true;
    activeAudio.dataset.src = first.src;
    activeAudio.src = first.src;
    activeAudio.volume = IS_IOS ? 1 : 0;

    activeAudio.play().then(() => {
      if (!IS_IOS) fadeTo(activeAudio, first.volume ?? 0.45, 1.5);
      currentVol = first.volume ?? 0.45;
      musicBtn.classList.add('playing', 'show');
    }).catch(() => {
      musicBtn.classList.add('show');
    });
  } else if (first && !musicBtn.classList.contains('show')){
    musicBtn.classList.add('show');
  }

  goTo('scene-envelope');
});

/* ---------- КОНВЕРТ ---------- */
const envelope = $('#envelope');
envelope.addEventListener('click', () => {
  if (envelope.classList.contains('open')) return;
  envelope.classList.add('open');
  setTimeout(() => goTo('scene-letter'), 1500);
});

/* ---------- ХРОНОЛОГИЯ СО СТИКЕРАМИ ---------- */
const timelineEl = $('#timeline');
CONFIG.timeline.forEach(item => {
  const el = document.createElement('div');
  el.className = 'tl-item';

  let sideHTML = '';
  if (item.sticker){
    sideHTML = `<div class="tl-sticker"><img src="${item.sticker}" alt=""></div>`;
  } else if (item.emoji){
    sideHTML = `<div class="tl-emoji">${item.emoji}</div>`;
  }

  el.innerHTML = `
    <div class="tl-dot"></div>
    <div class="tl-card">
      <div class="tl-main">
        <div class="tl-date"></div>
        <div class="tl-title"></div>
        <div class="tl-text"><div><p></p></div></div>
        <div class="tl-more">нажми, чтобы открыть</div>
      </div>
      ${sideHTML}
    </div>`;

  $('.tl-date',   el).textContent = item.date;
  $('.tl-title',  el).textContent = item.title;
  $('.tl-text p', el).textContent = item.text;

  const stImg = $('.tl-sticker img', el);
  if (stImg){
    stImg.addEventListener('error', () => {
      const wrap = $('.tl-sticker', el);
      if (wrap) wrap.style.display = 'none';
    });
  }

  $('.tl-card', el).addEventListener('click', () => el.classList.toggle('open'));
  timelineEl.appendChild(el);
});

/* ---------- ФОТО ---------- */
const galleryEl = $('#gallery');
CONFIG.photos.forEach((photo, i) => {
  const fig = document.createElement('figure');
  fig.className = 'polaroid';
  fig.style.setProperty('--rot', (Math.random() * 10 - 5).toFixed(1) + 'deg');
  fig.style.setProperty('--dy',  (Math.random() * 26 - 13).toFixed(0) + 'px');
  fig.innerHTML = `
    <img src="${photo.src}" alt="" loading="lazy">
    <div class="ph-fallback">Добавь фото<br>photos/${i + 1}.jpg</div>
    <figcaption></figcaption>`;
  $('figcaption', fig).textContent = photo.caption || '';

  const img = $('img', fig);
  img.addEventListener('error', () => fig.classList.add('noimg'));
  fig.addEventListener('click', () => openLightbox(photo));
  galleryEl.appendChild(fig);
});

const lightbox = $('#lightbox');
function openLightbox(photo){
  $('#lightboxImg').src = photo.src;
  $('#lightboxCaption').textContent = photo.caption || '';
  $('#lightboxNote').textContent    = photo.note    || '';
  lightbox.classList.add('on');
  document.body.style.overflow = 'hidden';
}
function closeLightbox(){
  lightbox.classList.remove('on');
  document.body.style.overflow = '';
}
$('#lightboxClose').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

/* ---------- СЕКРЕТИКИ ---------- */
const toast = $('#toast');
let toastTimer;

$$('.secret-star').forEach(star => {
  star.addEventListener('click', () => {
    const key = star.dataset.secretKey;
    const text = (CONFIG.secrets && CONFIG.secrets[key]) || '...';
    star.classList.add('found');
    toast.textContent = text;
    toast.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('on'), 4200);
    burst(star);
  });
});

function burst(el){
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 14; i++){
    particles.push({
      x: cx, y: cy,
      vx: (Math.random() - .5) * 6,
      vy: (Math.random() - .5) * 6,
      r: 1.5 + Math.random() * 2.5,
      life: 1,
      color: Math.random() > .5 ? '232,180,200' : '230,200,143'
    });
  }
}

/* ---------- ФИНАЛ ---------- */
const veil = $('#veil');
$('#finaleBtn').addEventListener('click', () => {
  veil.classList.add('on');
  setTimeout(() => {
    goTo('scene-finale');
    spawnHearts();
    setTimeout(() => veil.classList.remove('on'), 350);
  }, 1700);
});

function spawnHearts(){
  const wrap = $('#finaleHearts');
  if (wrap.dataset.done) return;
  wrap.dataset.done = '1';
  for (let i = 0; i < 30; i++){
    const h = document.createElement('span');
    h.className = 'heart';
    h.textContent = Math.random() > .35 ? '♥' : '✦';
    h.style.left = Math.random() * 100 + '%';
    h.style.animationDelay = (Math.random() * 12) + 's';
    h.style.animationDuration = (11 + Math.random() * 11) + 's';
    h.style.fontSize = (10 + Math.random() * 22) + 'px';
    h.style.opacity = (0.25 + Math.random() * 0.6).toFixed(2);
    wrap.appendChild(h);
  }
}

/* ---------- ФОНОВЫЕ ЧАСТИЦЫ ---------- */
const canvas = $('#fx');
const ctx = canvas.getContext('2d');
let W, H, particles = [];
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize(){
  W = canvas.width  = innerWidth  * DPR;
  canvas.height = H = innerHeight * DPR;
  canvas.style.width  = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
}
resize();
addEventListener('resize', resize);

for (let i = 0; i < 55; i++){
  particles.push({
    x: Math.random() * innerWidth,
    y: Math.random() * innerHeight,
    vx: (Math.random() - .5) * .18,
    vy: -(.12 + Math.random() * .35),
    r: .6 + Math.random() * 1.8,
    life: 1,
    color: Math.random() > .5 ? '232,180,200' : '201,160,255'
  });
}

function loop(){
  ctx.clearRect(0, 0, W, H);
  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    if (p.life < 1) p.life -= .02;
    if (p.life >= 1){
      if (p.y < -20) { p.y = innerHeight + 20; p.x = Math.random() * innerWidth; }
      if (p.x < -20) p.x = innerWidth + 20;
      if (p.x > innerWidth + 20) p.x = -20;
    }
    if (p.life <= 0){ particles.splice(i, 1); return; }
    ctx.beginPath();
    ctx.arc(p.x * DPR, p.y * DPR, p.r * DPR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.color},${(p.life >= 1 ? .5 : p.life) * .85})`;
    ctx.shadowBlur = 10 * DPR;
    ctx.shadowColor = `rgba(${p.color},.85)`;
    ctx.fill();
    ctx.shadowBlur = 0;
  });
  requestAnimationFrame(loop);
}
loop();

/* ============================================================
   ЗАПУСК МУЗЫКИ ПРИ ПЕРВОМ КАСАНИИ ЭКРАНА
   ============================================================ */
(function autoStartMusicOnFirstTouch(){
  let started = false;

  const tryStart = () => {
    if (started || musicEnabled) return;

    const first = getTrackForScene('scene-intro')
               || (Array.isArray(CONFIG.music) ? CONFIG.music[0] : null);
    if (!first) return;

    started = true;
    musicEnabled = true;

    activeAudio.dataset.src = first.src;
    activeAudio.src = first.src;
    activeAudio.volume = IS_IOS ? 1 : 0;

    activeAudio.play().then(() => {
      if (!IS_IOS) fadeTo(activeAudio, first.volume ?? 0.45, 1.2);
      currentVol = first.volume ?? 0.45;
      musicBtn.classList.add('playing', 'show');
    }).catch(() => {
      started = false;
      musicEnabled = false;
    });

    document.removeEventListener('touchstart', tryStart);
    document.removeEventListener('click', tryStart);
    document.removeEventListener('keydown', tryStart);
  };

  document.addEventListener('touchstart', tryStart, { once: true, passive: true });
  document.addEventListener('click', tryStart, { once: true, capture: true });
  document.addEventListener('keydown', tryStart, { once: true });
})();
