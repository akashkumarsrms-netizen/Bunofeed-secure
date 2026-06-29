/**
 * ============================================================
 *  BUNOFEED — Main Application Logic (script.js)
 *  - Reads data from products.js (window.BUNOFEED_DATA)
 *  - Dynamically builds product cards with live option dropdowns
 *  - Automatically recalculates prices in real-time on select changes
 *  - Manages secure checkout, serviceable pincodes, and promo codes
 *  - Coordinates return and cancellation updates
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // Inject order summary styles once
  if (!document.getElementById('buno-summary-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'buno-summary-styles';
    styleEl.textContent = `
      .order-summary-box {
        background: #fffaf7;
        border: 1px solid #e0d4cc;
        border-radius: 12px;
        padding: .9rem 1.2rem;
        margin-bottom: 1.5rem;
      }
      .os-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: .42rem 0;
        font-size: .9rem;
        gap: .5rem;
      }
      .os-row span:first-child { color: #555; flex: 1; }
      .os-row span:last-child { font-family: var(--font-head, 'Montserrat', sans-serif); font-weight: 700; color: #1a1a1a; white-space: nowrap; }
      .os-discount span:first-child { color: #28a745 !important; }
      .os-discount span:last-child  { color: #28a745 !important; }
      .os-free { color: #28a745; font-weight: 700; }
      .os-divider { border: none; border-top: 1.5px solid #d4c4b8; margin: .35rem 0; }
      .os-total {
        padding-top: .5rem !important;
      }
      .os-total span:first-child { color: #1a1a1a !important; font-weight: 700; font-size: .95rem; }
      .os-total span:last-child   { color: #6B2D0E !important; font-size: 1.08rem !important; font-weight: 800 !important; }
    `;
    document.head.appendChild(styleEl);
  }

    const D = window.BUNOFEED_DATA;
  if (!D) { console.error('BUNOFEED_DATA not found. Is products.js loaded?'); return; }

  /* ----------------------------------------------------------
     CAMPAIGN BANNER SYSTEM
  ---------------------------------------------------------- */
  const banner = document.getElementById('campaign-banner');
  if (banner && D.campaign && D.campaign.active) {
    const expired = D.campaign.expiryDate && new Date() > new Date(D.campaign.expiryDate);
    if (!expired) {
      banner.style.display = 'block';
      banner.style.background = D.campaign.bgColor || '#FF6B00';
      banner.style.color      = D.campaign.textColor || '#fff';

      let html = `<span>${D.campaign.text}</span>`;
      if (D.campaign.link && D.campaign.linkText) {
        html += `<a href="${D.campaign.link}" target="_blank" rel="noopener noreferrer" style="color:${D.campaign.textColor||'#fff'}">${D.campaign.linkText}</a>`;
      }
      html += `<button id="banner-close" style="color:${D.campaign.textColor||'#fff'}" aria-label="Close banner">✕</button>`;
      banner.innerHTML = html;

      document.getElementById('banner-close').addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }
  }

  /* ----------------------------------------------------------
     HERO SEGMENTS SYNCHRONIZER
  ---------------------------------------------------------- */
  if (D.hero) {
    const h = D.hero;
    const sub   = document.getElementById('hero-sub');
    const title = document.getElementById('hero-title');
    const desc  = document.getElementById('hero-desc');
    if (sub)   sub.textContent   = h.subtitle;
    if (title) title.innerHTML   = `${h.title}<br/><span class="hero-highlight">${h.titleHighlight}</span>`;
    if (desc)  desc.textContent  = h.description;

    const cta = document.getElementById('hero-cta');
    if (cta) {
      cta.textContent = h.ctaText;
      cta.href = h.ctaLink;
    }

    if (h.image) {
      const wrap = document.querySelector('.hero-img-wrap');
      if (wrap) {
        wrap.innerHTML = `<img class="hero-photo" src="${h.image}" alt="Bunofeed Hero" loading="eager"/>`;
        document.querySelector('.hero-image').style.display = 'flex';
      }
    }
  }

  /* ----------------------------------------------------------
     PRICE ENGINE CALCULATOR TOOL
  ---------------------------------------------------------- */
  function parseComboPrice(product, sizeLabel, textureLabel) {
    const pricing = product.pricing;
    const comboKey = textureLabel ? `${textureLabel}_${sizeLabel}` : `Default_${sizeLabel}`;
    const combo = pricing && pricing[comboKey];

    if (combo) {
      const base     = parseFloat(combo.basePrice) || 0;
      const gst      = parseFloat(combo.gst)       || 0;
      const discount = parseFloat(combo.discount)  || 0;

      // ── CORRECT pricing order (matches admin engine & checkout) ──
      // 1. Apply product-level discount to base price first
      const discountedBase = parseFloat((base * (1 - discount / 100)).toFixed(4));
      // 2. Apply GST on the discounted base → this is the selling price (incl. GST)
      const sellingPrice   = parseFloat((discountedBase * (1 + gst / 100)).toFixed(2));
      // 3. MRP = base + GST on base (undiscounted price, shown as strikethrough)
      const mrp = discount > 0
        ? parseFloat((base * (1 + gst / 100)).toFixed(2))
        : null;

      // GST amount on the discounted base (before any coupon)
      const gstAmount = parseFloat((discountedBase * (gst / 100)).toFixed(2));

      return {
        price:     sellingPrice,   // selling price incl. GST (after product discount)
        mrp:       mrp,            // undiscounted price incl. GST (for strikethrough)
        gstRate:   gst,
        gstAmount: gstAmount,      // GST on discounted base
        basePrice: base,           // raw base price (excl. GST, excl. discount)
        discountedBase: discountedBase  // base after product discount, before GST
      };
    }

    // Default configuration fallback
    return { price: product.price || 0, mrp: product.mrp || null, gstRate: 0, gstAmount: 0, basePrice: product.price || 0, discountedBase: product.price || 0 };
  }

  /**
   * PRICE CALCULATION HELPER — discount-before-GST
   * Given a per-unit selling price (incl. GST) and a coupon, computes:
   *   1. Extract base price from selling price
   *   2. Apply coupon discount to base price
   *   3. Re-apply GST on the discounted base
   * Returns { discountedUnitPrice, unitGstAmount, unitDiscount }
   */
  /**
   * applyDiscountThenGst
   *  sellingPricePerUnit = price AFTER product-level discount, incl. GST
   *                        (output of parseComboPrice().price)
   *  gstRate             = GST % for this variant
   *  coupon              = coupon object (or null)
   *  qty                 = quantity
   *
   *  Coupon applies on the ALREADY-DISCOUNTED base (product discount already baked
   *  into sellingPricePerUnit).  Flow:
   *    1. Extract discounted-base per unit  = sellingPrice / (1 + gstRate/100)
   *    2. Multiply by qty for total discounted-base
   *    3. Apply coupon on that total discounted-base
   *    4. Re-apply GST on final base after coupon
   */
  function applyDiscountThenGst(sellingPricePerUnit, gstRate, coupon, qty) {
    // Back-calculate product-discounted base (pre-GST, pre-coupon) from selling price
    const basePerUnit  = parseFloat((sellingPricePerUnit / (1 + gstRate / 100)).toFixed(4));
    const baseSubtotal = parseFloat((basePerUnit * qty).toFixed(2));  // discounted base × qty

    let discountOnBase = 0;
    if (coupon) {
      if (coupon.discountType === 'percent') {
        discountOnBase = parseFloat((baseSubtotal * (coupon.discountValue / 100)).toFixed(2));
      } else {
        discountOnBase = parseFloat(Math.min(baseSubtotal, coupon.discountValue).toFixed(2));
      }
    }

    const discountedBase  = parseFloat((baseSubtotal - discountOnBase).toFixed(2));
    const gstOnDiscounted = parseFloat((discountedBase * (gstRate / 100)).toFixed(2));
    const payableSubtotal = parseFloat((discountedBase + gstOnDiscounted).toFixed(2));

    return {
      baseSubtotal,          // product-discounted base × qty (pre-coupon, pre-GST)
      discountOnBase,        // coupon savings (in rupees, on base)
      discountedBase,        // base after coupon
      gstOnDiscounted,       // GST on base after all discounts (actual GST charged)
      payableSubtotal,       // what customer pays (excl. shipping)
      gstRate,
    };
  }

  /* ----------------------------------------------------------
     SHIPPING RULES — fetched from Google Sheets on page load
     Sheet: "Pin code and Shipping Charges"
     Columns: A=Pin Code | B=Weight/Pack size | C=Shipping charges
     Rules are cached after the first fetch and used synchronously
     so the UI stays responsive even while the sheet fetch is in flight.
  ---------------------------------------------------------- */
  let _shippingRules        = null;   // null = not yet fetched
  let _shippingFetchDone    = false;
  let _shippingFetchPromise = null;   // prevents duplicate parallel fetches

  async function fetchShippingRules() {
    if (_shippingFetchDone) return _shippingRules;
    if (_shippingFetchPromise) return _shippingFetchPromise;

    _shippingFetchPromise = (async () => {
      try {
        const result = await window.BUNOFEED_API.get('lookupShipping', {});
        if (result && result.status === 'success' && Array.isArray(result.rules)) {
          _shippingRules = result.rules;
        } else {
          _shippingRules = [];
        }
      } catch (err) {
        _shippingRules = [];
      }
      _shippingFetchDone = true;
      // Once rules arrive, refresh summary if checkout modal is open
      if (document.getElementById('order-summary-box') && currentProduct) {
        injectOrUpdateOrderSummary();
        refreshCheckoutCalculation();
      }
      return _shippingRules;
    })();

    return _shippingFetchPromise;
  }

  // Kick off immediately so rules are ready before the customer opens checkout
  fetchShippingRules();

  /* ----------------------------------------------------------
     SHIPPING CHARGE RESOLVER  (synchronous — uses cached sheet rules)
     Priority: exact pin + exact size > wildcard pin + exact size >
               exact pin + wildcard size > full wildcard > free fallback.
     packSize is normalised (lowercase, spaces stripped) so
     "400 g", "400G", and "400g" all match each other.
  ---------------------------------------------------------- */
function resolveShippingCharge(pincode, packSize, orderTotal) {

  const freeAbove = Number((D.shipping && D.shipping.freeShippingAbove) || 499);
  if (orderTotal >= freeAbove) return 0;

  const rules = _shippingRules || [];

  // Normalise size: lowercase, no spaces, unify unit suffixes, then ALSO
  // strip the unit entirely so "400g" matches a sheet entry of just "400"
  function normSize(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/grams?$/, 'g')
      .replace(/gm$/, 'g');
  }
  // Extract just the numeric part (e.g. "400g" → "400", "400" → "400")
  function numericPart(s) {
    return s.replace(/[a-z]+$/, '');
  }

  const pinStr  = String(pincode || '').trim();
  const sizeNorm = normSize(packSize);           // e.g. "400g"
  const sizeNum  = numericPart(sizeNorm);        // e.g. "400"

  let bestMatch = null;
  let bestScore = -1;

  for (const rule of rules) {
    const rPin  = String(rule.pincode || '').trim();
    const rSizeNorm = normSize(rule.packSize);   // e.g. "400" or "500g"
    const rSizeNum  = numericPart(rSizeNorm);    // e.g. "400" or "500"

    const pinWild  = rPin === '*' || rPin.toLowerCase() === 'all';
    const sizeWild = rSizeNorm === '*' || rSizeNorm === 'all';

    const pinMatch  = pinWild || rPin.split(',').map(x => x.trim()).includes(pinStr);
    // Match if full normalised strings equal, OR if numeric parts equal
    const sizeMatch = sizeWild || rSizeNorm === sizeNorm || rSizeNum === sizeNum;

    if (!pinMatch || !sizeMatch) continue;

    // Higher score for more specific matches
    const score = (!pinWild ? 2 : 0) + (!sizeWild ? 2 : 0);
    if (score > bestScore) { bestScore = score; bestMatch = rule; }
  }

  const baseCharge = bestMatch ? (Number(bestMatch.charge) || 0) : (() => {
    const flatFallback = (D.shipping && D.shipping.flatShippingCharge);
    return typeof flatFallback === 'number' ? flatFallback : 49;
  })();

  // Apply shipping GST if set
  const shipGst = (D.shipping && D.shipping.gstRate) ? Number(D.shipping.gstRate) : 0;
  if (baseCharge === 0 || shipGst === 0) return baseCharge;
  return parseFloat((baseCharge * (1 + shipGst / 100)).toFixed(2));
}

  

  /* ----------------------------------------------------------
     PRICE HTML GENERATOR
  ---------------------------------------------------------- */
  function getPriceMarkup(price, mrp) {
    if (mrp && mrp > price) {
      const pct = Math.round((1 - price / mrp) * 100);
      return `
        <span class="price-current">₹${price.toFixed(2)}</span>
        <span class="price-old">₹${mrp.toFixed(2)}</span>
        <span class="price-save-tag">${pct}% off</span>`;
    }
    return `<span class="price-original">₹${price.toFixed(2)}</span>`;
  }

  /* ----------------------------------------------------------
     BUILD PRODUCT CARDS (UNIFIED DYNAMIC ENGINE)
     - Renders custom dropdown selectors directly on product cards
     - Real-time updates prices instantly on change
  ---------------------------------------------------------- */
  window.BUILD_PRODUCT_CARD_ELEMENT = function(product) {
    let badgeHTML = '';
    if (product.badge) {
      const cls = product.badgeType === 'new' ? ' new' : product.badgeType === 'limited' ? ' limited' : product.badgeType === 'bestseller' ? ' bestseller' : '';
      badgeHTML = `<div class="product-badge${cls}">${product.badge}</div>`;
    }

    const imgHTML = product.image
      ? `<img class="product-photo" src="${product.image}" loading="lazy" decoding="async" alt="${product.name}"/>`
      : `<span class="product-emoji">${product.emoji || '🥜'}</span>`;

    const card = document.createElement('div');
    card.className = 'product-card reveal visible';
    card.dataset.id = product.id;

    // Sizes elements configuration
    const sizes = product.allowedSizes || (product.variants ? product.variants.map(v => v.label) : [product.weight || '500g']);
    const textures = product.allowedTextures || ["Default"];
    const hasTextures = textures.some(t => t.toLowerCase() !== 'default') && textures.length > 1;

    // Initial default calculation values
    const firstSize = sizes[0] || '';
    const firstTexture = hasTextures ? textures[0] : 'Default';
    const initialPricing = parseComboPrice(product, firstSize, hasTextures ? firstTexture : 'Default');

    // Build Select menus string
    let sizeOptions = sizes.map(sz => `<option value="${sz}">${sz}</option>`).join('');
    let textureOptions = textures.map(tx => `<option value="${tx}">${tx}</option>`).join('');

    card.innerHTML = `
      ${badgeHTML}
      <div class="product-img ${product.bgClass || ''}">
        ${imgHTML}
      </div>
      <div class="product-info">
        <div class="card-name-block" style="margin-bottom:0.5rem;">
          <h3 style="font-size:1.05rem;line-height:1.3;">${product.name}</h3>
        </div>

        <!-- Real-Time Selectors Grid directly on card -->
        <div class="card-selectors-row" style="margin-bottom:0.45rem;">
          <select class="card-select size-card-select" aria-label="Select packing size">
            ${sizeOptions}
          </select>
          <select class="card-select texture-card-select" aria-label="Select texture" style="${hasTextures ? '' : 'display:none;'}">
            ${textureOptions}
          </select>
        </div>

        <div class="card-price-row" style="margin-bottom:0.5rem;">
          <div class="product-weight card-computed-weight">${hasTextures ? firstTexture + ' ' : ''}${firstSize || product.weight || ''}</div>
          <div class="price-sale card-computed-pricing">
            ${getPriceMarkup(initialPricing.price, initialPricing.mrp)}
          </div>
        </div>

        <div class="product-card-btns">
          <button class="btn-buy c-buy-btn" data-id="${product.id}" style="width:100%;flex:1;">Buy Now</button>
        </div>
      </div>`;

    // Connect real-time calculation triggers on dropdown changes
    const sSelect = card.querySelector('.size-card-select');
    const tSelect = card.querySelector('.texture-card-select');
    const priceDisplay = card.querySelector('.card-computed-pricing');
    const weightDisplay = card.querySelector('.card-computed-weight');

    function executePriceRecalculation() {
      const sz = sSelect.value;
      const tx = hasTextures ? tSelect.value : 'Default';
      const recalculated = parseComboPrice(product, sz, tx);

      priceDisplay.innerHTML = getPriceMarkup(recalculated.price, recalculated.mrp);
      weightDisplay.textContent = `${hasTextures ? tx + ' ' : ''}${sz}`;
    }

    sSelect.addEventListener('change', executePriceRecalculation);
    tSelect.addEventListener('change', executePriceRecalculation);

    // Clicking the card body navigates to the product page
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.c-buy-btn') && !e.target.closest('.card-select')) {
        window.location.href = `/product.html?id=${encodeURIComponent(product.id)}`;
      }
    });

    card.querySelector('.c-buy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const sz = sSelect.value;
      const tx = hasTextures ? tSelect.value : 'Default';
      const finalPricing = parseComboPrice(product, sz, tx);

      currentProduct = product;
      qty = 1;
      selectedUnitPrice = finalPricing.price;
      selectedVariantLabel = `${hasTextures ? tx + ' ' : ''}${sz}`;

      // ── GA4: Buy Now click from product card ──
      if (typeof gtag === 'function') {
        gtag('event', 'buy_now_click', {
          event_category: 'ecommerce',
          product_id: product.id,
          product_name: product.name,
          variant: selectedVariantLabel,
          price: finalPricing.price,
          source: 'product_card'
        });
      }

      openCheckoutModal();
    });

    return card;
  };

  /* ----------------------------------------------------------
     RENDER BEST SELLERS HOMEPAGE GRID
  ---------------------------------------------------------- */
  const grid = document.getElementById('products-grid');
  if (grid && D.products) {
    grid.innerHTML = '';
    D.products.filter(p => p.visible !== false && p.bestSeller === true).forEach(p => {
      const card = window.BUILD_PRODUCT_CARD_ELEMENT(p);
      grid.appendChild(card);
    });
    initRevealObserver();
  }

  /* ----------------------------------------------------------
     DETAIL POPUP TRIGGERS
  ---------------------------------------------------------- */
  let currentProduct = null;
  let qty = 1;
  let selectedUnitPrice = null;
  let selectedVariantLabel = '';

  function openProductModal(id) {
    const product = (D.products || []).find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    qty = 1;
    selectedUnitPrice = null;
    selectedVariantLabel = '';

    if (window.BUNO_MODAL) {
      window.BUNO_MODAL.open(product, (pObj, quantity, calculatedPrice, variantLabel) => {
        currentProduct = pObj;
        qty = quantity;
        selectedUnitPrice = calculatedPrice;
        selectedVariantLabel = variantLabel || '';
        openCheckoutModal();
      });
    }
  }
  window.BUNO_OPEN_MODAL = openProductModal;

  /* ----------------------------------------------------------
     SCROLL REVEAL BINDINGS
  ---------------------------------------------------------- */
  function initRevealObserver() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  document.querySelectorAll('.product-card, .why-stat-card, .feature-item').forEach(el => {
    el.classList.add('reveal');
  });
  initRevealObserver();

  /* ----------------------------------------------------------
     COUPON / PROMO CODE ENGINE INTEGRATION (CHECKOUT MODAL)
  ---------------------------------------------------------- */
  let activeCoupon = null;
  const couponInput = document.getElementById('coupon-code');
  const applyCouponBtn = document.getElementById('apply-coupon-btn');
  const couponMsg = document.getElementById('coupon-msg');

  if (applyCouponBtn && couponInput) {
    applyCouponBtn.addEventListener('click', () => {
      const typed = couponInput.value.trim().toUpperCase();
      couponMsg.textContent = '';
      couponMsg.style.color = '';
      activeCoupon = null;

      if (!typed) {
        couponMsg.textContent = 'Please enter a coupon code first.';
        couponMsg.style.color = '#dc3545';
        refreshCheckoutCalculation();
        return;
      }

      // Search coupons pool inside products.js window.BUNOFEED_DATA.coupons
      const matched = (D.coupons || []).find(c => c.code.toUpperCase() === typed);

      if (!matched) {
        couponMsg.textContent = 'Invalid coupon code.';
        couponMsg.style.color = '#dc3545';
        refreshCheckoutCalculation();
        return;
      }

      // Scope validation: specific product vs allproducts
      if (matched.scope === 'specific' && currentProduct && matched.productId !== currentProduct.id) {
        couponMsg.textContent = 'This code is not applicable on the selected product.';
        couponMsg.style.color = '#dc3545';
        refreshCheckoutCalculation();
        return;
      }

      // Applied successfully!
      activeCoupon = matched;
      couponMsg.style.color = '#28a745';
      
      let discountText = matched.discountType === 'percent' 
        ? `${matched.discountValue}% discount applied!` 
        : `₹${matched.discountValue} discount applied!`;
      
      couponMsg.textContent = `Applied! ${discountText}`;
      refreshCheckoutCalculation();
    });
  }

  function refreshCheckoutCalculation() {
    if (!currentProduct) return;
    const baseVal = selectedUnitPrice !== null ? selectedUnitPrice : currentProduct.price;

    // Get GST rate for the current variant
    let gstRate = 0;
    if (selectedVariantLabel) {
      const _parts = selectedVariantLabel.split(' ');
      const _sz = _parts[_parts.length - 1];
      const _tx = _parts.length > 1 ? _parts.slice(0, _parts.length - 1).join(' ') : 'Default';
      gstRate = (parseComboPrice(currentProduct, _sz, _tx).gstRate) || 0;
    }

    // Apply coupon to base price, then recompute GST on discounted base
    const calc = applyDiscountThenGst(baseVal, gstRate, activeCoupon, qty);
    const promotionalDiscountValue = calc.discountOnBase;
    const discountedTotal = calc.payableSubtotal;

    // Only resolve shipping when pincode is a complete 6-digit value AND rules are loaded.
    // Partial pincode → no match → would incorrectly show FREE.
    const pincodeInput   = document.getElementById('cust-pincode');
    const enteredPincode = pincodeInput ? pincodeInput.value.trim() : '';
    const pinComplete    = /^\d{6}$/.test(enteredPincode);
    const packSizeParts  = selectedVariantLabel ? selectedVariantLabel.split(' ') : [];
    const packSize       = packSizeParts.length > 0 ? packSizeParts[packSizeParts.length - 1] : '';

    let shippingAmt  = 0;
    let shipPending  = !pinComplete || !_shippingFetchDone;
    if (!shipPending) {
      shippingAmt = resolveShippingCharge(enteredPincode, packSize, discountedTotal);
    }
    const grandTotalValue = discountedTotal + shippingAmt;

    injectOrUpdateOrderSummary();
    const proceedBtn = document.getElementById('proceed-pay-btn');
    if (proceedBtn) {
      const discountLabel = promotionalDiscountValue > 0 ? ` (₹${promotionalDiscountValue.toFixed(2)} discount applied)` : '';
      let shippingLabel;
      if (shipPending) {
        shippingLabel = ' (+ shipping)';
      } else if (shippingAmt > 0) {
        shippingLabel = ` (+₹${shippingAmt.toFixed(2)} shipping)`;
      } else {
        shippingLabel = ' (Free Shipping)';
      }
      proceedBtn.textContent = `Pay ₹${grandTotalValue.toFixed(2)}${discountLabel}${shippingLabel}`;
    }
  }

  /* ----------------------------------------------------------
     CHECKOUT INITIATOR & ORDER SUBMIT PIPELINE
  ---------------------------------------------------------- */
  let orderProcessingState = false;

  const checkoutOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutForm    = document.getElementById('checkout-form');
  const checkoutClose   = document.getElementById('checkout-close-btn');

  function buildOrderSummaryHTML() {
    if (!currentProduct) return '';
    const baseVal = selectedUnitPrice !== null ? selectedUnitPrice : currentProduct.price;

    // Determine GST rate from the selected variant
    let gstRate = 0;
    if (currentProduct && selectedVariantLabel) {
      const _parts = selectedVariantLabel.split(' ');
      const _sz = _parts[_parts.length - 1];
      const _tx = _parts.length > 1 ? _parts.slice(0, _parts.length - 1).join(' ') : 'Default';
      gstRate = (parseComboPrice(currentProduct, _sz, _tx).gstRate) || 0;
    }

    // Core calculation: discount on base price, then GST on discounted base
    const calc = applyDiscountThenGst(baseVal, gstRate, activeCoupon, qty);
    const promoDiscount    = calc.discountOnBase;
    const discountedTotal  = calc.payableSubtotal;  // incl. GST on discounted base
    const gstAmountTotal   = calc.gstOnDiscounted;
    const subtotalVal      = parseFloat((baseVal * qty).toFixed(2)); // original selling price × qty

    // Resolve shipping: only run resolver on a complete 6-digit pincode.
    // A partial pincode would produce no match → incorrectly show FREE.
    const pincodeInput   = document.getElementById('cust-pincode');
    const enteredPincode = pincodeInput ? pincodeInput.value.trim() : '';
    const pinComplete    = /^\d{6}$/.test(enteredPincode);
    const packSizeParts  = selectedVariantLabel ? selectedVariantLabel.split(' ') : [];
    const packSize       = packSizeParts.length > 0 ? packSizeParts[packSizeParts.length - 1] : '';

    // Only resolve if pincode is complete AND rules have loaded
    let shipAmt = 0;
    let shipPending = false;
    if (!pinComplete) {
      shipPending = true; // Waiting for customer to finish entering pincode
    } else if (!_shippingFetchDone) {
      shipPending = true; // Rules still loading from sheet
    } else {
      shipAmt = resolveShippingCharge(enteredPincode, packSize, discountedTotal);
    }

    const freeShip = !shipPending && shipAmt === 0;
    const grand    = Math.round((discountedTotal + (shipPending ? 0 : shipAmt)) * 100) / 100;
    const varLabel = selectedVariantLabel ? ' (' + selectedVariantLabel + ')' : '';

    // Shipping note for the user
    const freeAbove = (D.shipping && D.shipping.freeShippingAbove) || 499;

    // Extract pricing combo details: gstRate, product-level discount %, raw base price
    let gstRateDisplay = 0;
    let productDiscountPct = 0;
    let rawBasePerUnit = baseVal;
    if (currentProduct && selectedVariantLabel) {
      const _dp = selectedVariantLabel.split(' ');
      const _ds = _dp[_dp.length - 1];
      const _dt = _dp.length > 1 ? _dp.slice(0, _dp.length - 1).join(' ') : 'Default';
      const comboData    = parseComboPrice(currentProduct, _ds, _dt);
      gstRateDisplay     = comboData.gstRate    || 0;
      rawBasePerUnit     = comboData.basePrice   || baseVal;
      const discBase     = comboData.discountedBase || rawBasePerUnit;
      productDiscountPct = rawBasePerUnit > 0 ? Math.round((1 - discBase / rawBasePerUnit) * 100) : 0;
    }

    // Discounted base per unit (excl. GST) — back-calculated from selling price
    const discountedBasePerUnit = gstRateDisplay > 0
      ? parseFloat((baseVal / (1 + gstRateDisplay / 100)).toFixed(2))
      : baseVal;
    const productDiscSavingTotal = parseFloat(((rawBasePerUnit - discountedBasePerUnit) * qty).toFixed(2));
    const mrpSubtotalExclGst     = parseFloat((rawBasePerUnit * qty).toFixed(2));
    const baseSubtotalExclGst    = parseFloat((discountedBasePerUnit * qty).toFixed(2));

    // ── Simple GST-inclusive 4-line summary ──────────────────────
    const itemTotalIncl     = parseFloat((baseVal * qty).toFixed(2));
    const mrpInclGst        = rawBasePerUnit > 0 && gstRateDisplay > 0
      ? parseFloat((rawBasePerUnit * (1 + gstRateDisplay / 100)).toFixed(2))
      : rawBasePerUnit;
    // All discount savings in GST-inclusive terms
    const productDiscIncl   = productDiscountPct > 0
      ? parseFloat(((mrpInclGst - baseVal) * qty).toFixed(2)) : 0;
    const promoDiscIncl     = promoDiscount > 0
      ? parseFloat((promoDiscount * (1 + gstRateDisplay / 100)).toFixed(2)) : 0;
    const totalDiscIncl     = parseFloat((productDiscIncl + promoDiscIncl).toFixed(2));
    const productTotalIncl  = parseFloat((itemTotalIncl - totalDiscIncl).toFixed(2));

    let rows = '';

    // Line 1: Product name + variant (MRP incl. GST × qty)
    const priceLineVal   = parseFloat(((mrpInclGst > 0 ? mrpInclGst : baseVal) * qty).toFixed(2));
    const productName    = currentProduct.name || 'Product';
    const variantSuffix  = selectedVariantLabel ? ' (' + selectedVariantLabel + ')' : '';
    rows += '<div class="os-row"><span>' + productName + variantSuffix + '</span><span>\u20b9' + priceLineVal.toFixed(2) + '</span></div>';

    // Line 2: Product Discount (if any)
    if (productDiscIncl > 0) {
      rows += '<div class="os-row os-discount"><span>Product Discount (' + productDiscountPct + '%)</span><span>\u2212 \u20b9' + productDiscIncl.toFixed(2) + '</span></div>';
    }

    // Line 3: Coupon (if any) — format: Coupon (CODE)
    if (promoDiscIncl > 0 && activeCoupon) {
      rows += '<div class="os-row os-discount"><span>Coupon (' + activeCoupon.code + ')</span><span>\u2212 \u20b9' + promoDiscIncl.toFixed(2) + '</span></div>';
    }

    // Line 4: Product Total (after all discounts, incl. GST, before shipping)
    rows += '<div class="os-row os-subtotal"><span>Product Total</span><span>\u20b9' + productTotalIncl.toFixed(2) + '</span></div>';

    // Line 5: Shipping (Incl. GST)
    if (shipPending) {
      rows += '<div class="os-row"><span>Shipping (Incl. GST)</span><span style="color:#999;font-style:italic;font-size:.8rem;font-weight:400;">Enter pincode</span></div>';
    } else {
      rows += '<div class="os-row"><span>Shipping (Incl. GST)</span><span>' + (freeShip ? '<span class="os-free">FREE</span>' : '\u20b9' + shipAmt.toFixed(2)) + '</span></div>';
    }

    // Divider
    rows += '<hr class="os-divider"/>';

    // Line 6: Total Payable
    rows += '<div class="os-row os-total"><span>Total Payable</span><span>\u20b9' + grand.toFixed(2) + (shipPending ? '<span style="font-size:.75rem;font-weight:400;color:#999;"> + shipping</span>' : '') + '</span></div>';
        return '<div class="order-summary-box" id="order-summary-box">' + rows + '</div>';
  }

  function injectOrUpdateOrderSummary() {
    if (!checkoutOverlay) return;
    const form = document.getElementById('checkout-form');
    if (!form) return;
    const html = buildOrderSummaryHTML();
    const existing = document.getElementById('order-summary-box');
    if (existing) {
      existing.outerHTML = html;
    } else {
      // Place summary just above the "Proceed to Pay" button
      const payBtn = document.getElementById('proceed-pay-btn');
      if (payBtn) {
        payBtn.insertAdjacentHTML('beforebegin', html);
      } else {
        form.insertAdjacentHTML('beforeend', html);
      }
    }
  }

  function openCheckoutModal() {
    if (!currentProduct) return;
    checkoutOverlay.classList.add('open');
    if (couponInput) couponInput.value = '';
    if (couponMsg) couponMsg.textContent = '';
    activeCoupon = null;
    injectOrUpdateOrderSummary();
    refreshCheckoutCalculation();
  }

  /* ----------------------------------------------------------
     PUBLIC CHECKOUT HOOK — used by product.html (PDP page)
     product.html dispatches 'bunofeed:openCheckout' with the
     chosen product / qty / price / label so the same Razorpay
     pipeline runs without duplicating code.
  ---------------------------------------------------------- */
  document.addEventListener('bunofeed:openCheckout', function (e) {
    const { product, qty: q, price, label } = e.detail || {};
    if (!product) return;
    currentProduct        = product;
    qty                   = q || 1;
    selectedUnitPrice     = price;
    selectedVariantLabel  = label || '';

    // ── GA4: Buy Now click from product detail page ──
    if (typeof gtag === 'function') {
      gtag('event', 'buy_now_click', {
        event_category: 'ecommerce',
        product_id: product.id,
        product_name: product.name,
        variant: label || '',
        price: price,
        source: 'product_detail_page'
      });
    }

    openCheckoutModal();
  });

  // Also expose imperatively for direct calls from product.html
  window.BUNO_OPEN_CHECKOUT = function (product, q, price, label) {
    currentProduct        = product;
    qty                   = q || 1;
    selectedUnitPrice     = price;
    selectedVariantLabel  = label || '';

    // ── GA4: Buy Now click via direct BUNO_OPEN_CHECKOUT call ──
    if (typeof gtag === 'function') {
      gtag('event', 'buy_now_click', {
        event_category: 'ecommerce',
        product_id: product.id,
        product_name: product.name,
        variant: label || '',
        price: price,
        source: 'direct_call'
      });
    }

    openCheckoutModal();
  };

  function closeCheckoutModal() {
    checkoutOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);

  // Live-refresh shipping when pincode changes.
  // Only recalculate once a full 6-digit pincode is entered so partial
  // typing never triggers a no-match that incorrectly shows free shipping.
  const pincodeEl = document.getElementById('cust-pincode');
  if (pincodeEl) {
    pincodeEl.addEventListener('input', async () => {
      if (!currentProduct) return;
      const val = pincodeEl.value.trim();
      // Partial entry — re-render summary but do not run shipping resolver yet
      if (val.length !== 6 || !/^\d{6}$/.test(val)) {
        injectOrUpdateOrderSummary();
        return;
      }
      // Full pincode typed — wait for sheet rules if still loading, then refresh
      if (!_shippingFetchDone) {
        await fetchShippingRules();
      }
      refreshCheckoutCalculation();
    });
  }

  function generateOrderId() {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
    return 'ORD' + Date.now() + rand;
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (orderProcessingState) return;

      const name     = document.getElementById('cust-name').value.trim();
      const phone    = document.getElementById('cust-phone').value.trim();
      const email    = document.getElementById('cust-email').value.trim();
      const address  = document.getElementById('cust-address').value.trim();
      const pincode  = document.getElementById('cust-pincode').value.trim();

      // Reset validation triggers
      document.querySelectorAll('.error-msg').forEach(el => el.style.display = 'none');

      let isValid = true;
      if (!name) { document.getElementById('name-error').style.display = 'block'; isValid = false; }
      if (!/^\d{10}$/.test(phone)) { document.getElementById('phone-error').style.display = 'block'; isValid = false; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('email-error').style.display = 'block'; isValid = false; }
      if (!address) { document.getElementById('address-error').style.display = 'block'; isValid = false; }
      if (!/^\d{6}$/.test(pincode)) { document.getElementById('pincode-error').style.display = 'block'; isValid = false; }

      // Pincode serviceable list validator
      const pincodes = D.serviceablePincodes || [];
      if (isValid && pincodes.length > 0 && !pincodes.includes(pincode)) {
        const errorElement = document.getElementById('pincode-error');
        errorElement.textContent = 'Sorry, we do not deliver to this pincode yet. Accepted: ' + pincodes.join(', ');
        errorElement.style.display = 'block';
        isValid = false;
      }

      if (!isValid) return;

      orderProcessingState = true;
      const proceedBtn = document.getElementById('proceed-pay-btn');
      proceedBtn.disabled = true;
      proceedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Initializing Gateway...';

      // Ensure sheet shipping rules are loaded before computing final total.
      // fetchShippingRules() is a no-op if already fetched (returns cached rules).
      await fetchShippingRules();

      // Computations
      const baseVal = selectedUnitPrice !== null ? selectedUnitPrice : currentProduct.price;

      // Resolve GST rate for the current variant
      let _gstRateForSubmit = 0;
      if (selectedVariantLabel) {
        const _p2 = selectedVariantLabel.split(' ');
        const _sz2 = _p2[_p2.length - 1];
        const _tx2 = _p2.length > 1 ? _p2.slice(0, _p2.length - 1).join(' ') : 'Default';
        _gstRateForSubmit = (parseComboPrice(currentProduct, _sz2, _tx2).gstRate) || 0;
      }

      // Apply coupon to base, then GST on discounted base
      const _submitCalc = applyDiscountThenGst(baseVal, _gstRateForSubmit, activeCoupon, qty);
      const promotionalDiscountValue = _submitCalc.discountOnBase;
      const discountedTotal = _submitCalc.payableSubtotal;
      // Resolve shipping using entered pincode + selected pack size from sheet rules
      const packSizeParts2 = selectedVariantLabel ? selectedVariantLabel.split(' ') : [];
      const packSize2      = packSizeParts2.length > 0 ? packSizeParts2[packSizeParts2.length - 1] : '';
      const shippingAmt    = resolveShippingCharge(pincode, packSize2, discountedTotal);
      // Round to 2 decimal places first, then ensure integer paise for Razorpay (no floating-point drift)
      const grandTotalCombined = Math.round((discountedTotal + shippingAmt) * 100) / 100;

      const orderId = generateOrderId();
      const chosenTag = selectedVariantLabel ? `${currentProduct.name} - ${selectedVariantLabel}` : currentProduct.name;

      // ── Pre-compute all invoice column values here so Apps Script does zero re-derivation ──

      // Get combo pricing data for this variant (same source used by checkout UI)
      let _rawBasePerUnit      = baseVal;  // fallback: selling price per unit (incl. GST)
      let _discountedBasePerUnit = baseVal;
      let _productDiscountPct  = 0;
      if (selectedVariantLabel) {
        const _pb = selectedVariantLabel.split(' ');
        const _sb = _pb[_pb.length - 1];
        const _tb = _pb.length > 1 ? _pb.slice(0, _pb.length - 1).join(' ') : 'Default';
        const _combo = parseComboPrice(currentProduct, _sb, _tb);
        _rawBasePerUnit       = _combo.basePrice       || baseVal;
        _discountedBasePerUnit = _combo.discountedBase || _rawBasePerUnit;
        // Compute product discount % from the actual base/discountedBase values,
        // regardless of whether GST is applied (fixes incorrect 0% when gstRate was 0)
        _productDiscountPct   = (_rawBasePerUnit > 0 && _discountedBasePerUnit < _rawBasePerUnit)
          ? parseFloat(((1 - _discountedBasePerUnit / _rawBasePerUnit) * 100).toFixed(4))
          : 0;
      }

      const _gstRateInv   = _gstRateForSubmit;

      // col L — Base Price excl. GST × qty  (raw, before any discount)
      const _inv_basePriceTotal   = parseFloat((_rawBasePerUnit * qty).toFixed(2));

      // col M — Product Discount amount (rupees, excl. GST)
      const _inv_productDisc      = parseFloat(((_rawBasePerUnit - _discountedBasePerUnit) * qty).toFixed(2));

      // col N — Coupon Discount (rupees, on discounted base, pre-GST) = what _submitCalc gives
      const _inv_couponDisc       = parseFloat(promotionalDiscountValue.toFixed(2));

      // col O — Net Taxable Value = discounted base × qty − coupon discount
      const _inv_netTaxable       = parseFloat((_discountedBasePerUnit * qty - _inv_couponDisc).toFixed(2));

      // col P — GST Amount on product = GST on net taxable value
      const _inv_gstAmt           = parseFloat((_inv_netTaxable * _gstRateInv / 100).toFixed(2));

      // col Q — Product Total = net taxable + GST
      const _inv_productTotal     = parseFloat((_inv_netTaxable + _inv_gstAmt).toFixed(2));

      // Shipping split
      const _shipGstRate    = (D.shipping && D.shipping.gstRate !== undefined) ? Number(D.shipping.gstRate) : 0;
      const _inv_shipExclGst = _shipGstRate > 0
        ? parseFloat((shippingAmt / (1 + _shipGstRate / 100)).toFixed(2))
        : shippingAmt;
      const _inv_shipGstAmt  = parseFloat((shippingAmt - _inv_shipExclGst).toFixed(2));

      const _gstForPayload = {
        rate: _gstRateInv,
        amt:  _inv_gstAmt,
      };

      const orderPayload = {
        order_id:       orderId,
        date_time:      new Date().toLocaleString('en-IN'),
        customer_name:  name,
        phone_number:   phone,
        email:          email,
        address:        address,
        pincode:        pincode,
        product_id:     currentProduct.id,
        product_name:   chosenTag,
        quantity:       qty,
        product_price:  baseVal,              // selling price per unit (incl. GST, after product discount)
        base_price:     _rawBasePerUnit,      // raw base per unit (excl. GST, excl. all discounts)
        total_amount:   grandTotalCombined,
        promo_code:     activeCoupon ? activeCoupon.code : '',
        promo_discount_amount: promotionalDiscountValue,
        payment_id:     '',
        payment_status: 'Pending',

        // ── Pre-computed invoice columns (Apps Script writes these directly) ──
        hsn_code:             currentProduct.hsnCode || '',
        gst_rate:             _gstRateInv,
        gst_amount:           _inv_gstAmt,            // col P
        base_price_total:     _inv_basePriceTotal,    // col L — base × qty
        product_discount_amt: _inv_productDisc,       // col M — product disc rupees
        coupon_discount:      _inv_couponDisc,        // col N — coupon disc rupees (pre-GST)
        net_taxable_value:    _inv_netTaxable,        // col O
        product_total:        _inv_productTotal,      // col Q
        shipping_charges:     shippingAmt,            // col T — shipping incl. GST
        shipping_excl_gst:    _inv_shipExclGst,       // col R
        shipping_gst_amt:     _inv_shipGstAmt,        // col S
        shipping_gst_rate:    _shipGstRate,
      };

      // Create Order Entry Statically or locally on Express database file
      try {
        await window.BUNOFEED_API.post('createOrder', orderPayload);
      } catch (err) {
        console.error('Local JSON order synchronization failed:', err);
      }

      executeRazorpayGateway(currentProduct, qty, grandTotalCombined, shippingAmt, orderPayload, chosenTag, _gstForPayload);
    });
  }

  function launchSuccessFullscreenOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'redirect-overlay';
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'background:rgba(255,255,255,0.97)',
      'display:flex', 'flex-direction:column',
      'align-items:center', 'justify-content:center', 'gap:1.2rem'
    ].join(";");
    overlay.innerHTML = `
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#28a745,#20c753);display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;">
        <i class="fas fa-check"></i>
      </div>
      <p style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:1.2rem;color:#2c1a0e;margin:0;">Payment Approved!</p>
      <p style="font-family:'Open Sans',sans-serif;font-size:.92rem;color:#7a6155;margin:0;">Generating packaging log details...</p>
      <div style="width:36px;height:36px;border:3px solid #f0e8e0;border-top-color:#FF6B00;border-radius:50%;animation:spin .8s linear infinite;"></div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(overlay);
  }

  function executeRazorpayGateway(product, quantity, grandTotal, shippingAmt, orderPayload, displayTitle, gstInfo) {
    gstInfo = gstInfo || { rate: 0, amt: 0 };
    const rzpKey = D.payment && D.payment.razorpayKeyId;

    if (!rzpKey || rzpKey.includes('PASTE_YOUR') || rzpKey.includes('rzp_test_XXXX')) {
      alert('⚠️ Razorpay Live API key not set. Initializing local sandbox checkout order summary!');
      orderPayload.payment_status = 'Paid (Test Local)';
      orderPayload.payment_id = 'SANDBOX_' + Date.now();
      
      window.BUNOFEED_API.post('createOrder', orderPayload).then(() => {
        closeCheckoutModal();
        launchSuccessFullscreenOverlay();
        setTimeout(() => {
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${orderPayload.payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}&subtotal=${orderPayload.product_price * quantity}&shipping=${shippingAmt}&promo_discount=${orderPayload.promo_discount_amount}&gst_rate=${gstInfo.rate}&gst_amount=${gstInfo.amt}&mrp_unit=${orderPayload.base_price}&coupon_val=${activeCoupon ? activeCoupon.discountValue : ""}&coupon_type=${activeCoupon ? activeCoupon.discountType : ""}`;
        }, 1200);
      });
      return;
    }

    if (typeof Razorpay === 'undefined') {
      alert('Razorpay payment libraries not accessible. Initializing local checkout bypass.');
      resetPayButton();
      return;
    }

    const config = {
      key: rzpKey,
      amount: Math.round(grandTotal * 100),
      currency: D.payment.currency || 'INR',
      name: D.payment.businessName || 'Bunofeed',
      description: `${displayTitle} × ${quantity}${shippingAmt > 0 ? ` + ₹${shippingAmt} delivery` : ' (Free Shipping!)'}`,
      image: D.payment.logoUrl || '',
      theme: { color: D.payment.themeColor || '#FF6B00' },
      prefill: {
        name: orderPayload.customer_name,
        email: orderPayload.email,
        contact: orderPayload.phone_number
      },
      handler: async function (response) {
        closeCheckoutModal();
        launchSuccessFullscreenOverlay();

        orderPayload.payment_id = response.razorpay_payment_id;
        orderPayload.payment_status = 'Paid';

        try {
          await window.BUNOFEED_API.post('createOrder', orderPayload);
        } catch (err) {
          console.error('Finalizing order record update failed:', err);
        }

        setTimeout(() => {
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}&subtotal=${orderPayload.product_price * quantity}&shipping=${shippingAmt}&promo_discount=${orderPayload.promo_discount_amount}&gst_rate=${gstInfo.rate}&gst_amount=${gstInfo.amt}&mrp_unit=${orderPayload.base_price}&coupon_val=${activeCoupon ? activeCoupon.discountValue : ""}&coupon_type=${activeCoupon ? activeCoupon.discountType : ""}`;
        }, 1200);
      },
      modal: {
        ondismiss: function () {
          orderPayload.payment_status = 'Dismissed';
          window.BUNOFEED_API.post('createOrder', orderPayload);
          resetPayButton();
        }
      }
    };

    const rzp = new Razorpay(config);
    rzp.on('payment.failed', function (resp) {
      orderPayload.payment_id = (resp.error.metadata && resp.error.metadata.payment_id) || ('FAIL-' + Date.now());
      orderPayload.payment_status = 'Failed';
      window.BUNOFEED_API.post('createOrder', orderPayload);
      alert('Checkout failed! ' + resp.error.description);
      resetPayButton();
    });
    rzp.open();
  }

  function resetPayButton() {
    orderProcessingState = false;
    const btn = document.getElementById('proceed-pay-btn');
    if (btn) {
      btn.disabled = false;
      refreshCheckoutCalculation();
    }
  }

  /* ----------------------------------------------------------
     MOBILE NAVIGATION TOGGLE
  ---------------------------------------------------------- */
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.classList.toggle('active', open);
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  /* ----------------------------------------------------------
     BRAND FEED COORDINATION
  ---------------------------------------------------------- */
  if (D.brand) {
    const b = D.brand;
    document.querySelectorAll('[data-social]').forEach(el => {
      const urlKey = el.getAttribute('data-social');
      if (b[urlKey]) el.href = b[urlKey];
    });
    document.querySelectorAll('[data-email]').forEach(el => {
      el.href = `mailto:${b.email}`;
      if (!el.textContent.trim() || el.textContent.includes('bunofeed')) el.textContent = b.email;
    });
    document.querySelectorAll('[data-feedback-link]').forEach(el => {
      el.href = b.feedbackFormUrl;
    });
  }

});
