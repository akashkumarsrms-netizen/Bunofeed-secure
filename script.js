/**
 * ============================================================
 *  BUNOFEED — Main Script (script.js)
 *  - Reads data from products.js (window.BUNOFEED_DATA)
 *  - Renders best-seller products on homepage using unified multi-variant card engine
 *  - Uses shared window.BUNO_MODAL for full-screen detail
 *  - Shows/hides campaign banner
 *  - Mobile nav, scroll reveal, active links
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  const D = window.BUNOFEED_DATA;
  if (!D) { console.error('BUNOFEED_DATA not found. Is products.js loaded?'); return; }

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
        const heroImgSection = document.querySelector('.hero-image');
        if (heroImgSection) heroImgSection.style.display = 'flex';
      }
    }
  }

  /* ----------------------------------------------------------
     RENDER BEST-SELLER CARDS (homepage)
  ---------------------------------------------------------- */
  const grid = document.getElementById('products-grid');
  if (grid && D.products) {
    grid.innerHTML = '';

    D.products.filter(p => p.visible !== false && p.bestSeller === true).forEach(product => {
      const card = bunoBuildProductCard(product);
      grid.appendChild(card);
    });

    initReveal();
  }

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
     CHECKOUT CONTROLLER
  ---------------------------------------------------------- */
  let isProcessing = false;

  const checkoutOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutForm    = document.getElementById('checkout-form');
  const checkoutClose   = document.getElementById('checkout-close-btn');

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

      // selected checkout details
      const totalAmount = selectedUnitPrice * qty;
      const shipping = D.shipping && totalAmount < D.shipping.freeShippingAbove ? D.shipping.shippingCharge : 0;
      const grandTotal = totalAmount + shipping;
      const orderId = generateOrderId();

      // Store combined details as required: (e.g. "Crunchy Peanut Butter - 400gm")
      const displayProductName = selectedVariantLabel ? `${currentProduct.name} - ${selectedVariantLabel}` : currentProduct.name;

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
        product_price: selectedUnitPrice,
        total_amount: grandTotal,
        payment_id: '',
        razorpay_order_id: '',
        payment_status: 'Pending'
      };

      await syncLocalOrder(orderData);
      triggerRazorpay(currentProduct, qty, grandTotal, shipping, orderData, displayProductName);
    });
  }

  function triggerRazorpay(product, quantity, grandTotal, shippingAmt, orderData, displayProductName) {
    const key = D.payment && D.payment.razorpayKeyId;
    if (!key || key.includes('PASTE_YOUR') || key.includes('rzp_test_SntAL')) {
      // Create test order directly if custom real key not filled yet, for premium test convenience
      showRedirectOverlay();
      orderData.payment_status = 'Paid (Demo Mode)';
      orderData.payment_id = 'BUNO_' + Date.now();
      syncLocalOrder(orderData).then(() => {
        setTimeout(() => {
          window.location.href = `order-success.html?order_id=${orderData.order_id}&payment_id=${orderData.payment_id}&product=${encodeURIComponent(displayProductName)}&qty=${quantity}&total=${grandTotal}`;
        }, 1200);
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
        closeCheckoutModal();
        showRedirectOverlay();

        orderData.payment_id = response.razorpay_payment_id;
        orderData.payment_status = 'Paid';
        await syncLocalOrder(orderData);
        window.location.href = `order-success.html?order_id=${orderData.order_id}&payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(displayProductName)}&qty=${quantity}&total=${grandTotal}`;
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
      <p style="font-family:\'Montserrat\',sans-serif;font-weight:800;font-size:1.2rem;color:#2c1a0e;margin:0;">Payment Successful!</p>
      <p style="font-family:\'Open Sans\',sans-serif;font-size:.92rem;color:#7a6155;margin:0;">Taking you to your order summary</p>
      <div style="width:36px;height:36px;border:3px solid #f0e8e0;border-top-color:#FF6B00;border-radius:50%;animation:spin .8s linear infinite;"></div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
    document.body.appendChild(overlay);
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

/* ══════════════════════════════════════════════════════════
   GLOBAL UNIFIED MULTI-VARIANT CARD & MODAL ROUTER
   ══════════════════════════════════════════════════════════ */
let currentProduct = null;
let qty = 1;
let selectedUnitPrice = null;
let selectedVariantLabel = '';

const checkoutOverlay = document.getElementById('checkout-modal-overlay');

function openCheckoutModal() {
  if (!currentProduct) return;
  checkoutOverlay.classList.add('open');
}

function closeCheckoutModal() {
  checkoutOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

// 1. Opens detail modal with a selected texture preloaded
function openProductModal(id, selectedTexture) {
  const D = window.BUNOFEED_DATA;
  const product = (D.products || []).find(p => p.id === id);
  if (!product) return;
  currentProduct = product;
  qty = 1;
  selectedUnitPrice = null;
  selectedVariantLabel = '';

  if (window.BUNO_MODAL) {
    window.BUNO_MODAL.open(product, selectedTexture || "", (prod, quantity, unitPrice, variantLabel) => {
      currentProduct = prod;
      qty = quantity;
      selectedUnitPrice = unitPrice;
      selectedVariantLabel = variantLabel || '';
      openCheckoutModal();
    });
  }
}
window.BUNO_OPEN_MODAL = openProductModal;

// 2. Buy Now direct checkout directly from homepage or catalog listing page
function openProductCheckoutDirect(product, selectedTexture) {
  const D = window.BUNOFEED_DATA;
  const saleActive = D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
  const discountPct = saleActive ? (D.sale.discountPercent || 0) : 0;

  currentProduct = product;
  qty = 1;

  // Selected texture must fallback or resolve to size
  const weightSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "";
  const key = selectedTexture ? `${selectedTexture}-${weightSize}` : `-${weightSize}`;

  let origPrice = product.price;
  if (product.prices && product.prices[key]) {
    origPrice = product.prices[key].price;
  }

  // Adjust for sale discount if active
  if (saleActive) {
    selectedUnitPrice = Math.round(origPrice * (1 - discountPct / 100));
  } else {
    selectedUnitPrice = origPrice;
  }

  // Bundle selection label cleanly (e.g. "Smooth - 400gm")
  selectedVariantLabel = selectedTexture ? `${selectedTexture} - ${weightSize}` : weightSize;

  openCheckoutModal();
}

// 3. Unified Card Render builder used globally in index.html AND shop.html
window.bunoBuildProductCard = function(product) {
  const D = window.BUNOFEED_DATA;
  const saleActive = D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
  const discountPct = saleActive ? (D.sale.discountPercent || 0) : 0;

  // Initial local card states
  let selectedTexture = product.textures && product.textures.length > 0 ? product.textures[0] : "";
  const defaultSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "";

  const card = document.createElement('div');
  card.className = 'product-card reveal visible';
  card.dataset.id = product.id;
  card.setAttribute('data-selected-texture', selectedTexture);

  function renderCardHTML() {
    const key = selectedTexture ? `${selectedTexture}-${defaultSize}` : `-${defaultSize}`;
    let origPrice = product.price;
    let origMrp = product.mrp || null;

    if (product.prices && product.prices[key]) {
      origPrice = product.prices[key].price;
      origMrp = product.prices[key].mrp || null;
    }

    let curPrice = origPrice;
    let oldPrice = origMrp;
    if (saleActive) {
      curPrice = Math.round(origPrice * (1 - discountPct / 100));
      if (!oldPrice) oldPrice = origPrice;
    }

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

    let priceHTML = '';
    if (saleActive) {
      priceHTML = `
        <div class="product-price">
          <div class="product-weight">${defaultSize}</div>
          <div class="price-sale">
            <span class="price-current">₹${curPrice}</span>
            <span class="price-old">₹${origPrice}</span>
          </div>
        </div>`;
    } else if (oldPrice && oldPrice > curPrice) {
      const pct = Math.round((1 - curPrice / oldPrice) * 100);
      priceHTML = `
        <div class="product-price">
          <div class="product-weight">${defaultSize}</div>
          <div class="price-sale">
            <span class="price-current">₹${curPrice}</span>
            <span class="price-old">₹${oldPrice}</span>
            <span class="price-save-tag">${pct}% off</span>
          </div>
        </div>`;
    } else {
      priceHTML = `
        <div class="product-price">
          <div class="product-weight">${defaultSize}</div>
          <div class="price-original">₹${curPrice}</div>
        </div>`;
    }

    // Display dropdown selector only if texture variants are configured
    let texturesMarkup = '';
    if (product.textures && product.textures.length > 0) {
      texturesMarkup = `
        <div class="card-textures-row" style="margin: 8px 0 6px; width: 100%;">
          <select class="card-texture-dropdown" aria-label="Select flavor"
            style="width: 100%; font-family: var(--font-head); font-size: 0.75rem; font-weight: 700; padding: 8px 12px; border-radius: var(--radius); border: 2px solid #e0d4cc; background-color: var(--white); color: var(--brown); cursor: pointer; transition: all 0.2s; outline: none; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%236B2D0E%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 12px top 50%; background-size: 10px auto; padding-right: 32px;">
            ${product.textures.map(tex => {
              const isSelected = tex === selectedTexture;
              return `<option value="${tex}" ${isSelected ? 'selected' : ''}>Type: ${tex}</option>`;
            }).join('')}
          </select>
        </div>
      `;
    }

    card.innerHTML = `
      ${badgeHTML}
      <div class="product-img ${product.bgClass || ''}">
        ${imgHTML}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        ${texturesMarkup}
        <div class="product-footer">
          ${priceHTML}
          <div class="product-card-btns">
            <button type="button" class="btn-view-detail c-view-btn-custom">Details</button>
            <button type="button" class="btn-buy c-buy-btn-custom">Buy</button>
          </div>
        </div>
      </div>
    `;

    // Connect dropdown select changes
    const selectEl = card.querySelector('.card-texture-dropdown');
    if (selectEl) {
      selectEl.addEventListener('change', (e) => {
        selectedTexture = e.target.value;
        card.setAttribute('data-selected-texture', selectedTexture);
        renderCardHTML();
      });
      selectEl.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    // Connect custom buttons
    card.querySelector('.c-view-btn-custom').addEventListener('click', (e) => {
      e.stopPropagation();
      openProductModal(product.id, selectedTexture);
    });

    card.querySelector('.c-buy-btn-custom').addEventListener('click', (e) => {
      e.stopPropagation();
      openProductCheckoutDirect(product, selectedTexture);
    });
  }

  renderCardHTML();

  // Clicking anywhere on card triggers the modal with pre-selected card texture
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.card-texture-dropdown') && !e.target.closest('.c-view-btn-custom') && !e.target.closest('.c-buy-btn-custom')) {
      openProductModal(product.id, selectedTexture);
    }
  });

  return card;
};
