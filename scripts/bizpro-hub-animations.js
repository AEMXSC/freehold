/*
 * bizpro-hub animations
 * Extracted from input/index.html (lines 2162-2685).
 * Loads Lenis from /scripts/bizpro-hub-lenis.min.js, then runs the
 * original scroll/carousel/animation code and the Lenis init.
 */
(function () {
  const s = document.createElement('script');
  s.src = `${window.hlx.codeBasePath}/scripts/bizpro-hub-lenis.min.js`;
  s.onload = main;
  document.head.appendChild(s);

  function main() {
    // switchTab is referenced by onclick handlers in the solutions tab buttons;
    // expose to window so the inline handlers can find it after wrapping.
    window.switchTab = switchTab;

    // ── Nav scroll ─────────────────────────────────────────────────────────
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });

    // ── Stories carousel: mouse-proximity pan ────────────────────────────
    (function() {
      const section = document.querySelector('.stories');
      const track   = document.getElementById('storiesTrack');
      if (!section || !track) return;

      const CARD_W  = 351;
      const GAP     = 8;
      const nCards  = track.querySelectorAll('.story-card').length;

      function getOverflow() {
        const trackW   = nCards * CARD_W + (nCards - 1) * GAP;
        const overflow = trackW - section.offsetWidth;
        // No panning if all cards fit within the section (e.g. ≥ 1920px)
        if (overflow <= 0) return 0;
        // Add 16px (8px margin on each side) so fully-panned cards land with 8px breathing room
        return overflow + 16;
      }

      function pan(x) { track.style.transform = `translateX(${x}px)`; }

      const ZONE     = 0.5; // left/right trigger zone = 50% each, meeting at center
      const viewport = section.querySelector('.stories__viewport');

      viewport.addEventListener('mousemove', (e) => {
        const rect  = viewport.getBoundingClientRect();
        const t     = (e.clientX - rect.left) / rect.width;
        const range = getOverflow() / 2;
        pan(t < ZONE ? range : -range);
      });

      viewport.addEventListener('mouseleave', () => pan(0));
    })();

    // ── Tutorial carousel (infinite loop) ────────────────────────────────
    // Track layout: [clone-2 | real-0 | real-1 | real-2 | clone-0]
    //   track index:    0          1        2        3        4
    // Starting at track index 1 (real-0). Navigating past the last real slide
    // (index 3) lands on clone-0 (index 4); after the transition completes we
    // silently snap back to real-0 (index 1). Vice-versa for the left edge.
    const tutTrack   = document.getElementById('tutorialTrack');
    const tutPrevBtn = document.getElementById('tutorialPrev');
    const tutNextBtn = document.getElementById('tutorialNext');
    const tutDots    = document.getElementById('tutorialDots');
    const TUT_GAP    = 8;
    const REAL_COUNT = 3;           // number of real (non-clone) slides
    const TRACK_LEN  = REAL_COUNT + 2; // 5 total including clones
    let trackIdx     = 2;           // start on real-1

    // Map a track index to its real-slide index (0–2)
    function realIdx(ti) { return (ti - 1 + REAL_COUNT) % REAL_COUNT; }

    function layoutCarousel() {
      const slides  = tutTrack.querySelectorAll('.tutorial__slide');
      const margin  = window.innerWidth >= 768 ? window.innerWidth * 0.08333 : 24;
      const slideW  = Math.round(window.innerWidth - 2 * margin);
      const step    = slideW + TUT_GAP;
      const vpWidth = tutTrack.parentElement.offsetWidth;
      const offset  = Math.round((vpWidth - slideW) / 2);
      const tx      = -(trackIdx * step - offset);

      // Set inline flex + width on every slide (example pattern)
      slides.forEach(s => {
        s.style.flex  = `0 0 ${slideW}px`;
        s.style.width = `${slideW}px`;
      });

      tutTrack.style.transform = `translate(${tx}px, 0px)`;

      // Position arrows centred on the active card edges (half in peek, half on slide)
      tutPrevBtn.style.left = `${offset - 20}px`;
      tutNextBtn.style.left = `${offset + slideW - 20}px`;

      // Centre dots on the active slide — 20px above slide bottom edge
      const slideH   = slideW * (600 / 1068);
      const sectionH = tutTrack.closest('.tutorial').offsetHeight;
      tutDots.style.left   = `${offset + slideW / 2}px`;
      tutDots.style.bottom = `${Math.round((sectionH - slideH) / 2 + 20)}px`;

      // Sync dot active state to the real slide index
      const ri = realIdx(trackIdx);
      tutDots.querySelectorAll('.tutorial__dot').forEach((dot, i) => {
        dot.classList.toggle('tutorial__dot--active', i === ri);
      });
    }

    // Navigate to a track index, optionally suppressing the CSS transition
    function goTo(ti, animate = true) {
      trackIdx = ti;
      if (!animate) {
        tutTrack.style.transition = 'none';
        layoutCarousel();
        // Double rAF ensures the snap happens in the same paint before
        // restoring the transition — no visible flash
        requestAnimationFrame(() => requestAnimationFrame(() => {
          tutTrack.style.transition = '';
        }));
      } else {
        tutTrack.style.transition = '';
        layoutCarousel();
      }
    }

    // After animating into a clone, silently snap back to the real equivalent
    tutTrack.addEventListener('transitionend', () => {
      if (trackIdx === 0)              goTo(REAL_COUNT, false);     // clone-2 → real-2 (idx 3)
      else if (trackIdx === TRACK_LEN - 1) goTo(1, false);          // clone-0 → real-0 (idx 1)
    });

    tutPrevBtn.addEventListener('click', () => goTo(trackIdx - 1));
    tutNextBtn.addEventListener('click', () => goTo(trackIdx + 1));

    tutDots.querySelectorAll('.tutorial__dot').forEach(dot => {
      dot.addEventListener('click', () => goTo(Number(dot.dataset.index) + 1));
    });

    window.addEventListener('resize', () => goTo(trackIdx, false), { passive: true });
    goTo(2); // initialise — show real-1 on load

    // ── Hero scroll animation + video pause/play ────────────────────────────
    (function () {
      const heroScroll  = document.querySelector('.hero-scroll');
      const heroSticky  = document.getElementById('heroSticky');
      const heroText    = document.getElementById('heroText');
      const heroVidWrap = document.getElementById('heroVideoWrap');
      const heroScrim   = document.getElementById('heroVideoScrim');
      const heroOverlay = document.getElementById('heroVideoOverlay');
      const heroPause   = document.getElementById('heroPauseBtn');
      const storiesEl   = document.querySelector('.stories');
      if (!heroScroll) return;

      let iL = 0, iT = 0, iW = 0, iH = 0, measured = false;

      function lerp(a, b, t) { return a + (b - a) * t; }
      function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
      function easeOut3(t) { return 1 - Math.pow(1 - t, 3); }

      function measureInitial() {
        heroText.style.opacity   = '1';
        heroText.style.transform = 'none';
        const vw = window.innerWidth;
        const m  = vw >= 768 ? vw * 0.08333 : 24;
        iL = m;
        iW = vw - 2 * m;
        iH = iW * (600 / 1068);
        const sr = heroSticky.getBoundingClientRect();
        const tr = heroText.getBoundingClientRect();
        iT = tr.bottom - sr.top;
        measured = true;
      }

      function tick() {
        const smoothY = window.__lenis ? window.__lenis.scroll : window.scrollY;

        if (measured) {
          const vw = window.innerWidth;
          const vh = window.innerHeight;
          // Final video size: full width, 16:9 aspect ratio
          const finalH = vw * 0.5625;

          // Overall raw progress: 0→1 over one viewport height of scroll
          const rawP = clamp(smoothY / vh, 0, 1);

          // ── Parallel animations at different rates ──
          // Horizontal (width, left, height) — 2× faster, completes at rawP≈0.5
          const horizP = easeOut3(clamp(rawP * 2, 0, 1));
          // Vertical (top) — full range, completes at rawP=1
          const vertP  = easeOut3(rawP);

          // Video geometry
          const vidLeft   = lerp(iL, 0,      horizP);
          const vidWidth  = lerp(iW, vw,     horizP);
          const vidHeight = lerp(iH, finalH, horizP);
          const vidTop    = lerp(iT, 0,      vertP);

          // Border radius: decreases when either left OR top edge is within 40px of viewport
          const leftProx = clamp(1 - vidLeft / 40, 0, 1);
          const topProx  = clamp(1 - vidTop  / 40, 0, 1);
          const radius   = lerp(16, 0, Math.max(leftProx, topProx));

          heroVidWrap.style.left         = vidLeft   + 'px';
          heroVidWrap.style.top          = vidTop    + 'px';
          heroVidWrap.style.width        = vidWidth  + 'px';
          heroVidWrap.style.height       = vidHeight + 'px';
          heroVidWrap.style.borderRadius = radius    + 'px';

          // ── Text: parallax — fades slower, moves less (feels like a deeper plane) ──
          const textP = clamp(rawP / 0.6, 0, 1);
          heroText.style.opacity   = String(1 - textP);
          heroText.style.transform = `translateY(${-40 * textP}px)`;

          // ── Scrim: starts fading in at rawP=0.25 (video already rising over text) ──
          const scrimIn = clamp((rawP - 0.25) / 0.6, 0, 1);

          // Shadow: own faster curve — full strength by rawP≈0.5 (well before overlay)
          // Negative y-offsets cast upward onto text as video rises over it
          const shadowP = easeOut3(clamp(rawP / 0.5, 0, 1));
          heroVidWrap.style.boxShadow = shadowP > 0
            ? `0 -283px 79px 0 rgba(0,0,0,0), 0 -181px 72px 0 rgba(0,0,0,${(0.01*shadowP).toFixed(3)}), 0 -102px 61px 0 rgba(0,0,0,${(0.05*shadowP).toFixed(3)}), 0 -45px 45px 0 rgba(0,0,0,${(0.09*shadowP).toFixed(3)}), 0 -11px 25px 0 rgba(0,0,0,${(0.10*shadowP).toFixed(3)})`
            : 'none';

          // ── Overlay: starts fading in at rawP=0.35 with upward parallax ──
          const overlayIn = clamp((rawP - 0.35) / 0.6, 0, 1);

          // ── Stories cover: overlay + scrim fade as next section slides over ──
          let cover = 0;
          if (storiesEl) {
            const st = storiesEl.getBoundingClientRect().top;
            cover = clamp(1 - st / vh, 0, 1);
          }

          heroScrim.style.opacity         = String(clamp(scrimIn   - cover, 0, 1));
          heroOverlay.style.opacity       = String(clamp(overlayIn - cover, 0, 1));
          heroOverlay.style.transform     = `translateY(${lerp(20, 0, overlayIn)}px)`;
          heroOverlay.style.pointerEvents = overlayIn > 0.5 ? 'auto' : 'none';
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(() => {
        measureInitial();
        requestAnimationFrame(tick);
      });

      window.addEventListener('resize', measureInitial, { passive: true });

      // ── Pause / play ────────────────────────────────────────────────────────
      const heroVideo    = document.getElementById('heroVideo');
      const heroPauseBtn = document.getElementById('heroPauseBtn');
      const PAUSE_ICON = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="20" cy="20" r="20" fill="black" fill-opacity="0.48"/><rect x="14" y="13" width="4" height="14" rx="1.5" fill="white"/><rect x="22" y="13" width="4" height="14" rx="1.5" fill="white"/></svg>`;
      const PLAY_ICON  = `<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="19.5" stroke="rgba(255,255,255,0.5)"/><path d="M16 13l12 7-12 7V13z" fill="white"/></svg>`;
      if (heroPauseBtn && heroVideo) {
        heroPauseBtn.addEventListener('click', () => {
          if (heroVideo.paused) {
            heroVideo.play();
            heroPauseBtn.setAttribute('aria-label', 'Pause');
            heroPauseBtn.innerHTML = PAUSE_ICON;
          } else {
            heroVideo.pause();
            heroPauseBtn.setAttribute('aria-label', 'Play');
            heroPauseBtn.innerHTML = PLAY_ICON;
          }
        });
      }
    })();

    // ── Scroll-driven section animations ─────────────────────────────────────
    (function () {
      const clamp    = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
      const easeOut3 = t => 1 - Math.pow(1 - t, 3);

      const animList = []; // { el, triggerTop, staggerDelay } — bidirectional
      // studio-banner parallax now handled by CSS scroll-driven animations
      let wordmarkEl = null, wordmarkTop = 0;
      // Tutorial reverse-hero entrance
      let tutSectionEl = null, tutDocTop = 0;
      let tutTrackEl = null, tutActiveSlideEl = null;
      let tutCopyEls = [], tutAnimDone = false;
      let tutPrevBtnEl = null, tutNextBtnEl = null, tutDotsEl = null;

      function getDocTop(el) {
        return el.getBoundingClientRect().top + window.scrollY;
      }

      function register(el, triggerTop, staggerDelay) {
        el.style.opacity    = '0';
        el.style.transform  = 'translateY(40px)';
        el.style.willChange = 'opacity, transform';
        animList.push({ el, triggerTop, staggerDelay });
      }
      function single(sel, delay) {
        document.querySelectorAll(sel).forEach(el => register(el, getDocTop(el), delay || 0));
      }
      function staggerGroup(itemSel, groupSel, perItem) {
        const map = new Map();
        document.querySelectorAll(itemSel).forEach(el => {
          const g = (groupSel ? el.closest(groupSel) : null) || el.parentElement;
          if (!map.has(g)) map.set(g, []);
          map.get(g).push(el);
        });
        map.forEach((items, g) => {
          const gt = getDocTop(g);
          items.forEach((el, i) => register(el, gt, i * (perItem || 0.12)));
        });
      }

      function measure() {
        animList.forEach(({ el }) => { el.style.opacity = el.style.transform = el.style.willChange = ''; });
        animList.length = 0;

        // ── Stories ──────────────────────────────────────────────────────────
        single('.stories__header');
        staggerGroup('.story-card', '.stories__track', 0.10);

        // ── Acrobat Feature ──────────────────────────────────────────────────
        single('.acrobat-feature__header');
        single('.acrobat-wide');
        staggerGroup('.acrobat-card', '.acrobat-cards', 0.12);

        // ── Solutions ────────────────────────────────────────────────────────
        single('.solutions__header');
        staggerGroup('.price-card', '.pricing-grid', 0.15);

        // ── Product Grid ─────────────────────────────────────────────────────
        staggerGroup('.explore-card-container', '.product-grid', 0.06);

        // ── Search Section ────────────────────────────────────────────────────
        const si = document.querySelector('.search-section__inner');
        if (si) {
          const st = getDocTop(si);
          document.querySelectorAll('.search-section__copy').forEach(el => register(el, st, 0));
          document.querySelectorAll('.search-section .search-bar').forEach(el => register(el, st, 0.12));
          document.querySelectorAll('.search-section__disclaimer').forEach(el => register(el, st, 0.22));
        }

        // ── Studio Banner: handled by CSS scroll-driven animations ────────────

        // ── Footer wordmark ───────────────────────────────────────────────────
        wordmarkEl = document.querySelector('.footer__wordmark img');
        if (wordmarkEl) {
          wordmarkTop = getDocTop(wordmarkEl);
          wordmarkEl.style.clipPath   = 'inset(60% 0 0 0)';
          wordmarkEl.style.willChange = 'clip-path';
        }

        // ── Tutorial: reverse-hero entrance ──────────────────────────────────
        // Active slide: 100vw + 0 radius → 12-col width + 16px radius
        // Peek slides: slide in from sides (already have fixed 16px radius)
        // Copy text: parallax rise from 80px below
        tutCopyEls.forEach(el => { el.style.left = ''; });
        tutCopyEls = [];
        tutAnimDone = false;
        tutSectionEl = document.querySelector('.tutorial');
        // Use the scroll wrapper's top as the anchor — matches how hero uses
        // heroScroll (the 300vh container) rather than heroSticky itself
        const tutScrollEl = document.querySelector('.tutorial-scroll');
        tutDocTop = tutScrollEl ? getDocTop(tutScrollEl) : (tutSectionEl ? getDocTop(tutSectionEl) : 0);
        tutTrackEl   = document.getElementById('tutorialTrack');
        if (tutTrackEl) {
          const slides = tutTrackEl.querySelectorAll('.tutorial__slide');
          tutActiveSlideEl = slides[2] || null; // carousel initialises at trackIdx = 2
          // Peek slides carry a fixed 16px radius — active slide starts at 0 and animates
          slides.forEach((s, i) => {
            s.style.borderRadius = (i === 2) ? '0px' : '16px';
          });
        }
        tutCopyEls = Array.from(document.querySelectorAll(
          '.tutorial__slide:not(.tutorial__slide--clone) .tutorial__copy'
        ));
        // (no willChange needed — only `left` is JS-animated on copy)
        tutPrevBtnEl = document.getElementById('tutorialPrev');
        tutNextBtnEl = document.getElementById('tutorialNext');
        tutDotsEl    = document.getElementById('tutorialDots');

      }

      function tick() {
        const sY = window.__lenis ? window.__lenis.scroll : window.scrollY;
        const vh = window.innerHeight;

        // ── Fade + slide up — bidirectional ───────────────────────────────────
        for (let i = 0; i < animList.length; i++) {
          const item = animList[i];
          const raw = (sY + vh * 0.85 - item.triggerTop) / (vh * 0.3);
          const p   = easeOut3(clamp(raw - item.staggerDelay, 0, 1));
          item.el.style.opacity   = String(p);
          item.el.style.transform = `translateY(${(1 - p) * 40}px)`;
        }

        // ── Tutorial: reverse-hero entrance ───────────────────────────────────
        if (tutSectionEl) {
          const vw          = window.innerWidth;
          const finalMargin = vw >= 768 ? vw * 0.08333 : 24;

          // Start:    top edge of container enters bottom of viewport  → tutPRaw = 0
          // Complete: 75% of container height has entered viewport   → tutPRaw = 1
          const tutH    = tutSectionEl.offsetHeight;
          const animStart = tutDocTop - vh;
          const animEnd   = tutDocTop + tutH * 0.75 - vh;
          const tutPRaw = clamp((sY - animStart) / (animEnd - animStart), 0, 1);
          const tutP    = tutPRaw < 1 ? 1 - Math.pow(1 - tutPRaw, 2.5) : 1;

          // Geometry animation — bidirectional, always follows tutP
          if (tutP < 1) {
            const animMargin = finalMargin * tutP;
            const animSlideW = Math.round(vw - 2 * animMargin);

            // Gap: starts wide (60px) so peek slides slide in from sides, settles to 8px.
            // Completes at 60% of tutP — peek cards arrive slightly after the width settles,
            // matching the elastic-carousel's staggered gap-shrink feel.
            const gapP   = clamp(tutP / 0.6, 0, 1);
            const animGap = Math.round(8 + (1 - gapP) * 52); // 60px → 8px

            // trackIdx = 2 → centre slide 2 in viewport
            const tx = -2 * (animSlideW + animGap) + animMargin;

            if (tutTrackEl) {
              tutTrackEl.querySelectorAll('.tutorial__slide').forEach(s => {
                s.style.flex  = `0 0 ${animSlideW}px`;
                s.style.width = `${animSlideW}px`;
              });
              tutTrackEl.style.gap        = `${animGap}px`;
              tutTrackEl.style.transition = 'none';
              tutTrackEl.style.transform  = `translate(${tx}px, 0px)`;
            }
            if (tutActiveSlideEl) {
              tutActiveSlideEl.style.borderRadius = `${(tutP * 16).toFixed(2)}px`;
            }

            // Fix 3: pin copy at fixed viewport-left so it doesn't shift horizontally
            const targetCopyLeft = finalMargin + 0.07491 * (vw - 2 * finalMargin);
            tutCopyEls.forEach(el => {
              el.style.left = `${(targetCopyLeft - animMargin).toFixed(2)}px`;
            });

            // Fix 4: arrows centred on active slide edges (half in peek zone, half on slide)
            if (tutPrevBtnEl) tutPrevBtnEl.style.left = `${(animMargin - 20).toFixed(2)}px`;
            if (tutNextBtnEl) tutNextBtnEl.style.left = `${(animMargin + animSlideW - 20).toFixed(2)}px`;

            // Fix 5: dots sit on the active slide bottom edge
            const animSlideH = animSlideW * (600 / 1068);
            const sectionH   = tutSectionEl.offsetHeight;
            if (tutDotsEl) {
              tutDotsEl.style.bottom = `${((sectionH - animSlideH) / 2 + 20).toFixed(2)}px`;
              tutDotsEl.style.left   = `${(animMargin + animSlideW / 2).toFixed(2)}px`;
            }

            tutAnimDone = false;
          } else if (!tutAnimDone) {
            // One-time restore — hands control back to the carousel JS
            tutAnimDone = true;
            if (tutTrackEl) {
              tutTrackEl.style.gap        = '';
              tutTrackEl.style.transition = '';
            }
            // Clear active-slide inline radius so CSS default (16px) takes over
            if (tutActiveSlideEl) tutActiveSlideEl.style.borderRadius = '';
            // Restore positions to final settled values (mirrors layoutCarousel)
            tutCopyEls.forEach(el => { el.style.left = ''; });
            const finalSlideW = Math.round(vw - 2 * finalMargin);
            const finalSlideH = finalSlideW * (600 / 1068);
            const sectionH    = tutSectionEl.offsetHeight;
            if (tutPrevBtnEl) tutPrevBtnEl.style.left = `${Math.round(finalMargin - 20)}px`;
            if (tutNextBtnEl) tutNextBtnEl.style.left = `${Math.round(finalMargin + finalSlideW - 20)}px`;
            if (tutDotsEl) {
              tutDotsEl.style.bottom = `${Math.round((sectionH - finalSlideH) / 2 + 20)}px`;
              tutDotsEl.style.left   = `${Math.round(finalMargin + finalSlideW / 2)}px`;
            }
          }

          // Copy transform handled by CSS (translateY(-50%) for centering)
        }

        // ── Studio-banner: CSS scroll-driven animations handle parallax ────────

        // ── Footer wordmark: wipe-up clip reveal ─────────────────────────────
        if (wordmarkEl) {
          const wP = easeOut3(clamp((sY + vh - wordmarkTop) / (vh * 0.5), 0, 1));
          wordmarkEl.style.clipPath = `inset(${(1 - wP) * 60}% 0 0 0)`;
        }

        requestAnimationFrame(tick);
      }

      requestAnimationFrame(() => {
        measure();
        requestAnimationFrame(tick);
      });

      window.addEventListener('resize', () => {
        requestAnimationFrame(measure);
      }, { passive: true });
    })();

    // ── Tab switcher ───────────────────────────────────────────────────────
    function switchTab(btn) {
      btn.closest('.tab-bar').querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
    }

    // ── Grid overlay ───────────────────────────────────────────────────────
    let gridOn = false;
    function buildGrid() {
      const cols = document.getElementById('gridCols');
      cols.innerHTML = '';
      const n = window.innerWidth >= 768 ? 12 : 6;
      for (let i = 0; i < n; i++) {
        const c = document.createElement('div');
        c.className = 'grid-col';
        cols.appendChild(c);
      }
    }
    function toggleGrid() {
      gridOn = !gridOn;
      const overlay = document.getElementById('gridOverlay');
      const btn = document.getElementById('gridToggle');
      if (gridOn) { buildGrid(); overlay.classList.add('on'); btn.classList.add('on'); }
      else { overlay.classList.remove('on'); btn.classList.remove('on'); }
    }
    window.addEventListener('resize', () => { if (gridOn) buildGrid(); }, { passive: true });
  
    (function () {
      // lerp: 0.1 matches the original manual sY += (tY - sY) * 0.1 factor
      const lenis = new Lenis({ lerp: 0.1 });
      window.__lenis = lenis;
      // Drive Lenis from its own rAF loop (hero + section loops read window.__lenis.scroll)
      (function lenisRaf(time) {
        lenis.raf(time);
        requestAnimationFrame(lenisRaf);
      })(performance.now());
    })();
  
  }
})();
