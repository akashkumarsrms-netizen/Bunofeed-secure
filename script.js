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
      const base = parseFloat(combo.basePrice) || 0;
      const profit = parseFloat(combo.profit) || 0;
      const directDiscount = parseFloat(combo.discount) || 0;
      const gst = parseFloat(combo.gst) || 0;

      // Pricing combination logic
      const subtotalBase = base * (1 + profit / 100);
      const discountedSubtotal = subtotalBase * (1 - directDiscount / 100);

      const salesPrice = Math.round(discountedSubtotal * (1 + gst / 100));
      const mrp = Math.round(subtotalBase * (1 + gst / 100));

      return { price: salesPrice, mrp: mrp };
    }

    // Default configuration fallback
    return { price: product.price || 0, mrp: product.mrp || null };
  }

  /* ----------------------------------------------------------
     PRICE HTML GENERATOR
  ---------------------------------------------------------- */
  function getPriceMarkup(price, mrp) {
    if (mrp && mrp > price) {
      const pct = Math.round((1 - price / mrp) * 100);
      return `
        <span class="price-current">₹${price}</span>
        <span class="price-old">₹${mrp}</span>
        <span class="price-save-tag">${pct}% off</span>`;
    }
    return `<span class="price-original">₹${price}</span>`;
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
        <h3>${product.name}</h3>

        <!-- Real-Time Selectors Grid directly on card -->
        <div class="card-selectors-row">
          <select class="card-select size-card-select" aria-label="Select packing size">
            ${sizeOptions}
          </select>
          <select class="card-select texture-card-select" aria-label="Select texture" style="${hasTextures ? '' : 'display:none;'}">
            ${textureOptions}
          </select>
        </div>

        <div class="product-footer">
          <div class="product-price">
            <div class="product-weight card-computed-weight">${hasTextures ? firstTexture + ' ' : ''}${firstSize || product.weight || ''}</div>
            <div class="price-sale card-computed-pricing">
              ${getPriceMarkup(initialPricing.price, initialPricing.mrp)}
            </div>
          </div>
          <div class="product-card-btns">
            <button class="btn-view-detail c-view-btn" data-id="${product.id}">View Details</button>
            <button class="btn-buy c-buy-btn" data-id="${product.id}">Buy Now</button>
          </div>
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

    // Button Triggers
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.c-buy-btn') && !e.target.closest('.c-view-btn') && !e.target.closest('.card-select')) {
        openProductModal(product.id);
      }
    });

    card.querySelector('.c-view-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openProductModal(product.id);
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
        promotionalDiscountValue = Math.round(itemsSubtotal * (activeCoupon.discountValue / 100));
      } else {
        promotionalDiscountValue = Math.min(itemsSubtotal, activeCoupon.discountValue);
      }
    }

    const discountedTotal = itemsSubtotal - promotionalDiscountValue;
    const freeShippingThreshold = D.shipping ? D.shipping.freeShippingAbove : 499;
    const shippingCharge = D.shipping ? D.shipping.shippingCharge : 60;
    const hasFreeShipping = discountedTotal >= freeShippingThreshold;
    const grandTotalValue = discountedTotal + (hasFreeShipping ? 0 : shippingCharge);

    const proceedBtn = document.getElementById('proceed-pay-btn');
    if (proceedBtn) {
      const discountLabel = promotionalDiscountValue > 0 ? ` (₹${promotionalDiscountValue} discount applied)` : '';
      const shippingLabel = grandTotalValue > discountedTotal ? ` (+₹${shippingCharge} shipping)` : ' (Free Shipping)';
      proceedBtn.textContent = `Pay ₹${grandTotalValue}${discountLabel}${shippingLabel}`;
    }
  }

  /* ----------------------------------------------------------
     CHECKOUT INITIATOR & ORDER SUBMIT PIPELINE
  ---------------------------------------------------------- */
  let orderProcessingState = false;

  const checkoutOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutForm    = document.getElementById('checkout-form');
  const checkoutClose   = document.getElementById('checkout-close-btn');

  function openCheckoutModal() {
    if (!currentProduct) return;
    checkoutOverlay.classList.add('open');
    if (couponInput) couponInput.value = '';
    if (couponMsg) couponMsg.textContent = '';
    activeCoupon = null;
    refreshCheckoutCalculation();
  }

  function closeCheckoutModal() {
    checkoutOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);

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

      // Computations
      const baseVal = selectedUnitPrice !== null ? selectedUnitPrice : currentProduct.price;
      const subtotalVal = baseVal * qty;
      
      let promotionalDiscountValue = 0;
      if (activeCoupon) {
        if (activeCoupon.discountType === 'percent') {
          promotionalDiscountValue = Math.round(subtotalVal * (activeCoupon.discountValue / 100));
        } else {
          promotionalDiscountValue = Math.min(subtotalVal, activeCoupon.discountValue);
        }
      }

      const discountedTotal = subtotalVal - promotionalDiscountValue;
      const freeShippingThreshold = D.shipping ? D.shipping.freeShippingAbove : 499;
      const shippingCharge = D.shipping ? D.shipping.shippingCharge : 60;
      const hasFreeShipping = discountedTotal >= freeShippingThreshold;
      const shippingAmt = hasFreeShipping ? 0 : shippingCharge;
      const grandTotalCombined = discountedTotal + shippingAmt;

      const orderId = generateOrderId();
      const chosenTag = selectedVariantLabel ? `${currentProduct.name} (${selectedVariantLabel})` : currentProduct.name;

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
        payment_status: 'Pending'
      };

      // Create Order Entry Statically or locally on Express database file
      try {
        await window.BUNOFEED_API.post('createOrder', orderPayload);
      } catch (err) {
        console.error('Local JSON order synchronization failed:', err);
      }

      executeRazorpayGateway(currentProduct, qty, grandTotalCombined, shippingAmt, orderPayload, chosenTag);
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

  function executeRazorpayGateway(product, quantity, grandTotal, shippingAmt, orderPayload, displayTitle) {
    const rzpKey = D.payment && D.payment.razorpayKeyId;

    if (!rzpKey || rzpKey.includes('PASTE_YOUR') || rzpKey.includes('rzp_test_XXXX')) {
      alert('⚠️ Razorpay Live API key not set. Initializing local sandbox checkout order summary!');
      orderPayload.payment_status = 'Paid (Test Local)';
      orderPayload.payment_id = 'SANDBOX_' + Date.now();
      
      window.BUNOFEED_API.post('createOrder', orderPayload).then(() => {
        closeCheckoutModal();
        launchSuccessFullscreenOverlay();
        setTimeout(() => {
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${orderPayload.payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}`;
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
          window.location.href = `/order-success.html?order_id=${orderPayload.order_id}&payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(displayTitle)}&qty=${quantity}&coupon=${orderPayload.promo_code}&total=${grandTotal}`;
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
