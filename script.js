/* =========================
   CYBERDUCK — OPTIMIZATIONS
========================= */

// API Cache system para reducir llamadas repetidas
const apiCache = new Map();
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

function cachedFetch(url) {
  const now = Date.now();
  const cached = apiCache.get(url);
  
  if (cached && (now - cached.timestamp) < API_CACHE_DURATION) {
    return Promise.resolve(cached.data);
  }
  
  return fetch(url)
    .then(response => response.json())
    .then(data => {
      apiCache.set(url, { data, timestamp: now });
      return data;
    });
}

// Lazy loading de imágenes con Intersection Observer
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target;
      const imageUrl = element.dataset.bgImage;

      if (imageUrl && imageUrl.trim() !== '') {
        // Precargar imagen
        const img = new Image();
        const timeout = setTimeout(() => {
          console.warn('Image load timeout for:', imageUrl);
          element.classList.add('is-error');
          observer.unobserve(element);
        }, 10000); // Timeout de 10 segundos para evitar carga infinita

        img.onload = () => {
          clearTimeout(timeout);
          element.style.backgroundImage = `url(${imageUrl})`;
          element.classList.add('is-loaded');
          observer.unobserve(element);
        };
        img.onerror = () => {
          clearTimeout(timeout);
          console.warn('Image load error for:', imageUrl);
          element.classList.add('is-error');
          observer.unobserve(element);
        };
        img.src = imageUrl;
      } else {
        // No image URL, set error state immediately
        element.classList.add('is-error');
        observer.unobserve(element);
      }
    }
  });
}, {
  rootMargin: '50px',
  threshold: 0.01
});

// Función para aplicar lazy loading a elementos de galería
function applyLazyLoading(selector = '.gallery__image') {
  const images = document.querySelectorAll(selector);
  images.forEach(img => {
    const imageUrl = img.dataset.bgImage;
    if (imageUrl && imageUrl.trim() !== '' && !img.classList.contains('is-loaded') && !img.classList.contains('is-error')) {
      // Cargar imagen inmediatamente para debugging
      const imgEl = new Image();
      imgEl.onload = () => {
        console.log('Image loaded successfully:', imageUrl);
        // Create an actual img element for better display
        const actualImg = document.createElement('img');
        actualImg.src = imageUrl;
        actualImg.style.width = '100%';
        actualImg.style.height = '100%';
        actualImg.style.objectFit = 'cover';
        actualImg.style.borderRadius = '16px';
        actualImg.alt = 'Producto';
        img.innerHTML = '';
        img.appendChild(actualImg);
        img.classList.remove('gallery__image--loading');
        img.classList.add('is-loaded');
        console.log('Created img element for:', imageUrl);
      };
      imgEl.onerror = () => {
        console.warn('Error loading image:', imageUrl);
        img.classList.remove('gallery__image--loading');
        img.classList.add('is-error');
      };
      imgEl.src = imageUrl;
    } else if (!imageUrl || imageUrl.trim() === '') {
      console.warn('Empty image URL for element:', img);
      img.classList.remove('gallery__image--loading');
      img.classList.add('is-error');
    }
  });
}

// Exponer funciones globalmente
window.cyberduck = {
  cachedFetch,
  applyLazyLoading,
  imageObserver
};

/* =========================
   CYBERDUCK — slider simple
========================= */
document.addEventListener('DOMContentLoaded', () => {
  const slides = Array.from(document.querySelectorAll("[data-slide]"));
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const dotsWrap = document.getElementById("dots");

  if (!slides.length || !prevBtn || !nextBtn || !dotsWrap) return;

  let index = 0;

  const setActive = (i) => {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === index));
    Array.from(dotsWrap.children).forEach((d, idx) => d.classList.toggle("is-active", idx === index));
  };

  // dots
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot" + (i === 0 ? " is-active" : "");
    dot.ariaLabel = `Ir al slide ${i + 1}`;
    dot.addEventListener("click", () => setActive(i));
    dotsWrap.appendChild(dot);
  });

  prevBtn.addEventListener("click", () => setActive(index - 1));
  nextBtn.addEventListener("click", () => setActive(index + 1));

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!prefersReduced) {
    setInterval(() => setActive(index + 1), 6500);
  }
});

/* Product modal behavior: open modal when clicking a product, populate fields, allow close */
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const modal = document.getElementById('productModal');
    const backdrop = document.getElementById('productModalBackdrop');
    const closeBtn = document.getElementById('productModalClose');
    const titleEl = document.getElementById('productTitle');
    const priceEl = document.getElementById('productPrice');
    const descEl = document.getElementById('productDescription');
    const imageEl = document.getElementById('productModalImage');

    function gatherProductData(product){
      const name = product.dataset.title || (product.querySelector('.gallery__name') && product.querySelector('.gallery__name').textContent) || 'Producto';
      const price = product.dataset.price || (product.querySelector('.gallery__price') && product.querySelector('.gallery__price').textContent) || '—';
      const desc = product.dataset.description || (product.querySelector('.gallery__meta') && product.querySelector('.gallery__meta').textContent) || '';
      let image = '';
      const imgElement = product.querySelector('.gallery__image img');
      if(imgElement){
        image = imgElement.src;
        console.log('Found img element with src:', image);
      } else {
        // Fallback to dataset if img element not created yet (lazy loading)
        const galleryImage = product.querySelector('.gallery__image');
        image = galleryImage ? galleryImage.dataset.bgImage || '' : '';
        console.log('No img element found, using dataset.bgImage:', image);
      }
      console.log('Final image for product:', name, image);
      return {name, price, desc, image};
    }

    function goToProductPage(product){
      const data = gatherProductData(product);
      try{ localStorage.setItem('cyberduck:selectedProduct', JSON.stringify(data)); }catch(e){ /* ignore */ }
      window.location.href = './product.html';
    }

    // Ensure floating cart UI exists (inject into body) so it works on all pages
    function ensureCartUI(){
      if(document.getElementById('cartButton')) return;
      const container = document.createElement('div');
      container.className = 'cart cart-floating';
      container.innerHTML = `
        <button id="cartButton" class="iconbtn cart-btn" type="button" aria-label="Carrito">🛒<span id="cartCount" class="cart-badge" aria-hidden="true">0</span></button>
        <div id="cartDropdown" class="cart-dropdown" hidden>
          <div class="cart-dropdown__head">
            <strong>Carrito</strong>
            <button id="cartClear" class="btn">Vaciar</button>
          </div>
          <div id="cartItems" class="cart-items"></div>
          <div class="cart-dropdown__foot">
            <div id="cartTotal" class="cart-total">Total: —</div>
            <a id="cartCheckout" class="btn btn--primary" href="#">Pagar →</a>
          </div>
        </div>
      `;
      document.body.appendChild(container);
    }

    ensureCartUI();
    // make checkout link go to checkout page
    const cartCheckoutLink = document.getElementById('cartCheckout');
    if(cartCheckoutLink){ cartCheckoutLink.setAttribute('href', './checkout.html'); }

    // Attach direct listeners to known product elements for reliability
    const items = Array.from(document.querySelectorAll('.gallery__item, .card'));
    items.forEach(item => item.addEventListener('click', function(e){
      e.preventDefault();
      goToProductPage(item);
    }));

    // Fallback: delegated listener for any other trigger
    document.addEventListener('click', function(e){
      const trigger = e.target.closest('[data-product-trigger]');
      if(trigger){
        e.preventDefault();
        goToProductPage(trigger);
      }
    });
  
    /* Cart: simple cart UI and localStorage-backed data */
    const CART_KEY = 'cyberduck:cart';
    function readCart(){
      try{ const raw = localStorage.getItem(CART_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ return []; }
    }
    function writeCart(cart){ try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch(e){}
    }

    function formatPrice(p){ return p.toLocaleString('es-CO'); }

    function renderCart(){
      const btn = document.getElementById('cartButton');
      const countEl = document.getElementById('cartCount');
      const dropdown = document.getElementById('cartDropdown');
      const itemsWrap = document.getElementById('cartItems');
      const totalEl = document.getElementById('cartTotal');
      if(!btn || !countEl || !dropdown || !itemsWrap || !totalEl) return;

      const cart = readCart();
      countEl.textContent = String(cart.length || 0);

      // Enable/disable checkout link depending on cart contents (do this before early return)
      const checkoutLink = document.getElementById('cartCheckout');
      if(checkoutLink){
        if(!cart.length){
          checkoutLink.classList.add('is-disabled');
          checkoutLink.setAttribute('aria-disabled', 'true');
          checkoutLink.setAttribute('href', '#');
        } else {
          checkoutLink.classList.remove('is-disabled');
          checkoutLink.removeAttribute('aria-disabled');
          checkoutLink.setAttribute('href', './checkout.html');
        }
      }

      itemsWrap.innerHTML = '';
      if(!cart.length){
        itemsWrap.innerHTML = '<div class="cart-empty">No hay productos en el carrito</div>';
        totalEl.textContent = 'Total: —';
        return;
      }

      let total = 0;
      cart.forEach((it, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';

        const thumb = document.createElement('div');
        thumb.className = 'cart-item__thumb';
        if(it.image){ thumb.style.backgroundImage = it.image.indexOf('url(') === 0 ? it.image : `url(${it.image})`; }

        const meta = document.createElement('div'); meta.className = 'cart-item__meta';
        const name = document.createElement('div'); name.className = 'cart-item__name'; name.textContent = it.name || 'Producto';
        const parsedPrice = parseFloat((it.price || '').toString().replace(/\$/g, '').replace(/\./g, '').replace(',', '.'));
        const price = document.createElement('div'); price.className = 'cart-item__price'; price.textContent = isNaN(parsedPrice) ? '—' : parsedPrice.toLocaleString('es-CO');

        meta.appendChild(name); meta.appendChild(price);

          const rm = document.createElement('button'); rm.className = 'cart-item__remove'; rm.type = 'button'; rm.innerHTML = '✕';
          rm.addEventListener('click', function(e){
            e.stopPropagation();
            cart.splice(idx,1);
            writeCart(cart);
            renderCart();
            // keep dropdown open after removing
            const dd = document.getElementById('cartDropdown'); if(dd) dd.hidden = false;
            try{ window.dispatchEvent(new Event('cyberduck:cart-updated')); }catch(err){}
          });

        itemEl.appendChild(thumb); itemEl.appendChild(meta); itemEl.appendChild(rm);
        itemsWrap.appendChild(itemEl);

        // Try to parse numeric price for total (best-effort) - handle Spanish format
        const num = (it.price || '').toString().replace(/\$/g, '').replace(/\./g, '').replace(',', '.');
        const val = parseFloat(num) || 0;
        total += val;
      });

      totalEl.textContent = 'Total: $' + (total ? formatPrice(total) : '0');


    }

    // Expose renderCart globally
    window.cyberduck.renderCart = renderCart;

    // Listen for explicit cart-updated events (fired after cart change in-page)
    window.addEventListener('cyberduck:cart-updated', function(){
      renderCart();
      // pulse animation for visual feedback
      const btn = document.getElementById('cartButton');
      if(btn){
        btn.classList.add('is-pulse');
        setTimeout(() => btn.classList.remove('is-pulse'), 480);
      }
    });

    document.addEventListener('click', function(e){
      const cartBtn = e.target.closest('#cartButton');
      if(cartBtn){
        const dd = document.getElementById('cartDropdown');
        if(dd){ dd.hidden = !dd.hidden; if(!dd.hidden) renderCart(); }
      } else {
        // click outside closes cart
        const dd = document.getElementById('cartDropdown');
        if(dd && !e.target.closest('.cart')) dd.hidden = true;
      }
    });

    // Clear cart
    const clearBtn = document.getElementById('cartClear');
    if(clearBtn){ clearBtn.addEventListener('click', function(){ writeCart([]); renderCart(); }); }

    // Initial render
    renderCart();
  });
})();

/* Loading indicator for nuevo section */
(function(){
  const loadingIndicator = document.getElementById('loading-indicator');
  const gallery = document.querySelector('.gallery');

  if (loadingIndicator && gallery) {
    // Show loading indicator initially
    loadingIndicator.style.display = 'flex';
    gallery.style.display = 'none';

    // Simulate loading delay
    setTimeout(() => {
      loadingIndicator.style.display = 'none';
      gallery.style.display = 'grid';
    }, 2000); // 2 seconds delay
  }
})();

/* Search functionality */
document.addEventListener('DOMContentLoaded', function(){
  const searchBtn = document.querySelector('.iconbtn[aria-label="Buscar"]');
  let searchInput = null;
  let searchModal = null;

  if (searchBtn) {
    searchBtn.addEventListener('click', function() {
      if (!searchModal) {
        createSearchModal();
      }
      searchModal.hidden = false;
      if (searchInput) {
        searchInput.focus();
      }
    });
  }

  function createSearchModal() {
    searchModal = document.createElement('div');
    searchModal.className = 'modal';
    searchModal.innerHTML = `
      <div class="modal__backdrop"></div>
      <div class="modal__content" style="max-width: 600px;">
        <div class="modal__head">
          <h3 class="modal__title">Buscar productos</h3>
          <button class="modal__close" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal__body">
          <div class="form-group">
            <input type="text" id="searchInput" placeholder="Buscar productos..." class="input" style="width: 100%;">
          </div>
          <div id="searchResults" style="max-height: 400px; overflow-y: auto; margin-top: 16px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(searchModal);

    searchInput = document.getElementById('searchInput');
    const closeBtn = searchModal.querySelector('.modal__close');
    const backdrop = searchModal.querySelector('.modal__backdrop');

    // Close modal functions
    function closeModal() {
      searchModal.hidden = true;
      if (searchInput) {
        searchInput.value = '';
      }
      const resultsDiv = document.getElementById('searchResults');
      if (resultsDiv) {
        resultsDiv.innerHTML = '';
      }
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !searchModal.hidden) {
        closeModal();
      }
    });

    // Search functionality
    let searchTimeout = null;
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      if (query.length >= 3) {
        searchTimeout = setTimeout(() => {
          performSearch(query);
        }, 300);
      } else {
        const resultsDiv = document.getElementById('searchResults');
        if (resultsDiv) {
          resultsDiv.innerHTML = query.length > 0 ? '<p style="color: var(--muted);">Ingresa al menos 3 letras para buscar...</p>' : '';
        }
      }
    });
  }

  async function performSearch(query) {
    const resultsDiv = document.getElementById('searchResults');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<p style="color: var(--muted);">Buscando...</p>';

    try {
      // Search across all product categories
      const searchPromises = [
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycby8QkrU25mFNgiP3eq0hKoDFOnBSLvybmAnrjX_m4ibdBAqXekiQNbMs1bZbvdOGRWL/exec'), // Nuevo
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzlEH33cVRdLmR3cI17bZi7k81OyucZnhqQ7WAPhJcigixl12fpYH03xMfvL77gGl9x/exec'), // Camisetas
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbxi7qSdxN6ZQdzVYTzAHlfGwkjqmll0ldqGspbxFb8T4GstfDK0MasUNflQUymsbOri/exec'), // Faldas
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbw4zEM2NKmejtMMuiBLDdBEMIyIgtwfr1yHoPXxNBz7_mypqhTTX6tu85DFLGD4Cn_b/exec'), // Aretes
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzDPhkp_9XcrAeg67eek7l5ijVEu7LiWuwgSXR8CEcp1OJwi_vCzqH9bVH0oFI7JLgW/exec'), // Otros
        window.cyberduck.cachedFetch('https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhGPGNmmLa8riYe4CS2khOSoGTVL7DEQ74nVmLsR-UYhEIfckSl1OMf2zROgO7Pk9OrRZMdX2tTmIOzrAkE89PlJIWLHdg4LmF5ABC6Umj2AlQ2Vxyj1ARtSg8PyBFrtT2ZPR9mlc_MN9kA1JepzEkRbABtVxfaKe8FheiklWy8zknXpFF-RcAW2nhuoHkrZ_po5njURSs2EkOJFcXVdF4ZeMaSPNy4r5yMy7UcET3mSYwFlE2JAbVFFYZHtirYZqa3p4YzdBY21pf--RSGJuXOEDH_zg&lib=M-YxSEsKo8g88BRj95yNKp5OjAoyKQGY4'), // Collares
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbz4mKWXZ2NSQ_T2U6cFaLm9CvKLsHzvwJAd2-PSnvqIizSmjeiDgGC7A8vDCtXrfM0e/exec'), // Manillas
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbyLTeWyAHgR_0i2bE50o-ufvp0gK_FnNcVaMc_S80xpSW-6MHQgTLoxm-6eeYeWz6hE/exec'), // Impresiones
        window.cyberduck.cachedFetch('https://script.google.com/macros/s/AKfycbzOjIQtpaVbU8ymtev2cioDvUz6N255uDpsvAyHLf5PFNpBnLBqd4b6HAPKwHYuY72V/exec') // Gargantillas
      ];

      const results = await Promise.all(searchPromises);
      const allProducts = [];

      results.forEach(result => {
        if (result && result.data && Array.isArray(result.data)) {
          allProducts.push(...result.data);
        }
      });

      // Filter products that match the search query
      const matches = allProducts.filter(product => {
        const name = (product.NAME || product.name || product.nombre || '').toLowerCase();
        const desc = (product.DESC || product.desc || product.descripcion || '').toLowerCase();
        return name.includes(query) || desc.includes(query);
      });

      if (matches.length > 0) {
        resultsDiv.innerHTML = matches.slice(0, 10).map(product => {
          const name = product.NAME || product.name || product.nombre || 'Producto';
          const price = product.PRICE || product.price || product.precio || '';
          const image = product.IMAGE || product.image || product.imagen || '';
          const formattedPrice = price ? `$${parseFloat(price).toLocaleString('es-CO')} COP` : '';

          return `
            <div class="search-result-item" style="display: flex; gap: 12px; padding: 12px; border-bottom: 1px solid var(--line); cursor: pointer;" onclick="window.location.href='./product.html'; localStorage.setItem('cyberduck:selectedProduct', JSON.stringify({name:'${name}',price:'${price}',image:'${image}',desc:'${product.DESC || product.desc || product.descripcion || ''}'}))">
              <div style="width: 60px; height: 60px; background: var(--panel); border-radius: 8px; overflow: hidden; flex-shrink: 0;">
                ${image ? `<img src="${image}" alt="${name}" style="width: 100%; height: 100%; object-fit: cover;">` : ''}
              </div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">${name}</div>
                <div style="color: var(--muted); font-size: 14px;">${formattedPrice}</div>
              </div>
            </div>
          `;
        }).join('');
      } else {
        resultsDiv.innerHTML = '<p style="color: var(--muted);">No se encontraron productos que coincidan con tu búsqueda.</p>';
      }

    } catch (error) {
      console.error('Search error:', error);
      resultsDiv.innerHTML = '<p style="color: var(--muted);">Error al buscar productos. Inténtalo de nuevo.</p>';
    }
  }
});

/* Gift card modal */
document.addEventListener('DOMContentLoaded', function(){
  const modal = document.getElementById('giftModal');
  const openBtn = document.getElementById('giftBuyBtn');
  const closeBtn = document.getElementById('giftModalClose');
  const cancelBtn = document.getElementById('giftModalCancel');
  const acceptBtn = document.getElementById('giftModalAccept');
  const valueInput = document.getElementById('giftValue');

  if (!modal || !openBtn || !closeBtn || !cancelBtn || !acceptBtn || !valueInput) return;

  function openModal() {
    modal.hidden = false;
    valueInput.focus();
  }

  function closeModal() {
    modal.hidden = true;
    valueInput.value = '';
  }

  function addToCart() {
    const value = parseInt(valueInput.value);
    if (!value || value < 10000) {
      alert('Por favor ingresa un valor válido (mínimo $10.000 COP)');
      return;
    }

    const giftItem = {
      name: `Tarjeta de Regalo - $${value.toLocaleString('es-CO')} COP`,
      price: value.toLocaleString('es-CO'),
      image: 'url(./imgs/gift.png)',
      desc: 'Tarjeta de regalo con pequeño regalo sorpresa incluido.'
    };

    // Add to cart
    const CART_KEY = 'cyberduck:cart';
    const cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    cart.push(giftItem);
    localStorage.setItem(CART_KEY, JSON.stringify(cart));

    // Update cart UI
    window.dispatchEvent(new Event('cyberduck:cart-updated'));

    closeModal();
    alert('Tarjeta de regalo añadida al carrito!');
  }

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  acceptBtn.addEventListener('click', addToCart);

  // Close on backdrop click
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
});

