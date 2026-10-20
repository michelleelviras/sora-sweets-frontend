/* Sora Sweets – lógica compartida de las vistas (conectada al API en Render) */
(() => {
  const API = 'https://sora-sweets-backend.onrender.com/api';  const FREE = 180, COUPON = 10, SHIP = 35;
  const PAGES = { 'catalogo-feed': 'catalogo.html', explorar: 'catalogo.html', carrito: 'carrito.html', 'registro-cuenta': 'registro.html' };
  const CHIP = 'category-chip flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-surface-container text-on-surface-variant hover:bg-surface-container-high transition-transform active:scale-95';
  const $ = (s, r = document) => r.querySelector(s);
  const money = n => '$' + Number(n || 0).toFixed(2);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const fill = (tpl, o) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => o[k] ?? '');
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#fde8ec"/><text x="50" y="64" font-size="42" text-anchor="middle">🍬</text></svg>');

  async function post(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Error ' + r.status);
    return d;
  }

  /* ───────── Carrito (localStorage) ───────── */
  const Cart = {
    get items() { return load('sora_cart', []); },
    set(items) { save('sora_cart', items); badge(); if (Cart.onChange) Cart.onChange(); },
    add(p) {
      const items = Cart.items, it = items.find(i => i.id === p._id);
      if (it) { if (p.stock && it.cantidad >= p.stock) return false; it.cantidad++; }
      else items.push({ id: p._id, nombre: p.nombre, precio: p.precio, imagen: p.imagen || '', categoria: p.categoria || '', descripcion: p.descripcion || '', stock: p.stock, cantidad: 1 });
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

  /* ───────── Catálogo ───────── */
  async function initCatalogo() {
    const box = $('#lista-productos'), search = $('#sweet-search');
    box.innerHTML = '<p class="col-span-2 text-center py-8 text-on-surface-variant">Cargando dulces… 🍡<br><span class="text-xs">(el servidor puede tardar hasta un minuto en despertar)</span></p>';
    let all = [], words = [];
    try {
      const r = await fetch(API + '/productos');
      if (!r.ok) throw new Error(r.status);
      all = await r.json();
    } catch (e) {
      box.innerHTML = '<p class="col-span-2 text-center py-8 text-error">No se pudo cargar el catálogo. Recarga la página.</p>';
      return;
    }
    const card = p => `
      <div class="group relative flex flex-col justify-between p-2.5 bg-surface-container-lowest rounded-2xl shadow-sm">
        <div class="flex flex-col">
          <div class="relative w-full aspect-square rounded-[1.25rem] overflow-hidden bg-surface-container mb-2">
            <img class="w-full h-full object-cover" src="${esc(p.imagen || PH)}" alt="${esc(p.nombre)}" onerror="this.onerror=null;this.src='${PH}'"/>
            <span class="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-secondary-container/90 text-on-secondary-container text-[10px] font-medium">${esc(p.categoria || 'Popular')}</span>
            <button aria-label="Guardar favorito" onclick="toggleFav(this)" class="absolute top-2 right-2 w-7 h-7 bg-surface/80 rounded-full flex items-center justify-center text-on-surface hover:text-primary transition-colors">
              <span class="material-symbols-outlined text-[16px]">favorite</span>
            </button>
          </div>
          <h3 class="font-bold text-[15px] mb-1 text-on-surface line-clamp-1">${esc(p.nombre)}</h3>
          <p class="text-xs text-on-surface-variant line-clamp-2 mb-2">${esc(p.descripcion || '')}</p>
        </div>
        <div class="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/30">
          <span class="font-bold text-primary text-base">${money(p.precio)}</span>
          <button data-add="${esc(p._id)}" aria-label="Agregar ${esc(p.nombre)} al carrito" class="bg-primary text-on-primary rounded-full w-8 h-8 flex items-center justify-center hover:opacity-90 active:scale-95 transition-transform">
            <span class="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>`;
    const draw = () => {
      const q = norm(search && search.value);
      const list = all.filter(p => {
        const c = norm(p.categoria);
        const okCat = !words.length || (c && words.some(w => c.includes(w) || w.includes(c)));
        const text = norm([p.nombre, p.descripcion, p.categoria, (p.etiquetas || []).join(' '), p.detalles && p.detalles.pais_origen].join(' '));
        return okCat && (!q || text.includes(q));
      });
      box.innerHTML = list.map(card).join('') || '<p class="col-span-2 text-center py-8 text-on-surface-variant">No encontramos dulces con ese filtro 🍡</p>';
      const n = $('#n-prod'); if (n) n.textContent = list.length + (list.length === 1 ? ' delicia' : ' delicias');
    };
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-add]'); if (!b) return;
      const p = all.find(x => x._id === b.dataset.add);
      if (!Cart.add(p)) return alert('Ya agregaste todo el stock disponible de ' + p.nombre);
      if (window.addToCart) window.addToCart(b, p.nombre);
    });
    document.querySelectorAll('.category-chip').forEach(c => c.addEventListener('click', () => {
      words = norm(c.querySelectorAll('span')[1].textContent).split(/[^a-z]+/).filter(w => w.length > 3); draw();
    }));
    const all_ = $('#ver-todas');
    if (all_) all_.addEventListener('click', () => { words = []; document.querySelectorAll('.category-chip').forEach(c => c.className = CHIP); draw(); });
    if (search) search.addEventListener('input', draw);
    draw();
  }

  /* ───────── Carrito (vista) + checkout ───────── */
  function initCarrito() {
    const box = $('#cart-items'), tpl = $('#tpl-item').innerHTML;
    Cart.onChange = () => {
      const items = Cart.items, t = Cart.totals();
      box.innerHTML = items.length
        ? items.map(i => fill(tpl, { id: i.id, img: esc(i.imagen || PH), cat: esc(i.categoria || 'Dulce'), nombre: esc(i.nombre), desc: esc(i.descripcion), precio: money(i.precio), subtotal: money(i.precio * i.cantidad), qty: i.cantidad })).join('')
        : '<div class="text-center py-10 text-on-surface-variant">Tu carrito está vacío 🍡<br><a class="text-primary underline font-bold" href="catalogo.html">Ir al catálogo</a></div>';
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
    const items = Cart.items, u = load('sora_user'), t = Cart.totals(), btn = $('#btn-checkout');
    if (!items.length) return alert('Tu carrito está vacío');
    if (!u) { alert('Primero crea tu cuenta para confirmar el pedido'); location.href = 'registro.html'; return; }
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

  /* ───────── Registro ───────── */
  // El API no guarda contraseña (la colección usuarios solo tiene nombre, email y rol)
  window.handleRegistration = async () => {
    const btn = $('#submitBtn'), html = btn.innerHTML; btn.disabled = true; btn.textContent = 'Creando dulzura...';
    try {
      const d = await post('/usuarios', { nombre: $('#fullName').value.trim(), email: $('#email').value.trim() });
      save('sora_user', { _id: d.usuario._id, nombre: d.usuario.nombre, email: d.usuario.email });
      btn.textContent = '¡Bienvenido al Club!';
      setTimeout(() => { location.href = 'catalogo.html'; }, 900);
    } catch (e) {
      btn.disabled = false; btn.innerHTML = html; alert('No se pudo crear la cuenta: ' + e.message);
    }
  };

  /* ───────── Ticket (GET /api/ordenes/ticket/:cliente) ───────── */
  async function initTicket() {
    const u = load('sora_user'); let docs = [];
    try { if (u) docs = await (await fetch(`${API}/ordenes/ticket/${encodeURIComponent(u.nombre)}`)).json(); } catch (e) { /* sin conexión */ }
    if (!Array.isArray(docs) || !docs.length) {
      set('t-gracias', 'Aún no tienes pedidos 🍡');
      $('#ticket-items').innerHTML = '<a class="text-primary underline font-bold" href="catalogo.html">Ir al catálogo</a>';
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
      const p = (d.detalle_producto || [])[0] || {};
      return fill(tpl, { img: esc(p.imagen || PH), cat: esc(p.categoria || 'Dulce'), qty: d.cantidad, nombre: esc(d.producto_nombre), precio: money(d.subtotal / d.cantidad), subtotal: money(d.subtotal) });
    }).join('');
  }

  /* ───────── Arranque ───────── */
  document.querySelectorAll('a[data-path]').forEach(a => { if (PAGES[a.dataset.path]) a.href = PAGES[a.dataset.path]; });
  badge();
  const init = { catalogo: initCatalogo, carrito: initCarrito, ticket: initTicket }[document.body.dataset.page];
  if (init) init();
})();
