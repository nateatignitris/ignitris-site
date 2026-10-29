(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var money = function (n) { return '$' + n.toFixed(2); };

  var PRODUCT = window.RD_PRODUCT || {};
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

  function goTo(i, smooth) {
    if (!track || !slides.length) return;
    current = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[current].offsetLeft, behavior: smooth === false ? 'auto' : 'smooth' });
    sync();
  }
  function sync() {
    thumbs.forEach(function (t, idx) {
      t.classList.toggle('is-active', idx === current);
      t.setAttribute('aria-current', idx === current ? 'true' : 'false');
    });
    dots.forEach(function (d, idx) { d.classList.toggle('is-active', idx === current); });
    var counter = $('[data-gallery-count]');
    if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
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
        var w = track.clientWidth || 1;
        var idx = Math.round(track.scrollLeft / w);
        if (idx !== current) { current = Math.max(0, Math.min(slides.length - 1, idx)); sync(); }
      }, 60);
    }, { passive: true });
    window.addEventListener('resize', function () { goTo(current, false); });
    sync();
  }

  /* ---------- Zoom lightbox ---------- */
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

  /* ---------- Layers (drawer, lightbox, modal) ---------- */
  var overlay = $('#overlay');
  var openStack = [];
  var lastFocus = null;
  function openLayer(el) {
    lastFocus = document.activeElement;
    el.hidden = false;
    requestAnimationFrame(function () { el.classList.add('is-open'); });
    if (overlay) { overlay.hidden = false; requestAnimationFrame(function () { overlay.classList.add('is-open'); }); }
    document.documentElement.classList.add('no-scroll');
    openStack.push(el);
    var f = $('[data-autofocus]', el) || $('button, a, input, textarea, select', el);
    if (f) setTimeout(function () { f.focus(); }, 50);
  }
  function closeLayer(el) {
    el = el || openStack[openStack.length - 1];
    if (!el) return;
    el.classList.remove('is-open');
    openStack = openStack.filter(function (x) { return x !== el; });
    setTimeout(function () { if (!el.classList.contains('is-open')) el.hidden = true; }, 300);
    if (!openStack.length) {
      if (overlay) { overlay.classList.remove('is-open'); setTimeout(function () { if (!openStack.length) overlay.hidden = true; }, 300); }
      document.documentElement.classList.remove('no-scroll');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
  }
  if (overlay) overlay.addEventListener('click', function () { while (openStack.length) closeLayer(); });
  $$('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { closeLayer(b.closest('[data-layer]')); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && openStack.length) closeLayer(); });

  /* ---------- Quantity ---------- */
  function bindQty(root) {
    var input = $('[data-qty-input]', root);
    if (!input) return;
    $$('[data-qty-minus]', root).forEach(function (b) {
      b.addEventListener('click', function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); });
    });
    $$('[data-qty-plus]', root).forEach(function (b) {
      b.addEventListener('click', function () { input.value = Math.min(99, (parseInt(input.value, 10) || 1) + 1); });
    });
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      input.value = isNaN(v) || v < 1 ? 1 : Math.min(99, v);
    });
  }
  $$('[data-qty]').forEach(bindQty);

  /* ---------- Cart (visual only, kept for this tab) ---------- */
  var cart = { qty: 0 };
  try { cart.qty = parseInt(sessionStorage.getItem('rd-cart-qty'), 10) || 0; } catch (e) { cart.qty = 0; }
  var drawer = $('#cart-drawer');

  function saveCart() { try { sessionStorage.setItem('rd-cart-qty', String(cart.qty)); } catch (e) { /* storage unavailable */ } }

  function renderCart() {
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = cart.qty;
      el.hidden = cart.qty === 0;
    });
    if (!drawer) return;
    var empty = $('[data-cart-empty]', drawer);
    var filled = $('[data-cart-filled]', drawer);
    empty.hidden = cart.qty > 0;
    filled.hidden = cart.qty === 0;
    var title = $('[data-cart-title-count]', drawer);
    if (title) title.textContent = cart.qty ? '(' + cart.qty + ')' : '';
    if (!cart.qty) return;
    var subtotal = cart.qty * PRODUCT.price;
    $('[data-line-qty]', drawer).value = cart.qty;
    $('[data-line-price]', drawer).textContent = money(subtotal);
    $('[data-subtotal]', drawer).textContent = money(subtotal);
    var bar = $('[data-ship-bar]', drawer);
    var msg = $('[data-ship-msg]', drawer);
    if (FREE_SHIP && bar && msg) {
      var pct = Math.min(100, (subtotal / FREE_SHIP) * 100);
      bar.style.width = pct + '%';
      msg.innerHTML = subtotal >= FREE_SHIP
        ? 'You’ve unlocked <strong>free shipping</strong>!'
        : 'You’re <strong>' + money(FREE_SHIP - subtotal) + '</strong> away from free shipping';
    }
  }

  function addToCart(qty, btn) {
    cart.qty = Math.min(99, cart.qty + qty);
    saveCart();
    renderCart();
    if (btn) {
      btn.classList.add('is-loading');
      btn.disabled = true;
      setTimeout(function () {
        btn.classList.remove('is-loading');
        btn.disabled = false;
        if (drawer) openLayer(drawer);
      }, 450);
    } else if (drawer) {
      openLayer(drawer);
    }
  }

  $$('[data-add-to-cart]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var scope = btn.closest('[data-buy-scope]') || document;
      var input = $('[data-qty-input]', scope);
      addToCart(input ? (parseInt(input.value, 10) || 1) : 1, btn);
    });
  });
  $$('[data-open-cart]').forEach(function (b) { b.addEventListener('click', function () { if (drawer) openLayer(drawer); }); });

  if (drawer) {
    var lineInput = $('[data-line-qty]', drawer);
    $('[data-line-minus]', drawer).addEventListener('click', function () {
      cart.qty = Math.max(0, cart.qty - 1); saveCart(); renderCart();
    });
    $('[data-line-plus]', drawer).addEventListener('click', function () {
      cart.qty = Math.min(99, cart.qty + 1); saveCart(); renderCart();
    });
    lineInput.addEventListener('change', function () {
      var v = parseInt(lineInput.value, 10);
      cart.qty = isNaN(v) || v < 0 ? 0 : Math.min(99, v); saveCart(); renderCart();
    });
    $('[data-line-remove]', drawer).addEventListener('click', function () { cart.qty = 0; saveCart(); renderCart(); });
    $$('[data-checkout]', drawer).forEach(function (b) {
      b.addEventListener('click', function () {
        b.classList.add('is-loading');
        b.disabled = true;
        setTimeout(function () {
          b.classList.remove('is-loading');
          b.disabled = false;
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
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      acc.classList.toggle('is-open', !open);
      panel.hidden = open;
    });
  });

  /* ---------- Sticky add-to-cart bar ---------- */
  var sticky = $('#sticky-atc');
  var mainAtc = $('[data-main-atc]');
  if (sticky && mainAtc && 'IntersectionObserver' in window) {
    var footer = $('.site-footer');
    var atcGone = false, footerIn = false;
    var update = function () {
      var show = atcGone && !footerIn;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
    };
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { atcGone = !en.isIntersecting && en.boundingClientRect.top < 0; });
      update();
    }).observe(mainAtc);
    if (footer) new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { footerIn = en.isIntersecting; });
      update();
    }).observe(footer);
  }

  /* ---------- Reviews ---------- */
  var REVIEWS = (window.RD_REVIEWS || []).slice();
  var reviewsRoot = $('#reviews');
  var PAGE = 5;
  var shown = PAGE;
  var sortMode = 'recent';
  var starFilter = 0;

  function starsHTML(n, cls) {
    var out = '<span class="' + (cls || 'stars') + '" role="img" aria-label="' + n + ' out of 5 stars">';
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
    return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  }
  function sorted() {
    var list = REVIEWS.filter(function (r) { return !starFilter || Math.round(r.rating) === starFilter; });
    var key = function (r) { return r.sortDate || r.date || ''; };
    if (sortMode === 'recent') list.sort(function (a, b) { return key(b) < key(a) ? -1 : key(b) > key(a) ? 1 : 0; });
    if (sortMode === 'high') list.sort(function (a, b) { return b.rating - a.rating; });
    if (sortMode === 'low') list.sort(function (a, b) { return a.rating - b.rating; });
    if (sortMode === 'helpful') list.sort(function (a, b) { return (b.helpful || 0) - (a.helpful || 0); });
    return list;
  }

  function renderSummary() {
    if (!reviewsRoot) return;
    var total = PRODUCT.ratingCount || REVIEWS.length;
    var avg = PRODUCT.rating || (REVIEWS.reduce(function (s, r) { return s + r.rating; }, 0) / (REVIEWS.length || 1));
    $$('[data-rating-avg]').forEach(function (el) { el.textContent = avg.toFixed(1); });
    $$('[data-rating-stars]').forEach(function (el) { el.innerHTML = starsHTML(avg); });
    $$('[data-rating-count]').forEach(function (el) {
      var fmt = el.getAttribute('data-rating-count');
      el.textContent = fmt === 'paren' ? '(' + total + ')' : total + (total === 1 ? ' review' : ' reviews');
    });
    var hist = $('[data-histogram]', reviewsRoot);
    if (hist) {
      var dist = PRODUCT.ratingDistribution;
      var rows = '';
      for (var s = 5; s >= 1; s--) {
        var pct = dist ? (dist[s] || 0) : (REVIEWS.length ? Math.round(REVIEWS.filter(function (r) { return Math.round(r.rating) === s; }).length / REVIEWS.length * 100) : 0);
        rows += '<button type="button" class="hist-row' + (starFilter === s ? ' is-active' : '') + '" data-star-filter="' + s + '" aria-pressed="' + (starFilter === s) + '">' +
          '<span class="hist-label">' + s + ' <span class="hist-star" aria-hidden="true"></span></span>' +
          '<span class="hist-bar"><span style="width:' + pct + '%"></span></span>' +
          '<span class="hist-pct">' + pct + '%</span></button>';
      }
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
  }

  function renderList() {
    if (!reviewsRoot) return;
    var listEl = $('[data-review-list]', reviewsRoot);
    var more = $('[data-review-more]', reviewsRoot);
    var countEl = $('[data-review-showing]', reviewsRoot);
    var list = sorted();
    if (!list.length) {
      listEl.innerHTML = '<p class="review-empty">No reviews match this filter.</p>';
      if (more) more.hidden = true;
      if (countEl) countEl.textContent = '';
      return;
    }
    listEl.innerHTML = list.slice(0, shown).map(function (r, i) {
      var meta = (r.attributes || []).map(function (a) {
        return '<li><span>' + esc(a[0]) + ':</span> ' + esc(a[1]) + '</li>';
      }).join('');
      return '<article class="review-card">' +
        '<div class="review-author">' +
          '<span class="review-avatar" aria-hidden="true">' + esc(initials(r.author)) + '</span>' +
          '<div><p class="review-name">' + esc(r.author) + '</p>' +
          (r.verified ? '<p class="review-verified"><span class="check" aria-hidden="true"></span>Verified Buyer</p>' : '') +
          '</div>' +
        '</div>' +
        '<div class="review-body">' +
          '<div class="review-top">' + starsHTML(r.rating) + '<time class="review-date">' + esc(r.date) + '</time></div>' +
          (r.title ? '<h4 class="review-title">' + esc(r.title) + '</h4>' : '') +
          '<p class="review-text">' + esc(r.body) + '</p>' +
          (meta ? '<ul class="review-attrs">' + meta + '</ul>' : '') +
          (r.source ? '<p class="review-source">' + esc(r.source) + '</p>' : '') +
          '<div class="review-helpful"><span>Was this review helpful?</span>' +
            '<button type="button" class="vote" data-vote="up" data-idx="' + i + '" aria-label="Yes, helpful"><span class="thumb up" aria-hidden="true"></span><span class="vote-n">' + (r.helpful || 0) + '</span></button>' +
            '<button type="button" class="vote" data-vote="down" data-idx="' + i + '" aria-label="No, not helpful"><span class="thumb down" aria-hidden="true"></span><span class="vote-n">' + (r.unhelpful || 0) + '</span></button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
    $$('[data-vote]', listEl).forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.classList.contains('is-voted')) return;
        b.classList.add('is-voted');
        var n = $('.vote-n', b);
        n.textContent = (parseInt(n.textContent, 10) || 0) + 1;
      });
    });
    if (more) more.hidden = shown >= list.length;
    if (countEl) countEl.textContent = 'Showing ' + Math.min(shown, list.length) + ' of ' + list.length;
  }

  if (reviewsRoot) {
    var sortSel = $('[data-review-sort]', reviewsRoot);
    if (sortSel) sortSel.addEventListener('change', function () { sortMode = sortSel.value; shown = PAGE; renderList(); });
    var moreBtn = $('[data-review-more]', reviewsRoot);
    if (moreBtn) moreBtn.addEventListener('click', function () { shown += PAGE; renderList(); });
    renderSummary();
    renderList();
  }

  $$('[data-scroll-reviews]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (!reviewsRoot) return;
      e.preventDefault();
      reviewsRoot.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  /* ---------- Write a review (visual only) ---------- */
  var reviewModal = $('#review-modal');
  $$('[data-write-review]').forEach(function (b) { b.addEventListener('click', function () { if (reviewModal) openLayer(reviewModal); }); });
  if (reviewModal) {
    var pick = 0;
    var starBtns = $$('[data-pick-star]', reviewModal);
    starBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        pick = parseInt(b.getAttribute('data-pick-star'), 10);
        starBtns.forEach(function (x) { x.classList.toggle('is-on', parseInt(x.getAttribute('data-pick-star'), 10) <= pick); });
      });
    });
    var form = $('form', reviewModal);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('[data-review-error]', form);
      if (!pick) { err.textContent = 'Choose a star rating before submitting.'; err.hidden = false; return; }
      if (!form.checkValidity()) { err.textContent = 'Fill in your name, email and review.'; err.hidden = false; return; }
      err.hidden = true;
      form.reset();
      pick = 0;
      starBtns.forEach(function (x) { x.classList.remove('is-on'); });
      closeLayer(reviewModal);
      toast('Thanks! Your review was submitted for moderation.');
    });
  }

  /* ---------- Newsletter (visual only) ---------- */
  $$('[data-newsletter]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('input[type="email"]', form);
      var msg = $('[data-newsletter-msg]', form);
      if (!input.value || !input.checkValidity()) {
        msg.textContent = 'Enter a valid email address.';
        msg.className = 'newsletter-msg is-error';
        msg.hidden = false;
        return;
      }
      msg.textContent = 'Thanks for subscribing! Your 10% off code is on its way to ' + input.value + '.';
      msg.className = 'newsletter-msg is-ok';
      msg.hidden = false;
      form.reset();
    });
  });

  /* ---------- Video placeholder ---------- */
  $$('[data-video-play]').forEach(function (b) {
    b.addEventListener('click', function () { toast('Video coming soon.'); });
  });
})();
