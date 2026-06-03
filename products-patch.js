/**
 * ============================================================
 *  BUNOFEED — Products Patch (products-patch.js)
 *
 *  PURPOSE: Override BUILD_PRODUCT_CARD_ELEMENT so product cards
 *  on shop.html link to /product.html?id=X (SEO-friendly URLs)
 *  instead of opening a modal.
 *
 *  INSTALL: Add this script AFTER /script.js on shop.html only:
 *    <script src="/products-patch.js"></script>
 *
 *  This does NOT affect modal.js, api.js, or GAS connections.
 * ============================================================
 */
(function() {
  'use strict';

  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  window.BUILD_PRODUCT_CARD_ELEMENT = function(p, opts) {
    const D = window.BUNOFEED_DATA || {};
    const pricingKey  = Object.keys(p.pricing||{})[0];
    const pObj        = p.pricing&&pricingKey ? p.pricing[pricingKey] : {};
    const basePrice   = pObj.basePrice || p.price || 0;
    const gstRate     = pObj.gst || 5;
    const discount    = pObj.discount || 0;
    const saleMulti   = D.sale?.active ? (1-D.sale.discountPercent/100) : 1;
    const sellPrice   = Math.round(basePrice * (1+gstRate/100) * (1-discount/100) * saleMulti);
    const displayPrice= p.price || sellPrice;

    // Outer wrapper — always an <a> linking to product page
    const card = document.createElement('a');
    card.href  = `/product.html?id=${encodeURIComponent(p.id)}`;
    card.className = 'product-card';
    card.style.textDecoration = 'none';
    card.setAttribute('aria-label', p.name);

    const saleBadgeHtml = D.sale?.active
      ? `<span class="product-sale-badge">${D.sale.label || 'SALE'} ${D.sale.discountPercent}% OFF</span>` : '';

    const badgeHtml = p.badge
      ? `<span class="product-badge badge-${p.badgeType||'default'}">${esc(p.badge)}</span>` : '';

    const bestSellerHtml = p.bestSeller
      ? `<span class="best-seller-tag"><i class="fas fa-fire"></i> Best Seller</span>` : '';

    const savePct = p.mrp && p.mrp>displayPrice
      ? Math.round(((p.mrp-displayPrice)/p.mrp)*100) : 0;

    card.innerHTML = `
      <div class="product-img-wrap">
        <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy"/>
        ${badgeHtml}${saleBadgeHtml}
      </div>
      <div class="product-info">
        ${bestSellerHtml}
        <p class="product-emoji">${p.emoji||''}</p>
        <h3 class="product-name">${esc(p.name)}</h3>
        <p class="product-tagline">${esc(p.tagline||'')}</p>
        <div class="product-price-row">
          <span class="product-price">₹${displayPrice}</span>
          ${p.mrp ? `<span class="product-mrp">₹${p.mrp}</span>` : ''}
          ${savePct>0 ? `<span class="product-save">${savePct}% OFF</span>` : ''}
        </div>
        <span class="btn btn-primary product-cta-btn">
          <i class="fas fa-eye"></i> View Product
        </span>
      </div>`;

    return card;
  };

})();
