(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (n) { return '$' + n.toFixed(2); };

  var PRODUCT = window.RD_PRODUCT || { price: 0 };
  var FREE_SHIP = PRODUCT.freeShippingThreshold || 0;

  /* ---------- Toast ---------- */
  var toastEl = $('#toast');
  var toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible'); }, 2800);
  }

  /* ---------- Gallery ---------- */
  var track = $('[data-gallery-track]');
  var slides = track ? $$('[data-slide]', track) : [];
  var thumbs = $$('[data-thumb]');
  var dots = $$('[data-dot]');
  var current = 0;

  function sync() {
    thumbs.forEach(function (t, idx) {
      t.classList.toggle('is-active', idx === current);
      t.setAttribute('aria-pressed', idx === current ? 'true' : 'false');
    });
    dots.forEach(function (d, idx) {
      d.classList.toggle('is-active', idx === current);
      d.setAttribute('aria-pressed', idx === current ? 'true' : 'false');
    });
  }
  function goTo(i, smooth) {
    if (!track || !slides.length) return;
    current = (i + slides.length) % slides.length;
    track.scrollTo({ left: current * track.clientWidth, behavior: smooth === false ? 'auto' : 'smooth' });
    sync();
  }
  thumbs.forEach(function (t, idx) { t.addEventListener('click', function () { goTo(idx); }); });
  dots.forEach(function (d, idx) { d.addEventListener('click', function () { goTo(idx); }); });
  $$('[data-gallery-prev]').forEach(function (b) { b.addEventListener('click', function () { goTo(current - 1); }); });
  $$('[data-gallery-next]').forEach(function (b) { b.addEventListener('click', function () { goTo(current + 1); }); });
  if (track) {
    var scrollTimer;
    track.addEventListener('scroll', function () {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () {
        var idx = Math.round(track.scrollLeft / (track.clientWidth || 1));
        idx = Math.max(0, Math.min(slides.length - 1, idx));
        if (idx !== current) { current = idx; sync(); }
      }, 80);
    }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goTo(current + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1); }
    });
    window.addEventListener('resize', function () { goTo(current, false); });
    sync();
  }

  /* ---------- Layers: cart drawer, lightbox ---------- */
  var overlay = $('#overlay');
  var openStack = [];
  var lastFocus = null;

  function openLayer(el) {
    if (!el || openStack.indexOf(el) !== -1) return;
    if (!openStack.length) lastFocus = document.activeElement;
    el.hidden = false;
    void el.offsetWidth;
    el.classList.add('is-open');
    if (overlay && el.id !== 'lightbox') {
      overlay.hidden = false;
      void overlay.offsetWidth;
      overlay.classList.add('is-open');
    }
    document.documentElement.classList.add('no-scroll');
    openStack.push(el);
    var f = $('[data-close]', el);
    if (f) setTimeout(function () { f.focus(); }, 60);
  }
  function closeLayer(el) {
    el = el || openStack[openStack.length - 1];
    if (!el) return;
    el.classList.remove('is-open');
    openStack = openStack.filter(function (x) { return x !== el; });
    setTimeout(function () { if (!el.classList.contains('is-open')) el.hidden = true; }, 320);
    if (!openStack.length) {
      if (overlay) {
        overlay.classList.remove('is-open');
        setTimeout(function () { if (!openStack.length) overlay.hidden = true; }, 320);
      }
      document.documentElement.classList.remove('no-scroll');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }
  if (overlay) overlay.addEventListener('click', function () { while (openStack.length) closeLayer(); });
  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeLayer(b.closest('[data-layer]')); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openStack.length) { closeLayer(); return; }
    if (e.key !== 'Tab' || !openStack.length) return;
    var layer = openStack[openStack.length - 1];
    var focusables = $$('button, a[href], input, select, textarea', layer).filter(function (n) {
      return !n.disabled && n.offsetParent !== null;
    });
    if (!focusables.length) return;
    var first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  var lightbox = $('#lightbox');
  var lightboxImg = lightbox ? $('img', lightbox) : null;
  $$('[data-zoom]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!lightbox) return;
      lightboxImg.src = btn.getAttribute('data-zoom');
      lightboxImg.alt = btn.getAttribute('data-alt') || '';
      openLayer(lightbox);
    });
  });
  if (lightbox) lightbox.addEventListener('click', function (e) { if (e.target === lightbox || e.target === lightboxImg) closeLayer(lightbox); });

  /* ---------- Quantity ---------- */
  $$('[data-qty]').forEach(function (root) {
    var input = $('[data-qty-input]', root);
    if (!input) return;
    var clamp = function (v) { return isNaN(v) || v < 1 ? 1 : Math.min(99, v); };
    $('[data-qty-minus]', root).addEventListener('click', function () { input.value = clamp((parseInt(input.value, 10) || 1) - 1); });
    $('[data-qty-plus]', root).addEventListener('click', function () { input.value = clamp((parseInt(input.value, 10) || 1) + 1); });
    input.addEventListener('change', function () { input.value = clamp(parseInt(input.value, 10)); });
  });

  /* ---------- Cart (visual only) ---------- */
  var cartQty = 0;
  try { cartQty = parseInt(sessionStorage.getItem('rd-cart-qty'), 10) || 0; } catch (e) { cartQty = 0; }
  var drawer = $('#cart-drawer');

  function setCart(q) {
    cartQty = Math.max(0, Math.min(99, q));
    try { sessionStorage.setItem('rd-cart-qty', String(cartQty)); } catch (e) { /* storage unavailable */ }
    renderCart();
  }
  function renderCart() {
    $$('[data-cart-count]').forEach(function (el) { el.textContent = cartQty; el.hidden = cartQty === 0; });
    var cartBtn = $('[data-open-cart]');
    if (cartBtn) cartBtn.setAttribute('aria-label', cartQty ? 'Open cart, ' + cartQty + (cartQty === 1 ? ' item' : ' items') : 'Open cart');
    if (!drawer) return;
    $$('[data-cart-empty]', drawer).forEach(function (el) { el.hidden = cartQty > 0; });
    $$('[data-cart-filled]', drawer).forEach(function (el) { el.hidden = cartQty === 0; });
    var title = $('[data-cart-title-count]', drawer);
    if (title) title.textContent = cartQty ? '(' + cartQty + ')' : '';
    if (!cartQty) return;
    var subtotal = cartQty * PRODUCT.price;
    $('[data-line-qty]', drawer).value = cartQty;
    $('[data-line-price]', drawer).textContent = money(subtotal);
    $('[data-subtotal]', drawer).textContent = money(subtotal);
    var bar = $('[data-ship-bar]', drawer);
    var msg = $('[data-ship-msg]', drawer);
    if (FREE_SHIP && bar && msg) {
      bar.style.width = Math.min(100, (subtotal / FREE_SHIP) * 100) + '%';
      msg.innerHTML = subtotal >= FREE_SHIP
        ? 'You’ve unlocked <strong>free shipping</strong>!'
        : 'You are <strong>' + money(FREE_SHIP - subtotal) + '</strong> away from free shipping';
    }
  }

  $$('[data-add-to-cart]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (btn.classList.contains('is-loading')) return;
      var scope = btn.closest('[data-buy-scope]') || document;
      var input = $('[data-qty-input]', scope);
      var q = input ? (parseInt(input.value, 10) || 1) : 1;
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      setTimeout(function () {
        btn.classList.remove('is-loading');
        btn.removeAttribute('aria-busy');
        setCart(cartQty + q);
        openLayer(drawer);
      }, 450);
    });
  });
  $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', function () { openLayer(drawer); }); });

  if (drawer) {
    var lineInput = $('[data-line-qty]', drawer);
    $('[data-line-minus]', drawer).addEventListener('click', function () { setCart(cartQty - 1); });
    $('[data-line-plus]', drawer).addEventListener('click', function () { setCart(cartQty + 1); });
    lineInput.addEventListener('change', function () { setCart(parseInt(lineInput.value, 10) || 0); });
    $('[data-line-remove]', drawer).addEventListener('click', function () {
      setCart(0);
      var cont = $('[data-cart-empty] button', drawer);
      if (cont) cont.focus();
    });
    $$('[data-checkout]', drawer).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-loading')) return;
        b.classList.add('is-loading');
        setTimeout(function () {
          b.classList.remove('is-loading');
          toast('Checkout is disabled on this example site.');
        }, 700);
      });
    });
  }
  renderCart();

  /* ---------- Accordions ---------- */
  $$('[data-accordion]').forEach(function (acc) {
    var btn = $('[data-accordion-toggle]', acc);
    var panel = $('[data-accordion-panel]', acc);
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      acc.classList.toggle('is-open', !open);
      panel.hidden = open;
    });
  });

  /* ---------- Reviews (Judge.me layout) ---------- */
  var REVIEWS = (window.RD_REVIEWS || []).filter(function (r) { return r && r.body && r.rating; });
  var reviewsRoot = $('#reviews');
  var PAGE = 5;
  var shown = PAGE;
  var sortMode = 'recent';
  var starFilter = 0;

  function starsHTML(n, extra) {
    var out = '<span class="stars' + (extra ? ' ' + extra : '') + '" role="img" aria-label="' + (Math.round(n * 10) / 10) + ' out of 5 stars">';
    for (var i = 1; i <= 5; i++) {
      var fill = Math.max(0, Math.min(1, n - (i - 1)));
      out += '<span class="star" style="--fill:' + Math.round(fill * 100) + '%"></span>';
    }
    return out + '</span>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initials(name) {
    var parts = String(name || '?').trim().split(/\s+/);
    return ((parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
  }
  function average() {
    if (!REVIEWS.length) return 0;
    return REVIEWS.reduce(function (s, r) { return s + r.rating; }, 0) / REVIEWS.length;
  }
  function filtered() {
    var list = REVIEWS.filter(function (r) { return !starFilter || Math.round(r.rating) === starFilter; });
    var key = function (r) { return r.isoDate || ''; };
    if (sortMode === 'recent') list.sort(function (a, b) { return key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0; });
    if (sortMode === 'high') list.sort(function (a, b) { return b.rating - a.rating; });
    if (sortMode === 'low') list.sort(function (a, b) { return a.rating - b.rating; });
    if (sortMode === 'helpful') list.sort(function (a, b) { return (b.helpful || 0) - (a.helpful || 0); });
    return list;
  }

  function renderSummary() {
    var total = REVIEWS.length;
    var avg = average();
    $$('[data-rating-stars]').forEach(function (el) { el.innerHTML = starsHTML(avg); });
    $$('[data-rating-label]').forEach(function (el) {
      el.textContent = total ? total + (total === 1 ? ' Review' : ' Reviews') : 'No reviews yet';
    });
    if (!reviewsRoot) return;
    $('[data-summary-stars]', reviewsRoot).innerHTML = starsHTML(avg, 'stars--lg');
    $('[data-summary-score]', reviewsRoot).innerHTML = total
      ? '<strong>' + avg.toFixed(2) + '</strong> out of 5'
      : 'Be the first to write a review';
    var based = $('[data-summary-based]', reviewsRoot);
    based.textContent = total ? 'Based on ' + total + (total === 1 ? ' review' : ' reviews') : '';
    based.hidden = !total;

    var rows = '';
    for (var s = 5; s >= 1; s--) {
      var count = REVIEWS.filter(function (r) { return Math.round(r.rating) === s; }).length;
      var pct = total ? Math.round(count / total * 100) : 0;
      rows += '<button type="button" class="hist-row' + (starFilter === s ? ' is-active' : '') + '" data-star-filter="' + s + '"' +
        (total ? ' aria-pressed="' + (starFilter === s) + '"' : ' disabled') +
        ' aria-label="' + s + ' star reviews: ' + count + '">' +
        '<span class="hist-label" aria-hidden="true">' + s + '<span class="hist-star"></span></span>' +
        '<span class="hist-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></span>' +
        '<span class="hist-pct" aria-hidden="true">' + pct + '% (' + count + ')</span></button>';
    }
    var hist = $('[data-histogram]', reviewsRoot);
    hist.innerHTML = rows;
    $$('[data-star-filter]', hist).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = parseInt(b.getAttribute('data-star-filter'), 10);
        starFilter = starFilter === v ? 0 : v;
        shown = PAGE;
        renderSummary();
        renderList();
      });
    });
  }

  function renderList() {
    if (!reviewsRoot) return;
    var listEl = $('[data-review-list]', reviewsRoot);
    var more = $('[data-review-more]', reviewsRoot);
    var toolbar = $('[data-reviews-toolbar]', reviewsRoot);
    var showing = $('[data-review-showing]', reviewsRoot);
    toolbar.hidden = !REVIEWS.length;
    if (!REVIEWS.length) { listEl.innerHTML = ''; more.hidden = true; return; }
    var list = filtered();
    if (!list.length) {
      listEl.innerHTML = '<p class="review-empty">No reviews match this filter.</p>';
      more.hidden = true;
      showing.textContent = '';
      return;
    }
    listEl.innerHTML = list.slice(0, shown).map(function (r) {
      return '<article class="review-card">' +
        '<div class="review-author">' +
          '<span class="review-avatar" aria-hidden="true">' + esc(initials(r.author)) + '</span>' +
          '<div><p class="review-name">' + esc(r.author || 'Customer') + '</p>' +
          (r.verified ? '<p class="review-verified"><span class="check" aria-hidden="true"></span>Verified Buyer</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="review-body">' +
          '<div class="review-top">' + starsHTML(r.rating) + (r.date ? '<time class="review-date"' + (r.isoDate ? ' datetime="' + esc(r.isoDate) + '"' : '') + '>' + esc(r.date) + '</time>' : '') + '</div>' +
          (r.title ? '<h3 class="review-title">' + esc(r.title) + '</h3>' : '') +
          '<p class="review-text">' + esc(r.body) + '</p>' +
          (r.source ? '<p class="review-source">' + esc(r.source) + '</p>' : '') +
          '<div class="review-helpful"><span>Was this review helpful?</span>' +
            '<button type="button" class="vote" aria-label="Yes, helpful"><span class="thumb" aria-hidden="true"></span><span class="vote-n">' + (r.helpful || 0) + '</span></button>' +
            '<button type="button" class="vote" aria-label="No, not helpful"><span class="thumb down" aria-hidden="true"></span><span class="vote-n">' + (r.unhelpful || 0) + '</span></button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
    $$('.vote', listEl).forEach(function (b) {
      b.addEventListener('click', function () {
        var group = b.parentNode;
        if ($('.vote.is-voted', group)) return;
        b.classList.add('is-voted');
        var n = $('.vote-n', b);
        n.textContent = (parseInt(n.textContent, 10) || 0) + 1;
      });
    });
    more.hidden = shown >= list.length;
    showing.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length + (list.length === 1 ? ' review' : ' reviews');
  }

  if (reviewsRoot) {
    $('[data-review-sort]', reviewsRoot).addEventListener('change', function (e) { sortMode = e.target.value; shown = PAGE; renderList(); });
    $('[data-review-more]', reviewsRoot).addEventListener('click', function () { shown += PAGE; renderList(); });
  }
  renderSummary();
  renderList();

  $$('[data-scroll-reviews]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!reviewsRoot) return;
      e.preventDefault();
      reviewsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- Write a review (visual only) ---------- */
  var formWrap = $('#review-form');
  var writeBtn = $('[data-write-review]');
  function toggleForm(show) {
    if (!formWrap) return;
    formWrap.hidden = !show;
    if (writeBtn) writeBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (show) { var first = $('[data-pick-star]', formWrap); if (first) first.focus(); }
  }
  if (writeBtn) writeBtn.addEventListener('click', function () { toggleForm(formWrap.hidden); });
  if (formWrap) {
    var pick = 0;
    var starBtns = $$('[data-pick-star]', formWrap);
    var paint = function () {
      starBtns.forEach(function (x) {
        var on = parseInt(x.getAttribute('data-pick-star'), 10) <= pick;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on && parseInt(x.getAttribute('data-pick-star'), 10) === pick ? 'true' : 'false');
      });
    };
    starBtns.forEach(function (b) {
      b.addEventListener('click', function () { pick = parseInt(b.getAttribute('data-pick-star'), 10); paint(); });
    });
    var form = $('form', formWrap);
    var err = $('[data-review-error]', form);
    $('[data-cancel-review]', form).addEventListener('click', function () {
      form.reset(); pick = 0; paint(); err.hidden = true; toggleForm(false);
      if (writeBtn) writeBtn.focus();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pick) { err.textContent = 'Choose a star rating before submitting.'; err.hidden = false; return; }
      if (!form.checkValidity()) { err.textContent = 'Fill in your review, name and a valid email.'; err.hidden = false; return; }
      err.hidden = true;
      form.reset(); pick = 0; paint();
      toggleForm(false);
      if (writeBtn) writeBtn.focus();
      toast('Thank you! Your review has been submitted.');
    });
  }

  /* ---------- Newsletter (visual only) ---------- */
  $$('[data-newsletter]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('input[type="email"]', form);
      var msg = $('[data-newsletter-msg]', form);
      msg.hidden = false;
      if (!input.value.trim() || !input.checkValidity()) {
        msg.textContent = 'Enter a valid email address.';
        msg.className = 'newsletter-msg is-error';
        input.focus();
        return;
      }
      msg.textContent = 'Thanks for subscribing! Your 10% off code is on its way.';
      msg.className = 'newsletter-msg is-ok';
      input.value = '';
    });
  });

  /* ---------- Video placeholder ---------- */
  $$('[data-video-play]').forEach(function (b) {
    b.addEventListener('click', function () { toast('Video coming soon.'); });
  });
})();
