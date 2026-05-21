/**
 * ============================================================
 *  BUNOFEED — Main Script (script.js)
 *  - Reads data from products.js (window.BUNOFEED_DATA)
 *  - Renders products dynamically on homepage
 *  - Uses shared BUNO_MODAL for full-screen product detail
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
        document.querySelector('.hero-image').style.display = 'flex';
      }
    }
  }

  /* ----------------------------------------------------------
     SALE helpers
  ---------------------------------------------------------- */
  const saleActive  = D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
  const discountPct = saleActive ? (D.sale.discountPercent || 0) : 0;
  function salePrice(p) {
    return saleActive && discountPct > 0 ? Math.round(p * (1 - discountPct / 100)) : null;
  }

  /* ----------------------------------------------------------
     PRICE HTML helper (supports MRP strikethrough)
  ---------------------------------------------------------- */
  function buildPriceHTML(product) {
    const sp = salePrice(product.price);
    const mrp = product.mrp || null;

    if (sp) {
      // Sale active: show sale price + original as strikethrough
      return `
        <div class="product-price">
          <div class="product-weight">${product.weight || ''}</div>
          <div class="price-sale">
            <span class="price-current">₹${sp}</span>
            <span class="price-old">₹${product.price}</span>
          </div>
        </div>`;
    } else if (mrp && mrp > product.price) {
      // MRP set: show current price + MRP struck through
      const pct = Math.round((1 - product.price / mrp) * 100);
      return `
        <div class="product-price">
          <div class="product-weight">${product.weight || ''}</div>
          <div class="price-sale">
            <span class="price-current">₹${product.price}</span>
            <span class="price-old">₹${mrp}</span>
            <span class="price-save-tag">${pct}% off</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="product-price">
          <div class="product-weight">${product.weight || ''}</div>
          <div class="price-original">₹${product.price}</div>
        </div>`;
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
        ? `<img class="product-photo" src="${product.image}" alt="${product.name}" loading="lazy"/>`
        : `<span class="product-emoji">${product.emoji || '🥜'}</span>`;

      const card = document.createElement('div');
      card.className = 'product-card reveal';
      card.dataset.id = product.id;
      card.innerHTML = `
        ${badgeHTML}
        <div class="product-img ${product.bgClass || ''}">
          ${imgHTML}
        </div>
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <div class="product-footer">
            ${buildPriceHTML(product)}
            <div class="product-card-btns">
              <button class="btn-view-detail view-detail-btn" data-id="${product.id}">View Details</button>
              <button class="btn-buy buy-now-btn" data-id="${product.id}">Buy Now</button>
            </div>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    /* Wire up card clicks and buttons */
    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-buy') && !e.target.closest('.btn-view-detail')) {
          openProductModal(card.dataset.id);
        }
      });
    });
    grid.querySelectorAll('.view-detail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); openProductModal(btn.dataset.id); });
    });
    grid.querySelectorAll('.buy-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const product = (D.products || []).find(p => p.id === btn.dataset.id);
        if (product) {
          currentProduct = product;
          qty = 1;
          openCheckoutModal();
        }
      });
    });

    initReveal();
  }

  /* ----------------------------------------------------------
     OPEN PRODUCT MODAL (shared BUNO_MODAL)
  ---------------------------------------------------------- */
  let currentProduct = null;
  let qty = 1;

  function openProductModal(id) {
    const product = (D.products || []).find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    qty = 1;

    if (window.BUNO_MODAL) {
      window.BUNO_MODAL.open(product, (prod, quantity, unitPrice) => {
        currentProduct = prod;
        qty = quantity;
        openCheckoutModal();
      });
    }
  }

  /* ----------------------------------------------------------
     SCROLL REVEAL ANIMATION
  ---------------------------------------------------------- */
  function initReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }

  document.querySelectorAll('.product-card, .why-stat-card, .feature-item').forEach(el => {
    el.classList.add('reveal');
  });
  initReveal();

  /* ----------------------------------------------------------
     CHECKOUT MODAL (unchanged functionality)
  ---------------------------------------------------------- */
  let isProcessing = false;

  function generateOrderId() {
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000;
    return 'ORD' + Date.now() + rand;
  }

  async function syncToGoogleSheets(orderData) {
    if (!window.BUNOFEED_API) { console.warn('api.js not loaded.'); return; }
    try {
      await window.BUNOFEED_API.post('createOrder', orderData);
    } catch (e) {
      console.error('Error syncing order:', e);
    }
  }

  const checkoutOverlay = document.getElementById('checkout-modal-overlay');
  const checkoutForm    = document.getElementById('checkout-form');
  const checkoutClose   = document.getElementById('checkout-close-btn');

  function openCheckoutModal() {
    if (!currentProduct) return;
    checkoutOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
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
        el.textContent = 'Sorry, we do not deliver to this pincode yet.';
        el.style.display = 'block';
        isValid = false;
      }

      if (!isValid) return;

      isProcessing = true;
      const proceedBtn = document.getElementById('proceed-pay-btn');
      proceedBtn.disabled = true;
      proceedBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

      const sp = salePrice(currentProduct.price);
      const unitPrice = sp || currentProduct.price;
      const totalAmount = unitPrice * qty;
      const shipping = D.shipping && totalAmount < D.shipping.freeShippingAbove ? D.shipping.shippingCharge : 0;
      const grandTotal = totalAmount + shipping;
      const orderId = generateOrderId();

      const orderData = {
        order_id: orderId,
        date_time: new Date().toLocaleString('en-IN'),
        customer_name: name,
        phone_number: phone,
        email: email,
        address: address,
        pincode: pincode,
        product_id: currentProduct.id,
        product_name: currentProduct.name,
        quantity: qty,
        product_price: unitPrice,
        total_amount: grandTotal,
        payment_id: '',
        razorpay_order_id: '',
        payment_status: 'Pending'
      };

      await syncToGoogleSheets(orderData);
      triggerRazorpay(currentProduct, qty, grandTotal, shipping, orderData);
    });
  }

  function triggerRazorpay(product, quantity, grandTotal, shippingAmt, orderData) {
    const key = D.payment && D.payment.razorpayKeyId;
    if (!key || key.includes('PASTE_YOUR')) {
      alert('⚠️ Razorpay key not configured yet.\n\nOpen products.js and paste your Razorpay Key ID in payment.razorpayKeyId.');
      resetSubmitBtn();
      return;
    }
    if (typeof Razorpay === 'undefined') {
      alert('Payment gateway not loaded. Please check your internet connection.');
      resetSubmitBtn();
      return;
    }

    const options = {
      key: key,
      amount: grandTotal * 100,
      currency: D.payment.currency || 'INR',
      name: D.payment.businessName || 'Bunofeed',
      description: `${product.name} × ${quantity}${shippingAmt > 0 ? ` + ₹${shippingAmt} shipping` : ' (Free Shipping)'}`,
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
        orderData.payment_id = response.razorpay_payment_id;
        orderData.payment_status = 'Paid';
        await syncToGoogleSheets(orderData);
        window.location.href = `order-success.html?payment_id=${response.razorpay_payment_id}&product=${encodeURIComponent(product.name)}&qty=${quantity}&total=${grandTotal}`;
      },
      modal: {
        ondismiss: function() {
          orderData.payment_status = 'Dismissed';
          orderData.payment_id = 'DISMISSED-' + Date.now();
          syncToGoogleSheets(orderData);
          resetSubmitBtn();
        }
      }
    };
    const rzp = new Razorpay(options);
    rzp.on('payment.failed', async function(response) {
      orderData.payment_id = (response.error.metadata && response.error.metadata.payment_id) || ('FAIL-' + Date.now());
      orderData.payment_status = 'Failed';
      await syncToGoogleSheets(orderData);
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
     ACTIVE NAV LINK
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
     SOCIAL LINKS
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
