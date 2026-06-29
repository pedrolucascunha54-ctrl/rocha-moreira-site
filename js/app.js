/* ═══════════════════════════════════════════════════════
   ROCHA E MOREIRA — Canvas Scroll-Driven JS
   Lenis + GSAP ScrollTrigger + Canvas Frame Pools
   ═══════════════════════════════════════════════════════ */

gsap.registerPlugin(ScrollTrigger);

// ── Canvas setup ──────────────────────────────────────
const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');

function resizeCanvas() {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  canvas.width  = Math.round(vw * window.devicePixelRatio);
  canvas.height = Math.round(vh * window.devicePixelRatio);
  canvas.style.width  = vw + 'px';
  canvas.style.height = vh + 'px';
  ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── Frame pools & manifest ────────────────────────────
const MANIFEST = { hero:96, especialidades:48, diferenciais:48, 'como-funciona':64, faq:48, cta:80, rodape:36 };
const pools = {};
Object.keys(MANIFEST).forEach(k => pools[k] = []);

// Zone map: which pool to use at each scroll progress range
const ZONES = [
  { start:0.00, end:0.13, pool:'hero'           },
  { start:0.13, end:0.28, pool:'especialidades' },
  { start:0.28, end:0.42, pool:'diferenciais'   },
  { start:0.42, end:0.54, pool:'diferenciais'   },
  { start:0.54, end:0.63, pool:'diferenciais'   },
  { start:0.63, end:0.75, pool:'como-funciona'  },
  { start:0.75, end:0.83, pool:'faq'            },
  { start:0.83, end:0.92, pool:'faq'            },
  { start:0.92, end:1.00, pool:'cta'            },
];

// Overlay opacity per zone (how dark the scene overlay gets)
const ZONE_OVERLAYS = [.60,.78,.82,.80,.82,.82,.84,.82,.68];

let currentBg = '#050505';
let lastFrame  = null;

// ── Draw a frame ─────────────────────────────────────
const IMAGE_SCALE = 1.0;
function drawFrame(img) {
  const vw = canvas.width  / window.devicePixelRatio;
  const vh = canvas.height / window.devicePixelRatio;
  if (!img) { ctx.fillStyle = currentBg; ctx.fillRect(0,0,vw,vh); return; }
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(vw/iw, vh/ih) * IMAGE_SCALE;
  const dw = iw*scale, dh = ih*scale;
  const dx = (vw-dw)/2, dy = (vh-dh)/2;
  ctx.fillStyle = currentBg;
  ctx.fillRect(0,0,vw,vh);
  ctx.drawImage(img,dx,dy,dw,dh);
  lastFrame = img;
}

// ── Get frame for current progress ───────────────────
function getFrame(progress) {
  const zone = ZONES.find(z => progress >= z.start && progress < z.end) || ZONES[ZONES.length-1];
  const zoneIdx = ZONES.indexOf(zone);
  const localP  = Math.min(1, Math.max(0, (progress - zone.start) / (zone.end - zone.start)));
  const pool    = pools[zone.pool];
  if (!pool.length) return null;
  const idx = Math.min(Math.floor(localP * pool.length), pool.length-1);
  return { frame: pool[idx], zoneIdx };
}

// ── Load frames with batch preloading ────────────────
const loader       = document.getElementById('loader');
const loaderBar    = document.getElementById('loader-bar');
const loaderPct    = document.getElementById('loader-pct');
let   loadedCount  = 0;
let   totalFrames  = 0;

function pad(n) { return String(n).padStart(4,'0'); }

function loadPool(name, count, priority) {
  return new Promise(resolve => {
    let done = 0;
    for (let i = 1; i <= count; i++) {
      const img = new Image();
      img.src = `frames/${name}/frame_${pad(i)}.jpg`;
      img.onload = () => {
        pools[name].push(img);
        done++; loadedCount++;
        loaderBar.style.width = Math.round(loadedCount/totalFrames*100) + '%';
        loaderPct.textContent = Math.round(loadedCount/totalFrames*100) + '%';
        if (done >= count) resolve();
      };
      img.onerror = () => {
        done++; loadedCount++;
        if (done >= count) resolve();
      };
    }
  });
}

async function loadAllFrames() {
  totalFrames = Object.values(MANIFEST).reduce((a,b)=>a+b,0);

  // Phase 1: hero first (fast first paint)
  await loadPool('hero', Math.min(20, MANIFEST.hero));

  // Draw first hero frame immediately
  if (pools.hero.length) drawFrame(pools.hero[0]);
  loader.classList.add('hidden');
  initScene();

  // Phase 2: load remaining in background
  const remaining = Object.entries(MANIFEST).map(([k,v]) => {
    const already = k === 'hero' ? Math.min(20, v) : 0;
    if (already >= v) return Promise.resolve();
    const arr = [];
    for (let i = already+1; i <= v; i++) {
      const img = new Image();
      img.src = `frames/${k}/frame_${pad(i)}.jpg`;
      arr.push(new Promise(res => {
        img.onload = () => { pools[k].push(img); loadedCount++; res(); };
        img.onerror = () => { loadedCount++; res(); };
      }));
    }
    return Promise.all(arr);
  });
  await Promise.all(remaining);
}

// ── Scene init (after hero frames ready) ─────────────
function initScene() {
  initLenis();
  initHeader();
  initHamburger();
  initNavLinks();
  initScrollTrigger();
  initSections();
  initFAQ();
  initCounters();
  initTimeline();

  // ScrollTrigger doesn't fire onEnter at scroll=0 on init; trigger hero manually
  ScrollTrigger.refresh();
  const heroSec = document.querySelector('.scroll-section[data-enter="0"]');
  if (heroSec) {
    setTimeout(() => animateIn(heroSec), 120);
  }
}

// ── Lenis smooth scroll ───────────────────────────────
let lenis;
function initLenis() {
  lenis = new Lenis({
    duration: 1.3,
    easing: t => Math.min(1, 1.001 - Math.pow(2, -10*t)),
    smoothWheel: true,
    wheelMultiplier: 0.9,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── Header ────────────────────────────────────────────
function initHeader() {
  const h = document.getElementById('site-header');
  lenis.on('scroll', ({scroll}) => h.classList.toggle('solid', scroll > 60));
}

// ── Hamburger ─────────────────────────────────────────
function initHamburger() {
  const btn  = document.getElementById('hamburger');
  const nav  = document.getElementById('mobile-nav');
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    document.body.style.overflow = '';
  }));
}

// ── Nav goto links ────────────────────────────────────
function initNavLinks() {
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const pct    = parseFloat(el.dataset.goto);
      const sc     = document.getElementById('scroll-container');
      const total  = sc.scrollHeight - window.innerHeight;
      lenis && lenis.scrollTo(pct * total, {duration:2});
    });
  });
  document.getElementById('logo-home').addEventListener('click', e => { e.preventDefault(); lenis && lenis.scrollTo(0,{duration:1.8}); });
  const fh = document.getElementById('footer-logo-home');
  if (fh) fh.addEventListener('click', e => { e.preventDefault(); lenis && lenis.scrollTo(0,{duration:1.8}); });
}

// ── Main ScrollTrigger (canvas + overlay) ────────────
const overlay = document.getElementById('scene-overlay');

function initScrollTrigger() {
  const sc = document.getElementById('scroll-container');

  ScrollTrigger.create({
    trigger: sc,
    start:   'top top',
    end:     'bottom bottom',
    scrub:   true,
    onUpdate(self) {
      const p = self.progress;

      // Canvas frame
      const res = getFrame(p);
      if (res) {
        drawFrame(res.frame);
        // Overlay opacity
        const opa = ZONE_OVERLAYS[res.zoneIdx] ?? 0.78;
        overlay.style.background = `rgba(5,5,5,${opa})`;
      }

      // Timeline progress (section ⑥)
      const tl = document.getElementById('tl-progress');
      if (tl) {
        const enter = 0.63, leave = 0.75;
        if (p >= enter && p <= leave) {
          const lp = (p - enter) / (leave - enter);
          tl.style.height = (lp * 100) + '%';
          document.querySelectorAll('.tl-step').forEach((step,i) => {
            step.classList.toggle('lit', lp >= (i+1)/4 * 0.8);
          });
        }
      }
    }
  });
}

// ── Section reveal system ─────────────────────────────
function initSections() {
  const sc = document.getElementById('scroll-container');

  document.querySelectorAll('.scroll-section').forEach(sec => {
    const enter  = parseFloat(sec.dataset.enter)  / 100;
    const leave  = parseFloat(sec.dataset.leave)  / 100;
    const persist = sec.dataset.persist === 'true';
    const scHeight = sc.scrollHeight;

    ScrollTrigger.create({
      trigger:   sc,
      start:     `top+=${enter * scHeight} top`,
      end:       `top+=${leave * scHeight} top`,
      onEnter()    { animateIn(sec) },
      onEnterBack(){ animateIn(sec) },
      onLeave()    { if (!persist) animateOut(sec) },
      onLeaveBack(){ if (!persist) animateOut(sec) },
    });
  });
}

function animateIn(sec) {
  sec.classList.add('visible');
  const els = sec.querySelectorAll('.s-el');
  els.forEach(el => {
    const delay = parseFloat(el.dataset.delay || 0);
    setTimeout(() => el.classList.add('in'), delay);
  });
}

function animateOut(sec) {
  sec.classList.remove('visible');
  sec.querySelectorAll('.s-el').forEach(el => el.classList.remove('in'));
}

// ── FAQ accordion ─────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      document.querySelectorAll('.faq-q').forEach(b => {
        b.setAttribute('aria-expanded','false');
        b.nextElementSibling.classList.remove('open');
      });
      if (!expanded) {
        btn.setAttribute('aria-expanded','true');
        btn.nextElementSibling.classList.add('open');
      }
    });
  });
}

// ── Counter animations ────────────────────────────────
function initCounters() {
  const nums = document.querySelectorAll('.stat-num');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el      = entry.target;
      const target  = parseFloat(el.dataset.target);
      const dec     = parseInt(el.dataset.dec || 0);
      const dur     = 1800;
      const start   = performance.now();
      function tick(now) {
        const t = Math.min((now-start)/dur,1);
        const v = (1 - Math.pow(1-t,3)) * target;
        el.textContent = v.toFixed(dec);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = target.toFixed(dec);
      }
      requestAnimationFrame(tick);
      obs.unobserve(el);
    });
  }, {threshold:.6});
  nums.forEach(n => obs.observe(n));
}

// ── Timeline (passive IntersectionObserver backup) ───
function initTimeline() {
  const steps = document.querySelectorAll('.tl-step');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('lit'); });
  }, {threshold:.5});
  steps.forEach(s => obs.observe(s));
}

// ── Boot ──────────────────────────────────────────────
loadAllFrames();
