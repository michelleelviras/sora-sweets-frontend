/* Sora Sweets – lógica compartida de todas las vistas */
(() => {
  'use strict';

  /* ───────── Configuración ───────── */
  // Si tu backend cambia de URL, solo modifica esta línea.
  const API = 'https://sora-sweets-backend.onrender.com/api';
  const FREE = 180, COUPON = 10, SHIP = 35;
  // false = usa img/<nombre-del-producto>.jpg y, si no existe, una ilustración generada con el nombre.
  // true  = usa primero el campo "imagen" guardado en MongoDB.
  const USE_DB_IMAGES = false;
  const PAGES = { 'catalogo-feed': 'index.html', explorar: 'index.html', carrito: 'carrito.html', 'registro-cuenta': 'registro.html' };

  /* ───────── Helpers ───────── */
  const $ = (s, r = document) => r.querySelector(s);
  const money = n => '$' + Number(n || 0).toFixed(2);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* almacenamiento lleno o bloqueado */ } };
  const fill = (tpl, o) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k] ?? '');
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const CHIP = 'category-chip flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-transform active:scale-95';

  /* ───────── Enlaces del menú (primero, para que siempre funcionen) ───────── */
  document.querySelectorAll('a[data-path]').forEach(a => { if (PAGES[a.dataset.path]) a.href = PAGES[a.dataset.path]; });

  /* ───────── API ───────── */
  async function request(method, path, body) {
    const r = await fetch(API + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Error ' + r.status);
    return d;
  }
  const get = p => request('GET', p);
  const post = (p, b) => request('POST', p, b);

  /* ───────── Imágenes relacionadas con el nombre ───────── */
  const EMOJIS = [
    [/pocky|palito|stick|biscuit|galleta|cookie/, '🍪'], [/kit.?kat|chocolate|cacao|choco/, '🍫'],
    [/matcha|te verde|te |tea|cafe|coffee/, '🍵'], [/ramune|soda|refresco|bebida|jugo|limonada|calpis/, '🥤'],
    [/mochi|daifuku|dango/, '🍡'], [/taiyaki|dorayaki|pancake|hotcake/, '🥞'],
    [/helado|ice|nieve|paleta/, '🍦'], [/gomita|gummy|gominola|caramelo|candy|dulce/, '🍬'],
    [/ramen|fideo|noodle|sopa/, '🍜'], [/arroz|onigiri|rice/, '🍙'], [/papas|chips|snack|botana|crujiente/, '🥔'],
    [/fresa|strawberry/, '🍓'], [/melon/, '🍈'], [/uva|grape/, '🍇'], [/mango/, '🥭'], [/durazno|peach|momo/, '🍑'],
    [/yuzu|limon|lemon|citrico/, '🍋'], [/sakura|cereza|cherry/, '🌸'], [/pastel|cake|tarta/, '🍰'], [/pan |bread|bakery/, '🍞']
  ];
  const PALETTES = [['#ffe0e6', '#ffb2bc'], ['#e3f4d3', '#caeaac'], ['#fff0d6', '#ffd9a8'], ['#e7e0ff', '#c9bdf5'], ['#d9f1f7', '#a9dbe8'], ['#ffe6f1', '#ffc2dd']];
  const hash = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  function art(p) {
    const text = norm([p.nombre, (p.etiquetas || []).join(' '), p.categoria].join(' '));
    const hit = EMOJIS.find(([re]) => re.test(text));
    const emoji = hit ? hit[1] : '🍬';
    const [c1, c2] = PALETTES[hash(p.nombre) % PALETTES.length];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="400" fill="url(#g)"/><text x="200" y="240" font-size="170" text-anchor="middle">${emoji}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  // Devuelve { src, fb }: src es la imagen "real" y fb la ilustración de respaldo.
  function imgPair(p) {
    const local = 'img/' + slug(p.nombre) + '.jpg';
    return { src: (USE_DB_IMAGES && p.imagen) || local, fb: art(p) };
  }
  const imgAttrs = p => { const i = imgPair(p); return `src="${esc(i.src)}" data-fb="${esc(i.fb)}"`; };
  // Si una imagen falla, se cambia automáticamente por su respaldo.
  document.addEventListener('error', e => {
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.fb) { const fb = t.dataset.fb; t.removeAttribute('data-fb'); t.src = fb; }
  }, true);

  /* ───────── Sesión (se queda guardada en el navegador) ───────── */
  const Session = {
    get user() { return load('sora_user', null); },
    set(u) { save('sora_user', { _id: u._id, nombre: u.nombre, email: u.email }); },
    clear() { try { localStorage.removeItem('sora_user'); } catch { /* nada */ } }
  };
  window.Session = Session;

  /* ───────── Favoritos (se guardan en el navegador) ───────── */
  const Favs = {
    get ids() { return load('sora_favs', []); },
    has(id) { return Favs.ids.includes(id); },
    toggle(id) {
      const ids = Favs.ids, i = ids.indexOf(id);
      if (i >= 0) ids.splice(i, 1); else ids.push(id);
      save('sora_favs', ids); return i < 0;
    }
  };
  const heart = on => `<span class="material-symbols-outlined text-[16px] ${on ? 'text-primary' : ''}" style="font-variation-settings:'FILL' ${on ? 1 : 0}">favorite</span>`;

  /* ───────── Carrito (localStorage) ───────── */
  const Cart = {
    get items() { return load('sora_cart', []); },
    set(items) { save('sora_cart', items); badge(); if (Cart.onChange) Cart.onChange(); },
    add(p, n = 1) {
      const items = Cart.items, it = items.find(i => i.id === p._id);
      if (it) { if (p.stock && it.cantidad + n > p.stock) return false; it.cantidad += n; }
      else {
        if (p.stock && n > p.stock) return false;
        items.push({ id: p._id, nombre: p.nombre, precio: p.precio, categoria: p.categoria || '', descripcion: p.descripcion || '', imagen: p.imagen || '', stock: p.stock, cantidad: n });
      }
      Cart.set(items); return true;
    },
    qty(id, d) {
      let items = Cart.items; const it = items.find(i => i.id === id); if (!it) return;
      const n = it.cantidad + d;
      if (n < 1) items = items.filter(i => i.id !== id);
      else if (it.stock && n > it.stock) return alert('Solo hay ' + it.stock + ' en stock');
      else it.cantidad = n;
      Cart.set(items);
    },
    remove(id) { Cart.set(Cart.items.filter(i => i.id !== id)); },
    totals() {
      const items = Cart.items;
      const count = items.reduce((a, i) => a + i.cantidad, 0);
      const subtotal = items.reduce((a, i) => a + i.cantidad * i.precio, 0);
      const shipping = !count || subtotal >= FREE ? 0 : SHIP;
      const discount = count ? COUPON : 0;
      return { count, subtotal, shipping, discount, total: Math.max(0, subtotal + shipping - discount) };
    }
  };
  window.Cart = Cart;

  function badge() {
    const n = Cart.items.reduce((a, i) => a + i.cantidad, 0);
    document.querySelectorAll('a[data-path="carrito"] span').forEach(s => {
      if (/^\d+$/.test(s.textContent.trim())) { s.textContent = n; s.style.display = n ? '' : 'none'; }
    });
  }

  /* ───────── Productos (con caché para que cargue rápido) ───────── */
  async function loadProducts(onData) {
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem('sora_products')); } catch { /* sin caché */ }
    if (cached && cached.length) onData(cached, true);
    const fresh = await get('/productos');
    try { sessionStorage.setItem('sora_products', JSON.stringify(fresh)); } catch { /* nada */ }
    onData(fresh, false);
    return fresh;
  }
  function toast(text) {
    const t = document.getElementById('toast-cart'), tt = document.getElementById('toast-text');
    if (!t || !tt) return;
    tt.textContent = text;
    t.classList.remove('opacity-0', 'pointer-events-none', 'scale-95'); t.classList.add('opacity-100', 'scale-100');
    clearTimeout(toast.id);
    toast.id = setTimeout(() => { t.classList.remove('opacity-100', 'scale-100'); t.classList.add('opacity-0', 'pointer-events-none', 'scale-95'); }, 1700);
  }

  /* ───────── Catálogo: filtros, orden, favoritos, buscador ───────── */
  async function initCatalogo() {
    const box = $('#lista-productos'), search = $('#sweet-search');
    const S = { words: [], sort: 'rel', max: null, vegan: false, favs: false };
    let all = [];

    // Saludo si hay sesión
    const user = Session.user, h1 = $('h1');
    if (user && h1) h1.textContent = '¡Hola, ' + user.nombre.split(' ')[0] + '!';

    // Panel de filtros (se muestra con el botón "Filtro" o con el ícono de ajustes)
    const panel = document.createElement('div');
    panel.id = 'panel-filtros';
    panel.className = 'hidden flex-col gap-3 bg-surface-container-lowest rounded-lg p-space-md shadow-sm mb-space-sm';
    panel.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <label class="font-label-md text-label-md text-on-surface-variant" for="f-sort">Ordenar por</label>
        <select id="f-sort" class="bg-surface-container-low rounded-full px-3 py-2 font-label-md text-label-md text-on-surface focus:outline-none">
          <option value="rel">Relevancia</option>
          <option value="asc">Precio: menor a mayor</option>
          <option value="desc">Precio: mayor a menor</option>
          <option value="az">Nombre: A → Z</option>
        </select>
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between font-label-md text-label-md text-on-surface-variant">
          <label for="f-price">Precio máximo</label><span id="f-price-val" class="text-primary font-bold"></span>
        </div>
        <input id="f-price" type="range" min="0" max="100" step="1" class="w-full accent-[#a8334e]"/>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" id="f-vegan" class="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md">🌱 Vegano</button>
        <button type="button" id="f-favs" class="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant font-label-md text-label-md">❤ Mis favoritos</button>
        <button type="button" id="f-clear" class="px-3 py-1.5 rounded-full text-primary font-label-md text-label-md underline">Limpiar</button>
      </div>`;
    box.parentElement.insertBefore(panel, box);
    const toggle = () => { panel.classList.toggle('hidden'); panel.classList.toggle('flex'); };
    document.querySelectorAll('button').forEach(b => {
      if (/Filtro/.test(b.textContent) || b.getAttribute('aria-label') === 'Filtros avanzados') b.addEventListener('click', toggle);
    });

    const pill = (btn, on) => { btn.className = 'px-3 py-1.5 rounded-full font-label-md text-label-md ' + (on ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container text-on-surface-variant'); };
    const priceEl = $('#f-price'), priceVal = $('#f-price-val');

    const card = p => {
      const fav = Favs.has(p._id);
      return `
      <div class="group relative flex flex-col justify-between p-2.5 bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-shadow">
        <a href="producto.html?id=${esc(p._id)}" class="flex flex-col">
          <div class="relative w-full aspect-square rounded-[1.25rem] overflow-hidden bg-surface-container mb-2">
            <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" ${imgAttrs(p)} alt="${esc(p.nombre)}" loading="lazy"/>
            <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-secondary-container/90 text-on-secondary-container text-[10px] font-medium">${esc(p.categoria || 'Popular')}</span>
          </div>
          <h3 class="font-bold text-[15px] mb-1 text-on-surface line-clamp-1">${esc(p.nombre)}</h3>
          <p class="text-xs text-on-surface-variant line-clamp-2 mb-2">${esc(p.descripcion || '')}</p>
        </a>
        <button data-fav="${esc(p._id)}" aria-label="Guardar favorito" class="absolute top-4 right-4 w-7 h-7 bg-surface/80 rounded-full flex items-center justify-center text-on-surface hover:text-primary transition-colors">${heart(fav)}</button>
        <div class="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
          <span class="font-bold text-primary text-base">${money(p.precio)}</span>
          <button data-add="${esc(p._id)}" aria-label="Agregar ${esc(p.nombre)} al carrito" class="bg-primary text-on-primary rounded-full w-8 h-8 flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>`;
    };

    const draw = () => {
      const q = norm(search && search.value);
      let list = all.filter(p => {
        const c = norm(p.categoria);
        const okCat = !S.words.length || (c && S.words.some(w => c.includes(w) || w.includes(c)));
        const text = norm([p.nombre, p.descripcion, p.categoria, (p.etiquetas || []).join(' '), p.detalles && p.detalles.pais_origen].join(' '));
        return okCat && (!q || text.includes(q))
          && (S.max == null || p.precio <= S.max)
          && (!S.vegan || (p.detalles && p.detalles.es_vegano))
          && (!S.favs || Favs.has(p._id));
      });
      if (S.sort === 'asc') list.sort((a, b) => a.precio - b.precio);
      else if (S.sort === 'desc') list.sort((a, b) => b.precio - a.precio);
      else if (S.sort === 'az') list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      box.innerHTML = list.map(card).join('') || '<p class="col-span-2 text-center py-8 text-on-surface-variant">No encontramos dulces con ese filtro 🍡</p>';
      const n = $('#n-prod'); if (n) n.textContent = list.length + (list.length === 1 ? ' delicia' : ' delicias');
      pill($('#f-vegan'), S.vegan); pill($('#f-favs'), S.favs);
    };

    const setData = (data, fromCache) => {
      all = data;
      const top = Math.ceil(Math.max(10, ...all.map(p => p.precio || 0)));
      priceEl.max = top;
      if (S.max == null) priceEl.value = top;
      priceVal.textContent = money(priceEl.value);
      draw();
    };

    box.innerHTML = '<p class="col-span-2 text-center py-8 text-on-surface-variant">Cargando dulces… 🍡<br><span class="text-xs">(el servidor puede tardar hasta un minuto en despertar)</span></p>';
    try { await loadProducts(setData); }
    catch (e) {
      if (!all.length) { box.innerHTML = '<p class="col-span-2 text-center py-8 text-error">No se pudo cargar el catálogo. Recarga la página.</p>'; return; }
    }

    // Eventos
    box.addEventListener('click', e => {
      const f = e.target.closest('[data-fav]');
      if (f) { f.innerHTML = heart(Favs.toggle(f.dataset.fav)); if (S.favs) draw(); return; }
      const b = e.target.closest('[data-add]'); if (!b) return;
      const p = all.find(x => x._id === b.dataset.add); if (!p) return;
      if (!Cart.add(p)) return alert('Ya agregaste todo el stock disponible de ' + p.nombre);
      if (window.addToCart) window.addToCart(b, p.nombre); else toast('¡' + p.nombre + ' agregado!');
    });
    document.querySelectorAll('.category-chip').forEach(c => c.addEventListener('click', () => {
      S.words = norm(c.querySelectorAll('span')[1].textContent).split(/[^a-z]+/).filter(w => w.length > 3); draw();
    }));
    const todas = $('#ver-todas');
    if (todas) todas.addEventListener('click', () => { S.words = []; document.querySelectorAll('.category-chip').forEach(c => c.className = CHIP); draw(); });
    if (search) search.addEventListener('input', draw);
    $('#f-sort').addEventListener('change', e => { S.sort = e.target.value; draw(); });
    priceEl.addEventListener('input', () => { S.max = Number(priceEl.value); priceVal.textContent = money(S.max); draw(); });
    $('#f-vegan').addEventListener('click', () => { S.vegan = !S.vegan; draw(); });
    $('#f-favs').addEventListener('click', () => { S.favs = !S.favs; draw(); });
    $('#f-clear').addEventListener('click', () => {
      Object.assign(S, { words: [], sort: 'rel', max: null, vegan: false, favs: false });
      $('#f-sort').value = 'rel'; priceEl.value = priceEl.max; priceVal.textContent = money(priceEl.max);
      if (search) search.value = '';
      document.querySelectorAll('.category-chip').forEach(c => c.className = CHIP);
      draw();
    });
  }

  /* ───────── Detalle de producto (producto.html?id=...) ───────── */
  async function initProducto() {
    const root = $('#detalle'), id = new URLSearchParams(location.search).get('id');
    if (!id) { root.innerHTML = '<p class="text-center py-10">Producto no encontrado. <a class="text-primary underline font-bold" href="index.html">Volver al catálogo</a></p>'; return; }
    root.innerHTML = '<p class="text-center py-10 text-on-surface-variant">Cargando… 🍡</p>';
    let p, todos = [];
    try {
      p = await get('/productos/' + encodeURIComponent(id));
      try { todos = JSON.parse(sessionStorage.getItem('sora_products')) || await get('/productos'); } catch { todos = []; }
    } catch (e) {
      root.innerHTML = '<p class="text-center py-10 text-error">No se pudo cargar el producto. <a class="text-primary underline font-bold" href="index.html">Volver al catálogo</a></p>'; return;
    }
    document.title = p.nombre + ' · Sora Sweets';
    const d = p.detalles || {};
    const chips = [
      d.pais_origen && `🌏 ${esc(d.pais_origen)}`,
      d.contenido_gramos && `⚖️ ${d.contenido_gramos} g`,
      d.es_vegano && '🌱 Vegano'
    ].filter(Boolean).map(t => `<span class="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container font-label-md text-label-md">${t}</span>`).join('');
    const tags = (p.etiquetas || []).map(t => `<span class="px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-label-sm text-label-sm">#${esc(t)}</span>`).join('');
    const alerg = (p.alergenos || []).length ? `<p class="font-body-md text-body-md text-on-surface-variant"><b>Alérgenos:</b> ${p.alergenos.map(esc).join(', ')}</p>` : '<p class="font-body-md text-body-md text-on-surface-variant"><b>Alérgenos:</b> ninguno declarado</p>';
    const agotado = !(p.stock > 0);
    let qty = 1;
    root.innerHTML = `
      <div class="relative w-full aspect-square rounded-3xl overflow-hidden bg-surface-container shadow-sm">
        <img class="w-full h-full object-cover" ${imgAttrs(p)} alt="${esc(p.nombre)}"/>
        <span class="absolute top-3 left-3 px-3 py-1 rounded-full bg-secondary-container/90 text-on-secondary-container font-label-md text-label-md">${esc(p.categoria || '')}</span>
        <button id="d-fav" aria-label="Guardar favorito" class="absolute top-3 right-3 w-10 h-10 bg-surface/85 rounded-full flex items-center justify-center">${heart(Favs.has(p._id))}</button>
      </div>
      <div class="flex items-start justify-between gap-3">
        <h1 class="font-headline-lg text-headline-lg text-on-surface">${esc(p.nombre)}</h1>
        <span class="font-headline-lg text-headline-lg text-primary font-bold">${money(p.precio)}</span>
      </div>
      <p class="font-body-lg text-body-lg text-on-surface-variant">${esc(p.descripcion || 'Una delicia importada, ¡pruébala!')}</p>
      <div class="flex flex-wrap gap-2">${chips}</div>
      ${alerg}
      <div class="flex flex-wrap gap-2">${tags}</div>
      <p class="font-label-md text-label-md ${agotado ? 'text-error' : 'text-secondary'}">${agotado ? 'Agotado' : (p.stock <= 5 ? '¡Últimas ' + p.stock + ' piezas!' : 'Disponible: ' + p.stock + ' piezas')}</p>
      <div class="flex items-center gap-3">
        <div class="flex items-center bg-surface-container-low rounded-full p-1 gap-2">
          <button id="d-minus" class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center" aria-label="Restar"><span class="material-symbols-outlined">remove</span></button>
          <span id="d-qty" class="w-6 text-center font-headline-sm text-headline-sm">1</span>
          <button id="d-plus" class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center" aria-label="Sumar"><span class="material-symbols-outlined">add</span></button>
        </div>
        <button id="d-add" ${agotado ? 'disabled' : ''} class="flex-1 h-12 rounded-full bg-primary-container text-on-primary-container font-headline-sm text-headline-sm shadow-[0_8px_20px_rgba(255,117,143,0.35)] active:scale-[0.98] transition disabled:opacity-50">Agregar al carrito</button>
      </div>
      <div id="relacionados"></div>`;
    $('#d-fav').addEventListener('click', e => { e.currentTarget.innerHTML = heart(Favs.toggle(p._id)); });
    $('#d-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); set('d-qty', qty); });
    $('#d-plus').addEventListener('click', () => { qty = Math.min(p.stock || 99, qty + 1); set('d-qty', qty); });
    $('#d-add').addEventListener('click', () => {
      if (!Cart.add(p, qty)) return alert('No hay suficiente stock de ' + p.nombre);
      toast('¡' + p.nombre + ' agregado!');
    });
    const rel = todos.filter(x => x._id !== p._id && x.categoria === p.categoria).slice(0, 4);
    if (rel.length) {
      $('#relacionados').innerHTML = `<h2 class="font-headline-sm text-headline-sm mb-2">También te puede gustar</h2><div class="grid grid-cols-2 gap-gutter-sm">` +
        rel.map(x => `<a href="producto.html?id=${esc(x._id)}" class="flex flex-col p-2.5 bg-surface-container-lowest rounded-2xl shadow-sm">
          <div class="aspect-square rounded-[1.25rem] overflow-hidden bg-surface-container mb-2"><img class="w-full h-full object-cover" ${imgAttrs(x)} alt="${esc(x.nombre)}" loading="lazy"/></div>
          <span class="font-bold text-[14px] line-clamp-1">${esc(x.nombre)}</span><span class="font-bold text-primary">${money(x.precio)}</span></a>`).join('') + '</div>';
    }
  }

  /* ───────── Carrito (vista) + checkout ───────── */
  function initCarrito() {
    const box = $('#cart-items'), tpl = $('#tpl-item').innerHTML;
    Cart.onChange = () => {
      const items = Cart.items, t = Cart.totals();
      box.innerHTML = items.length
        ? items.map(i => { const im = imgPair(i); return fill(tpl, { id: i.id, img: esc(im.src), fb: esc(im.fb), cat: esc(i.categoria || 'Dulce'), nombre: esc(i.nombre), desc: esc(i.descripcion), precio: money(i.precio), subtotal: money(i.precio * i.cantidad), qty: i.cantidad }); }).join('')
        : '<div class="text-center py-10 text-on-surface-variant">Tu carrito está vacío 🍡<br><a class="text-primary underline font-bold" href="index.html">Ir al catálogo</a></div>';
      set('badge-total-items', t.count + (t.count === 1 ? ' ítem' : ' items'));
      set('summary-items-count', `Subtotal (${t.count} ${t.count === 1 ? 'artículo' : 'artículos'})`);
      set('summary-subtotal', money(t.subtotal));
      set('summary-shipping', t.shipping || !t.count ? money(t.shipping) : 'Gratis 🎉');
      set('summary-total', money(t.total));
      const pb = $('#shipping-progress-bar'), pt = $('#shipping-progress-text'), pp = $('#shipping-percentage');
      if (pb && pt && pp) {
        const full = t.count && t.subtotal >= FREE, pct = full ? 100 : Math.min(100, Math.round(t.subtotal / FREE * 100));
        pb.style.width = pct + '%'; pp.textContent = pct + '%';
        pt.textContent = full ? '¡Felicidades! Tienes envío gratis 🌸' : `¡Estás a solo ${money(FREE - t.subtotal)} del envío gratis! 🌸`;
      }
    };
    Cart.onChange();
  }

  // Un documento por producto en /api/ordenes, todos con el mismo numero_orden
  window.confirmOrder = async () => {
    const items = Cart.items, u = Session.user, t = Cart.totals(), btn = $('#btn-checkout');
    if (!items.length) return alert('Tu carrito está vacío');
    if (!u) { alert('Primero inicia sesión o crea tu cuenta para confirmar el pedido'); location.href = 'registro.html'; return; }
    const html = btn.innerHTML; btn.disabled = true; btn.textContent = 'Procesando…';
    const num = 'ORD-' + Date.now().toString().slice(-6), done = [];
    try {
      for (const [k, i] of items.entries()) {
        const sub = i.precio * i.cantidad, env = k ? 0 : t.shipping;
        await post('/ordenes', { numero_orden: num, cliente: u.nombre, producto_nombre: i.nombre, cantidad: i.cantidad, subtotal: sub, envio: env, total: Math.max(0, sub + env - (k ? 0 : t.discount)), estado: 'Pagado' });
        done.push(i.id);
      }
      save('sora_cart', []); location.href = 'ticket.html';
    } catch (e) {
      Cart.set(Cart.items.filter(i => !done.includes(i.id)));
      btn.disabled = false; btn.innerHTML = html;
      alert('No se pudo completar el pedido: ' + e.message);
    }
  };

  /* ───────── Cuenta: registro, inicio de sesión y perfil ───────── */
  function initRegistro() {
    get('/productos/estadisticas/paises').catch(() => {}); // despierta el servidor de Render
    const form = $('#signup-form'), btn = $('#submitBtn');
    const nameBox = $('#fullName').closest('.flex.flex-col'), termsBox = $('#terms').closest('label');
    const title = $('h2'), sub = title && title.nextElementSibling;
    const switchLink = document.querySelector('a[data-path="catalogo-feed"]');
    const question = switchLink && switchLink.previousElementSibling;
    let mode = 'registro';

    const setMode = m => {
      mode = m;
      const login = m === 'login';
      nameBox.style.display = login ? 'none' : '';
      termsBox.style.display = login ? 'none' : '';
      $('#fullName').required = !login; $('#terms').required = !login;
      if (title) title.textContent = login ? '¡Qué gusto verte de nuevo!' : '¡Únete a la dulzura!';
      if (sub) sub.textContent = login ? 'Inicia sesión con tu correo y contraseña.' : 'Crea tu cuenta para guardar tus snacks favoritos y sumar pétalos de recompensa.';
      btn.firstElementChild.textContent = login ? 'Iniciar sesión' : 'Crear mi Cuenta';
      if (question) question.textContent = login ? '¿Aún no tienes cuenta?' : '¿Ya eres parte del club?';
      if (switchLink) switchLink.firstElementChild.textContent = login ? 'Crear cuenta' : 'Iniciar Sesión';
    };
    if (switchLink) { switchLink.removeAttribute('data-path'); switchLink.href = '#'; switchLink.addEventListener('click', e => { e.preventDefault(); setMode(mode === 'login' ? 'registro' : 'login'); }); }

    // Si ya hay sesión, se muestra el perfil en lugar del formulario
    const u = Session.user;
    if (u) {
      const card = document.createElement('div');
      card.className = 'bg-surface-container-lowest rounded-3xl p-space-lg shadow-sm flex flex-col gap-space-md text-center';
      card.innerHTML = `<div class="text-5xl">🍡</div>
        <h2 class="font-headline-lg text-headline-lg">¡Hola, ${esc(u.nombre)}!</h2>
        <p class="text-on-surface-variant">${esc(u.email)}</p>
        <a href="index.html" class="h-12 rounded-full bg-primary-container text-on-primary-container font-headline-sm flex items-center justify-center">Ir al catálogo</a>
        <a href="ticket.html" class="h-12 rounded-full bg-surface-container text-on-surface font-headline-sm flex items-center justify-center">Ver mi último pedido</a>
        <button id="btn-logout" type="button" class="h-12 rounded-full text-error font-headline-sm">Cerrar sesión</button>`;
      const wrap = form.closest('.bg-surface-container-lowest') || form.parentElement;
      document.querySelectorAll('main > div > *').forEach(el => { el.style.display = 'none'; });
      (wrap.parentElement).appendChild(card);
      $('#btn-logout').addEventListener('click', () => { Session.clear(); location.reload(); });
      return;
    }

    window.handleRegistration = async () => {
      const html = btn.innerHTML; btn.disabled = true; btn.textContent = mode === 'login' ? 'Entrando…' : 'Creando dulzura…';
      try {
        const email = $('#email').value.trim(), password = $('#password').value;
        const d = mode === 'login'
          ? await post('/login', { email, password })
          : await post('/usuarios', { nombre: $('#fullName').value.trim(), email, password });
        Session.set(d.usuario);
        btn.textContent = '¡Bienvenido al Club!';
        setTimeout(() => { location.href = 'index.html'; }, 800);
      } catch (e) {
        btn.disabled = false; btn.innerHTML = html; alert((mode === 'login' ? 'No se pudo iniciar sesión: ' : 'No se pudo crear la cuenta: ') + e.message);
      }
    };
  }

  /* ───────── Ticket (GET /api/ordenes/ticket/:cliente) ───────── */
  async function initTicket() {
    const u = Session.user; let docs = [];
    try { if (u) docs = await get(`/ordenes/ticket/${encodeURIComponent(u.nombre)}`); } catch (e) { /* sin conexión */ }
    if (!Array.isArray(docs) || !docs.length) {
      set('t-gracias', 'Aún no tienes pedidos 🍡');
      $('#ticket-items').innerHTML = '<a class="text-primary underline font-bold" href="index.html">Ir al catálogo</a>';
      return;
    }
    const last = docs.reduce((a, b) => new Date(b.fecha) > new Date(a.fecha) ? b : a);
    const o = docs.filter(d => d.numero_orden === last.numero_orden);
    const sum = k => o.reduce((a, d) => a + (d[k] || 0), 0), sub = sum('subtotal'), env = sum('envio'), tot = sum('total');
    set('t-gracias', `¡Gracias por tu compra, ${u.nombre.split(' ')[0]}!`);
    set('t-num', '#' + last.numero_orden);
    set('t-fecha', new Date(last.fecha).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }));
    set('t-count', `Snacks & Bebidas (${o.length})`);
    set('t-sub', money(sub)); set('t-env', money(env)); set('t-tot', money(tot));
    set('t-cup', '-' + money(Math.max(0, sub + env - tot)));
    const tpl = $('#tpl-row').innerHTML;
    $('#ticket-items').innerHTML = o.map(d => {
      const p = (d.detalle_producto || [])[0] || { nombre: d.producto_nombre };
      const im = imgPair({ ...p, nombre: d.producto_nombre });
      return fill(tpl, { img: esc(im.src), fb: esc(im.fb), cat: esc(p.categoria || 'Dulce'), qty: d.cantidad, nombre: esc(d.producto_nombre), precio: money(d.subtotal / d.cantidad), subtotal: money(d.subtotal) });
    }).join('');
  }

  /* ───────── Arranque ───────── */
  badge();
  const init = { catalogo: initCatalogo, producto: initProducto, carrito: initCarrito, registro: initRegistro, ticket: initTicket }[document.body.dataset.page];
  if (init) { try { const r = init(); if (r && r.catch) r.catch(e => console.error(e)); } catch (e) { console.error(e); } }
})();
