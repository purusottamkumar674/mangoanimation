/* Scroll is the only animation clock.
 * No video.play(), autoplay, time-based tween, or perpetual animation loop.
 * Source video frames are rendered to canvas using the exact scroll position.
 */
(() => {
  'use strict';
  const sequence = window.FROOTI_SEQUENCE;
  if (!sequence) return;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
  const lerp = (a, b, p) => a + (b - a) * p;
  const smooth = (a, b, p) => { const t = clamp((p - a) / (b - a)); return t * t * (3 - 2 * t); };
  const sample = (points, p) => {
    for (let i = 1; i < points.length; i++) {
      if (p <= points[i][0]) {
        const [t0, v0] = points[i - 1], [t1, v1] = points[i];
        return lerp(v0, v1, smooth(t0, t1, p));
      }
    }
    return points[points.length - 1][1];
  };
  const colorStops = [
    [0, [255, 237, 40]], [.32, [255, 237, 40]], [.46, [245, 242, 233]],
    [.60, [245, 242, 233]], [.73, [255, 163, 51]], [.88, [255, 163, 51]], [1, [255, 237, 40]]
  ];
  function sceneColor(p) {
    const components = [0, 1, 2].map(channel => Math.round(sample(colorStops.map(s => [s[0], s[1][channel]]), p)));
    return `rgb(${components.join(',')})`;
  }

  const hero = $('#experience');
  const stage = $('#stage');
  const canvas = $('#product-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const poster = $('#product-poster');
  const status = $('#sequence-status');
  const copies = $$('[data-phase]');
  const chapterButtons = $$('[data-chapter]');
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileQuery = window.matchMedia('(max-width: 760px)');
  let storedMotion = null;
  try { storedMotion = localStorage.getItem('frooti-motion'); } catch (_) { /* file:// privacy modes */ }
  let motionEnabled = storedMotion === null ? !reducedQuery.matches : storedMotion === 'on';
  let progress = 0;
  let targetFrame = 0;
  let displayedFrame = -1;
  let scheduled = false;
  let width = 0, height = 0, pixelRatio = 1;
  let lastFrameError = false;
  let renderCount = 0;

  class FrameCache {
    constructor() {
      this.path = mobileQuery.matches ? sequence.mobilePath : sequence.desktopPath;
      this.limit = mobileQuery.matches ? 18 : 30;
      this.frames = new Map();
      this.loading = new Set();
      this.failed = new Set();
      this.queue = new Map();
      this.target = 0;
      this.direction = 1;
      this.concurrent = 4;
    }
    url(index) { return `${this.path}${String(index).padStart(4, '0')}${sequence.extension}`; }
    request(index) {
      index = clamp(index, 0, sequence.frameCount - 1);
      this.direction = index === this.target ? this.direction : Math.sign(index - this.target);
      this.target = index;
      // Discard stale queued requests when the user changes scroll direction.
      this.queue.clear();
      this.enqueue(index, 0);
      if (motionEnabled) {
        for (let distance = 1; distance <= 7; distance++) {
          this.enqueue(index + distance * this.direction, distance);
          if (distance <= 4) this.enqueue(index - distance * this.direction, distance + 1);
        }
      }
      this.pump();
    }
    enqueue(index, priority) {
      if (index < 0 || index >= sequence.frameCount || this.frames.has(index) || this.loading.has(index) || this.failed.has(index)) return;
      this.queue.set(index, priority);
    }
    pump() {
      while (this.loading.size < this.concurrent && this.queue.size) {
        const [index] = [...this.queue].sort((a, b) => a[1] - b[1])[0];
        this.queue.delete(index);
        this.load(index);
      }
    }
    load(index) {
      this.loading.add(index);
      const image = new Image();
      image.decoding = 'async';
      if ('fetchPriority' in image) image.fetchPriority = index === this.target ? 'high' : 'low';
      image.onload = () => {
        this.loading.delete(index);
        this.frames.set(index, image);
        this.evict();
        // Redraw on asset readiness, never advance a frame on elapsed time.
        if (index === targetFrame || displayedFrame < 0) scheduleRender();
        this.pump();
      };
      image.onerror = () => {
        this.loading.delete(index);
        this.failed.add(index);
        if (index === targetFrame) {
          lastFrameError = true;
          status.textContent = 'This film frame is unavailable. Keeping the closest still visible.';
          status.hidden = false;
        }
        this.pump();
      };
      image.src = this.url(index);
    }
    evict() {
      if (this.frames.size <= this.limit) return;
      const farthest = [...this.frames.keys()].sort((a, b) => Math.abs(b - this.target) - Math.abs(a - this.target));
      while (this.frames.size > this.limit && farthest.length) this.frames.delete(farthest.shift());
    }
    closest(index) {
      if (this.frames.has(index)) return { image: this.frames.get(index), index };
      let nearest = null, distance = Infinity;
      for (const [candidate, image] of this.frames) {
        if (Math.abs(candidate - index) < distance) {
          distance = Math.abs(candidate - index);
          nearest = { image, index: candidate };
        }
      }
      return nearest;
    }
  }
  const cache = new FrameCache();

  function resizeCanvas() {
    const nextWidth = stage.clientWidth;
    const nextHeight = stage.clientHeight;
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return;
    width = nextWidth; height = nextHeight; pixelRatio = nextRatio;
    if (ctx) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
  }
  function productLayout() {
    const mobile = width <= 760;
    const p = motionEnabled ? progress : 0;
    if (mobile) return {
      x: width * sample([[0, .65], [.40, .65], [.65, .62], [.85, .65], [1, .65]], p),
      y: height * (height < 740 ? .61 : .60),
      h: height * (height < 740 ? .49 : .52)
    };
    return {
      x: width * sample([[0, .64], [.30, .64], [.46, .31], [.59, .31], [.72, .66], [1, .66]], p),
      y: height * .515,
      h: height * .78
    };
  }
  function drawProduct() {
    const layout = productLayout();
    const result = cache.closest(targetFrame);
    if (ctx && result) {
      const imageWidth = layout.h * result.image.naturalWidth / result.image.naturalHeight;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(result.image, layout.x - imageWidth / 2, layout.y - layout.h / 2, imageWidth, layout.h);
      // Feather the edge of the original portrait film where its camera crops a splash.
      // This does not invent missing product imagery or change the source sequence.
      const left = layout.x - imageWidth / 2, bottom = layout.y + layout.h / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-in';
      const edgeX = ctx.createLinearGradient(left, 0, left + imageWidth, 0);
      edgeX.addColorStop(0, 'rgba(0,0,0,0)');
      edgeX.addColorStop(.045, 'rgba(0,0,0,1)');
      edgeX.addColorStop(.97, 'rgba(0,0,0,1)');
      edgeX.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = edgeX; ctx.fillRect(0, 0, width, height);
      const edgeY = ctx.createLinearGradient(0, bottom - Math.min(22, layout.h * .04), 0, bottom);
      edgeY.addColorStop(0, 'rgba(0,0,0,1)'); edgeY.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = edgeY; ctx.fillRect(0, 0, width, height);
      ctx.restore();
      poster.hidden = true;
      displayedFrame = result.index;
      canvas.dataset.frame = String(displayedFrame);
      if (result.index === targetFrame && lastFrameError) {
        lastFrameError = false;
        status.hidden = true;
      }
    } else {
      poster.hidden = false;
      poster.style.left = `${layout.x}px`;
      poster.style.top = `${layout.y}px`;
      poster.style.height = `${layout.h}px`;
    }
    const orbit = $('#orbit');
    orbit.style.left = `${layout.x}px`;
    orbit.style.top = `${height * (width <= 760 ? .61 : .54)}px`;
    orbit.style.transform = `translate(-50%, -50%) rotate(${motionEnabled ? -20 + progress * 280 : -20}deg)`;
    $('#product-shadow').style.left = `${layout.x}px`;
    $('#product-shadow').style.opacity = String(1 - smooth(.68, .80, progress) * (1 - smooth(.9, .98, progress)) * .8);
  }
  function paintStory() {
    resizeCanvas();
    const distance = Math.max(1, hero.offsetHeight - stage.offsetHeight);
    progress = clamp((window.scrollY - hero.offsetTop) / distance);
    targetFrame = motionEnabled ? Math.round(progress * (sequence.frameCount - 1)) : 0;
    cache.request(targetFrame);
    stage.dataset.targetFrame = String(targetFrame);
    stage.dataset.progress = progress.toFixed(5);
    stage.style.backgroundColor = sceneColor(progress);
    stage.style.setProperty('--scene-bg', sceneColor(progress));
    const opacity = [
      1 - smooth(.36, .415, progress),
      smooth(.40, .445, progress) * (1 - smooth(.63, .675, progress)),
      smooth(.665, .71, progress) * (1 - smooth(.89, .925, progress)),
      smooth(.915, .96, progress)
    ];
    const current = progress >= .915 ? 3 : progress >= .675 ? 2 : progress >= .415 ? 1 : 0;
    copies.forEach((copy, i) => {
      copy.style.opacity = String(opacity[i]);
      copy.style.visibility = opacity[i] < .015 ? 'hidden' : 'visible';
      copy.style.transform = motionEnabled ? `translateY(${(1 - opacity[i]) * 24}px)` : 'none';
      copy.setAttribute('aria-hidden', String(i !== current));
      copy.inert = i !== current;
    });
    const ranges = [0, .415, .675, .915, 1];
    chapterButtons.forEach((button, i) => {
      button.style.setProperty('--fill', clamp((progress - ranges[i]) / (ranges[i + 1] - ranges[i])));
      button.classList.toggle('active', i === current);
      if (i === current) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('#story-percent').textContent = `${String(Math.round(progress * 100)).padStart(3, '0')}%`;
    $('#frame-label').textContent = !motionEnabled ? 'MOTION OFF / SCROLL TO EXPLORE' : targetFrame === 0 ? 'SCROLL TO UNBOTTLE' : `FRAME ${String(targetFrame + 1).padStart(3, '0')} / ${sequence.frameCount}`;
    $('#ghost-word').style.transform = `translateX(${motionEnabled ? -progress * width * .17 : 0}px) rotate(${motionEnabled ? -9 + progress * 17 : -9}deg)`;
    const badge = $('#sun-badge');
    badge.style.transform = `rotate(${motionEnabled ? 11 + progress * 155 : 11}deg)`;
    badge.style.opacity = String(1 - smooth(.31, .43, progress) * (1 - smooth(.65, .74, progress)));
    $('#side-note').style.opacity = width <= 760 ? '1' : badge.style.opacity;
    drawProduct();
  }

  const revealItems = $$('[data-reveal]').map(element => ({ element, y: 0 }));
  const parallaxItems = $$('[data-parallax]');
  function paintSections() {
    const viewport = window.innerHeight;
    for (const item of revealItems) {
      const top = item.element.getBoundingClientRect().top - item.y;
      const p = motionEnabled ? smooth(viewport * 1.02, viewport * .78, top) : 1;
      item.y = (1 - p) * 32;
      item.element.style.setProperty('--reveal-opacity', p.toFixed(3));
      item.element.style.setProperty('--reveal-y', `${item.y.toFixed(2)}px`);
    }
    for (const element of parallaxItems) {
      const box = element.parentElement.getBoundingClientRect();
      const p = clamp((viewport - box.top) / (viewport + box.height));
      const offset = motionEnabled ? (p - .5) * Number(element.dataset.parallax) : 0;
      const angle = element.classList.contains('card-original') ? 17 : element.classList.contains('card-twist') ? -13 : 8;
      element.style.transform = `translate(-50%, ${offset}px) rotate(${angle + (motionEnabled ? (p - .5) * 10 : 0)}deg)`;
    }
    const marquee = $('#marquee-text');
    const box = marquee.parentElement.getBoundingClientRect();
    const p = clamp((viewport - box.top) / (viewport + box.height));
    marquee.style.transform = `translateX(${motionEnabled ? -p * Math.min(width * .65, 750) : 0}px)`;
  }
  function render() {
    scheduled = false;
    renderCount++;
    paintStory();
    paintSections();
  }
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(render); // One repaint, not a self-running loop.
  }

  function applyMotionPreference() {
    document.documentElement.classList.toggle('motion-reduced', !motionEnabled);
    $('#motion-toggle').setAttribute('aria-pressed', String(motionEnabled));
    $('#motion-label').textContent = motionEnabled ? 'Motion on' : 'Motion off';
    scheduleRender();
  }
  $('#motion-toggle').addEventListener('click', () => {
    motionEnabled = !motionEnabled;
    storedMotion = motionEnabled ? 'on' : 'off';
    try { localStorage.setItem('frooti-motion', storedMotion); } catch (_) { /* Optional persistence. */ }
    applyMotionPreference();
  });
  reducedQuery.addEventListener('change', event => {
    if (storedMotion !== null) return;
    motionEnabled = !event.matches;
    applyMotionPreference();
  });
  const chapterTargets = [0, .55, .80, 1];
  for (const button of chapterButtons) {
    button.addEventListener('click', () => {
      const distance = hero.offsetHeight - stage.offsetHeight;
      window.scrollTo({ top: Math.round(hero.offsetTop + chapterTargets[Number(button.dataset.chapter)] * distance), behavior: 'auto' });
      scheduleRender();
    });
  }

  const menu = $('#site-nav');
  const menuButton = $('#menu-toggle');
  function closeMenu() {
    menu.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  }
  menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  for (const link of $$('a[href^="#"]')) {
    link.addEventListener('click', event => {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (!target) return;
      event.preventDefault();
      closeMenu();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'auto' });
      // Update the fragment without introducing smooth, time-driven scrolling.
      try { history.replaceState(null, '', link.getAttribute('href')); } catch (_) { /* file:// restrictions */ }
      scheduleRender();
      if (link.classList.contains('skip-link')) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  const moments = [
    { tag: 'OUT OF OFFICE. IN MY ELEMENT.', word: 'PAUSE.', description: ['Close the laptop.', 'Open a little sunshine.'], time: 'THE 4 PM RESET', color: '#ffed28', sun: '#ffa333' },
    { tag: 'NO SHORTCUTS. JUST GOOD DETOURS.', word: 'GO ON.', description: ['Take the scenic route.', 'Bring the mango mood.'], time: 'THE UNPLANNED PLAN', color: '#ffa333', sun: '#ffed28' },
    { tag: 'MORE LAUGHS. LESS KEEPING SCORE.', word: 'US TIME.', description: ['Your favourite people.', 'Your kind of good time.'], time: 'BETTER TOGETHER', color: '#dfeabe', sun: '#ffb62a' }
  ];
  const tabs = $$('[data-moment]');
  function activateMoment(index, focus = false) {
    const moment = moments[index];
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    $('#moment-panel').setAttribute('aria-labelledby', tabs[index].id);
    $('#moment-panel').style.backgroundColor = moment.color;
    $('#moment-tag').textContent = moment.tag;
    $('#moment-big-word').textContent = moment.word;
    const description = $('#moment-description');
    description.replaceChildren(document.createTextNode(moment.description[0]), document.createElement('br'), document.createTextNode(moment.description[1]));
    $('#moment-time').textContent = moment.time;
    $('#moment-sun').style.color = moment.sun;
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateMoment(index));
    tab.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activateMoment(next, true);
    });
  });

  const help = $('#help-dialog');
  function openHelp() { closeMenu(); help.showModal(); document.body.style.overflow = 'hidden'; }
  function closeHelp() { help.close(); }
  $('#help-open').addEventListener('click', openHelp);
  $('#footer-help').addEventListener('click', openHelp);
  $('#help-close').addEventListener('click', closeHelp);
  $('#help-done').addEventListener('click', closeHelp);
  help.addEventListener('close', () => { document.body.style.overflow = ''; });
  help.addEventListener('click', event => {
    if (event.target !== help) return;
    const bounds = help.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeHelp();
  });

  window.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', scheduleRender, { passive: true });
  window.addEventListener('pageshow', scheduleRender);
  window.addEventListener('load', scheduleRender, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) scheduleRender(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRender);
  document.documentElement.classList.add('js-ready');
  applyMotionPreference();

  // Read-only diagnostics for QA: useful for verifying that idle frames never move.
  Object.defineProperty(window, 'FrootiExperience', { value: Object.freeze({
    getState: () => ({ progress, targetFrame, displayedFrame, motionEnabled, cachedFrames: cache.frames.size, loadingFrames: cache.loading.size, renderCount, tier: cache.path.includes('mobile') ? 'mobile' : 'desktop' })
  }) });
})();
