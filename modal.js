/**
 * ============================================================
 *  BUNOFEED — Full-Screen Product Modal (modal.js)
 *  Shared by index.html and shop.html
 *  Upgraded with:
 *   - Texture Type variation selector (Dropdown)
 *   - Weight / Size variation selector (Buttons)
 *   - Dynamics prices, original MRP, and savings calculations based on variant combination
 *   - Dynamic naming formatting with selected texture appended in bracket e.g. Name (Smooth)
 *   - CSS Blurred Fullscreen Tap Viewer
 *   - Swipe Galleries both in modal & fullscreen
 *   - Pinch-to-Zoom, Double-Tap Zoom, and Pan
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
      transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    #buno-modal-overlay.open {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.4);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      padding: 1.5rem;
    }
    #buno-modal-overlay.visible {
      background: rgba(15, 8, 4, 0.65);
    }

    #buno-modal {
      display: flex;
      flex-direction: row;
      width: 100%;
      height: 90vh;
      max-height: 750px;
      max-width: 1100px;
      margin: 0 auto;
      background: #fff;
      position: relative;
      will-change: transform, opacity;
      transform: translateY(30px);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      overflow: hidden;
      border-radius: 24px;
      box-shadow: 0 15px 50px rgba(0,0,0,0.22);
    }
    #buno-modal-overlay.visible #buno-modal {
      transform: translateY(0);
      opacity: 1;
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
      cursor: zoom-in;
      position: relative;
      contain: layout paint;
      width: 100%;
      height: 100%;
    }

    #buno-modal-main-img img {
      display: block;
      width: 90%;
      height: 90%;
      object-fit: contain;
      padding: 12px;
      pointer-events: none;
      will-change: transform, opacity;
      transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    #buno-modal-main-img .buno-emoji-display {
      font-size: 8rem;
      line-height: 1;
      pointer-events: none;
      display: inline-block;
      transition: transform 0.3s ease;
    }

    /* Swipe indicator dots */
    #buno-modal-dots {
      display: flex;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      flex-shrink: 0;
      z-index: 2;
    }
    #buno-modal-dots:empty { display: none; }
    .buno-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: rgba(107,45,14,0.2);
      border: none;
      cursor: pointer;
      transition: background 0.25s, transform 0.25s;
      flex-shrink: 0;
      padding: 0;
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
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(255,255,255,0.75);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      border: 1px solid rgba(107,45,14,0.1);
      color: #6B2D0E;
      font-size: 1rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
      transition: opacity 0.2s, background 0.2s, transform 0.2s;
      z-index: 5;
    }
    #buno-modal-img-col:hover .buno-img-nav { opacity: 1; }
    #buno-img-prev { left: 14px; }
    #buno-img-next { right: 14px; }
    .buno-img-nav:hover { background: #fff; transform: translateY(-50%) scale(1.05); }
    .buno-img-nav:active { transform: translateY(-50%) scale(0.95); }

    /* Thumbnail strip optimized for touch swipe */
    #buno-modal-thumbs {
      display: flex;
      gap: 10px;
      padding: 10px 16px;
      overflow-x: auto;
      background: rgba(107,45,14,0.03);
      scrollbar-width: none; /* Hide standard scrollbar */
      flex-shrink: 0;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }
    #buno-modal-thumbs::-webkit-scrollbar { display: none; }
    #buno-modal-thumbs:empty { display: none; }
    .buno-thumb {
      width: 60px; height: 60px;
      border-radius: 12px;
      overflow: hidden;
      flex-shrink: 0;
      border: 2px solid transparent;
      cursor: pointer;
      background: #fff;
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04);
    }
    .buno-thumb:hover { transform: scale(1.04); }
    .buno-thumb.active {
      border-color: #FF6B00;
      box-shadow: 0 4px 12px rgba(255,107,0,0.15);
    }
    .buno-thumb img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }

    /* ---- Content side (right 55%) ---- */
    #buno-modal-body {
      flex: 1;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      padding: 3rem 2.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.3rem;
      scroll-behavior: smooth;
    }

    /* Close button */
    #buno-modal-close {
      position: absolute;
      top: 1.25rem; right: 1.25rem;
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(0,0,0,0.06);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.15rem;
      color: #333;
      z-index: 20;
      transition: background 0.2s, transform 0.2s, color 0.2s;
      -webkit-appearance: none;
    }
    #buno-modal-close:hover { background: rgba(0,0,0,0.12); transform: scale(1.05); }
    #buno-modal-close:active { transform: scale(0.95); }

    /* Badge row */
    #buno-modal-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .buno-badge {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700; font-size: 0.72rem;
      padding: 5px 14px; border-radius: 50px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .buno-badge.bestseller { background: #6B2D0E; color: #fff; }
    .buno-badge.new        { background: #28a745; color: #fff; }
    .buno-badge.limited    { background: #dc3545; color: #fff; }
    .buno-badge.sale       { background: #FF6B00; color: #fff; }

    #buno-modal-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 1.8rem; font-weight: 800;
      color: #1a1a1a; line-height: 1.25;
      margin: 0;
      letter-spacing: -0.02em;
    }
    #buno-modal-tagline {
      font-size: 1rem; color: #FF6B00; font-weight: 600;
      margin: 0;
      font-family: 'Montserrat', sans-serif;
    }

    /* Description with collapse */
    .buno-desc-wrap { position: relative; }
    #buno-modal-desc {
      color: #555; font-size: 0.95rem; line-height: 1.75;
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    #buno-modal-desc.expanded {
      display: block;
      overflow: visible;
      -webkit-line-clamp: unset;
    }
    #buno-desc-toggle {
      background: none; border: none; cursor: pointer;
      color: #FF6B00; font-size: 0.85rem; font-weight: 700;
      font-family: 'Montserrat', sans-serif;
      padding: 4px 0; margin-top: 4px;
      display: inline-block;
      -webkit-appearance: none;
      min-height: 44px; /* tactile touch target */
    }
    #buno-desc-toggle:hover { text-decoration: underline; }

    /* Features */
    #buno-modal-features { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .buno-chip {
      background: rgba(255,107,0,0.08); color: #6B2D0E;
      font-size: 0.8rem; font-family: 'Montserrat', sans-serif; font-weight: 600;
      padding: 6px 14px; border-radius: 50px;
    }

    /* Core Multi-Variant Layout */
    .buno-texture-section {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 0.8rem;
      margin: 4px 0;
    }
    .buno-texture-label {
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 0.88rem;
      color: #1a1a1a;
      white-space: nowrap;
    }
    .modal-texture-select {
      padding: 4px 24px 4px 8px;
      border: 1.5px solid #e0d4cc;
      border-radius: 6px;
      font-family: 'Open Sans', sans-serif;
      font-size: 0.82rem;
      outline: none;
      background: #fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236B2D0E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>") no-repeat right 8px center;
      background-size: 12px;
      appearance: none;
      -webkit-appearance: none;
      color: #1a1a1a;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
      min-height: 32px;
      width: auto;
      max-width: 140px;
    }
    .modal-texture-select:focus {
      border-color: #FF6B00;
      box-shadow: 0 0 0 3px rgba(255,107,0,0.1);
    }

    /* Variant selector */
    .buno-variants-section { display: flex; flex-direction: column; gap: 0.6rem; }
    .buno-variants-label {
      font-family: 'Montserrat', sans-serif; font-weight: 700;
      font-size: 0.88rem; color: #1a1a1a;
    }
    #buno-variants-row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .buno-variant-btn {
      padding: 10px 20px;
      border-radius: 50px;
      border: 2px solid #e0d4cc;
      background: #fff;
      font-family: 'Montserrat', sans-serif; font-weight: 600; font-size: 0.85rem;
      color: #555;
      cursor: pointer;
      transition: border-color 0.2s, background 0.2s, color 0.16s, transform 0.1s;
      -webkit-appearance: none;
      min-height: 44px;
    }
    .buno-variant-btn:hover { border-color: #FF6B00; color: #FF6B00; }
    .buno-variant-btn.selected {
      border-color: #FF6B00; background: #FF6B00; color: #fff;
    }
    .buno-variant-btn:active { transform: scale(0.97); }

    /* Price row */
    .buno-price-row {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
      padding: 1rem 0;
      border-top: 1px solid #f2e8e0;
      border-bottom: 1px solid #f2e8e0;
    }
    #buno-modal-price {
      font-family: 'Montserrat', sans-serif; font-size: 2rem;
      font-weight: 800; color: #000000;
    }
    #buno-modal-mrp {
      font-size: 1.1rem; color: #d32f2f; /* Cutted price in red */
      text-decoration: line-through; font-weight: 600;
      display: none;
    }
    #buno-modal-discount-badge {
      background: #eafbe1; color: #2e7d32;
      font-size: 0.78rem; font-weight: 700;
      font-family: 'Montserrat', sans-serif;
      padding: 4px 12px; border-radius: 50px;
      letter-spacing: 0.02em;
      display: none;
    }

    /* Qty row */
    .buno-qty-row { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .buno-qty-label {
      font-family: 'Montserrat', sans-serif; font-weight: 700;
      font-size: 0.88rem; color: #1a1a1a;
    }
    .buno-qty-control {
      display: flex; align-items: center;
      border: 2px solid #e0d4cc; border-radius: 50px; overflow: hidden;
      background: #fff;
    }
    .buno-qty-btn {
      width: 44px; height: 44px; /* Generous 44px target sizing */
      background: none; border: none; cursor: pointer;
      font-size: 1.3rem; font-weight: 700; color: #1a1a1a;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s;
      -webkit-appearance: none;
    }
    .buno-qty-btn:hover { background: #FFF8F3; }
    .buno-qty-btn:active { background: #fbebd8; }
    #buno-qty-num {
      min-width: 40px; text-align: center;
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 1rem;
    }
    #buno-modal-subtotal {
      font-size: 0.95rem; color: #444; font-weight: 600;
    }

    /* Action buttons with proper tap targets and responsive hierarchy */
    .buno-actions { display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .buno-actions .btn {
      flex: 1;
      min-width: 140px;
      justify-content: center;
      min-height: 48px;
    }

    /* Accordion Custom look */
    .buno-accordion { margin-top: 0.8rem; }
    .buno-acc-item { border-top: 1px solid #f2e8e0; }
    .buno-acc-item:last-child { border-bottom: 1px solid #f2e8e0; }
    .buno-acc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 0; cursor: pointer;
      font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 0.9rem; color: #1a1a1a;
      background: none; border: none; width: 100%; text-align: left;
      -webkit-appearance: none;
      min-height: 44px;
    }
    .buno-acc-head i { transition: transform 0.25s ease; color: #FF6B00; font-size: 0.85rem; }
    .buno-acc-head.open i { transform: rotate(180deg); }
    .buno-acc-body {
      display: none; padding: 0.4rem 0 1.2rem;
      color: #666; font-size: 0.92rem; line-height: 1.7;
      white-space: pre-line;
      animation: accFade 0.2s ease;
    }
    @keyframes accFade {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .buno-acc-body.open { display: block; }

    /* ===== FULL-SCREEN HARDWARE-ACCELERATED pinch-zoom image-viewer ===== */
    #buno-fullscreen-viewer {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10001; /* Must sit completely on top of everything */
      background: rgba(0, 0, 0, 0);
      transition: background 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      touch-action: none; /* stop browser default pull to refresh or gestures */
      user-select: none;
      -webkit-user-select: none;
    }
    #buno-fullscreen-viewer.open {
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(5, 2, 1, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    #buno-fullscreen-close {
      position: absolute;
      top: max(1.25rem, env(safe-area-inset-top));
      right: max(1.25rem, env(safe-area-inset-right));
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
      font-size: 1.25rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.25s, transform 0.2s;
      z-index: 50;
      -webkit-appearance: none;
    }
    #buno-fullscreen-close:hover { background: rgba(255,255,255,0.25); transform: scale(1.05); }
    #buno-fullscreen-close:active { transform: scale(0.95); }

    #buno-fullscreen-img-container {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    #buno-fullscreen-img {
      max-width: 95%;
      max-height: 85%;
      object-fit: contain;
      will-change: transform;
      transform: translate3d(0, 0, 0) scale(1);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      contain: layout paint;
    }

    #buno-fs-prev, #buno-fs-next {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 48px; height: 48px;
      border-radius: 50%;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.1);
      color: #fff;
      font-size: 1.1rem;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.8;
      transition: opacity 0.2s, background 0.2s;
      z-index: 40;
    }
    #buno-fs-prev { left: 16px; }
    #buno-fs-next { right: 16px; }
    #buno-fs-prev:hover, #buno-fs-next:hover { opacity: 1; background: rgba(255,255,255,0.2); }
    
    #buno-fs-index {
      position: absolute;
      bottom: max(1.5rem, env(safe-area-inset-bottom));
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.06);
      color: #fff;
      font-size: 0.85rem;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      padding: 6px 16px;
      border-radius: 50px;
      letter-spacing: 0.05em;
    }

    /* ===== RESPONSIVE BREAKPOINTS ===== */
    @media (max-width: 900px) {
      #buno-modal-overlay.open {
        align-items: flex-end;
        padding: 0;
      }
      #buno-modal {
        flex-direction: column;
        width: 100%;
        height: 100%;
        max-height: 92dvh;
        border-radius: 24px 24px 0 0;
        transform: translateY(100%);
        opacity: 1;
        margin-top: auto;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      #buno-modal-overlay.visible #buno-modal {
        transform: translateY(0);
        opacity: 1;
      }
      #buno-modal-img-col {
        width: 100%;
        flex-shrink: 0;
        height: 380px;
        min-height: unset;
        border-radius: 24px 24px 0 0;
      }
      #buno-modal-main-img img {
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
      #buno-modal-close {
        background: rgba(255, 255, 255, 0.85); /* stand out */
        border: 1px solid rgba(107, 45, 14, 0.1);
        top: 1rem; right: 1rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      }
      #buno-modal-body {
        flex: none;
        padding: 1.8rem 1.5rem 2.2rem;
        overflow-y: visible;
      }
      #buno-modal-name { font-size: 1.45rem; }
      #buno-modal-price { font-size: 1.7rem; }
    }

    @media (max-width: 480px) {
      #buno-modal {
        max-height: 94dvh;
        overflow-y: auto;
      }
      #buno-modal-img-col {
        height: 350px;
        min-height: unset;
      }
      .buno-actions { flex-direction: column; gap: 0.75rem; }
      .buno-actions .btn { flex: unset; width: 100%; }
      #buno-fs-prev, #buno-fs-next { display: none !important; } /* rely entirely on swipes on small mobiles */
    }

    /* Prevent page scroll utility */
    body.buno-lock-scroll {
      overflow: hidden !important;
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
          <div id="buno-modal-main-img" aria-label="Tap to view larger image">
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

          <!-- Texture multi-variant dropdown (Smooth, Crunchy, Crispy, etc.) -->
          <div class="buno-texture-section" id="buno-texture-section" style="display:none">
            <span class="buno-texture-label">Texture / Flavor Type:</span>
            <select class="modal-texture-select" id="buno-texture-select" aria-label="Select texture type"></select>
          </div>

          <!-- Weight/size variation section -->
          <div class="buno-variants-section" id="buno-variants-section" style="display:none">
            <span class="buno-variants-label">Size / Weight:</span>
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
    </div>

    <!-- Full-Screen Pinch-Zoom Multitouch Image Viewer overlay -->
    <div id="buno-fullscreen-viewer" role="dialog" aria-modal="true" aria-label="Fullscreen Image Viewer">
      <button id="buno-fullscreen-close" aria-label="Exit Fullscreen">
        <i class="fas fa-times"></i>
      </button>
      <button id="buno-fs-prev" class="fs-nav-btn" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
      <button id="buno-fs-next" class="fs-nav-btn" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
      <div id="buno-fullscreen-img-container">
        <img id="buno-fullscreen-img" alt="Zoomable active product image" decoding="async" />
      </div>
      <div id="buno-fs-index">1 / 1</div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  /* ===================================================
     MODAL STATE
  =================================================== */
  let _product      = null;
  let _qty          = 1;
  let _imgIndex     = 0;
  let _images       = [];
  let _selectedTexture = '';
  let _selectedSize = '';
  let _onBuy        = null; 
  let _descExpanded = false;

  /* Touch state for swipe & zoom */
  let _swipeStartX = 0;
  let _swipeStartY = 0;
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
  
  const textureSection = document.getElementById('buno-texture-section');
  const textureSelect  = document.getElementById('buno-texture-select');
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

  /* Fullscreen elements */
  const fsViewer   = document.getElementById('buno-fullscreen-viewer');
  const fsImg      = document.getElementById('buno-fullscreen-img');
  const fsClose    = document.getElementById('buno-fullscreen-close');
  const fsPrev     = document.getElementById('buno-fs-prev');
  const fsNext     = document.getElementById('buno-fs-next');
  const fsIndexNum = document.getElementById('buno-fs-index');

  /* PINCH AND PAN STATE FOR FULLSCREEN */
  let _zoomScale = 1;
  let _zoomBaseScale = 1;
  let _panX = 0;
  let _panY = 0;
  let _panStartX = 0;
  let _panStartY = 0;
  let _isDragging = false;
  let _isPinching = false;
  let _lastPinchDistance = 0;
  let _doubleTapTimer = null;

  /* Scroll locking history to prevent body jumping on iOS */
  let _scrollTopHistory = 0;

  function lockBodyScroll() {
    _scrollTopHistory = window.scrollY;
    document.body.classList.add('buno-lock-scroll');
    document.body.style.top = `-${_scrollTopHistory}px`;
  }

  function unlockBodyScroll() {
    if (document.body.classList.contains('buno-lock-scroll')) {
      document.body.classList.remove('buno-lock-scroll');
      document.body.style.top = '';
      window.scrollTo(0, _scrollTopHistory);
    }
  }

  /* ---- Image helpers ---- */
  function setImage(idx, instant) {
    if (!_images.length) return;
    idx = (_images.length + idx) % _images.length;
    _imgIndex = idx;

    const src = _images[idx];

    function showImg(imgEl) {
      mainImgWrap.innerHTML = '';
      mainImgWrap.appendChild(imgEl);
    }

    const currentImg = mainImgWrap.querySelector('img');
    if (instant || !currentImg) {
      const img = new Image();
      img.src = src;
      img.decoding = 'async';
      img.alt = _product ? _product.name : 'Product';
      img.style.opacity = '1';
      showImg(img);
    } else {
      currentImg.style.opacity = '0';
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        img.style.opacity = '0';
        showImg(img);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => { img.style.opacity = '1'; });
        });
      };
      img.onerror = () => {
        mainImgWrap.innerHTML = `<span class="buno-emoji-display" style="transform: scale(0.9)">${_product ? _product.emoji || '🥜' : '🥜'}</span>`;
      };
      img.src = src;
    }

    /* Keep dots up to date */
    dotsEl.querySelectorAll('.buno-dot').forEach((d, i) => {
      d.classList.toggle('active', i === idx);
    });

    /* Highlight thumbnails and center them softly */
    thumbsEl.querySelectorAll('.buno-thumb').forEach((t, i) => {
      t.classList.toggle('active', i === idx);
      if (i === idx) {
        t.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    });

    /* Visible indicators for arrows */
    prevBtn.style.display = _images.length > 1 ? 'flex' : 'none';
    nextBtn.style.display = _images.length > 1 ? 'flex' : 'none';
    
    // Sync fullscreen if opened
    if (fsViewer.classList.contains('open')) {
      resetZoom();
      fsImg.src = src;
      fsIndexNum.textContent = `${_imgIndex + 1} / ${_images.length}`;
      fsPrev.style.display = _images.length > 1 ? 'flex' : 'none';
      fsNext.style.display = _images.length > 1 ? 'flex' : 'none';
    }
  }

  function buildGallery(images) {
    _images = images;
    _imgIndex = 0;

    dotsEl.innerHTML = '';
    if (images.length > 1) {
      images.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'buno-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `View image ${i+1}`);
        dot.addEventListener('click', () => setImage(i));
        dotsEl.appendChild(dot);
      });
    }

    thumbsEl.innerHTML = '';
    if (images.length > 1) {
      images.forEach((src, i) => {
        const t = document.createElement('div');
        t.className = 'buno-thumb' + (i === 0 ? ' active' : '');
        t.innerHTML = `<img src="${src}" alt="Thumb ${i+1}" loading="lazy"/>`;
        t.addEventListener('click', () => setImage(i));
        thumbsEl.appendChild(t);
      });
    }

    if (images.length) {
      setImage(0, true);
    } else {
      mainImgWrap.innerHTML = `<span class="buno-emoji-display" id="buno-modal-emoji" style="transform:scale(1)">${_product ? _product.emoji || '🥜' : '🥜'}</span>`;
      prevBtn.style.display = 'none';
      nextBtn.style.display = 'none';
    }
  }

  /* ---- TOUCH SWIPE IN MODAL GALLERY ---- */
  mainImgWrap.addEventListener('touchstart', (e) => {
    _swipeStartX = e.touches[0].clientX;
    _swipeStartY = e.touches[0].clientY;
    _isSwiping = false;
  }, { passive: true });

  mainImgWrap.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - _swipeStartX;
    const dy = e.touches[0].clientY - _swipeStartY;
    if (!_isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      _isSwiping = true;
    }
  }, { passive: true });

  mainImgWrap.addEventListener('touchend', (e) => {
    if (!_isSwiping || _images.length <= 1) return;
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) {
        setImage(_imgIndex + 1);
      } else {
        setImage(_imgIndex - 1);
      }
    }
    _isSwiping = false;
  }, { passive: true });

  prevBtn.addEventListener('click', () => setImage(_imgIndex - 1));
  nextBtn.addEventListener('click', () => setImage(_imgIndex + 1));

  /* ---- TAP TO OPEN FULLSCREEN EVENT ---- */
  mainImgWrap.addEventListener('click', () => {
    if (_images.length > 0) {
      openFullscreen();
    }
  });

  /* ===================================================
     FULLSCREEN pinch-zoom & double-tap implementation
  =================================================== */
  function openFullscreen() {
    resetZoom();
    fsImg.src = _images[_imgIndex];
    fsIndexNum.textContent = `${_imgIndex + 1} / ${_images.length}`;
    
    fsPrev.style.display = _images.length > 1 ? 'flex' : 'none';
    fsNext.style.display = _images.length > 1 ? 'flex' : 'none';

    fsViewer.classList.add('open');
    requestAnimationFrame(() => {
      fsViewer.style.background = 'rgba(5, 2, 1, 0.95)';
    });

    // Disable gestures on rest of screen
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
  }

  function closeFullscreen() {
    fsViewer.style.background = 'rgba(0, 0, 0, 0)';
    setTimeout(() => {
      fsViewer.classList.remove('open');
      resetZoom();
    }, 280);
    document.removeEventListener('touchmove', preventDefaultTouch);
  }

  function preventDefaultTouch(e) {
    if (fsViewer.classList.contains('open')) {
      e.preventDefault();
    }
  }

  fsClose.addEventListener('click', closeFullscreen);
  fsPrev.addEventListener('click', () => setImage(_imgIndex - 1));
  fsNext.addEventListener('click', () => setImage(_imgIndex + 1));

  function resetZoom() {
    _zoomScale = 1;
    _zoomBaseScale = 1;
    _panX = 0;
    _panY = 0;
    applyViewerTransform();
  }

  function applyViewerTransform() {
    fsImg.style.transform = `translate3d(${_panX}px, ${_panY}px, 0px) scale(${_zoomScale})`;
  }

  /* Pinch Zoom Math */
  function getDistance(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  /* FULLSCREEN MULTITOUCH INPUT HANDLERS */
  const imgContainer = document.getElementById('buno-fullscreen-img-container');

  imgContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      _isDragging = true;
      _panStartX = e.touches[0].clientX - _panX;
      _panStartY = e.touches[0].clientY - _panY;
      
      _swipeStartX = e.touches[0].clientX;
      _swipeStartY = e.touches[0].clientY;
      _isSwiping = false;

      // Handle double tap
      const now = Date.now();
      if (now - _doubleTapTimer < 300) {
        handleDoubleTap(e.touches[0].clientX, e.touches[0].clientY);
        _doubleTapTimer = 0; // consumed
      } else {
        _doubleTapTimer = now;
      }
    } else if (e.touches.length === 2) {
      _isPinching = true;
      _isDragging = false;
      _lastPinchDistance = getDistance(e.touches);
      _zoomBaseScale = _zoomScale;
    }
  }, { passive: true });

  imgContainer.addEventListener('touchmove', (e) => {
    if (_isDragging && _zoomScale > 1) {
      _panX = e.touches[0].clientX - _panStartX;
      _panY = e.touches[0].clientY - _panY;
      
      const maxDragX = (fsImg.clientWidth * _zoomScale - fsImg.clientWidth) / 2;
      const maxDragY = (fsImg.clientHeight * _zoomScale - fsImg.clientHeight) / 2;
      
      _panX = Math.max(-maxDragX - 40, Math.min(maxDragX + 40, _panX));
      _panY = Math.max(-maxDragY - 40, Math.min(maxDragY + 40, _panY));

      requestAnimationFrame(applyViewerTransform);
    } else if (_isDragging && _zoomScale === 1 && _images.length > 1) {
      const dx = e.touches[0].clientX - _swipeStartX;
      const dy = e.touches[0].clientY - _swipeStartY;
      if (!_isSwiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        _isSwiping = true;
      }
    } else if (_isPinching && e.touches.length === 2) {
      const dist = getDistance(e.touches);
      if (_lastPinchDistance > 0) {
        const factor = dist / _lastPinchDistance;
        _zoomScale = Math.max(1, Math.min(4, _zoomBaseScale * factor));
        requestAnimationFrame(applyViewerTransform);
      }
    }
  }, { passive: true });

  imgContainer.addEventListener('touchend', (e) => {
    if (_isDragging && _zoomScale === 1 && _isSwiping) {
      const dx = e.changedTouches[0].clientX - _swipeStartX;
      if (Math.abs(dx) > 50) {
        if (dx < 0) {
          setImage(_imgIndex + 1);
        } else {
          setImage(_imgIndex - 1);
        }
      }
    } else if (_zoomScale > 1) {
      const maxDragX = (fsImg.clientWidth * _zoomScale - fsImg.clientWidth) / 2;
      const maxDragY = (fsImg.clientHeight * _zoomScale - fsImg.clientHeight) / 2;

      let snapped = false;
      if (_panX < -maxDragX) { _panX = -maxDragX; snapped = true; }
      if (_panX > maxDragX) { _panX = maxDragX; snapped = true; }
      if (_panY < -maxDragY) { _panY = -maxDragY; snapped = true; }
      if (_panY > maxDragY) { _panY = maxDragY; snapped = true; }

      if (snapped) {
        fsImg.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        applyViewerTransform();
        setTimeout(() => { fsImg.style.transition = ''; }, 250);
      }
    }
    _isDragging = false;
    _isPinching = false;
    _isSwiping = false;
  }, { passive: true });

  function handleDoubleTap(x, y) {
    fsImg.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
    if (_zoomScale > 1) {
      resetZoom();
    } else {
      _zoomScale = 2.5;
      const rect = fsImg.getBoundingClientRect();
      const clickX = x - (rect.left + rect.width / 2);
      const clickY = y - (rect.top + rect.height / 2);
      _panX = -clickX * 1.2;
      _panY = -clickY * 1.2;
      applyViewerTransform();
    }
    setTimeout(() => { fsImg.style.transition = ''; }, 300);
  }

  /* ---- Description toggle ---- */
  descToggle.addEventListener('click', () => {
    _descExpanded = !_descExpanded;
    descEl.classList.toggle('expanded', _descExpanded);
    descToggle.textContent = _descExpanded ? 'less ▴' : 'more ▾';
  });

  /* ---- Price calculations ---- */
  function getVariantPrice() {
    const product = _product;
    if (!product) return { price: 0, mrp: null, label: '', texture: '' };

    // combination key lookup: texture - size or default - size
    let hasTextures = product.textureVariants && product.textureVariants.length > 0;
    let combinationKey = "";

    if (hasTextures) {
      combinationKey = `${_selectedTexture}-${_selectedSize}`;
    } else {
      combinationKey = `default-${_selectedSize}`;
    }

    const varPriceInfo = product.variantPrices && product.variantPrices[combinationKey];
    if (varPriceInfo) {
      return {
        price: varPriceInfo.price,
        mrp: varPriceInfo.mrp || null,
        label: _selectedSize,
        texture: hasTextures ? _selectedTexture : ''
      };
    }

    // fallback matching for base price structures
    return {
      price: product.price,
      mrp: product.mrp || null,
      label: _selectedSize || product.weight || '',
      texture: hasTextures ? _selectedTexture : ''
    };
  }

  function updatePriceDisplay() {
    const { price, mrp } = getVariantPrice();

    let displayPrice = price;
    let displayMrp = mrp;

    const D = window.BUNOFEED_DATA;
    if (D && D.sale && D.sale.active) {
      const endOk = !D.sale.endDate || new Date() <= new Date(D.sale.endDate);
      if (endOk && D.sale.discountPercent > 0) {
        const saleP = Math.round(price * (1 - D.sale.discountPercent / 100));
        if (!displayMrp) displayMrp = price; 
        displayPrice = saleP;
      }
    }

    priceEl.textContent = `₹${displayPrice}`;

    if (displayMrp && displayMrp > displayPrice) {
      mrpEl.textContent = `₹${displayMrp}`;
      mrpEl.style.display = 'inline';
      const pct = Math.round((1 - displayPrice / displayMrp) * 100);
      discountEl.textContent = `${pct}% OFF`;
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

  /* ---- Variants rendering ---- */
  function buildVariants(product, initialSize) {
    variantsRow.innerHTML = '';
    const sizes = product.sizeVariants || [];
    
    if (sizes.length === 0) {
      variantsSection.style.display = 'none';
      _selectedSize = product.weight || '';
      return;
    }
    
    variantsSection.style.display = '';
    if (initialSize && sizes.includes(initialSize)) {
      _selectedSize = initialSize;
    } else {
      _selectedSize = sizes[0];
    }

    sizes.forEach((size) => {
      const btn = document.createElement('button');
      btn.className = 'buno-variant-btn' + (size === _selectedSize ? ' selected' : '');
      btn.textContent = size;
      btn.addEventListener('click', () => {
        _selectedSize = size;
        variantsRow.querySelectorAll('.buno-variant-btn').forEach((b) => {
          b.classList.toggle('selected', b.textContent === size);
        });
        updatePriceDisplay();
      });
      variantsRow.appendChild(btn);
    });
  }

  /* ---- Textures dropdown building ---- */
  function buildTextures(product, initialTexture) {
    const textures = product.textureVariants || [];
    if (textures.length === 0) {
      textureSection.style.display = 'none';
      _selectedTexture = '';
      return;
    }

    textureSection.style.display = '';
    textureSelect.innerHTML = textures.map(t => `<option value="${t}">${t}</option>`).join('');
    
    // Choose pre-selected if available, else first
    if (initialTexture && textures.includes(initialTexture)) {
      _selectedTexture = initialTexture;
      textureSelect.value = initialTexture;
    } else {
      _selectedTexture = textures[0];
      textureSelect.value = textures[0];
    }

    textureSelect.onchange = () => {
      _selectedTexture = textureSelect.value;
      updatePriceDisplay();
    };
  }

  /* ---- Qty handlers ---- */
  qtyMinusEl.addEventListener('click', () => {
    if (_qty > 1) { _qty--; qtyNumEl.textContent = _qty; updatePriceDisplay(); }
  });
  qtyPlusEl.addEventListener('click', () => {
    _qty++; qtyNumEl.textContent = _qty; updatePriceDisplay();
  });

  /* ---- Buy trigger ---- */
  buyBtn.addEventListener('click', () => {
    if (!_product || !_onBuy) return;

    const { price, label: sizeLabel, texture: textureLabel } = getVariantPrice();
    const D = window.BUNOFEED_DATA;
    let unitPrice = price;

    if (D && D.sale && D.sale.active) {
      const endOk = !D.sale.endDate || new Date() <= new Date(D.sale.endDate);
      if (endOk && D.sale.discountPercent > 0) {
        unitPrice = Math.round(price * (1 - D.sale.discountPercent / 100));
      }
    }

    closeModal();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // dynamic product naming modification: e.g. Dark Chocolate Peanut Butter (900gm, Crunchy)
        let formattedLabel = '';
        const formattedSize = window.BUNO_FORMAT_SIZE(sizeLabel);
        if (formattedSize && textureLabel) {
          formattedLabel = `${formattedSize}, ${textureLabel}`;
        } else if (formattedSize) {
          formattedLabel = formattedSize;
        } else if (textureLabel) {
          formattedLabel = textureLabel;
        }
        
        _onBuy(_product, _qty, unitPrice, formattedLabel);
      });
    });
  });

  /* ---- Closing modal smoothly ---- */
  function closeModal() {
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.classList.remove('open');
      unlockBodyScroll();
      _product = null;
    }, 320);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---- Public API ---- */
  window.BUNO_MODAL = {
    open: function(product, onBuyCallback, initialSelectedTexture, initialSelectedSize) {
      if (!product) return;
      _product = product;
      _qty = 1;
      _imgIndex = 0;
      _descExpanded = false;
      _onBuy = onBuyCallback;

      imgCol.className = product.bgClass || 'peanut-bg';

      const allImages = (product.images && product.images.filter(u => u && u.trim()))
        || (product.image ? [product.image] : []);
      buildGallery(allImages);

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

      descEl.textContent = product.description || '';
      descEl.classList.remove('expanded');
      descToggle.textContent = 'more ▾';
      
      if ((product.description || '').length > 150) {
        descToggle.style.display = 'inline-block';
      } else {
        descToggle.style.display = 'none';
        descEl.style.display = 'block';
      }

      document.getElementById('buno-modal-features').innerHTML =
        (product.features || []).map(f => `<span class="buno-chip">${f}</span>`).join('');

      // Build our modern multi-variant selection widgets
      buildTextures(product, initialSelectedTexture);
      buildVariants(product, initialSelectedSize);

      qtyNumEl.textContent = '1';
      updatePriceDisplay();

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

      const viewAllBtn = document.getElementById('buno-view-all-btn');
      if (viewAllBtn) {
        viewAllBtn.href = 'shop.html';
      }

      overlay.classList.add('open');
      lockBodyScroll();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => { overlay.classList.add('visible'); });
      });
    },
    close: closeModal
  };

})();
