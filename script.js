/**
 * ==============================================================
 *  BUNOFEED CLIENT-SIDE SCRIPT — (script.js)
 *  Core logic for carousel swiping, modal overlay, variant pricing,
 *  category filtering, search, and checkout.
 * ==============================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  // Ensure we have active products data
  if (!window.BUNOFEED_DATA) {
    console.error('BUNOFEED_DATA not loaded. Check products.js.');
    return;
  }

  // --- STATE SYSTEM ---
  const state = {
    products: window.BUNOFEED_DATA.products || [],
    categories: window.BUNOFEED_DATA.categories || [],
    campaign: window.BUNOFEED_DATA.campaign || {},
    sale: window.BUNOFEED_DATA.sale || {},
    shipping: window.BUNOFEED_DATA.shipping || { freeShippingAbove: 499, shippingCharge: 60 },
    pincodes: window.BUNOFEED_DATA.serviceablePincodes || [],
    brand: window.BUNOFEED_DATA.brand || {},
    payment: window.BUNOFEED_DATA.payment || {},

    // UI Tracker for Active Modal
    activeProduct: null,
    activeVariantIdx: 0,
    activeQty: 1,
    activeImageIdx: 0,
    descExpanded: false,

    // Touch Swiping Coordinates
    swipeStart: 0,
    swipeEnd: 0,
    isSwiping: false
  };

  // --- RUN DISPATCHER ---
  initCampaignBanner();
  initContactInfo();
  initPincodeSearch();

  // Route specific rendering
  const isShopPage = window.location.pathname.includes('shop.html');
  if (isShopPage) {
    initShopPage(state);
  } else {
    initHomePage(state);
  }

  /* ============================================================
     CAMPAIGN BANNER
  ============================================================ */
  function initCampaignBanner() {
    const active = state.campaign.active === true;
    const banner = document.getElementById('campaign-banner');
    if (!banner) return;

    if (!active) {
      banner.style.display = 'none';
      return;
    }

    // Load custom copy
    const textEl = banner.querySelector('.campaign-text');
    if (textEl) {
      textEl.innerHTML = state.campaign.text || '🎉 Welcome to Bunofeed!';
    }

    // Set styling and anchor
    if (state.campaign.bgColor) {
      banner.style.background = state.campaign.bgColor;
    }
    const linkEl = banner.querySelector('.campaign-link');
    if (linkEl && state.campaign.link) {
      linkEl.href = state.campaign.link;
      linkEl.textContent = state.campaign.linkText || 'Shop Now →';
      linkEl.style.display = 'inline-flex';
    } else if (linkEl) {
      linkEl.style.display = 'none';
    }
    
    // Close handler
    const closeBtn = banner.querySelector('.campaign-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.style.transform = 'translateY(-100%)';
        setTimeout(() => banner.style.display = 'none', 300);
      });
    }
  }

  /* ============================================================
     FOOTER & CONTACT SYNC
  ============================================================ */
  function initContactInfo() {
    const email = state.brand.email || 'bunofeedhelpdesk@gmail.com';
    const instagram = state.brand.instagram || 'https://www.instagram.com';
    const facebook = state.brand.facebook || 'https://www.facebook.com';
    const linkedin = state.brand.linkedin || 'https://www.linkedin.com/in/akash-kumar-995739293';
    const youtube = state.brand.youtube || 'https://www.youtube.com';

    // Populate any direct support email links
    document.querySelectorAll('a[href^="mailto:"]').forEach(el => {
      if (el.getAttribute('href') === 'mailto:bunofeedhelpdesk@gmail.com') {
        el.href = `mailto:${email}`;
        el.textContent = email;
      }
    });

    // Populate social links
    document.querySelectorAll('.social-links a').forEach(el => {
      const cls = el.innerHTML;
      if (cls.includes('fa-instagram')) el.href = instagram;
      else if (cls.includes('fa-facebook')) el.href = facebook;
      else if (cls.includes('fa-linkedin')) el.href = linkedin;
      else if (cls.includes('fa-youtube')) el.href = youtube;
    });
  }

  /* ============================================================
     PINCODE ELIGIBILITY CHECKER (WIDGET IN CONTACT)
  ============================================================ */
  function initPincodeSearch() {
    const btn = document.getElementById('chk-pin-btn');
    const input = document.getElementById('pincode-checker-input');
    const result = document.getElementById('pincode-check-result');
    if (!btn || !input || !result) return;

    btn.addEventListener('click', handleCheck);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') handleCheck(); });

    function handleCheck() {
      const val = input.value.trim();
      if (!/^\d{6}$/.test(val)) {
        result.className = 'status-msg error';
        result.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Please enter a valid 6-digit numeric pincode.';
        result.style.display = 'block';
        return;
      }

      const activeList = state.pincodes || [];
      if (activeList.length === 0) {
        result.className = 'status-msg success';
        result.innerHTML = `<i class="fas fa-check-circle"></i> Yes! We deliver to <strong>${val}</strong> (Accepted Nationwide)`;
        result.style.display = 'block';
        return;
      }

      if (activeList.includes(val)) {
        result.className = 'status-msg success';
        result.innerHTML = `<i class="fas fa-check-circle"></i> Perfect! <strong>${val}</strong> is currently within our express delivery grid.`;
      } else {
        result.className = 'status-msg error';
        result.innerHTML = `<i class="fas fa-times-circle"></i> We apologize. <strong>${val}</strong> is outside our service loop at this stage.`;
      }
      result.style.display = 'block';
    }
  }

  /* ============================================================
     HOMEPAGE PRODUCT RENDERING
  ============================================================ */
  function initHomePage(state) {
    const grid = document.getElementById('homepage-best-sellers-grid');
    if (!grid) return;

    // Filter only visible products
    const visibleProducts = state.products.filter(p => p.visible !== false);
    // Homepage only shows products designated as best sellers
    const bsProducts = visibleProducts.filter(p => p.bestSeller === true);
    
    // If empty render message or load first 4
    const displayList = bsProducts.length > 0 ? bsProducts : visibleProducts.slice(0, 4);

    if (displayList.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1;text-align:center;padding:2rem;color:var(--gray)">No items available at this moment.</div>';
      return;
    }

    grid.innerHTML = displayList.map(p => productCardHtml(p, state)).join('');
    wireProductCardClicks(grid);
  }

  /* ============================================================
     SHOP PAGE CATALOG RENDERING & FILTERING
  ============================================================ */
  function initShopPage(state) {
    const grid = document.getElementById('shop-catalog-grid');
    const filterContainer = document.getElementById('shop-filters');
    const searchInput = document.getElementById('shop-search');
    const productsCount = document.getElementById('catalog-products-count');
    if (!grid) return;

    let activeCategorySlug = 'all';
    let searchQuery = '';

    // Render category filters
    if (filterContainer) {
      const activeCats = state.categories || [];
      const chips = [
        { name: 'All Products', slug: 'all' },
        ...activeCats
      ];
      filterContainer.innerHTML = chips.map(c => 
        `<button class="filter-chip ${c.slug === 'all'?'active':''}" data-slug="${c.slug}">${c.name}</button>`
      ).join('');

      // Wire Category Chips
      filterContainer.querySelectorAll('.filter-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          filterContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          activeCategorySlug = btn.dataset.slug;
          applyFiltersAndSearch();
        });
      });
    }

    // Wire search query
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFiltersAndSearch();
      });
    }

    // First render
    applyFiltersAndSearch();

    function applyFiltersAndSearch() {
      let filtered = state.products.filter(p => p.visible !== false);

      // Category match
      if (activeCategorySlug !== 'all') {
        filtered = filtered.filter(p => p.category === activeCategorySlug);
      }

      // Search match
      if (searchQuery) {
        filtered = filtered.filter(p => 
          p.name.toLowerCase().includes(searchQuery) || 
          (p.tagline && p.tagline.toLowerCase().includes(searchQuery)) ||
          p.description.toLowerCase().includes(searchQuery) ||
          (p.features && p.features.some(f => f.toLowerCase().includes(searchQuery)))
        );
      }

      // Counter
      if (productsCount) {
        productsCount.textContent = `${filtered.length} Product${filtered.length !== 1 ? 's' : ''}`;
      }

      // Empty state
      if (filtered.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding:4rem 1rem; color:var(--gray);">
            <i class="fas fa-search" style="font-size:2.5rem; color:var(--border); margin-bottom:1rem; display:block"></i>
            <h3 style="font-family:var(--font-head); font-weight:700; color:var(--dark); margin-bottom:.3rem">No matches found</h3>
            <p style="font-size:.9rem">Try modifying your search or choosing another category.</p>
          </div>`;
        return;
      }

      grid.innerHTML = filtered.map(p => productCardHtml(p, state)).join('');
      wireProductCardClicks(grid);
    }
  }

  /* ============================================================
     PRODUCT CARD HTML GENERATOR
  ============================================================ */
  function productCardHtml(p, state) {
    // Read price and weights
    const hasVariants = p.variants && p.variants.length > 0;
    const activeWeight = hasVariants ? p.variants[0].weight : (p.weight || '');
    const activePrice  = hasVariants ? p.variants[0].price : (p.price || 0);
    const activeOriginal = hasVariants ? p.variants[0].originalPrice : (p.originalPrice || null);

    // Apply global sale mode discount if active
    let sellingPrice = activePrice;
    let oldPriceHTML = '';

    if (state.sale && state.sale.active === true) {
      const disc = state.sale.discountPercent || 15;
      sellingPrice = Math.round(activePrice * (1 - (disc / 100)));
      oldPriceHTML = `
        <span class="product-price-old">₹${activePrice}</span>
        <span class="sale-discount-tag">${disc}% OFF</span>`;
    } else if (activeOriginal) {
      oldPriceHTML = `<span class="product-price-old">₹${activeOriginal}</span>`;
    }

    // Set badge text & styling
    let badgeHTML = '';
    const isSaleMode = state.sale && state.sale.active === true;
    const activeBadge = isSaleMode ? (state.sale.label || 'SALE') : (p.badge || '');
    const activeBadgeType = isSaleMode ? 'limited' : (p.badgeType || '');

    if (activeBadge) {
      badgeHTML = `<span class="product-badge badge-${activeBadgeType || 'bestseller'}">${activeBadge}</span>`;
    }

    // Find first image URL
    const primaryImg = (p.images && p.images.length > 0) ? p.images[0] : (p.image || '');
    const hasMultiImg = p.images && p.images.length > 1;

    const imgHTML = primaryImg
      ? `<img src="${primaryImg}" alt="${p.name}" class="product-img" loading="lazy" referrerPolicy="no-referrer"/>`
      : `<span class="product-emoji">${p.emoji || '🥜'}</span>`;

    const multiImgIndicator = hasMultiImg 
      ? `<div class="card-multi-indicator"><i class="fas fa-images"></i> 1/${p.images.length} Swipeable</div>` 
      : '';

    return `
      <div class="product-card ${p.bgClass || 'peanut-bg'}" data-id="${p.id}" id="prodcard-${p.id}">
        ${badgeHTML}
        <div class="img-container">
          ${imgHTML}
          ${multiImgIndicator}
        </div>
        <div class="product-card-body">
          <div class="product-weight">${activeWeight}</div>
          <h3 class="product-name">${p.name}</h3>
          <p class="product-tagline">${p.tagline || ''}</p>
          
          <div class="product-footer-row">
            <div class="product-price-block">
              <span class="product-price-current">₹${sellingPrice}</span>
              ${oldPriceHTML}
            </div>
            <button class="btn btn-brown btn-sm card-viewdetails-btn" data-id="${p.id}">
              <i class="fas fa-shopping-cart"></i> View
            </button>
          </div>
        </div>
      </div>`;
  }

  function wireProductCardClicks(container) {
    if (!container) return;
    container.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Prevent trigger if they click another direct nested link, but currently there are none
        const prodId = card.dataset.id;
        if (prodId) openProductModal(prodId);
      });
    });
  }

  /* ============================================================
     PRODUCT DETAIL MODAL CONTROLLER
  ============================================================ */
  const modalOverlay = document.getElementById('product-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  if (modalCloseBtn && modalOverlay) {
    modalCloseBtn.addEventListener('click', closeProductModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductModal();
    });
  }

  function openProductModal(id) {
    const p = state.products.find(prod => prod.id === id);
    if (!p) return;

    state.activeProduct = p;
    state.activeVariantIdx = 0;
    state.activeQty = 1;
    state.activeImageIdx = 0;
    state.descExpanded = false;

    // Trigger overlay styling
    if (modalOverlay) {
      modalOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    // Load initial info
    document.getElementById('m-name').textContent = p.name;
    document.getElementById('m-tagline').textContent = p.tagline || '';
    document.getElementById('m-qty-val').textContent = state.activeQty;

    // Trigger dynamic components
    renderModalCarousel();
    renderModalDescription();
    renderModalVariants();
    renderModalDetails();
    updateModalPriceAndQtyDisplay();
    initCarouselTouchEvents();

    // Reset shipping checkout error status
    document.getElementById('checkout-error-msg').style.display = 'none';

    // Highlight active card or viewport focus if scrolled
  }

  function closeProductModal() {
    if (modalOverlay) {
      modalOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
    state.activeProduct = null;
  }

  /* ============================================================
     CAROUSEL IMAGE SWIPING & Touch Tracking
  ============================================================ */
  function renderModalCarousel() {
    const frame = document.getElementById('m-carousel-frame');
    const dotsContainer = document.getElementById('m-carousel-dots');
    if (!frame || !dotsContainer) return;

    const p = state.activeProduct;
    // Collect active images list
    let imgs = [];
    if (p.images && p.images.length > 0) {
      imgs = [...p.images];
    } else if (p.image && p.image.trim()) {
      imgs = [p.image.trim()];
    }

    if (imgs.length === 0) {
      frame.innerHTML = `
        <div class="carousel-slide active">
          <span class="modal-emoji-placeholder">${p.emoji || '🥜'}</span>
        </div>`;
      dotsContainer.innerHTML = '';
      return;
    }

    frame.innerHTML = imgs.map((u, idx) => `
      <div class="carousel-slide ${idx === 0?'active':''}" data-idx="${idx}">
        <img src="${u}" alt="${p.name} Image ${idx+1}" referrerPolicy="no-referrer"/>
      </div>`
    ).join('');

    dotsContainer.innerHTML = imgs.map((_, idx) => `
      <button class="carousel-dot ${idx === 0?'active':''}" data-idx="${idx}" aria-label="View slide ${idx+1}"></button>`
    ).join('');

    // Wire dots click
    dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateToSlide(parseInt(dot.dataset.idx));
      });
    });
  }

  function navigateToSlide(idx) {
    const frame = document.getElementById('m-carousel-frame');
    const dotsContainer = document.getElementById('m-carousel-dots');
    if (!frame) return;

    const slides = frame.querySelectorAll('.carousel-slide');
    if (idx < 0 || idx >= slides.length) return;

    state.activeImageIdx = idx;

    // Toggle active classes
    slides.forEach((slide, sIdx) => {
      slide.classList.toggle('active', sIdx === idx);
    });

    if (dotsContainer) {
      dotsContainer.querySelectorAll('.carousel-dot').forEach((dot, sIdx) => {
        dot.classList.toggle('active', sIdx === idx);
      });
    }
  }

  function initCarouselTouchEvents() {
    const carContainer = document.getElementById('m-carousel-container');
    if (!carContainer) return;

    // Unbind prior listeners by replacing the element or standard overwrite
    // Let's bind standard touch and pointer events
    carContainer.onmousedown = dragStart;
    carContainer.ontouchstart = dragStart;

    carContainer.onmousemove = dragMove;
    carContainer.ontouchmove = dragMove;

    carContainer.onmouseup = dragEnd;
    carContainer.onmouseleave = dragEnd;
    carContainer.ontouchend = dragEnd;

    function dragStart(e) {
      state.isSwiping = true;
      state.swipeStart = getCoordX(e);
    }
    function dragMove(e) {
      if (!state.isSwiping) return;
      state.swipeEnd = getCoordX(e);
    }
    function dragEnd() {
      if (!state.isSwiping) return;
      state.isSwiping = false;

      const diff = state.swipeStart - state.swipeEnd;
      const threshold = 55; // minimum px movement to trigger slide

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          // Swipe left -> Next image
          navigateToSlide(state.activeImageIdx + 1);
        } else {
          // Swipe right -> Prior image
          navigateToSlide(state.activeImageIdx - 1);
        }
      }
    }
    function getCoordX(e) {
      return e.touches ? e.touches[0].clientX : e.clientX;
    }
  }

  /* ============================================================
     TRUNCATED REUSABLE DESCRIPTION
  ============================================================ */
  function renderModalDescription() {
    const container = document.getElementById('m-description-container');
    if (!container) return;

    const p = state.activeProduct;
    const desc = p.description || '';

    // If description fits easily inside 2 lines (approx 120 chars) don't truncate
    if (desc.length <= 130) {
      container.innerHTML = `<p class="m-desc">${desc}</p>`;
      return;
    }

    const shortText = desc.substring(0, 110) + '…';

    container.innerHTML = `
      <p class="m-desc" id="m-desc-text">${shortText}</p>
      <button class="m-desc-toggle-btn" id="m-desc-toggle-btn">
        <span>More <i class="fas fa-chevron-down"></i></span>
      </button>`;

    const toggleBtn = document.getElementById('m-desc-toggle-btn');
    const descText  = document.getElementById('m-desc-text');

    if (toggleBtn && descText) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.descExpanded = !state.descExpanded;
        if (state.descExpanded) {
          descText.textContent = desc;
          toggleBtn.innerHTML = 'Less <i class="fas fa-chevron-up"></i>';
        } else {
          descText.textContent = shortText;
          toggleBtn.innerHTML = 'More <i class="fas fa-chevron-down"></i>';
        }
      });
    }
  }

  /* ============================================================
     VARIANTS CHIP MATRIX & QUANTITY
  ============================================================ */
  function renderModalVariants() {
    const matrix = document.getElementById('m-variants-matrix');
    if (!matrix) return;

    const p = state.activeProduct;
    let fallbackVars = [];

    if (p.variants && p.variants.length > 0) {
      fallbackVars = [...p.variants];
    } else {
      fallbackVars = [{ weight: p.weight || '400g', price: p.price || 0, originalPrice: p.originalPrice || null }];
    }

    matrix.innerHTML = fallbackVars.map((v, idx) => `
      <button class="variant-chip ${idx === 0?'active':''}" data-idx="${idx}">
        <span class="weight-tag">${v.weight}</span>
        <span class="price-brief">₹${getVariantSellingPrice(v)}</span>
      </button>`
    ).join('');

    matrix.querySelectorAll('.variant-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        matrix.querySelectorAll('.variant-chip').forEach(ch => ch.classList.remove('active'));
        chip.classList.add('active');
        state.activeVariantIdx = parseInt(chip.dataset.idx);
        updateModalPriceAndQtyDisplay();
      });
    });
  }

  function getVariantSellingPrice(v) {
    if (state.sale && state.sale.active === true) {
      const disc = state.sale.discountPercent || 15;
      return Math.round(v.price * (1 - (disc / 100)));
    }
    return v.price;
  }

  // Bind Quantity change buttons
  const qtyMinus = document.getElementById('m-qty-minus');
  const qtyPlus = document.getElementById('m-qty-plus');

  if (qtyMinus && qtyPlus) {
    qtyMinus.onclick = (e) => {
      e.stopPropagation();
      if (state.activeQty > 1) {
        state.activeQty--;
        document.getElementById('m-qty-val').textContent = state.activeQty;
        updateModalPriceAndQtyDisplay();
      }
    };
    qtyPlus.onclick = (e) => {
      e.stopPropagation();
      if (state.activeQty < 20) {
        state.activeQty++;
        document.getElementById('m-qty-val').textContent = state.activeQty;
        updateModalPriceAndQtyDisplay();
      }
    };
  }

  function updateModalPriceAndQtyDisplay() {
    const p = state.activeProduct;
    if (!p) return;

    let v = null;
    if (p.variants && p.variants.length > 0) {
      v = p.variants[state.activeVariantIdx] || p.variants[0];
    } else {
      v = { price: p.price, originalPrice: p.originalPrice };
    }

    const basePrice = v.price;
    const baseOriginal = v.originalPrice;

    // Apply discount
    let sellingPrice = basePrice;
    let oldHTML = '';

    if (state.sale && state.sale.active === true) {
      const disc = state.sale.discountPercent || 15;
      sellingPrice = Math.round(basePrice * (1 - (disc / 100)));
      oldHTML = `
        <span class="m-price-crossed">₹${basePrice * state.activeQty}</span>
        <span class="m-price-tag">- ${disc}% OFF</span>`;
    } else if (baseOriginal) {
      oldHTML = `<span class="m-price-crossed">₹${baseOriginal * state.activeQty}</span>`;
    }

    // Set prices in active footer row
    document.getElementById('m-price').textContent = `₹${sellingPrice * state.activeQty}`;
    document.getElementById('m-old-price-container').innerHTML = oldHTML;

    // Calculate free shipping hint info
    const subtotal = sellingPrice * state.activeQty;
    const shipLimit = state.shipping.freeShippingAbove || 499;
    const charge = state.shipping.shippingCharge || 60;
    const indicator = document.getElementById('m-shipping-info-indicator');

    if (indicator) {
      if (subtotal >= shipLimit) {
        indicator.innerHTML = `<i class="fas fa-truck" style="color:var(--success)"></i> Your order qualifies for <strong>FREE Shipping!</strong>`;
      } else {
        const diff = shipLimit - subtotal;
        indicator.innerHTML = `<i class="fas fa-info-circle"></i> Add <strong>₹${diff}</strong> more to get <strong>FREE Express Delivery</strong> (Save ₹${charge})`;
      }
    }
  }

  /* ============================================================
     TAB DETAILS AND SPECIAL STATS (INGREDIENTS, BENEFITS)
  ============================================================ */
  function renderModalDetails() {
    const p = state.activeProduct;

    // Features list
    const featsContainer = document.getElementById('m-features-list');
    if (featsContainer) {
      const list = p.features || [];
      if (list.length > 0) {
        featsContainer.innerHTML = list.map(f => `<span class="m-feature-pill"><i class="fas fa-certificate"></i> ${f}</span>`).join('');
        featsContainer.style.display = 'flex';
      } else {
        featsContainer.style.display = 'none';
      }
    }

    // Extra collapsible tabs (ingredients / allergen / benefits / storage)
    const ingText = document.getElementById('m-detail-ingredients');
    const benText = document.getElementById('m-detail-benefits');
    const storText = document.getElementById('m-detail-storage');
    const allText = document.getElementById('m-detail-allergen');

    if (ingText)  ingText.innerHTML  = formatBulletLines(p.ingredients  || 'Prepared with premium, wholesome organic food inputs under strict quality checks.');
    if (benText)  benText.innerHTML  = formatBulletLines(p.keyBenefits  || '🔥 Loaded with plant-based protein • Heart-healthy choice • Clean sustained energy.');
    if (storText) storText.innerHTML = formatBulletLines(p.storageInfo  || 'Store in a cool dry place. Close lid tightly after serving.');
    if (allText)  allText.innerHTML  = formatBulletLines(p.allergenInfo || 'Clean recipe. Processed in an allergen-safe, peanut-loving, fully sterilized environment.');

    // Tab controllers
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const tabName = btn.dataset.tab;
        const body    = btn.closest('.tab-container');
        body.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        body.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        body.querySelector(`.tab-panel[data-tab="${tabName}"]`).classList.add('active');
      };
    });
  }

  function formatBulletLines(str) {
    if (!str) return '';
    // Format if multiple points are listed using bullet separator •
    if (str.includes('•')) {
      return '<ul>' + str.split('•').map(s => s.trim()).filter(Boolean).map(s => `<li>${s}</li>`).join('') + '</ul>';
    }
    return `<p>${str}</p>`;
  }

  /* ============================================================
     SECURE RAZORPAY INTEGRATION AND REAL-TIME CHECKOUTS
  ============================================================ */
  const checkoutBtn = document.getElementById('m-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', startCheckoutFlow);
  }

  async function startCheckoutFlow(e) {
    e.stopPropagation();

    const name  = document.getElementById('checkout-name').value.trim();
    const email = document.getElementById('checkout-email').value.trim();
    const phone = document.getElementById('checkout-phone').value.trim();
    const addr  = document.getElementById('checkout-address').value.trim();
    const pin   = document.getElementById('checkout-pincode').value.trim();

    const errBox = document.getElementById('checkout-error-msg');
    errBox.style.display = 'none';

    // 1. Basic empty validations
    if (!name || !email || !phone || !addr || !pin) {
      showCheckoutError('All fields marked * are required to dispatch your package secure.');
      return;
    }

    // 2. Format validations
    if (!/^\d{10}$/.test(phone)) {
      showCheckoutError('Please enter a valid 10-digit Phone Number.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showCheckoutError('Please enter a valid Email address.');
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      showCheckoutError('Please enter a valid 6-digit Delivery Pincode.');
      return;
    }

    // 3. Pincode Active Verification
    const serviceable = state.pincodes || [];
    if (serviceable.length > 0 && !serviceable.includes(pin)) {
      showCheckoutError(`We apologize. The pincode ${pin} is currently outside our serviceable circle.`);
      return;
    }

    // 4. Loading button state
    checkoutBtn.classList.add('loading');
    checkoutBtn.disabled = true;

    // Get active variant details
    const p = state.activeProduct;
    let v = null;
    if (p.variants && p.variants.length > 0) {
      v = p.variants[state.activeVariantIdx];
    } else {
      v = { weight: p.weight || '400g', price: p.price };
    }

    const sellingPrice = getVariantSellingPrice(v);
    const subtotal = sellingPrice * state.activeQty;

    // Add delivery charge constraints
    const freeThresh = state.shipping.freeShippingAbove || 499;
    const shippingFee = subtotal >= freeThresh ? 0 : (state.shipping.shippingCharge || 60);
    const totalAmount = subtotal + shippingFee;

    // Get credentials configured by the merchant
    const rzpKeyId     = state.payment.razorpayKeyId || '';
    const merchantName = state.payment.businessName  || 'Bunofeed';
    const themeColor   = state.payment.themeColor    || '#FF6B00';

    try {
      // Create Order at backend
      const r = await window.BUNOFEED_API.post('createOrder', {
        productName: p.name,
        variantWeight: v.weight,
        qty: state.activeQty,
        price: sellingPrice,
        shippingCharge: shippingFee,
        total: totalAmount,
        customerName: name,
        email,
        phone,
        address: addr,
        pincode: pin
      });

      if (r.status !== 'success' || !r.order) {
        throw new Error(r.message || 'Failed to initialize checkout transaction.');
      }

      const backendOrder = r.order;

      // Check if Razorpay Key is missing - if so, allow Sandbox Mock/Simulated placement
      if (!rzpKeyId) {
        console.warn('Razorpay Key ID is empty. Processing in Sandbox Local Mode.');
        setTimeout(async () => {
          // Simulate payment callback success directly to mock backend
          const successPaymentId = 'pay_MOCK_' + Math.random().toString(36).substring(2, 10).toUpperCase();
          await window.BUNOFEED_API.post('updateOrder', {
            orderId: backendOrder.orderId,
            newStatus: 'Confirmed',
            paymentId: successPaymentId,
            paymentStatus: 'Success'
          });
          
          checkoutBtn.classList.remove('loading');
          checkoutBtn.disabled = false;
          closeProductModal();

          // Redirect to checkout success page
          window.location.href = `/order-success.html?orderId=${backendOrder.orderId}&phone=${phone}`;
        }, 1200);
        return;
      }

      // Check if razorpay script exists in parent windows, else lazy-inject
      if (typeof Razorpay === 'undefined') {
        const sc = document.createElement('script');
        sc.src = 'https://checkout.razorpay.com/v1/checkout.js';
        sc.onload = () => initRazorpayWidget(rzpKeyId, backendOrder, totalAmount, merchantName, themeColor, phone, email);
        document.body.appendChild(sc);
      } else {
        initRazorpayWidget(rzpKeyId, backendOrder, totalAmount, merchantName, themeColor, phone, email);
      }

    } catch (err) {
      checkoutBtn.classList.remove('loading');
      checkoutBtn.disabled = false;
      showCheckoutError(err.message || 'Network error occurred. Please try again.');
    }
  }

  function initRazorpayWidget(key, backendOrder, amount, name, theme, phone, email) {
    const options = {
      key: key,
      amount: amount * 100, // in paisa
      currency: 'INR',
      name: name,
      description: `Purchase – ${backendOrder.productName} (${backendOrder.variantWeight})`,
      image: 'https://bunofeed.in/images/logo2.png',
      order_id: backendOrder.rzpOrderId || '', // Generated by Razorpay orders API in real setups
      handler: async function (response) {
        checkoutBtn.classList.add('loading');
        
        // Confirm checkout validation at backend via update API
        try {
          const statusResult = await window.BUNOFEED_API.post('updateOrder', {
            orderId: backendOrder.orderId,
            newStatus: 'Confirmed',
            paymentId: response.razorpay_payment_id || response.paymentId || 'pay_manual',
            paymentStatus: 'Success'
          });

          checkoutBtn.classList.remove('loading');
          checkoutBtn.disabled = false;
          closeProductModal();

          window.location.href = `/order-success.html?orderId=${backendOrder.orderId}&phone=${phone}`;
        } catch (e) {
          checkoutBtn.classList.remove('loading');
          checkoutBtn.disabled = false;
          showCheckoutError('Payment verified, but failed to register order. Support email: bunofeedhelpdesk@gmail.com');
        }
      },
      prefill: {
        name: backendOrder.customerName,
        email: email,
        contact: phone
      },
      theme: {
        color: theme
      },
      modal: {
        ondismiss: function () {
          checkoutBtn.classList.remove('loading');
          checkoutBtn.disabled = false;
        }
      }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      showCheckoutError(`Payment failed: ${resp.error.description}`);
      checkoutBtn.classList.remove('loading');
      checkoutBtn.disabled = false;
    });
    rzp.open();
  }

  function showCheckoutError(msg) {
    const errBox = document.getElementById('checkout-error-msg');
    if (errBox) {
      errBox.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${msg}</span>`;
      errBox.style.display = 'flex';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ============================================================
     GLOBAL HAMBURGER MOBILE MENU CONTROLLER
  ============================================================ */
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      hamburger.classList.toggle('active', open);
      hamburger.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
  }

});
