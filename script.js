/**
 * ============================================================
 *  BUNOFEED — Main Script (script.js)
 *  - Reads data from products.js (window.BUNOFEED_DATA)
 *  - Renders best-seller products on homepage with texture selector
 *  - Dynamic pricing and MRP on texture dropdown changes
 *  - Integrates with window.BUNO_MODAL of full-screen details
 *  - Shows/hides campaign banner
 *  - Pincode-wise custom shipping charges and free shipping validation during checkout
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
     SALE helper
  ---------------------------------------------------------- */
  const saleActive  = D.sale && D.sale.active && (!D.sale.endDate || new Date() <= new Date(D.sale.endDate));
  const discountPct = saleActive ? (D.sale.discountPercent || 0) : 0;
  function salePrice(p) {
    return saleActive && discountPct > 0 ? Math.round(p * (1 - discountPct / 100)) : null;
  }

  /* ----------------------------------------------------------
     PRICE HTML helper (supports MRP strikethrough & multi-variant)
     Gets pricing for a specific texture and size combination
  ---------------------------------------------------------- */
  function getPricingForCombinations(product, texture, size) {
    let hasTextures = product.textureVariants && product.textureVariants.length > 0;
    let combinationKey = hasTextures ? `${texture}-${size}` : `default-${size}`;

    const varPriceInfo = product.variantPrices && product.variantPrices[combinationKey];
    if (varPriceInfo) {
      return {
        price: varPriceInfo.price,
        mrp: varPriceInfo.mrp || null
      };
    }
    return {
      price: product.price,
      mrp: product.mrp || null
    };
  }

  window.buildCardDropdownsHTML = function(product) {
    const textures = product.textureVariants || [];
    const sizes = product.sizeVariants || [];
    
    let hasTextures = textures.length > 0;
    let hasSizes = sizes.length > 0;
    
    if (!hasTextures && !hasSizes) return '';
    
    let html = `<div class="card-dropdowns-container">`;
    
    if (hasTextures) {
      html += `
        <div class="card-dropdown-group">
          <label class="card-dropdown-label" title="Select Texture">Texture:</label>
          <select class="card-variant-select card-texture-select" data-id="${product.id}" aria-label="Select Texture">
            ${textures.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
      `;
    }
    
    if (hasSizes) {
      html += `
        <div class="card-dropdown-group">
          <label class="card-dropdown-label" title="Select Weight">Pack Size:</label>
          <select class="card-variant-select card-size-select" data-id="${product.id}" aria-label="Select Weight">
            ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      `;
    }
    
    html += `</div>`;
    return html;
  };

  window.updateCardPrice = function(productId, cardElement) {
    const product = window.BUNOFEED_DATA.products.find(p => p.id === productId);
    if (!product) return;
    
    const card = cardElement || document.querySelector(`.product-card[data-id="${productId}"]`);
    if (!card) return;
    
    const textureSel = card.querySelector('.card-texture-select');
    const sizeSel = card.querySelector('.card-size-select');
    
    const currentTexture = textureSel ? textureSel.value : '';
    const currentSize = sizeSel ? sizeSel.value : '';
    
    const priceBox = card.querySelector(`#price-box-${productId}`);
    if (priceBox) {
      priceBox.outerHTML = window.buildPriceHTML(product, currentTexture, currentSize);
    }
  };

  window.buildPriceHTML = function(product, selectedTexture, selectedSize) {
    const defaultSize = selectedSize || ((product.sizeVariants && product.sizeVariants.length > 0) ? product.sizeVariants[0] : (product.weight || ''));
    const { price, mrp } = getPricingForCombinations(product, selectedTexture || '', defaultSize);

    const sp = salePrice(price);
    const displayMrp = mrp;
    const displayPrice = sp ? sp : price;

    let displayWeight = defaultSize;

    if (sp) {
      return `
        <div class="product-price" id="price-box-${product.id}">
          <div class="product-weight">${displayWeight}</div>
          <div class="price-sale">
            <span class="price-current">₹${displayPrice}</span>
            <span class="price-old">₹${price}</span>
          </div>
        </div>`;
    } else if (displayMrp && displayMrp > displayPrice) {
      const pct = Math.round((1 - displayPrice / displayMrp) * 100);
      return `
        <div class="product-price" id="price-box-${product.id}">
          <div class="product-weight">${displayWeight}</div>
          <div class="price-sale">
            <span class="price-current">₹${displayPrice}</span>
            <span class="price-old">₹${displayMrp}</span>
            <span class="price-save-tag">${pct}% off</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="product-price" id="price-box-${product.id}">
          <div class="product-weight">${displayWeight}</div>
          <div class="price-original">₹${displayPrice}</div>
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
        ? `<img class="product-photo" src="${product.image}" loading="lazy" decoding="async" alt="${product.name}"/>`
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
          ${window.buildCardDropdownsHTML(product)}
          <div class="product-footer">
            ${window.buildPriceHTML(product, (product.textureVariants && product.textureVariants.length > 0) ? product.textureVariants[0] : '')}
            <div class="product-card-btns">
              <button class="btn-buy buy-now-btn" data-id="${product.id}">Buy Now</button>
            </div>
          </div>
        </div>`;

      grid.appendChild(card);
    });

    /* Click and variation change handlers */
    grid.querySelectorAll('.card-variant-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const pId = sel.dataset.id;
        window.updateCardPrice(pId, sel.closest('.product-card'));
      });
      sel.addEventListener('click', (e) => e.stopPropagation());
    });

    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-buy') && !e.target.closest('.card-variant-select')) {
          const textureSel = card.querySelector('.card-texture-select');
          const sizeSel = card.querySelector('.card-size-select');
          openProductModal(card.dataset.id, textureSel ? textureSel.value : '', sizeSel ? sizeSel.value : '');
        }
      });
    });
    grid.querySelectorAll('.buy-now-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const product = (D.products || []).find(p => p.id === btn.dataset.id);
        if (product) {
          const card = btn.closest('.product-card');
          const textureSel = card ? card.querySelector('.card-texture-select') : null;
          const sizeSel = card ? card.querySelector('.card-size-select') : null;
          
          const chosenTexture = textureSel ? textureSel.value : '';
          const chosenSize = sizeSel ? sizeSel.value : ((product.sizeVariants && product.sizeVariants.length > 0) ? product.sizeVariants[0] : (product.weight || ''));

          currentProduct = product;
          qty = 1;

          const combPricing = getPricingForCombinations(product, chosenTexture, chosenSize);
          selectedUnitPrice = salePrice(combPricing.price) || combPricing.price;
          
          const formattedSize = window.BUNO_FORMAT_SIZE(chosenSize);
          if (chosenTexture && formattedSize) {
            selectedVariantLabel = `${formattedSize}, ${chosenTexture}`;
          } else if (formattedSize) {
            selectedVariantLabel = formattedSize;
          } else {
            selectedVariantLabel = chosenTexture;
          }

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

  function openProductModal(id, preSelectedTexture, preSelectedSize) {
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
      }, preSelectedTexture, preSelectedSize);
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
     CHECKOUT CONTROLLER
  ---------------------------------------------------------- */
  let isProcessing = false;

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

  function parseWeightInKg(wstr) {
    if (!wstr) return 0.5;
    const clean = wstr.toLowerCase().replace(/\s+/g, '');
    const val = parseFloat(clean);
    if (isNaN(val)) return 0.5; // fallback
    if (clean.endsWith('kg') || clean.endsWith('kilogram') || clean.endsWith('kilograms')) {
      return val;
    }
    if (clean.endsWith('gm') || clean.endsWith('g') || clean.endsWith('grams') || clean.endsWith('gram')) {
      return val / 1000;
    }
    if (val > 10) return val / 1000;
    return val;
  }

  function extractWeightInKg(variantLabel, product) {
    if (variantLabel) {
      const parts = variantLabel.split(',').map(s => s.trim().toLowerCase());
      for (const part of parts) {
        if (part.includes('g') || part.includes('kg') || part.includes('gm') || part.includes('gram') || part.includes('kilogram')) {
          return parseWeightInKg(part);
        }
      }
      const match = variantLabel.match(/(\d+(?:\.\d+)?)\s*(kg|g|gm|kilogram|grams|gram)/i);
      if (match) {
        return parseWeightInKg(match[0]);
      }
    }
    const defaultSize = (product.sizeVariants && product.sizeVariants.length > 0) ? product.sizeVariants[0] : (product.weight || '500g');
    return parseWeightInKg(defaultSize);
  }

  window.updateCheckoutSummary = function() {
    if (!currentProduct) return;
    const pincodeEl = document.getElementById('cust-pincode');
    const pincode = pincodeEl ? pincodeEl.value.trim() : '';

    const unitPrice = selectedUnitPrice !== null ? selectedUnitPrice : (salePrice(currentProduct.price) || currentProduct.price);
    const subtotal = unitPrice * qty;

    const itemWeightKg = extractWeightInKg(selectedVariantLabel, currentProduct);
    const totalWeightInKg = itemWeightKg * qty;

    let ratePerKg = 0;
    let isPincodeConfigured = false;
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      isPincodeConfigured = true;
      if (D.pincodeShipping && D.pincodeShipping[pincode] !== undefined) {
        ratePerKg = Number(D.pincodeShipping[pincode]);
      } else {
        ratePerKg = D.shipping ? Number(D.shipping.shippingCharge) : 50;
      }
    } else {
      ratePerKg = D.shipping ? Number(D.shipping.shippingCharge) : 50;
    }

    let shippingFee = Math.round(ratePerKg * totalWeightInKg);
    if (D.shipping && subtotal >= D.shipping.freeShippingAbove) {
      shippingFee = 0;
    }

    const grandTotal = subtotal + shippingFee;

    const subtotalEl = document.getElementById('checkout-subtotal');
    const weightEl = document.getElementById('checkout-weight');
    const shippingEl = document.getElementById('checkout-shipping');
    const totalEl = document.getElementById('checkout-total');
    const shippingLabelEl = document.getElementById('checkout-shipping-label');

    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
    if (weightEl) weightEl.textContent = `${totalWeightInKg.toFixed(2)} kg`;
    
    if (shippingEl) {
      if (shippingFee === 0) {
        shippingEl.textContent = 'FREE';
        shippingEl.style.color = '#28a745';
        shippingEl.style.fontWeight = '700';
      } else {
        shippingEl.textContent = `₹${shippingFee}`;
        shippingEl.style.color = '';
        shippingEl.style.fontWeight = '';
      }
    }
    
    if (shippingLabelEl) {
      shippingLabelEl.textContent = isPincodeConfigured 
        ? `Shipping (₹${ratePerKg}/kg):` 
        : `Estimated Shipping (₹${ratePerKg}/kg):`;
    }

    if (totalEl) totalEl.textContent = `₹${grandTotal}`;
  }

  function openCheckoutModal() {
    if (!currentProduct) return;
    checkoutOverlay.classList.add('open');
    window.updateCheckoutSummary();
  }

  function closeCheckoutModal() {
    checkoutOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (checkoutClose) checkoutClose.addEventListener('click', closeCheckoutModal);

  const pincodeInput = document.getElementById('cust-pincode');
  if (pincodeInput) {
    pincodeInput.addEventListener('input', window.updateCheckoutSummary);
  }

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

      const unitPrice = selectedUnitPrice !== null ? selectedUnitPrice : (salePrice(currentProduct.price) || currentProduct.price);
      const totalProductAmount = unitPrice * qty;

      const itemWeightKg = extractWeightInKg(selectedVariantLabel, currentProduct);
      const totalWeightInKg = itemWeightKg * qty;

      let ratePerKg = 0;
      if (D.pincodeShipping && D.pincodeShipping[pincode] !== undefined) {
        ratePerKg = Number(D.pincodeShipping[pincode]);
      } else {
        ratePerKg = D.shipping ? Number(D.shipping.shippingCharge) : 50;
      }

      let shippingFee = Math.round(ratePerKg * totalWeightInKg);
      if (D.shipping && totalProductAmount >= D.shipping.freeShippingAbove) {
        shippingFee = 0;
      }

      const grandTotal = totalProductAmount + shippingFee;
      const orderId = generateOrderId();

      // Ensure name contains variant details: Dark chocolate peanut butter (900gm, Crunchy)
      let displayProductName = currentProduct.name;
      if (selectedVariantLabel) {
        let matches = selectedVariantLabel.split(',').map(s => s.trim());
        if (matches.length > 1) {
          displayProductName = `${currentProduct.name} (${matches[0]}, ${matches[1]})`;
        } else {
          displayProductName = `${currentProduct.name} (${selectedVariantLabel})`;
        }
      }

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
        product_price: unitPrice,
        total_amount: grandTotal,
        payment_id: '',
        razorpay_order_id: '',
        payment_status: 'Pending'
      };

      await syncLocalOrder(orderData);
      triggerRazorpay(currentProduct, qty, grandTotal, shippingFee, orderData, displayProductName);
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
    if (!key || key.includes('PASTE_YOUR') || key.includes('rzp_test_XXXXXXXXX')) {
      alert('⚠️ Razorpay Key ID not configured. Local order preview created anyway!');
      orderData.payment_status = 'Paid (Test Local)';
      orderData.payment_id = 'LOCAL_' + Date.now();
      syncLocalOrder(orderData).then(() => {
        window.location.href = `order-success.html?order_id=${orderData.order_id}&payment_id=${orderData.payment_id}&product=${encodeURIComponent(displayProductName)}&qty=${quantity}&total=${grandTotal}`;
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
