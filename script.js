/**
 * ============================================================
 *  BUNOFEED — Main Script (script.js)
 *  - Reads data from products.js (window.BUNOFEED_DATA)
 *  - Renders best-seller products on homepage
 *  - Supports realtime texture and size selectors on cards
 *  - Upgrades Precheckout modal with complete dynamic split totals (HSN/GST, shipping, coupons)
 *  - Triggers Razorpay gateways cleanly
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  const D = window.BUNOFEED_DATA;
  if (!D) { console.error('BUNOFEED_DATA not found. Is products.js loaded?'); return; }

  /* Initialize fallback coupons arrays if they do not exist */
  if (!D.coupons) {
    D.coupons = [
      { "code": "BUNO10", "type": "all", "discountType": "percentage", "discountValue": 10 },
      { "code": "HEALTH20", "type": "all", "discountType": "percentage", "discountValue": 20 },
      { "code": "CREAMY50", "type": "specific", "productId": "creamy-pb", "discountType": "flat", "discountValue": 50 }
    ];
  }

  /* ----------------------------------------------------------
     CAMPAIGN BANNER
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
     HERO SECTION — dynamic text + image
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
     SALE helper
  ---------------------------------------------------------- */
  const saleActive  = D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
  const discountPct = saleActive ? (D.sale.discountPercent || 0) : 0;
  function salePrice(p) {
    return saleActive && discountPct > 0 ? Math.round(p * (1 - discountPct / 100)) : null;
  }

  /* ----------------------------------------------------------
     DYNAMIC VARIANT CALCULATOR (MATCHING ADVANCE PRICING ENGINE)
  ---------------------------------------------------------- */
  function calculateVariantPrice(variant, productDefaultPrice) {
    if (!variant) return { price: productDefaultPrice, mrp: null };
    // If the variant comes loaded with advance pricing variables:
    if (typeof variant.basePrice !== 'undefined') {
      const base = parseFloat(variant.basePrice) || 0;
      const profit = parseFloat(variant.profit) || 0;
      const discount = parseFloat(variant.discount) || 0;
      const gst = parseFloat(variant.gst) || 0;

      // Sales Price Formula: Base * (1 + Profit/100) * (1 - Discount/100) * (1 + GST/100)
      const salesPrice = Math.round(base * (1 + profit / 100) * (1 - discount / 100) * (1 + gst / 100));
      // MRP Formula: Base * (1 + Profit/100) * (1 + GST/100)
      const mrp = Math.round(base * (1 + profit / 100) * (1 + gst / 100));

      return {
        price: salesPrice,
        mrp: mrp > salesPrice ? mrp : null,
        gstPercent: gst,
        appliedDiscountPercent: discount
      };
    }
    // Fallback traditional price/mrp mapping
    return {
      price: variant.price,
      mrp: variant.mrp || null,
      gstPercent: 18, // standard fallback
      appliedDiscountPercent: 0
    };
  }

  /* ----------------------------------------------------------
     PRICE HTML helper (supports MRP strikethrough)
  ---------------------------------------------------------- */
  function buildPriceHTML(product, customVariant = null) {
    const defaultPrice = { price: product.price, mrp: product.mrp || null };
    const vPrice = customVariant ? calculateVariantPrice(customVariant, product.price) : defaultPrice;

    const sp = salePrice(vPrice.price);
    const mrp = vPrice.mrp;
    const finalWeight = customVariant ? customVariant.label : (product.weight || '');

    if (sp) {
      return `
        <div class="product-price">
          <div class="product-weight">${finalWeight}</div>
          <div class="price-sale">
            <span class="price-current">₹${sp}</span>
            <span class="price-old">₹${vPrice.price}</span>
          </div>
        </div>`;
    } else if (mrp && mrp > vPrice.price) {
      const pct = Math.round((1 - vPrice.price / mrp) * 100);
      return `
        <div class="product-price">
          <div class="product-weight">${finalWeight}</div>
          <div class="price-sale">
            <span class="price-current">₹${vPrice.price}</span>
            <span class="price-old">₹${mrp}</span>
            <span class="price-save-tag">${pct}% off</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="product-price">
          <div class="product-weight">${finalWeight}</div>
          <div class="price-original">₹${vPrice.price}</div>
        </div>`;
    }
  }

  /* ----------------------------------------------------------
     BUILD DYNAMIC SELECTORS ON CARD AND BIND ACTIONS
  ---------------------------------------------------------- */
  function buildCardSelectorsHTML(p) {
    const variants = p.variants || [];
    const sizes = Array.from(new Set(variants.map(v => v.label).filter(Boolean)));
    const finalSizes = sizes.length > 0 ? sizes : [p.weight || '500g'];
    const types = ['Crunchy', 'Crispy', 'Smooth'];

    let html = `<div class="card-selectors" style="display:flex; gap:6px; margin: 4px 0 8px 0; width:100%;" onclick="event.stopPropagation();">`;

    // Dropdown for pack size
    html += `
      <select class="card-select size-select" data-id="${p.id}" style="font-size:0.75rem; padding:4px 18px 4px 6px; border:1.5px solid #e0d4cc; border-radius:6px; color:#6B2D0E; font-weight:700; background:#fff; flex:1; height:32px; cursor:pointer; outline:none;">
        ${finalSizes.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>`;

    // Dropdown for type
    html += `
      <select class="card-select type-select" data-id="${p.id}" style="font-size:0.75rem; padding:4px 18px 4px 6px; border:1.5px solid #e0d4cc; border-radius:6px; color:#6B2D0E; font-weight:700; background:#fff; flex:1; height:32px; cursor:pointer; outline:none;">
        ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
      </select>`;

    html += `</div>`;
    return html;
  }

  function getSelectedVariantFromCard(card, product) {
    const variants = product.variants || [];
    if (variants.length === 0) return null;

    const sizeSelect = card.querySelector('.size-select');
    const chosenSize = sizeSelect ? sizeSelect.value : (variants[0] ? variants[0].label : '');

    let matched = variants.find(v => v.label === chosenSize);
    return matched || variants[0];
  }

  function updateCardPriceRealtime(card, product) {
    const matched = getSelectedVariantFromCard(card, product);
    const priceContainer = card.querySelector('.product-price');
    if (priceContainer && matched) {
      priceContainer.outerHTML = buildPriceHTML(product, matched);
    }
  }

  /* ----------------------------------------------------------
     RENDER BEST-SELLER CARDS (homepage)
  ---------------------------------------------------------- */
  const grid = document.getElementById('products-grid');
  if (grid && D.products) {
    grid.innerHTML = '';

    D.products.filter(p => p.visible !== false && p.bestSeller === true).forEach(product => {

      let badgeHTML = '';
      if (product.badge) {
        const cls = product.badgeType === 'new' ? ' new' : product.badgeType === 'limited' ? ' limited' : '';
        badgeHTML = `<div class="product-badge${cls}">${product.badge}</div>`;
      }
      if (saleActive) {
        badgeHTML += `<div class="sale-ribbon">${D.sale.label || 'SALE'} ${discountPct}% OFF</div>`;
      }

      const imgHTML = product.image
        ? `<img class="product-photo" src="${product.image}" loading="lazy" decoding="async" alt="${product.name}"/>`
        : `<span class="product-emoji">${product.emoji || '🥜'}</span>`;

      const card = document.createElement('div');
      card.className = 'product-card reveal';
      card.dataset.id = product.id;
      card.style.cursor = 'pointer';
      card.innerHTML = `
        ${badgeHTML}
        <div class="product-img ${product.bgClass || ''}">
          ${imgHTML}
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          ${buildCardSelectorsHTML(product)}
          <div class="product-footer">
            ${buildPriceHTML(product, product.variants && product.variants[0])}
            <button class="btn-buy buy-now-btn" data-id="${product.id}" style="padding: 10px 24px; font-size: 0.85rem; font-weight:700; border-radius:30px; min-height:40px; margin-left: auto;">Buy Now</button>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    /* Bind real-time change triggers on home page selects */
    grid.querySelectorAll('.product-card').forEach(card => {
      const selectors = card.querySelectorAll('.card-select');
      const product = (D.products || []).find(p => p.id === card.dataset.id);
      selectors.forEach(select => {
        select.addEventListener('change', () => {
          updateCardPriceRealtime(card, product);
        });
      });

      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-buy') && !e.target.closest('.card-select')) {
          openProductModal(card.dataset.id);
        }
      });
    });

    grid.querySelectorAll('.buy-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.product-card');
        const product = (D.products || []).find(p => p.id === btn.dataset.id);
        if (product) {
          currentProduct = product;
          qty = 1;

          const chosenVar = getSelectedVariantFromCard(card, product);
          let calcPriceObj = calculateVariantPrice(chosenVar, product.price);
          selectedUnitPrice = salePrice(calcPriceObj.price) || calcPriceObj.price;
          
          const sizeSelect = card.querySelector('.size-select');
          const typeSelect = card.querySelector('.type-select');
          const chosenSize = sizeSelect ? sizeSelect.value : (product.weight || '500g');
          const chosenType = typeSelect ? typeSelect.value : 'Crunchy';

          selectedVariantLabel = `${chosenSize} - ${chosenType}`;

          openCheckoutModal();
        }
      });
    });

    initReveal();
  }

  /* ----------------------------------------------------------
     OPEN PRODUCT DETAIL MODAL (uses window.BUNO_MODAL)
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
      window.BUNO_MODAL.open(product, (prod, quantity, unitPrice, variantLabel) => {
        currentProduct = prod;
        qty = quantity;
        selectedUnitPrice = unitPrice;
        selectedVariantLabel = variantLabel || '';
        openCheckoutModal();
      });
    }
  }
  window.BUNO_OPEN_MODAL = openProductModal;

  /* ----------------------------------------------------------
     SCROLL REVEAL ANIMATIONS
  ---------------------------------------------------------- */
  function initReveal() {
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
  initReveal();

  /* ----------------------------------------------------------
     CHECKOUT CONTROLLER (WITH DYNAMIC SUMMARIES + CUSTOM COUOPONS)
  ---------------------------------------------------------- */
  let isProcessing = false;
  let appliedCoupon = null;
  let currentShippingCharge = 0;
  let isShippingCalculated = false;

  function generateOrderId() {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
    return 'ORD' + Date.now() + rand;
  }

  async function syncLocalOrder(orderData) {
    if (!window.BUNOFEED_API) return;
    try {
      await window.BUNOFEED_API.post('createOrder', orderData);
    } catch (e) {
      console.error('Error syncing order data:', e);
    }
  }

  const checkoutOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutForm    = document.getElementById('checkout-form');
  const checkoutClose   = document.getElementById('checkout-close-btn');

  function getCouponDiscount(subtotal, product_id) {
    if (!appliedCoupon) return 0;
    const c = appliedCoupon;
    if (c.type === 'specific' && c.productId !== product_id) return 0;

    if (c.discountType === 'percentage') {
      return Math.round(subtotal * (c.discountValue / 100));
    } else {
      return Math.min(subtotal, c.discountValue);
    }
  }

  function getMappedGST(product, variantLabel) {
    if (!product.variants || product.variants.length === 0) return 18; // 18% standard fallback
    const rawLabel = variantLabel.includes(' - ') ? variantLabel.split(' - ')[0] : variantLabel;
    const matched = product.variants.find(v => v.label === rawLabel) || product.variants[0];
    if (matched && typeof matched.gst !== 'undefined') {
      return parseFloat(matched.gst);
    }
    return 18;
  }

  // Pure function to generate pricing split structures
  function calculatePaymentSplits() {
    const unitPrice = selectedUnitPrice !== null ? selectedUnitPrice : (salePrice(currentProduct.price) || currentProduct.price);
    const subtotal = unitPrice * qty;

    const gstPercent = getMappedGST(currentProduct, selectedVariantLabel);
    
    // To match GST separation, pre-tax subtotal is Subtotal / (1 + GST%)
    const preTaxSubtotal = subtotal / (1 + gstPercent / 100);
    const gstApplied = Math.round(subtotal - preTaxSubtotal);

    const couponD = getCouponDiscount(subtotal, currentProduct.id);
    const netTotal = Math.max(0, subtotal - couponD);

    const shippingThreshold = D.shipping ? D.shipping.freeShippingAbove : 499;
    const defaultShipping = D.shipping ? D.shipping.shippingCharge : 0;
    const activeShipping = netTotal >= shippingThreshold ? 0 : (isShippingCalculated ? currentShippingCharge : defaultShipping);

    const grandTotal = netTotal + activeShipping;

    return {
      unitPrice,
      subtotal,
      gstPercent,
      gstApplied,
      couponD,
      netTotal,
      activeShipping,
      grandTotal
    };
  }

  function renderOrderSummaryMarkup() {
    const summaryContainer = document.getElementById('checkout-summary-container');
    if (!summaryContainer) return;

    const splits = calculatePaymentSplits();
    
    let displayLabel = '';
    if (selectedVariantLabel) {
      const parts = selectedVariantLabel.split(' - ');
      const sizeStr = parts[0] ? parts[0].trim() : (currentProduct.weight || '500g');
      const typeStr = parts[1] ? parts[1].trim() : 'Crunchy';
      displayLabel = `(Pack Size: ${sizeStr}, Type: ${typeStr})`;
    }

    summaryContainer.innerHTML = `
      <div class="checkout-summary-box">
        <div class="checkout-summary-title">
          <i class="fas fa-shopping-cart"></i> Order Summary & Split
        </div>
        <div class="checkout-summary-item" style="color:var(--dark); font-weight:700;">
          <span>${currentProduct.name} ${displayLabel} × ${qty}</span>
          <span>₹${splits.subtotal}</span>
        </div>
        <div class="checkout-summary-item">
          <span>Base Price Split (Before GST)</span>
          <span>₹${splits.subtotal - splits.gstApplied}</span>
        </div>
        <div class="header-split-item" style="margin-top:2px;"></div>
        <div class="checkout-summary-item">
          <span>GST Applied (${splits.gstPercent}%)</span>
          <span>₹${splits.gstApplied}</span>
        </div>
        <div class="checkout-summary-item">
          <span>Shipping Charges ${splits.activeShipping === 0 ? '<strong style="color:#2e7d32;">(Free)</strong>' : ''}</span>
          <span>₹${splits.activeShipping}</span>
        </div>
        ${splits.couponD > 0 ? `
        <div class="checkout-summary-item">
          <span>Promo Code Discount (${appliedCoupon.code})</span>
          <span class="discount-green">-₹${splits.couponD}</span>
        </div>` : ''}
        <div class="checkout-summary-item total-bold">
          <span>Total To Pay</span>
          <span>₹${splits.grandTotal}</span>
        </div>
      </div>

      <!-- Promo Code Card Segment -->
      <div class="promo-input-group" onclick="event.stopPropagation();">
        <input type="text" id="promo-code-input" class="form-input" placeholder="Promo/Coupon Code" value="${appliedCoupon ? appliedCoupon.code : ''}"/>
        <button type="button" class="promo-apply-btn" id="promo-apply-btn">${appliedCoupon ? 'Cancel' : 'Apply'}</button>
      </div>
      <div id="promo-status-message" class="promo-status-msg" style="margin-bottom: 0.8rem;"></div>
    `;

    // Connect promo actions
    const promoBtn = document.getElementById('promo-apply-btn');
    const promoInput = document.getElementById('promo-code-input');
    const promoMsg = document.getElementById('promo-status-message');

    if (promoBtn) {
      promoBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (appliedCoupon) {
          appliedCoupon = null;
          renderOrderSummaryMarkup();
          return;
        }

        const value = promoInput.value.trim().toUpperCase();
        if (!value) {
          promoMsg.className = "promo-status-msg error";
          promoMsg.textContent = "Please enter a coupon code.";
          promoMsg.style.display = "block";
          return;
        }

        const match = D.coupons.find(c => c.code === value);
        if (!match) {
          promoMsg.className = "promo-status-msg error";
          promoMsg.textContent = "Invalid coupon code.";
          promoMsg.style.display = "block";
          return;
        }

        if (match.type === 'specific' && match.productId !== currentProduct.id) {
          promoMsg.className = "promo-status-msg error";
          promoMsg.textContent = "This coupon is only valid for a specific product.";
          promoMsg.style.display = "block";
          return;
        }

        appliedCoupon = match;
        renderOrderSummaryMarkup();
        // Recalc complete summary is successfully updated! Positive visual feedback:
        const freshMsg = document.getElementById('promo-status-message');
        if (freshMsg) {
          freshMsg.className = "promo-status-msg success";
          freshMsg.textContent = `Promo code "${value}" applied successfully!`;
          freshMsg.style.display = "block";
        }
      });
    }
  }

  function openCheckoutModal() {
    if (!currentProduct) return;
    appliedCoupon = null;
    isShippingCalculated = false;
    currentShippingCharge = 0;

    // Build the dynamic container right above the name field
    const nameFieldGroup = checkoutForm.querySelector('.form-group');
    if (nameFieldGroup) {
      let sumContainer = document.getElementById('checkout-summary-container');
      if (!sumContainer) {
        sumContainer = document.createElement('div');
        sumContainer.id = 'checkout-summary-container';
        nameFieldGroup.parentNode.insertBefore(sumContainer, nameFieldGroup);
      }
    }

    renderOrderSummaryMarkup();
    checkoutOverlay.classList.add('open');

    // Register pincode change trigger for dynamic sheet rates fetch
    const pincodeInput = document.getElementById('cust-pincode');
    if (pincodeInput) {
      pincodeInput.addEventListener('input', async (e) => {
        const pincode = e.target.value.trim();
        if (/^\d{6}$/.test(pincode)) {
          // Trigger automatic background shipping rate calculation
          try {
            const sizeLabel = selectedVariantLabel.includes(' - ') ? selectedVariantLabel.split(' - ')[0] : selectedVariantLabel;
            const res = await window.BUNOFEED_API.get('getShippingCharge', {
              pincode: pincode,
              weight: sizeLabel || currentProduct.weight || '500g'
            });
            if (res && res.status === 'success' && typeof res.shippingCharge !== 'undefined') {
              currentShippingCharge = parseFloat(res.shippingCharge);
              isShippingCalculated = true;
              renderOrderSummaryMarkup();
            }
          } catch (err) {
            console.error('Error fetching custom shipping charge:', err);
          }
        }
      });
    }
  }

  function closeCheckoutModal() {
    checkoutOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isProcessing) return;

      const name     = document.getElementById('cust-name').value.trim();
      const phone    = document.getElementById('cust-phone').value.trim();
      const email    = document.getElementById('cust-email').value.trim();
      const address  = document.getElementById('cust-address').value.trim();
      const pincode  = document.getElementById('cust-pincode').value.trim();

      document.querySelectorAll('.error-msg').forEach(el => el.style.display = 'none');

      let isValid = true;
      if (!name) { document.getElementById('name-error').style.display = 'block'; isValid = false; }
      if (!/^\d{10}$/.test(phone)) { document.getElementById('phone-error').style.display = 'block'; isValid = false; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('email-error').style.display = 'block'; isValid = false; }
      if (!address) { document.getElementById('address-error').style.display = 'block'; isValid = false; }
      if (!/^\d{6}$/.test(pincode)) { document.getElementById('pincode-error').style.display = 'block'; isValid = false; }

      const serviceablePincodes = D.serviceablePincodes || [];
      if (isValid && serviceablePincodes.length > 0 && !serviceablePincodes.includes(pincode)) {
        const el = document.getElementById('pincode-error');
        el.textContent = 'Sorry, we do not deliver to this pincode yet. Accepted: ' + serviceablePincodes.join(', ');
        el.style.display = 'block';
        isValid = false;
      }

      if (!isValid) return;

      isProcessing = true;
      const proceedBtn = document.getElementById('proceed-pay-btn');
      proceedBtn.disabled = true;
      proceedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Payment...';

      // ── MAPPED DYNAMIC SPLITS ──
      const splits = calculatePaymentSplits();
      const orderId = generateOrderId();

      // Bundle chosen variant size cleanly in product name
      const parts = selectedVariantLabel.split(' - ');
      const chosenSize = parts[0] ? parts[0].trim() : (currentProduct.weight || '500g');
      const chosenType = parts[1] ? parts[1].trim() : 'Crunchy';
      const displayProductName = `${currentProduct.name} (Pack Size: ${chosenSize}, Type: ${chosenType})`;

      const orderData = {
        order_id: orderId,
        date_time: new Date().toLocaleString('en-IN'),
        customer_name: name,
        phone_number: phone,
        email: email,
        address: address,
        pincode: pincode,
        product_id: currentProduct.id,
        product_name: displayProductName,
        quantity: qty,
        product_price: splits.unitPrice,
        total_amount: splits.grandTotal,
        payment_id: '',
        razorpay_order_id: '',
        payment_status: 'Pending',
        coupon_applied: appliedCoupon ? appliedCoupon.code : '',
        coupon_discount: splits.couponD,
        gst_percent: splits.gstPercent,
        gst_applied: splits.gstApplied,
        shipping_charges: splits.activeShipping
      };

      await syncLocalOrder(orderData);
      triggerRazorpay(currentProduct, qty, splits.grandTotal, splits.activeShipping, orderData, displayProductName);
    });
  }


  function showRedirectOverlay() {
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
      <p style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:1.2rem;color:#2c1a0e;margin:0;">Payment Successful!</p>
      <p style="font-family:'Open Sans',sans-serif;font-size:.92rem;color:#7a6155;margin:0;">Taking you to your order summary</p>
      <div style="width:36px;height:36px;border:3px solid #f0e8e0;border-top-color:#FF6B00;border-radius:50%;animation:spin .8s linear infinite;"></div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(overlay);
  }

  function triggerRazorpay(product, quantity, grandTotal, shippingAmt, orderData, displayProductName) {
    const key = D.payment && D.payment.razorpayKeyId;
    if (!key || key.includes('PASTE_YOUR')) {
      alert('⚠️ Razorpay Key ID not configured. Local order preview created anyway!');
      orderData.payment_status = 'Paid (Test Local)';
      orderData.payment_id = 'LOCAL_' + Date.now();
      syncLocalOrder(orderData).then(() => {
        window.location.href = `/order-success.html?order_id=${orderData.order_id}&payment_id=${orderData.payment_id}&product=${encodeURIComponent(displayProductName)}&qty=${quantity}&total=${grandTotal}&phone=${encodeURIComponent(orderData.phone_number)}`;
      });
      return;
    }
    if (typeof Razorpay === 'undefined') {
      alert('Razorpay Payment Gateway not online. Saving local preview.');
      resetSubmitBtn();
      return;
    }

    const options = {
      key: key,
      amount: grandTotal * 100,
      currency: D.payment.currency || 'INR',
      name: D.payment.businessName || 'Bunofeed',
      description: `${displayProductName} × ${quantity}${shippingAmt > 0 ? ` + ₹${shippingAmt} shipping` : ' (Free Shipping)'}`,
      image: D.payment.logoUrl || '',
      theme: { color: D.payment.themeColor || '#FF6B00' },
      prefill: {
        name: orderData.customer_name,
        email: orderData.email,
        contact: orderData.phone_number
      },
      notes: {
        order_id: orderData.order_id,
        product_id: product.id,
      },
      handler: async function(response) {
        // Immediately hide checkout modal and show full-screen redirect overlay
        closeCheckoutModal();
        showRedirectOverlay();

        orderData.payment_id = response.razorpay_payment_id;
        orderData.payment_status = 'Paid';
        await syncLocalOrder(orderData);
        window.location.href = `/order-success.html?order_id=${orderData.order_id}&payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(displayProductName)}&qty=${quantity}&total=${grandTotal}&phone=${encodeURIComponent(orderData.phone_number)}`;
      },
      modal: {
        ondismiss: function() {
          orderData.payment_status = 'Dismissed';
          orderData.payment_id = 'DISMISSED-' + Date.now();
          syncLocalOrder(orderData);
          resetSubmitBtn();
        }
      }
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', async function(response) {
      orderData.payment_id = (response.error.metadata && response.error.metadata.payment_id) || ('FAIL-' + Date.now());
      orderData.payment_status = 'Failed';
      await syncLocalOrder(orderData);
      alert(`Payment failed: ${response.error.description}`);
      resetSubmitBtn();
    });
    rzp.open();
  }

  function resetSubmitBtn() {
    isProcessing = false;
    const proceedBtn = document.getElementById('proceed-pay-btn');
    if (proceedBtn) {
      proceedBtn.disabled = false;
      proceedBtn.textContent = 'Proceed to Pay';
    }
  }

  /* ----------------------------------------------------------
     MOBILE NAVIGATION
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
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('open') &&
          !navLinks.contains(e.target) &&
          !hamburger.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  /* ----------------------------------------------------------
     ACTIVE SCROLL LINK OBSERVER
  ---------------------------------------------------------- */
  const sections    = document.querySelectorAll('section[id]');
  const navLinkEls  = document.querySelectorAll('a.nav-link');
  const sectionObs  = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinkEls.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px' });
  sections.forEach(s => sectionObs.observe(s));

  /* ----------------------------------------------------------
     BRAND LINKS SYNCHRONIZATION
  ---------------------------------------------------------- */
  if (D.brand) {
    const b = D.brand;
    document.querySelectorAll('[data-social]').forEach(el => {
      const key = el.getAttribute('data-social');
      if (b[key]) el.href = b[key];
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
