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
        padding: 1rem 1.2rem;
        margin-bottom: 1.5rem;
      }
      .os-header {
        font-family: var(--font-head, 'Montserrat', sans-serif);
        font-size: .78rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: .07em;
        color: #6B2D0E;
        margin-bottom: .7rem;
        display: flex;
        align-items: center;
        gap: .4rem;
      }
      .os-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: .38rem 0;
        border-bottom: 1px dashed #f0e8e0;
        font-size: .83rem;
        gap: .5rem;
      }
      .os-row:last-child { border-bottom: none; }
      .os-row span:first-child { color: #666; flex: 1; }
      .os-row span:last-child { font-family: var(--font-head, 'Montserrat', sans-serif); font-weight: 700; color: #1a1a1a; white-space: nowrap; }
      .os-subtotal span:last-child { color: #6B2D0E; }
      .os-discount span { color: #28a745 !important; }
      .os-tag {
        background: #e8f5e9;
        color: #28a745;
        font-size: .7rem;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        margin-left: .3rem;
      }
      .os-free { color: #28a745; font-weight: 700; }
      .os-saving { font-size: .75rem; color: #28a745; }
      .os-saving span:first-child { color: #28a745; }
      .os-total {
        border-top: 2px solid #e0d4cc !important;
        border-bottom: none !important;
        margin-top: .3rem;
        padding-top: .6rem !important;
      }
      .os-total span { font-size: .95rem !important; color: #4a1e08 !important; }
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

      // New simplified formula:
      // Selling Price = Base Price + GST on Base Price
      const sellingPrice = parseFloat((base * (1 + gst / 100)).toFixed(2));

      // MRP back-calculated so that:  MRP × (1 − discount/100) = Selling Price
      // → MRP = Selling Price / (1 − discount/100)
      const mrp = discount < 100
        ? parseFloat((sellingPrice / (1 - discount / 100)).toFixed(2))
        : sellingPrice;

      // GST amount = GST included in the selling price
      const gstAmount = parseFloat((base * (gst / 100)).toFixed(2));

      return { price: sellingPrice, mrp: mrp, gstRate: gst, gstAmount: gstAmount };
    }

    // Default configuration fallback
    return { price: product.price || 0, mrp: product.mrp || null, gstRate: 0, gstAmount: 0 };
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

  if (bestMatch) return Number(bestMatch.charge) || 0;

  const flatFallback = (D.shipping && D.shipping.flatShippingCharge);
  return typeof flatFallback === 'number' ? flatFallback : 49;
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
        <div class="card-name-block">
          <h3>${product.name}</h3>
          ${product.tagline ? `<p class="card-tagline">${product.tagline}</p>` : ''}
        </div>

        <!-- Real-Time Selectors Grid directly on card -->
        <div class="card-selectors-row">
          <select class="card-select size-card-select" aria-label="Select packing size">
            ${sizeOptions}
          </select>
          <select class="card-select texture-card-select" aria-label="Select texture" style="${hasTextures ? '' : 'display:none;'}">
            ${textureOptions}
          </select>
        </div>

        <div class="card-price-row">
          <div class="product-weight card-computed-weight">${hasTextures ? firstTexture + ' ' : ''}${firstSize || product.weight || ''}</div>
          <div class="price-sale card-computed-pricing">
            ${getPriceMarkup(initialPricing.price, initialPricing.mrp)}
          </div>
        </div>

        <div class="product-card-btns">
          <button class="btn-view-detail c-view-btn" data-id="${product.id}">View Details</button>
          <button class="btn-buy c-buy-btn" data-id="${product.id}">Buy Now</button>
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
      if (!e.target.closest('.c-buy-btn') && !e.target.closest('.c-view-btn') && !e.target.closest('.card-select')) {
        window.location.href = `/product.html?id=${encodeURIComponent(product.id)}`;
      }
    });

    card.querySelector('.c-view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      // Navigate to the dedicated SEO-friendly product page
      window.location.href = `/product.html?id=${encodeURIComponent(product.id)}`;
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
    const itemsSubtotal = baseVal * qty;

    let promotionalDiscountValue = 0;
    if (activeCoupon) {
      if (activeCoupon.discountType === 'percent') {
        promotionalDiscountValue = parseFloat((itemsSubtotal * (activeCoupon.discountValue / 100)).toFixed(2));
      } else {
        promotionalDiscountValue = Math.min(itemsSubtotal, activeCoupon.discountValue);
      }
    }

    const discountedTotal = itemsSubtotal - promotionalDiscountValue;

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
    const subtotalVal = parseFloat((baseVal * qty).toFixed(2));
    let promoDiscount = 0;
    if (activeCoupon) {
      if (activeCoupon.discountType === 'percent') {
        promoDiscount = parseFloat((subtotalVal * (activeCoupon.discountValue / 100)).toFixed(2));
      } else {
        promoDiscount = parseFloat(Math.min(subtotalVal, activeCoupon.discountValue).toFixed(2));
      }
    }
    const discountedTotal = parseFloat((subtotalVal - promoDiscount).toFixed(2));

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
    const grand    = parseFloat((discountedTotal + (shipPending ? 0 : shipAmt)).toFixed(2));
    const varLabel = selectedVariantLabel ? ' (' + selectedVariantLabel + ')' : '';

    // GST breakdown
    let gstRate = 0, gstAmountTotal = 0;
    if (currentProduct && selectedVariantLabel) {
      const _parts = selectedVariantLabel.split(' ');
      const _sz = _parts[_parts.length - 1];
      const _tx = _parts.length > 1 ? _parts.slice(0, _parts.length - 1).join(' ') : 'Default';
      const _pi = parseComboPrice(currentProduct, _sz, _tx);
      gstRate = _pi.gstRate || 0;
      gstAmountTotal = parseFloat(((_pi.gstAmount || 0) * qty).toFixed(2));
    }

    // Shipping note for the user
    const freeAbove = (D.shipping && D.shipping.freeShippingAbove) || 499;

    let rows = '';
    rows += '<div class="os-row"><span>Product' + varLabel + '</span><span>₹' + baseVal.toFixed(2) + '</span></div>';
    rows += '<div class="os-row"><span>Quantity</span><span>× ' + qty + '</span></div>';
    rows += '<div class="os-row os-subtotal"><span>Subtotal (incl. GST)</span><span>₹' + subtotalVal.toFixed(2) + '</span></div>';
    if (gstRate > 0 && gstAmountTotal > 0) {
      rows += '<div class="os-row" style="color:#999;font-size:.78rem;"><span>GST (' + gstRate + '%) included above</span><span style="color:#999;">₹' + gstAmountTotal.toFixed(2) + '</span></div>';
    }
    if (promoDiscount > 0 && activeCoupon) {
      const dLabel = activeCoupon.discountType === 'percent' ? activeCoupon.discountValue + '% off' : 'Flat ₹' + activeCoupon.discountValue;
      rows += '<div class="os-row os-discount"><span>Coupon (' + activeCoupon.code + ') <span class="os-tag">' + dLabel + '</span></span><span>− ₹' + promoDiscount.toFixed(2) + '</span></div>';
    }
    if (shipPending) {
      rows += '<div class="os-row"><span>Shipping' + (packSize ? ' (' + packSize + ')' : '') + '</span><span style="color:#999;font-style:italic;">Enter pincode</span></div>';
    } else {
      rows += '<div class="os-row"><span>Shipping' + (packSize ? ' (' + packSize + ')' : '') + '</span><span>' + (freeShip ? '<span class="os-free">FREE</span>' : '₹' + shipAmt.toFixed(2)) + '</span></div>';
      if (freeShip && discountedTotal < freeAbove) {
        rows += '<div class="os-row os-saving"><span>Free shipping on orders ≥ ₹' + freeAbove + '</span><span></span></div>';
      }
    }
    rows += '<div class="os-row os-total"><span>Total Payable</span><span>₹' + grand.toFixed(2) + (shipPending ? ' + shipping' : '') + '</span></div>';

    return '<div class="order-summary-box" id="order-summary-box"><div class="os-header"><i class="fas fa-receipt" aria-hidden="true"></i> Order Summary</div>' + rows + '</div>';
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
    openCheckoutModal();
  });

  // Also expose imperatively for direct calls from product.html
  window.BUNO_OPEN_CHECKOUT = function (product, q, price, label) {
    currentProduct        = product;
    qty                   = q || 1;
    selectedUnitPrice     = price;
    selectedVariantLabel  = label || '';
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
      const subtotalVal = baseVal * qty;

      let promotionalDiscountValue = 0;
      if (activeCoupon) {
        if (activeCoupon.discountType === 'percent') {
          promotionalDiscountValue = parseFloat((subtotalVal * (activeCoupon.discountValue / 100)).toFixed(2));
        } else {
          promotionalDiscountValue = Math.min(subtotalVal, activeCoupon.discountValue);
        }
      }

      const discountedTotal = subtotalVal - promotionalDiscountValue;
      // Resolve shipping using entered pincode + selected pack size from sheet rules
      const packSizeParts2 = selectedVariantLabel ? selectedVariantLabel.split(' ') : [];
      const packSize2      = packSizeParts2.length > 0 ? packSizeParts2[packSizeParts2.length - 1] : '';
      const shippingAmt    = resolveShippingCharge(pincode, packSize2, discountedTotal);
      const grandTotalCombined = parseFloat((discountedTotal + shippingAmt).toFixed(2));

      const orderId = generateOrderId();
      const chosenTag = selectedVariantLabel ? `${currentProduct.name} - ${selectedVariantLabel}` : currentProduct.name;

      // Compute GST for invoice fields
      const _gstForPayload = (() => {
        if (!currentProduct || !selectedVariantLabel) return { rate: 0, amt: 0 };
        const _p = selectedVariantLabel.split(' ');
        const _sz = _p[_p.length - 1];
        const _tx = _p.length > 1 ? _p.slice(0, _p.length - 1).join(' ') : 'Default';
        const _pi = parseComboPrice(currentProduct, _sz, _tx);
        return { rate: _pi.gstRate || 0, amt: parseFloat(((_pi.gstAmount || 0) * qty).toFixed(2)) };
      })();

      const orderPayload = {
        order_id: orderId,
        date_time: new Date().toLocaleString('en-IN'),
        customer_name: name,
        phone_number: phone,
        email: email,
        address: address,
        pincode: pincode,
        product_id: currentProduct.id,
        product_name: chosenTag,
        quantity: qty,
        product_price: baseVal,
        total_amount: grandTotalCombined,
        promo_code: activeCoupon ? activeCoupon.code : '',
        promo_discount_amount: promotionalDiscountValue,
        payment_id: '',
        payment_status: 'Pending',
        // ── Invoice fields ──
        hsn_code: currentProduct.hsnCode || '',
        discount: 0,                              // product-level discount already in price
        coupon_discount: promotionalDiscountValue,
        shipping_charges: shippingAmt,
        gst_rate: _gstForPayload.rate,
        gst_amount: _gstForPayload.amt,
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
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${orderPayload.payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}&subtotal=${orderPayload.product_price * quantity}&shipping=${shippingAmt}&promo_discount=${orderPayload.promo_discount_amount}&gst_rate=${gstInfo.rate}&gst_amount=${gstInfo.amt}`;
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
      amount: grandTotal * 100,
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
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}&subtotal=${orderPayload.product_price * quantity}&shipping=${shippingAmt}&promo_discount=${orderPayload.promo_discount_amount}&gst_rate=${gstInfo.rate}&gst_amount=${gstInfo.amt}`;
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
