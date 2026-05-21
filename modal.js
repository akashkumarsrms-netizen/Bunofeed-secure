/**
 * ============================================================
 *  BUNOFEED — Full-Screen Product Modal (modal.js)
 *  Shared by index.html and shop.html
 *  Features:
 *   - Full-screen overlay with split layout (desktop) / stacked (mobile)
 *   - Swipe gesture on main image to navigate gallery
 *   - Truncated description with "more/less" toggle
 *   - Variant selector (size/weight) with dynamic price
 *   - MRP strikethrough price support
 *   - No-flicker image loading (uses will-change & contain)
 * ============================================================
 */

(function () {
  'use strict';

  /* Inject styles once */
  if (document.getElementById('buno-modal-styles')) return;

  const style = document.createElement('style');
  style.id = 'buno-modal-styles';
  style.textContent = `
    /* ===== FULL-SCREEN MODAL ===== */
    #buno-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,0);
      transition: background 0.25s ease;
      overflow: hidden;
    }
    #buno-modal-overlay.open {
      display: flex;
      align-items: stretch;
      justify-content: center;
      background: rgba(0,0,0,0.6);
    }
    #buno-modal-overlay.visible {
      background: rgba(10,4,2,0.72);
    }

    #buno-modal {
      display: flex;
      flex-direction: row;
      width: 100%;
      height: 100%;
      max-width: 1200px;
      margin: 0 auto;
      background: #fff;
      position: relative;
      will-change: transform;
      transform: translateX(100%);
      transition: transform 0.32s cubic-bezier(0.22,1,0.36,1);
      overflow: hidden;
    }
    #buno-modal-overlay.visible #buno-modal {
      transform: translateX(0);
    }

    /* ---- Image side (left 45%) ---- */
    #buno-modal-img-col {
      width: 45%;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      position: relative;
      overflow: hidden;
      background: #FFF8F3;
      user-select: none;
      -webkit-user-select: none;
    }

    /* Main image container */
    #buno-modal-main-img {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      cursor: grab;
      position: relative;
      contain: layout paint;
    }
    #buno-modal-main-img:active { cursor: grabbing; }

    #buno-modal-main-img img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 24px;
      pointer-events: none;
      will-change: transform;
      transition: opacity 0.22s ease;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    #buno-modal-main-img .buno-emoji-display {
      font-size: 8rem;
      line-height: 1;
      pointer-events: none;
    }

    /* Swipe indicator dots */
    #buno-modal-dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      padding: 10px 16px;
      flex-shrink: 0;
      background: rgba(0,0,0,0.07);
    }
    #buno-modal-dots:empty { display: none; }
    .buno-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: rgba(255,255,255,0.4);
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
      flex-shrink: 0;
    }
    .buno-dot.active {
      background: #FF6B00;
      transform: scale(1.3);
    }

    /* Swipe nav arrows (shown on desktop hover) */
    .buno-img-nav {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(0,0,0,0.35);
      border: none;
      color: #fff;
      font-size: 0.9rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 5;
    }
    #buno-modal-img-col:hover .buno-img-nav { opacity: 1; }
    #buno-img-prev { left: 10px; }
    #buno-img-next { right: 10px; }
    .buno-img-nav:hover { background: rgba(0,0,0,0.6); }

    /* Thumbnail strip */
    #buno-modal-thumbs {
      display: flex;
      gap: 8px;
      padding: 8px 12px;
      overflow-x: auto;
      background: rgba(0,0,0,0.1);
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.3) transparent;
      flex-shrink: 0;
    }
    #buno-modal-thumbs:empty { display: none; }
    #buno-modal-thumbs::-webkit-scrollbar { height: 3px; }
    #buno-modal-thumbs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.3); border-radius: 3px; }
    .buno-thumb {
      width: 52px; height: 52px;
      border-radius: 8px;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid transparent;
      cursor: pointer;
      background: #fff;
      transition: border-color 0.18s, transform 0.18s;
    }
    .buno-thumb:hover { transform: scale(1.06); }
    .buno-thumb.active { border-color: #FF6B00; box-shadow: 0 0 0 1px #FF6B00; }
    .buno-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }

    /* ---- Content side (right 55%) ---- */
    #buno-modal-body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 2.5rem 2.2rem 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.1rem;
      scroll-behavior: smooth;
    }

    /* Close button */
    #buno-modal-close {
      position: absolute;
      top: 1rem; right: 1rem;
      width: 38px; height: 38px;
      border-radius: 50%;
      background: rgba(0,0,0,0.15);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem;
      color: #fff;
      z-index: 20;
      transition: background 0.2s, transform 0.15s;
      -webkit-appearance: none;
    }
    #buno-modal-close:hover { background: rgba(0,0,0,0.4); transform: scale(1.1); }

    /* Badge row */
    #buno-modal-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .buno-badge {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700; font-size: 0.72rem;
      padding: 4px 12px; border-radius: 50px;
    }
    .buno-badge.bestseller { background: #6B2D0E; color: #fff; }
    .buno-badge.new        { background: #28a745; color: #fff; }
    .buno-badge.limited    { background: #dc3545; color: #fff; }
    .buno-badge.sale       { background: #FF6B00; color: #fff; }

    #buno-modal-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 1.6rem; font-weight: 800;
      color: #1a1a1a; line-height: 1.2;
      margin: 0;
    }
    #buno-modal-tagline {
      font-size: 0.97rem; color: #FF6B00; font-weight: 600;
      margin: 0;
    }

    /* Description with collapse */
    .buno-desc-wrap { position: relative; }
    #buno-modal-desc {
      color: #666; font-size: 0.93rem; line-height: 1.75;
      margin: 0;
      /* collapsed */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      transition: none;
    }
    #buno-modal-desc.expanded {
      display: block;
      overflow: visible;
      -webkit-line-clamp: unset;
    }
    #buno-desc-toggle {
      background: none; border: none; cursor: pointer;
      color: #FF6B00; font-size: 0.82rem; font-weight: 700;
      font-family: 'Montserrat', sans-serif;
      padding: 2px 0; margin-top: 2px;
      display: inline-block;
      -webkit-appearance: none;
    }
    #buno-desc-toggle:hover { text-decoration: underline; }

    /* Features */
    #buno-modal-features { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .buno-chip {
      background: rgba(255,107,0,0.1); color: #6B2D0E;
      font-size: 0.78rem; font-family: 'Montserrat', sans-serif; font-weight: 600;
      padding: 5px 12px; border-radius: 50px;
    }

    /* Variant selector */
    .buno-variants-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .buno-variants-label {
      font-family: 'Montserrat', sans-serif; font-weight: 700;
      font-size: 0.85rem; color: #1a1a1a;
    }
    #buno-variants-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .buno-variant-btn {
      padding: 7px 18px;
      border-radius: 50px;
      border: 2px solid #e0d4cc;
      background: #fff;
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 0.82rem;
      color: #555;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s, color 0.18s;
      -webkit-appearance: none;
    }
    .buno-variant-btn:hover { border-color: #FF6B00; color: #FF6B00; }
    .buno-variant-btn.selected {
      border-color: #FF6B00; background: #FF6B00; color: #fff;
    }

    /* Price row */
    .buno-price-row {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      padding: 0.8rem 0;
      border-top: 1px solid #f0e8e0;
      border-bottom: 1px solid #f0e8e0;
    }
    #buno-modal-price {
      font-family: 'Montserrat', sans-serif; font-size: 1.8rem;
      font-weight: 800; color: #6B2D0E;
      transition: color 0.2s;
    }
    #buno-modal-mrp {
      font-size: 1rem; color: #999;
      text-decoration: line-through; font-weight: 500;
      display: none;
    }
    #buno-modal-discount-badge {
      background: #e8f5e9; color: #2e7d32;
      font-size: 0.75rem; font-weight: 700;
      font-family: 'Montserrat', sans-serif;
      padding: 3px 10px; border-radius: 50px;
      display: none;
    }

    /* Qty row */
    .buno-qty-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .buno-qty-label {
      font-family: 'Montserrat', sans-serif; font-weight: 700;
      font-size: 0.85rem; color: #1a1a1a;
    }
    .buno-qty-control {
      display: flex; align-items: center;
      border: 2px solid #e0d4cc; border-radius: 50px; overflow: hidden;
    }
    .buno-qty-btn {
      width: 38px; height: 38px;
      background: none; border: none; cursor: pointer;
      font-size: 1.2rem; font-weight: 700; color: #1a1a1a;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.18s;
      -webkit-appearance: none;
    }
    .buno-qty-btn:hover { background: #FFF8F3; }
    #buno-qty-num {
      min-width: 36px; text-align: center;
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 0.95rem;
    }
    #buno-modal-subtotal {
      font-size: 0.88rem; color: #555; font-weight: 600;
    }

    /* Action buttons */
    .buno-actions { display: flex; gap: 0.8rem; flex-wrap: wrap; }
    .buno-actions .btn { flex: 1; min-width: 130px; justify-content: center; }

    /* Accordion */
    .buno-accordion { margin-top: 0.5rem; }
    .buno-acc-item { border-top: 1px solid #f0e8e0; }
    .buno-acc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.85rem 0; cursor: pointer;
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 0.88rem; color: #1a1a1a;
      background: none; border: none; width: 100%; text-align: left;
      -webkit-appearance: none;
    }
    .buno-acc-head i { transition: transform 0.2s; color: #FF6B00; }
    .buno-acc-head.open i { transform: rotate(180deg); }
    .buno-acc-body {
      display: none; padding: 0.5rem 0 1rem;
      color: #666; font-size: 0.88rem; line-height: 1.7;
      white-space: pre-line;
    }
    .buno-acc-body.open { display: block; }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      #buno-modal {
        flex-direction: column;
        transform: translateY(100%);
        border-radius: 20px 20px 0 0;
        height: 100%;
        max-height: 100dvh;
      }
      #buno-modal-overlay.visible #buno-modal {
        transform: translateY(0);
      }
      #buno-modal-img-col {
        width: 100%;
        flex-shrink: 0;
        height: 52vw;
        max-height: 260px;
        min-height: 180px;
        border-radius: 20px 20px 0 0;
      }
      #buno-modal-close {
        background: rgba(0,0,0,0.3);
        top: 0.75rem; right: 0.75rem;
      }
      #buno-modal-body {
        flex: 1;
        padding: 1.4rem 1.2rem 1.5rem;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      #buno-modal-name { font-size: 1.25rem; }
      #buno-modal-price { font-size: 1.5rem; }
    }

    @media (max-width: 480px) {
      #buno-modal-img-col {
        height: 48vw;
      }
      .buno-actions { flex-direction: column; }
      .buno-actions .btn { flex: unset; width: 100%; }
    }
  `;
  document.head.appendChild(style);

  /* ---- Inject modal HTML ---- */
  const modalHTML = `
    <div id="buno-modal-overlay" role="dialog" aria-modal="true" aria-label="Product Details">
      <div id="buno-modal">
        <button id="buno-modal-close" aria-label="Close product details">
          <i class="fas fa-times"></i>
        </button>

        <!-- Image column -->
        <div id="buno-modal-img-col" class="peanut-bg">
          <div id="buno-modal-main-img">
            <span class="buno-emoji-display" id="buno-modal-emoji">🥜</span>
          </div>
          <button class="buno-img-nav" id="buno-img-prev" aria-label="Previous image">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="buno-img-nav" id="buno-img-next" aria-label="Next image">
            <i class="fas fa-chevron-right"></i>
          </button>
          <div id="buno-modal-thumbs"></div>
          <div id="buno-modal-dots"></div>
        </div>

        <!-- Content column -->
        <div id="buno-modal-body">
          <div id="buno-modal-badges"></div>
          <h2 id="buno-modal-name">Product Name</h2>
          <p id="buno-modal-tagline"></p>

          <div class="buno-desc-wrap">
            <p id="buno-modal-desc"></p>
            <button id="buno-desc-toggle">more ▾</button>
          </div>

          <div id="buno-modal-features"></div>

          <div class="buno-variants-section" id="buno-variants-section" style="display:none">
            <span class="buno-variants-label">Size / Variant:</span>
            <div id="buno-variants-row"></div>
          </div>

          <div class="buno-price-row">
            <span id="buno-modal-price">₹0</span>
            <span id="buno-modal-mrp"></span>
            <span id="buno-modal-discount-badge"></span>
          </div>

          <div class="buno-qty-row">
            <span class="buno-qty-label">Quantity:</span>
            <div class="buno-qty-control">
              <button class="buno-qty-btn" id="buno-qty-minus" aria-label="Decrease quantity">−</button>
              <span id="buno-qty-num">1</span>
              <button class="buno-qty-btn" id="buno-qty-plus" aria-label="Increase quantity">+</button>
            </div>
            <span id="buno-modal-subtotal"></span>
          </div>

          <div class="buno-actions">
            <button class="btn btn-primary" id="buno-modal-buy-btn">
              <i class="fas fa-bolt"></i> Buy Now
            </button>
            <a href="shop.html" class="btn btn-brown" id="buno-view-all-btn">
              <i class="fas fa-store"></i> View All
            </a>
          </div>

          <div class="buno-accordion" id="buno-modal-accordion"></div>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  /* ===================================================
     MODAL STATE
  =================================================== */
  let _product      = null;
  let _qty          = 1;
  let _imgIndex     = 0;
  let _images       = [];
  let _variantIdx   = 0;   // selected variant index
  let _onBuy        = null; // callback(product, qty, unitPrice)
  let _descExpanded = false;

  /* Touch state for swipe */
  let _touchStartX = 0;
  let _touchStartY = 0;
  let _isSwiping   = false;

  const overlay    = document.getElementById('buno-modal-overlay');
  const modal      = document.getElementById('buno-modal');
  const imgCol     = document.getElementById('buno-modal-img-col');
  const mainImgWrap= document.getElementById('buno-modal-main-img');
  const thumbsEl   = document.getElementById('buno-modal-thumbs');
  const dotsEl     = document.getElementById('buno-modal-dots');
  const prevBtn    = document.getElementById('buno-img-prev');
  const nextBtn    = document.getElementById('buno-img-next');
  const closeBtn   = document.getElementById('buno-modal-close');
  const descEl     = document.getElementById('buno-modal-desc');
  const descToggle = document.getElementById('buno-desc-toggle');
  const variantsSection = document.getElementById('buno-variants-section');
  const variantsRow= document.getElementById('buno-variants-row');
  const priceEl    = document.getElementById('buno-modal-price');
  const mrpEl      = document.getElementById('buno-modal-mrp');
  const discountEl = document.getElementById('buno-modal-discount-badge');
  const qtyMinusEl = document.getElementById('buno-qty-minus');
  const qtyPlusEl  = document.getElementById('buno-qty-plus');
  const qtyNumEl   = document.getElementById('buno-qty-num');
  const subtotalEl = document.getElementById('buno-modal-subtotal');
  const buyBtn     = document.getElementById('buno-modal-buy-btn');

  /* ---- Image helpers ---- */
  function setImage(idx, instant) {
    if (!_images.length) return;
    idx = (_images.length + idx) % _images.length;
    _imgIndex = idx;

    const src = _images[idx];
    const current = mainImgWrap.querySelector('img');

    function showImg(imgEl) {
      mainImgWrap.innerHTML = '';
      mainImgWrap.appendChild(imgEl);
    }

    if (instant || !current) {
      const img = new Image();
      img.src = src;
      img.alt = _product ? _product.name : 'Product';
      img.style.opacity = '1';
      showImg(img);
    } else {
      // fade transition
      current.style.opacity = '0';
      const img = new Image();
      img.onload = () => {
        img.style.opacity = '0';
        showImg(img);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { img.style.opacity = '1'; });
        });
      };
      img.onerror = () => {
        mainImgWrap.innerHTML = `<span class="buno-emoji-display">${_product ? _product.emoji || '🥜' : '🥜'}</span>`;
      };
      img.src = src;
    }

    // Update dots
    dotsEl.querySelectorAll('.buno-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });
    // Update thumbs
    thumbsEl.querySelectorAll('.buno-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === idx);
      if (i === idx) t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });

    // Show/hide nav arrows
    prevBtn.style.display = _images.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = _images.length > 1 ? 'flex' : 'none';
  }

  function buildGallery(images) {
    _images = images;
    _imgIndex = 0;

    // Dots
    dotsEl.innerHTML = '';
    if (images.length > 1) {
      images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'buno-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Image ${i+1}`);
        dot.addEventListener('click', () => setImage(i));
        dotsEl.appendChild(dot);
      });
    }

    // Thumbs
    thumbsEl.innerHTML = '';
    if (images.length > 1) {
      images.forEach((src, i) => {
        const t = document.createElement('div');
        t.className = 'buno-thumb' + (i === 0 ? ' active' : '');
        t.innerHTML = `<img src="${src}" alt="Image ${i+1}" loading="lazy"/>`;
        t.addEventListener('click', () => setImage(i));
        thumbsEl.appendChild(t);
      });
    }

    if (images.length) {
      setImage(0, true);
    } else {
      mainImgWrap.innerHTML = `<span class="buno-emoji-display">${_product ? _product.emoji || '🥜' : '🥜'}</span>`;
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  /* ---- Swipe handling ---- */
  mainImgWrap.addEventListener('touchstart', (e) => {
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
    _isSwiping = false;
  }, { passive: true });

  mainImgWrap.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - _touchStartX;
    const dy = e.touches[0].clientY - _touchStartY;
    if (!_isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      _isSwiping = true;
    }
  }, { passive: true });

  mainImgWrap.addEventListener('touchend', (e) => {
    if (!_isSwiping || _images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(dx) > 40) {
      dx < 0 ? setImage(_imgIndex + 1) : setImage(_imgIndex - 1);
    }
    _isSwiping = false;
  }, { passive: true });

  prevBtn.addEventListener('click', () => setImage(_imgIndex - 1));
  nextBtn.addEventListener('click', () => setImage(_imgIndex + 1));

  /* ---- Description toggle ---- */
  descToggle.addEventListener('click', () => {
    _descExpanded = !_descExpanded;
    descEl.classList.toggle('expanded', _descExpanded);
    descToggle.textContent = _descExpanded ? 'less ▴' : 'more ▾';
  });

  /* ---- Price helpers ---- */
  function getVariantPrice() {
    const product = _product;
    if (!product) return { price: 0, mrp: null };
    if (product.variants && product.variants.length > 0 && _variantIdx < product.variants.length) {
      const v = product.variants[_variantIdx];
      return { price: v.price, mrp: v.mrp || null };
    }
    return { price: product.price, mrp: product.mrp || null };
  }

  function updatePriceDisplay() {
    const { price, mrp } = getVariantPrice();

    // Also factor in sale
    let displayPrice = price;
    let displayMrp = mrp;

    // If global sale is active (from BUNOFEED_DATA)
    const D = window.BUNOFEED_DATA;
    if (D && D.sale && D.sale.active) {
      const endOk = !D.sale.endDate || new Date() <= new Date(D.sale.endDate);
      if (endOk && D.sale.discountPercent > 0) {
        const saleP = Math.round(price * (1 - D.sale.discountPercent / 100));
        if (!displayMrp) displayMrp = price; // original becomes MRP
        displayPrice = saleP;
      }
    }

    priceEl.textContent = `₹${displayPrice}`;

    if (displayMrp && displayMrp > displayPrice) {
      mrpEl.textContent = `₹${displayMrp}`;
      mrpEl.style.display = 'inline';
      const pct = Math.round((1 - displayPrice / displayMrp) * 100);
      discountEl.textContent = `${pct}% off`;
      discountEl.style.display = 'inline';
    } else {
      mrpEl.style.display = 'none';
      discountEl.style.display = 'none';
    }

    updateSubtotal(displayPrice);
    return displayPrice;
  }

  function updateSubtotal(unitPrice) {
    subtotalEl.textContent = `Total: ₹${unitPrice * _qty}`;
  }

  /* ---- Variant buttons ---- */
  function buildVariants(product) {
    variantsRow.innerHTML = '';
    if (!product.variants || product.variants.length <= 1) {
      variantsSection.style.display = 'none';
      return;
    }
    variantsSection.style.display = '';
    product.variants.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.className = 'buno-variant-btn' + (i === 0 ? ' selected' : '');
      btn.textContent = v.label;
      btn.addEventListener('click', () => {
        _variantIdx = i;
        variantsRow.querySelectorAll('.buno-variant-btn').forEach((b, j) => {
          b.classList.toggle('selected', j === i);
        });
        updatePriceDisplay();
      });
      variantsRow.appendChild(btn);
    });
  }

  /* ---- Qty controls ---- */
  qtyMinusEl.addEventListener('click', () => {
    if (_qty > 1) { _qty--; qtyNumEl.textContent = _qty; updatePriceDisplay(); }
  });
  qtyPlusEl.addEventListener('click', () => {
    _qty++; qtyNumEl.textContent = _qty; updatePriceDisplay();
  });

  /* ---- Buy button ---- */
  buyBtn.addEventListener('click', () => {
  if (!_product || !_onBuy) return;

  const { price } = getVariantPrice();
  const D = window.BUNOFEED_DATA;

  let unitPrice = price;

  if (D && D.sale && D.sale.active) {
    const endOk =
      !D.sale.endDate || new Date() <= new Date(D.sale.endDate);

    if (endOk && D.sale.discountPercent > 0) {
      unitPrice = Math.round(
        price * (1 - D.sale.discountPercent / 100)
      );
    }
  }

  // Close product modal first
  closeModal();

  // Prevent checkout opening behind modal
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      _onBuy(_product, _qty, unitPrice);
    });
  });
});

  /* ---- Close ---- */
  function closeModal() {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      _product = null;
    }, 320);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---- Public open function ---- */
  window.BUNO_MODAL = {
    open: function(product, onBuyCallback) {
      if (!product) return;
      _product = product;
      _qty = 1;
      _imgIndex = 0;
      _variantIdx = 0;
      _descExpanded = false;
      _onBuy = onBuyCallback;

      // Set bg class
      imgCol.className = product.bgClass || 'peanut-bg';

      // Gallery
      const allImages = (product.images && product.images.filter(u => u && u.trim()))
        || (product.image ? [product.image] : []);
      buildGallery(allImages);

      // Badges
      let badgesHTML = '';
      const D = window.BUNOFEED_DATA;
      if (product.badge) {
        badgesHTML += `<span class="buno-badge ${product.badgeType || ''}">${product.badge}</span>`;
      }
      const saleActive = D && D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
      if (saleActive) {
        badgesHTML += `<span class="buno-badge sale">${D.sale.label || 'SALE'} ${D.sale.discountPercent}% OFF</span>`;
      }
      document.getElementById('buno-modal-badges').innerHTML = badgesHTML;

      document.getElementById('buno-modal-name').textContent    = product.name;
      document.getElementById('buno-modal-tagline').textContent = product.tagline || '';

      // Description — reset collapse
      descEl.textContent = product.description || '';
      descEl.classList.remove('expanded');
      descToggle.textContent = 'more ▾';
      descToggle.style.display = '';

      // Features
      document.getElementById('buno-modal-features').innerHTML =
        (product.features || []).map(f => `<span class="buno-chip">${f}</span>`).join('');

      // Variants
      buildVariants(product);

      // Price
      qtyNumEl.textContent = '1';
      updatePriceDisplay();

      // Accordion
      const accordionData = [
        { title: 'Ingredients',   body: product.ingredients   || product.description || 'See product label.' },
        { title: 'Key Benefits',  body: product.keyBenefits   || (product.features || []).join(' • ') || 'See product label.' },
        { title: 'Storage Info',  body: product.storageInfo   || 'Store in a cool, dry place.' },
        { title: 'Allergen Info', body: product.allergenInfo  || 'May contain traces of nuts and soy.' },
      ];
      document.getElementById('buno-modal-accordion').innerHTML = accordionData.map((a, i) => `
        <div class="buno-acc-item">
          <button class="buno-acc-head" data-bacc="${i}">
            ${a.title} <i class="fas fa-chevron-down"></i>
          </button>
          <div class="buno-acc-body" data-bacc-body="${i}">${a.body}</div>
        </div>`).join('');

      document.querySelectorAll('.buno-acc-head').forEach(head => {
        head.addEventListener('click', () => {
          const idx  = head.dataset.bacc;
          const body = document.querySelector(`.buno-acc-body[data-bacc-body="${idx}"]`);
          const open = head.classList.toggle('open');
          body.classList.toggle('open', open);
        });
      });

      // View All link — adjust if on index page vs shop page
      const viewAllBtn = document.getElementById('buno-view-all-btn');
      if (viewAllBtn) {
        viewAllBtn.href = window.location.pathname.includes('shop') ? 'shop.html' : 'shop.html';
      }

      // Show overlay
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { overlay.classList.add('visible'); });
      });
    },
    close: closeModal
  };

})();
