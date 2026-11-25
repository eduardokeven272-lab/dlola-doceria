/* Site do cliente: rotas, páginas, carrinho e pedido */
(function () {
  'use strict';
  const { esc, $, $$, toast, modal, brl, readImage, fmtDate } = window.UI;
  const DB = window.DB;
  const app = $('#app');

  let C = { settings: {}, categories: [], products: [], cakes: {} };
  const CART_KEY = 'doceria.cart.v1';
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch (e) { cart = []; }
  const rid = () => 'c' + Math.random().toString(36).slice(2, 9);

  function saveCart() {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
    catch (e) { toast('Não foi possível salvar o carrinho. A imagem de referência pode ser grande demais.', { type: 'error' }); }
    updateBadge();
  }
  function updateBadge(bump) {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    $('#cartCount').textContent = n;
    if (bump) { const b = $('#cartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
  }

  async function load() {
    const [settings, categories, products, cakes] = await Promise.all([DB.settings.get(), DB.categories.list(), DB.products.list(), DB.cakes.get()]);
    C = { settings, categories, products, cakes };
  }

  /* ---------- helpers ---------- */
  const prod = (id) => C.products.find((p) => p.id === id);
  const catOf = (id) => C.categories.find((c) => c.id === id);
  const inCart = (id) => cart.filter((i) => i.kind === 'product' && i.productId === id).reduce((n, i) => n + i.qty, 0);
  const sellable = (p) => DB.util.isSellable(p);

  function visual(p) {
    const img = p.images && p.images[0];
    if (img) return '<img src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy">';
    return '<div class="ph" style="--h:' + (p.hue || 340) + '" role="img" aria-label="' + esc(p.name) + '"><span>' + esc(p.emoji || '🧁') + '</span></div>';
  }
  function brandHTML(name) {
    const w = String(name || '').trim().split(/\s+/);
    if (w.length < 2) return esc(name);
    return esc(w.slice(0, -1).join(' ')) + ' <em>' + esc(w[w.length - 1]) + '</em>';
  }
  function waLink(text) {
    const n = String(C.settings.whatsapp || '').replace(/\D/g, '');
    return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '';
  }
  const localISO = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const hasCake = () => cart.some((i) => i.kind === 'cake');
  function minDate() { const d = new Date(); d.setDate(d.getDate() + (hasCake() ? Number(C.cakes.leadDays) || 0 : 0)); return localISO(d); }

  const CAKE_SVG = '<svg viewBox="0 0 400 330" class="illus" role="img" aria-label="Ilustração de bolo de três andares">' +
    '<ellipse cx="200" cy="302" rx="165" ry="16" fill="var(--line)"/>' +
    '<rect x="70" y="204" width="260" height="92" rx="20" fill="var(--rose)"/>' +
    '<rect x="70" y="204" width="260" height="26" rx="13" fill="var(--frost)"/>' +
    '<g fill="var(--frost)"><circle cx="98" cy="232" r="10"/><circle cx="146" cy="236" r="12"/><circle cx="214" cy="234" r="10"/><circle cx="262" cy="238" r="12"/><circle cx="304" cy="232" r="9"/></g>' +
    '<rect x="108" y="134" width="184" height="76" rx="18" fill="var(--rose-strong)"/>' +
    '<rect x="108" y="134" width="184" height="24" rx="12" fill="var(--frost)"/>' +
    '<g fill="var(--frost)"><circle cx="134" cy="160" r="9"/><circle cx="184" cy="164" r="11"/><circle cx="246" cy="160" r="9"/><circle cx="276" cy="162" r="8"/></g>' +
    '<rect x="142" y="76" width="116" height="64" rx="16" fill="var(--rose)"/>' +
    '<rect x="142" y="76" width="116" height="22" rx="11" fill="var(--frost)"/>' +
    '<g fill="var(--frost)"><circle cx="164" cy="100" r="8"/><circle cx="206" cy="104" r="10"/><circle cx="240" cy="100" r="7"/></g>' +
    '<g fill="var(--gold)"><circle cx="96" cy="262" r="4"/><circle cx="130" cy="272" r="4"/><circle cx="270" cy="266" r="4"/><circle cx="304" cy="258" r="4"/><circle cx="168" cy="186" r="3.5"/><circle cx="230" cy="188" r="3.5"/></g>' +
    '<path d="M200 60c0-14 6-24 18-30" stroke="var(--ink-soft)" stroke-width="3" fill="none" stroke-linecap="round"/>' +
    '<circle cx="200" cy="64" r="14" fill="var(--danger)"/><circle cx="195" cy="59" r="4" fill="#fff" opacity=".55"/>' +
    '<path d="M82 120c-6-10-22-6-18 7 3 9 18 16 18 16s15-7 18-16c4-13-12-17-18-7z" fill="var(--rose)" opacity=".5"/>' +
    '<path d="M322 90c-5-8-17-5-14 5 2 7 14 12 14 12s12-5 14-12c3-10-9-13-14-5z" fill="var(--rose)" opacity=".5"/></svg>';

  function mount(html) { app.innerHTML = html; }

  /* ---------- cards de produto ---------- */
  function productCard(p) {
    const out = !sellable(p);
    const cat = catOf(p.categoryId);
    return '<article class="pcard' + (out ? ' is-out' : '') + '" data-open="' + p.id + '" tabindex="0" aria-label="' + esc(p.name) + '">' +
      '<div class="pimg">' + visual(p) + (p.featured ? '<span class="tag">Destaque</span>' : '') + (out ? '<span class="tag out">Esgotado</span>' : '') + '</div>' +
      '<div class="pbody">' + (cat ? '<span class="pcat">' + esc(cat.name) + '</span>' : '') +
      '<h3>' + esc(p.name) + '</h3>' + (p.unit ? '<span class="punit">' + esc(p.unit) + '</span>' : '') +
      '<p class="pdesc">' + esc(p.description) + '</p>' +
      '<div class="pfoot"><strong>' + brl(p.price) + '</strong>' +
      '<button class="btn btn-primary btn-sm" data-add="' + p.id + '"' + (out ? ' disabled' : '') + '>' + (out ? 'Esgotado' : 'Adicionar') + '</button></div></div></article>';
  }

  function addToCart(id, qty, note) {
    const p = prod(id);
    if (!p || !sellable(p)) { toast('Este produto não está disponível agora.', { type: 'error' }); return false; }
    const left = p.stock - inCart(id);
    if (qty > left) { toast(left > 0 ? 'Só temos mais ' + left + ' em estoque.' : 'Você já tem todo o estoque no carrinho.', { type: 'error' }); return false; }
    const line = cart.find((i) => i.kind === 'product' && i.productId === id && (i.note || '') === (note || ''));
    if (line) line.qty += qty; else cart.push({ key: rid(), kind: 'product', productId: id, qty, note: note || '' });
    saveCart(); updateBadge(true);
    toast(p.name + ' no carrinho.', { action: { label: 'Ver carrinho', onClick: () => { location.hash = '#/carrinho'; } } });
    return true;
  }

  function openProduct(id) {
    const p = prod(id); if (!p) return;
    const cat = catOf(p.categoryId);
    const imgs = p.images || [];
    const out = !sellable(p);
    const left = Math.max(0, p.stock - inCart(id));
    let qty = 1;
    const m = modal(
      '<div class="pm"><div class="pm-media"><div id="pmMain">' + visual(p) + '</div>' +
      (imgs.length > 1 ? '<div class="pm-thumbs">' + imgs.map((s, i) => '<img src="' + esc(s) + '" data-i="' + i + '" class="' + (i === 0 ? 'on' : '') + '" alt="Foto ' + (i + 1) + '">').join('') + '</div>' : '') + '</div>' +
      '<div class="pm-body"><div style="display:flex;justify-content:space-between;gap:8px;align-items:start"><div>' + (cat ? '<span class="pcat">' + esc(cat.name) + '</span>' : '') + '<h3>' + esc(p.name) + '</h3></div><button class="x" data-close aria-label="Fechar" style="background:none;border:0;font-size:1.7rem;cursor:pointer;color:var(--ink-soft)">×</button></div>' +
      (p.unit ? '<span class="punit">' + esc(p.unit) + '</span>' : '') +
      '<p style="color:var(--ink-soft)">' + esc(p.description) + '</p><div class="price-big">' + brl(p.price) + '</div>' +
      (out ? '<span class="badge danger" style="align-self:flex-start">Esgotado no momento</span>' :
        (p.stock <= (p.minStock || 0) ? '<span class="badge warn" style="align-self:flex-start">Últimas unidades: ' + p.stock + '</span>' : '') +
        '<div class="field"><label for="pmNote">Observação (opcional)</label><textarea id="pmNote" rows="2" placeholder="Ex.: sem granulado, para presente…"></textarea></div>' +
        '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div class="qty"><button type="button" id="qm" aria-label="Diminuir">−</button><span id="qv">1</span><button type="button" id="qp" aria-label="Aumentar">+</button></div>' +
        '<button class="btn btn-primary" id="pmAdd" style="flex:1"' + (left < 1 ? ' disabled' : '') + '>' + (left < 1 ? 'Estoque no carrinho' : 'Adicionar ao carrinho') + '</button></div>') +
      '</div></div>', { size: 'lg' });
    const el = m.el;
    $$('.pm-thumbs img', el).forEach((t) => t.addEventListener('click', () => {
      $('#pmMain', el).innerHTML = '<img src="' + esc(imgs[+t.dataset.i]) + '" alt="' + esc(p.name) + '">';
      $$('.pm-thumbs img', el).forEach((x) => x.classList.toggle('on', x === t));
    }));
    if (!out) {
      const upd = () => { $('#qv', el).textContent = qty; $('#qm', el).disabled = qty <= 1; $('#qp', el).disabled = qty >= left; };
      $('#qm', el).onclick = () => { qty = Math.max(1, qty - 1); upd(); };
      $('#qp', el).onclick = () => { qty = Math.min(left, qty + 1); upd(); };
      upd();
      $('#pmAdd', el).onclick = () => { if (addToCart(id, qty, $('#pmNote', el).value.trim())) m.close(); };
    }
  }

  /* ---------- páginas ---------- */
  /* ----- ícones e horários compartilhados (rodapé e página Contato) ----- */
  const svgIcon = (d, sz) => '<svg class="fi-ic" viewBox="0 0 24 24" width="' + (sz || 16) + '" height="' + (sz || 16) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const ICO = {
    pin: svgIcon('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
    clock: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    ig: svgIcon('<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.8"/><path d="M17 7h.01"/>'),
    chat: svgIcon('<path d="M4 20l1.5-4.5A8 8 0 1 1 8.5 18.5z"/>')
  };
  function hoursRows(s) {
    const hh = (t) => { const m = String(t || '').match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) + 'h' + (m[2] === '00' ? '' : m[2]) : String(t || ''); };
    const full = { Segunda: 'Segunda-feira', 'Terça': 'Terça-feira', Quarta: 'Quarta-feira', Quinta: 'Quinta-feira', Sexta: 'Sexta-feira' };
    const low = (t) => t.charAt(0).toLowerCase() + t.slice(1);
    const groups = [];
    (s.hours || []).forEach((h) => {
      const sig = h.closed || !h.open ? 'x' : h.open + '-' + h.close, g = groups[groups.length - 1];
      if (g && g.sig === sig) g.days.push(h); else groups.push({ sig, days: [h], h });
    });
    const label = (g) => { const d = g.days.map((x) => x.day);
      return d.length === 1 ? (full[d[0]] || d[0]) : d.length === 2 ? d[0] + ' e ' + low(d[1]) : d[0] + ' a ' + low(d[d.length - 1]); };
    const open = groups.filter((g) => g.sig !== 'x').map((g) => ({ label: label(g), value: hh(g.h.open) + ' às ' + hh(g.h.close) }));
    const shut = groups.filter((g) => g.sig === 'x').map((g, i, arr) => ({ label: label(g) + (s.closedExtra && i === arr.length - 1 ? ' e ' + s.closedExtra : ''), value: 'Fechado' }));
    if (!shut.length && s.closedExtra) shut.push({ label: s.closedExtra.charAt(0).toUpperCase() + s.closedExtra.slice(1), value: 'Fechado' });
    return open.concat(shut);
  }

  /* ----- página Contato (como no site de referência) ----- */
  function pContact() {
    const s = C.settings, ig = String(s.instagram || '').replace(/^@/, ''), wa = waLink('Olá! Gostaria de fazer um pedido.');
    const q = encodeURIComponent(s.mapQuery || [s.address, s.address2].filter(Boolean).join(', '));
    const addr2 = String(s.address2 || '').split(/\s+[—–]\s+/).filter(Boolean);
    const mapsUrl = s.mapsUrl || 'https://www.google.com/maps/search/?api=1&query=' + q;
    const rows = hoursRows(s);
    mount(
      '<section class="contact-hero"><div class="wrap"><p class="eyebrow">Contato</p><h1>Onde estamos?</h1><p>Venha nos visitar ou faça seu pedido para entrega.</p></div></section>' +
      '<section class="sec"><div class="wrap contact-grid"><div class="contact-cards">' +
      (q ? '<div class="ccard">' + ICO.pin.replace('width="16" height="16"', 'width="20" height="20"') + '<h3>Endereço</h3><p>' + esc(s.address || '') + (addr2.length ? '<br>' + addr2.map(esc).join('<br>') : '') + '</p>' +
        '<a class="btn btn-primary" href="' + esc(mapsUrl) + '" target="_blank" rel="noopener">Como chegar</a></div>' : '') +
      (rows.length ? '<div class="ccard">' + ICO.clock.replace('width="16" height="16"', 'width="20" height="20"') + '<h3>Horários</h3><ul class="hrows">' +
        rows.map((r) => '<li><span>' + esc(r.label) + '</span><b>' + esc(r.value) + '</b></li>').join('') + '</ul></div>' : '') +
      ((wa || ig || s.phone || s.email) ? '<div class="ccard ccard-row">' +
        (wa ? '<a class="btn btn-primary" href="' + wa + '" target="_blank" rel="noopener">' + ICO.chat + ' WhatsApp</a>' : '') +
        (ig ? '<a class="btn btn-ghost" href="https://instagram.com/' + esc(ig) + '" target="_blank" rel="noopener">' + ICO.ig + ' @' + esc(ig) + '</a>' : '') +
        (s.phone ? '<span class="cinfo">' + esc(s.phone) + '</span>' : '') + (s.email ? '<span class="cinfo">' + esc(s.email) + '</span>' : '') + '</div>' : '') +
      '</div>' + (q ? '<div class="map-frame map-tall"><iframe title="Mapa: localização da doceria" src="https://www.google.com/maps?q=' + q + '&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>' : '') +
      '</div></section>'
    );
  }

  function pHome() {
    const s = C.settings;
    const feat = C.products.filter((p) => p.featured && p.available).slice(0, 8);
    const cats = C.categories.filter((c) => c.visible);
    const occ = (C.cakes.occasions || []).filter((o) => o.available);
    const wa = waLink('Olá! Gostaria de fazer um pedido.');
    const firstCakeImg = ((C.cakes.types || []).find((t) => t.images && t.images[0]) || {}).images;
    mount(
      '<section class="hero"><div class="wrap hero-grid"><div class="hero-copy">' +
      '<p class="eyebrow">Doceria artesanal' + (s.city ? ' · ' + esc(s.city) : '') + '</p>' +
      '<h1>' + brandHTML(s.storeName) + '</h1><p class="lead">' + esc(s.tagline) + '</p>' +
      '<div class="btn-row"><a class="btn btn-primary" href="#/cardapio">Ver cardápio</a>' +
      (wa ? '<a class="btn btn-ghost" href="' + wa + '" target="_blank" rel="noopener">Fazer pedido</a>' : '<a class="btn btn-ghost" href="#/carrinho">Fazer pedido</a>') + '</div>' +
      (s.rating ? '<p class="rating"><span class="stars" aria-hidden="true">★★★★★</span> ' + esc(s.rating) + '</p>' : '<ul class="trust"><li>Feito sob encomenda</li><li>Ingredientes selecionados</li><li>Entrega ou retirada</li></ul>') + '</div>' +
      '<div class="hero-art"><div class="art-card is-photo"><img src="img/logo-card.png" alt="' + esc(s.storeName) + '"></div></div></div></section>' +

      (C.cakes.enabled ? '<section class="sec alt"><div class="wrap cake-teaser"><div class="copy"><p class="eyebrow">Encomendas</p>' +
        '<h2>Bolos personalizados para <em>momentos especiais</em></h2>' +
        '<p class="lead">Escolha os detalhes do seu bolo e faça sua encomenda de forma simples e rápida.</p>' +
        '<div class="chips">' + occ.map((o) => '<a class="chip" href="#/bolos/' + o.id + '"><span aria-hidden="true">' + esc(o.emoji || '🎂') + '</span>' + esc(o.name) + '</a>').join('') + '</div>' +
        '<a class="btn btn-primary" href="#/bolos">Encomendar meu bolo</a></div>' +
        '<div class="art-card is-photo"><img src="' + esc(firstCakeImg && firstCakeImg[0] ? firstCakeImg[0] : 'img/bolo-destaque.png') + '" alt="Bolo personalizado"></div></div></section>' : '') +

      (feat.length ? '<section class="sec"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Os preferidos</p><h2>Destaques da <em>casa</em></h2></div><a class="btn btn-ghost" href="#/cardapio">Ver cardápio completo</a></div>' +
        '<div class="grid">' + feat.map(productCard).join('') + '</div></div></section>' : '') +

      '<section class="sec alt"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Cardápio</p><h2>Navegue por <em>categorias</em></h2></div></div>' +
      '<div class="cat-grid">' + cats.map((c) => {
        const n = C.products.filter((p) => p.categoryId === c.id && p.available).length;
        return '<a class="cat-tile" href="#/cardapio/' + c.id + '"><span class="ic" aria-hidden="true">' + esc(c.emoji || '🍬') + '</span><h3>' + esc(c.name) + '</h3><p>' + esc(c.description) + '</p><small>' + n + (n === 1 ? ' item' : ' itens') + '</small></a>';
      }).join('') + '</div></div></section>' +

      '<section class="sec"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Passo a passo</p><h2>Como fazer seu <em>pedido</em></h2></div></div><div class="steps">' +
      '<div class="step"><span class="ic" aria-hidden="true">🍬</span><h3>Escolha</h3><p>Monte o carrinho com itens do cardápio ou crie o seu bolo.</p></div>' +
      '<div class="step"><span class="ic" aria-hidden="true">✍️</span><h3>Personalize</h3><p>Informe sabores, texto, tema e observações para cada item.</p></div>' +
      '<div class="step"><span class="ic" aria-hidden="true">📅</span><h3>Agende</h3><p>Defina data, entrega ou retirada e a forma de pagamento.</p></div>' +
      '<div class="step"><span class="ic" aria-hidden="true">🎁</span><h3>Receba</h3><p>Confirmamos o pedido e preparamos tudo com carinho.</p></div></div></div></section>' +
      reviewsSection()
    );
  }

  /* ----- avaliações, mapa e Instagram ----- */
  function reviewsSection() {
    const s = C.settings, list = s.reviews || [];
    if (!s.rating && !list.length) return '';
    return '<section class="sec alt" id="avaliacoes"><div class="wrap"><div class="sec-head"><div><p class="eyebrow">Avaliações</p><h2>O que dizem <em>nossos clientes</em></h2></div>' +
      (s.googleReviewsUrl ? '<a class="btn btn-ghost" href="' + esc(s.googleReviewsUrl) + '" target="_blank" rel="noopener">Ver no Google</a>' : '') + '</div>' +
      (s.rating ? '<p class="rev-sum"><span class="stars" aria-hidden="true">★★★★★</span><strong>' + esc(s.rating) + '</strong></p>' : '') +
      (list.length ? '<div class="rev-grid">' + list.map((r) => '<figure class="rev-card"><div class="stars" aria-label="' + r.stars + ' de 5">' + '★'.repeat(r.stars) + '<span class="off">' + '★'.repeat(5 - r.stars) + '</span></div>' +
        '<blockquote>' + esc(r.text) + '</blockquote><figcaption>' + esc(r.name) + '</figcaption></figure>').join('') + '</div>' : '') + '</div></section>';
  }

  let menuQ = '';
  function pMenu(catId) {
    const cats = C.categories.filter((c) => c.visible);
    const cur = catOf(catId);
    mount(
      '<div class="wrap"><div class="page-head"><p class="eyebrow">Cardápio</p><h1>' + (cur ? esc(cur.name) : 'Nossos <em>doces</em>') + '</h1>' +
      '<p>' + (cur ? esc(cur.description) : 'Toque em um item para ver os detalhes e adicionar ao carrinho.') + '</p></div>' +
      '<div class="toolbar"><input type="search" id="q" placeholder="Buscar doce…" aria-label="Buscar no cardápio" value="' + esc(menuQ) + '"></div>' +
      '<div class="chips" style="margin-bottom:26px"><a class="chip' + (!cur ? ' on' : '') + '" href="#/cardapio">Todos</a>' +
      cats.map((c) => '<a class="chip' + (cur && cur.id === c.id ? ' on' : '') + '" href="#/cardapio/' + c.id + '"><span aria-hidden="true">' + esc(c.emoji) + '</span>' + esc(c.name) + '</a>').join('') + '</div>' +
      '<div id="grid" style="padding-bottom:56px"></div></div>'
    );
    const draw = () => {
      const q = menuQ.trim().toLowerCase();
      const list = C.products.filter((p) => p.available && (!cur || p.categoryId === cur.id) && (!q || (p.name + ' ' + p.description).toLowerCase().includes(q)));
      $('#grid').innerHTML = list.length ? '<div class="grid">' + list.map(productCard).join('') + '</div>' :
        '<div class="empty"><span style="font-size:2rem">🔎</span><p>Nenhum item encontrado' + (q ? ' para “' + esc(menuQ) + '”' : ' nesta categoria') + '.</p><a class="btn btn-ghost" href="#/cardapio" id="clr">Ver tudo</a></div>';
    };
    draw();
    $('#q').addEventListener('input', (e) => { menuQ = e.target.value; draw(); });
  }

  /* ----- montador de bolos ----- */
  let sel = null;
  const newSel = (occ) => ({ typeId: '', sizeId: '', doughId: '', fillingId: '', toppingId: '', extraIds: [], occasionId: occ || '', text: '', theme: '', notes: '', refImage: '' });
  const SEL_KEY = { types: 'typeId', sizes: 'sizeId', doughs: 'doughId', fillings: 'fillingId', toppings: 'toppingId', occasions: 'occasionId' };

  function pCakes(occId) {
    const K = C.cakes;
    if (!K.enabled) {
      mount('<div class="wrap"><div class="empty" style="margin:56px 0"><span style="font-size:2rem">🎂</span><p>As encomendas de bolos estão pausadas no momento.</p><a class="btn btn-primary" href="#/cardapio">Ver cardápio</a></div></div>');
      return;
    }
    if (!sel) sel = newSel(occId); else if (occId) sel.occasionId = occId;
    const av = (g) => (K[g] || []).filter((x) => x.available);
    // limpa escolhas que deixaram de existir
    Object.keys(SEL_KEY).forEach((g) => { if (sel[SEL_KEY[g]] && !av(g).some((x) => x.id === sel[SEL_KEY[g]])) sel[SEL_KEY[g]] = ''; });
    sel.extraIds = sel.extraIds.filter((id) => av('extras').some((x) => x.id === id));

    const priceTxt = (g, it) => (g === 'sizes' ? brl(it.price) : Number(it.price) > 0 ? '+ ' + brl(it.price) : 'Incluso');
    const group = (g, title, required, type) =>
      '<fieldset class="bsec" data-sec="' + g + '"><legend>' + title + (required ? ' <i aria-hidden="true">*</i>' : '') + '</legend><div class="opt-grid">' +
      av(g).map((it) => {
        const checked = type === 'radio' ? sel[SEL_KEY[g]] === it.id : sel.extraIds.includes(it.id);
        return '<label class="opt"><input type="' + type + '" name="' + g + '" value="' + it.id + '"' + (checked ? ' checked' : '') + '><span class="opt-body">' +
          (g === 'types' ? '<span class="opt-ico" aria-hidden="true">' + esc(it.emoji || '🎂') + '</span>' : '') +
          '<b>' + esc(it.name) + '</b>' + (it.serves ? '<small>' + esc(it.serves) + '</small>' : '') + (it.description ? '<small>' + esc(it.description) + '</small>' : '') +
          '<em>' + priceTxt(g, it) + '</em></span></label>';
      }).join('') + '</div></fieldset>';

    mount(
      '<div class="wrap"><div class="page-head"><p class="eyebrow">Encomendas</p><h1>Monte o seu <em>bolo</em></h1>' +
      '<p>Escolha cada detalhe. O valor é atualizado na hora. Encomendas de bolo pedem ' + (Number(K.leadDays) || 0) + ' dia(s) de antecedência.</p></div>' +
      '<div class="builder"><div id="opts">' +
      (av('occasions').length ? '<fieldset class="bsec" data-sec="occasions"><legend>Ocasião</legend><div class="chips">' + av('occasions').map((o) =>
        '<label class="opt" style="display:inline-block"><input type="radio" name="occasions" value="' + o.id + '"' + (sel.occasionId === o.id ? ' checked' : '') + '><span class="opt-body" style="flex-direction:row;gap:8px;align-items:center;border-radius:999px;padding:.5rem 1rem"><span aria-hidden="true">' + esc(o.emoji || '🎂') + '</span><b style="font-weight:500">' + esc(o.name) + '</b></span></label>').join('') + '</div></fieldset>' : '') +
      group('types', 'Tipo de bolo', true, 'radio') + group('sizes', 'Tamanho', true, 'radio') + group('doughs', 'Massa', true, 'radio') +
      group('fillings', 'Recheio', true, 'radio') + group('toppings', 'Cobertura', true, 'radio') + group('extras', 'Extras e decoração', false, 'checkbox') +
      '<fieldset class="bsec"><legend>Personalização</legend><div class="form-grid">' +
      '<div class="field span2"><label for="cText">Texto no bolo</label><input type="text" id="cText" maxlength="40" placeholder="Ex.: Parabéns, Ana!" value="' + esc(sel.text) + '"></div>' +
      '<div class="field span2"><label for="cTheme">Tema ou inspiração</label><input type="text" id="cTheme" maxlength="120" placeholder="Ex.: flores rosa e dourado" value="' + esc(sel.theme) + '"></div>' +
      '<div class="field span2"><label for="cNotes">Observações</label><textarea id="cNotes" rows="3" placeholder="Alergias, cores, detalhes importantes…">' + esc(sel.notes) + '</textarea></div>' +
      '<div class="field span2"><span class="lbl">Foto de referência (opcional)</span><input type="file" id="cRef" accept="image/*" hidden><div class="ref-prev" id="refPrev"></div></div>' +
      '</div></fieldset></div>' +
      '<aside class="sum" aria-label="Resumo do bolo"><h3>Resumo do bolo</h3><div class="sum-lines" id="sumLines"></div>' +
      '<div class="sum-total"><span>Total</span><strong id="sumTotal">R$ 0,00</strong></div><button class="btn btn-primary" id="addCake">Adicionar ao carrinho</button></aside></div></div>'
    );

    const refresh = () => {
      const r = DB.cakePrice(K, sel);
      $('#sumLines').innerHTML = r.lines.length ? r.lines.map((l) => '<div><span>' + esc(l[0]) + '</span><span>' + esc(l[1]) + '</span></div>').join('') : '<span style="color:var(--ink-soft)">Escolha as opções ao lado.</span>';
      $('#sumTotal').textContent = brl(r.price);
    };
    const drawRef = () => {
      $('#refPrev').innerHTML = sel.refImage ?
        '<img src="' + esc(sel.refImage) + '" alt="Referência"><button class="btn btn-ghost btn-sm" type="button" id="refDel">Remover</button>' :
        '<button class="btn btn-ghost btn-sm" type="button" id="refAdd">+ Enviar foto</button>';
      const a = $('#refAdd'), d = $('#refDel');
      if (a) a.onclick = () => $('#cRef').click();
      if (d) d.onclick = () => { sel.refImage = ''; drawRef(); };
    };
    drawRef(); refresh();

    $('#opts').addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'extras') {
        sel.extraIds = $$('input[name=extras]:checked').map((x) => x.value);
      } else if (SEL_KEY[t.name]) {
        sel[SEL_KEY[t.name]] = t.value;
        const f = t.closest('.bsec'); if (f) f.classList.remove('invalid');
      }
      refresh();
    });
    $('#cText').addEventListener('input', (e) => { sel.text = e.target.value; refresh(); });
    $('#cTheme').addEventListener('input', (e) => { sel.theme = e.target.value; });
    $('#cNotes').addEventListener('input', (e) => { sel.notes = e.target.value; });
    $('#cRef').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { sel.refImage = await readImage(f, 480, 0.7); drawRef(); } catch (err) { toast(err.message, { type: 'error' }); }
    });
    $('#addCake').addEventListener('click', () => {
      const need = [['types', 'o tipo de bolo'], ['sizes', 'o tamanho'], ['doughs', 'a massa'], ['fillings', 'o recheio'], ['toppings', 'a cobertura']];
      const miss = need.filter(([g]) => !sel[SEL_KEY[g]]);
      $$('.bsec.invalid').forEach((x) => x.classList.remove('invalid'));
      if (miss.length) {
        miss.forEach(([g]) => { const f = $('[data-sec=' + g + ']'); if (f) f.classList.add('invalid'); });
        toast('Escolha ' + miss[0][1] + (miss.length > 1 ? ' e os demais itens marcados' : '') + '.', { type: 'error' });
        const f = $('[data-sec=' + miss[0][0] + ']'); if (f) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      cart.push({ key: rid(), kind: 'cake', qty: 1, sel: JSON.parse(JSON.stringify(sel)) });
      saveCart(); updateBadge(true);
      sel = null;
      toast('Bolo adicionado ao carrinho.', { action: { label: 'Ver carrinho', onClick: () => { location.hash = '#/carrinho'; } } });
      pCakes('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ----- carrinho e checkout ----- */
  const draft = { name: '', phone: '', email: '', type: '', street: '', number: '', district: '', complement: '', date: '', time: '', payment: '', notes: '' };

  function cartLines() {
    return cart.map((i) => {
      if (i.kind === 'cake') {
        const r = DB.cakePrice(C.cakes, i.sel);
        return { key: i.key, kind: 'cake', name: 'Bolo personalizado', summary: r.lines.map((l) => l[0] + ': ' + l[1]).join(' · '), unit: r.price, qty: 1, total: r.price, img: i.sel.refImage, problem: r.complete ? '' : 'Opções indisponíveis. Remova e monte novamente.' };
      }
      const p = prod(i.productId);
      if (!p) return { key: i.key, kind: 'product', name: 'Produto removido', summary: '', unit: 0, qty: i.qty, total: 0, problem: 'Este produto não existe mais.' };
      let problem = '';
      if (!sellable(p)) problem = 'Indisponível no momento.';
      else if (inCart(p.id) > p.stock) problem = 'Estoque disponível: ' + p.stock + '.';
      return { key: i.key, kind: 'product', p, name: p.name, summary: [p.unit, i.note && 'Obs.: ' + i.note].filter(Boolean).join(' · '), unit: p.price, qty: i.qty, total: p.price * i.qty, problem };
    });
  }

  function pCart() {
    const s = C.settings;
    const lines = cartLines();
    if (!lines.length) {
      mount('<div class="wrap"><div class="page-head"><p class="eyebrow">Carrinho</p><h1>Seu <em>carrinho</em></h1></div><div class="empty" style="margin-bottom:56px"><span style="font-size:2.4rem">🛍️</span><p>Seu carrinho está vazio.</p><div class="btn-row"><a class="btn btn-primary" href="#/cardapio">Ver cardápio</a>' + (C.cakes.enabled ? '<a class="btn btn-ghost" href="#/bolos">Montar um bolo</a>' : '') + '</div></div></div>');
      return;
    }
    const types = [];
    if (s.deliveryEnabled) types.push(['entrega', 'Entrega', '🛵']);
    if (s.pickupEnabled) types.push(['retirada', 'Retirada', '🏠']);
    if (!types.length) types.push(['retirada', 'Retirada', '🏠']);
    if (!types.some((t) => t[0] === draft.type)) draft.type = types[0][0];
    const pays = [['pix', 'Pix', '⚡'], ['dinheiro', 'Dinheiro', '💵'], ['cartao', 'Cartão', '💳']].filter((p) => (s.payments || {})[p[0]]);
    if (!pays.length) pays.push(['dinheiro', 'Combinar', '💬']);
    if (!pays.some((p) => p[0] === draft.payment)) draft.payment = pays[0][0];
    const min = minDate();
    if (!draft.date || draft.date < min) draft.date = min;
    const sub = lines.reduce((n, l) => n + l.total, 0);
    const fee = DB.feeFor(s, draft.type, sub);
    const bad = lines.some((l) => l.problem);

    const radios = (name, arr) => '<div class="radio-row">' + arr.map((a) => '<label class="opt"><input type="radio" name="' + name + '" data-draft="' + name + '" value="' + a[0] + '"' + (draft[name === 'dtype' ? 'type' : name] === a[0] ? ' checked' : '') + '><span class="opt-body" style="flex-direction:row;gap:8px;align-items:center"><span aria-hidden="true">' + a[2] + '</span><b style="font-weight:500">' + a[1] + '</b></span></label>').join('') + '</div>';

    mount(
      '<div class="wrap"><div class="page-head"><p class="eyebrow">Carrinho</p><h1>Finalize seu <em>pedido</em></h1></div><div class="cart-grid"><div>' +
      lines.map((l) => '<div class="cart-line' + (l.problem ? ' bad' : '') + '">' +
        (l.p ? visual(l.p) : l.img ? '<img src="' + esc(l.img) + '" alt="Referência">' : '<div class="ph" style="--h:340"><span>🎂</span></div>') +
        '<div><h3>' + esc(l.name) + '</h3><small>' + esc(l.summary) + '</small>' + (l.problem ? '<small style="color:var(--danger);font-weight:600">' + esc(l.problem) + '</small>' : '') +
        '<div class="row">' + (l.kind === 'product' && l.p ? '<div class="qty"><button data-dec="' + l.key + '" aria-label="Diminuir">−</button><span>' + l.qty + '</span><button data-inc="' + l.key + '" aria-label="Aumentar"' + (inCart(l.p.id) >= l.p.stock ? ' disabled' : '') + '>+</button></div>' : '<span class="badge">1 unidade</span>') +
        '<button class="link-btn" data-del="' + l.key + '">Remover</button></div></div><div class="lt">' + brl(l.total) + '</div></div>').join('') +
      '<a class="btn btn-ghost" href="#/cardapio">+ Adicionar mais itens</a></div>' +

      '<form class="panel" id="checkout" novalidate><h2>Seus dados</h2><div class="form-grid">' +
      '<div class="field span2"><label for="fName">Nome *</label><input type="text" id="fName" data-draft="name" autocomplete="name" value="' + esc(draft.name) + '"></div>' +
      '<div class="field"><label for="fPhone">WhatsApp / telefone *</label><input type="tel" id="fPhone" data-draft="phone" autocomplete="tel" placeholder="(00) 00000-0000" value="' + esc(draft.phone) + '"></div>' +
      '<div class="field"><label for="fMail">E-mail</label><input type="email" id="fMail" data-draft="email" autocomplete="email" value="' + esc(draft.email) + '"></div></div>' +
      '<h2 style="margin-top:6px">Entrega</h2>' + radios('dtype', types) +
      (draft.type === 'entrega' ? '<div class="form-grid"><div class="field span2"><label for="fStreet">Rua *</label><input type="text" id="fStreet" data-draft="street" value="' + esc(draft.street) + '"></div>' +
        '<div class="field"><label for="fNum">Número *</label><input type="text" id="fNum" data-draft="number" value="' + esc(draft.number) + '"></div>' +
        '<div class="field"><label for="fDist">Bairro *</label><input type="text" id="fDist" data-draft="district" value="' + esc(draft.district) + '"></div>' +
        '<div class="field span2"><label for="fComp">Complemento</label><input type="text" id="fComp" data-draft="complement" value="' + esc(draft.complement) + '"></div></div>' :
        (s.address ? '<p style="color:var(--ink-soft);font-size:.9rem">Retire em: ' + esc(s.address) + '</p>' : '')) +
      '<div class="form-grid"><div class="field"><label for="fDate">Data desejada *</label><input type="date" id="fDate" data-draft="date" min="' + min + '" value="' + esc(draft.date) + '">' + (hasCake() ? '<small>Bolos: mínimo ' + (Number(C.cakes.leadDays) || 0) + ' dia(s) de antecedência.</small>' : '') + '</div>' +
      '<div class="field"><label for="fTime">Horário</label><input type="time" id="fTime" data-draft="time" value="' + esc(draft.time) + '"></div></div>' +
      '<h2 style="margin-top:6px">Pagamento</h2>' + radios('payment', pays) +
      (s.orderNote ? '<small style="color:var(--ink-soft)">' + esc(s.orderNote) + '</small>' : '') +
      '<div class="field"><label for="fNotes">Observações do pedido</label><textarea id="fNotes" data-draft="notes" rows="2">' + esc(draft.notes) + '</textarea></div>' +
      '<div class="totals"><div><span>Subtotal</span><span>' + brl(sub) + '</span></div><div><span>Entrega</span><span>' + (draft.type === 'entrega' ? (fee ? brl(fee) : 'Grátis') : '—') + '</span></div><div class="big"><span>Total</span><span>' + brl(sub + fee) + '</span></div></div>' +
      '<button class="btn btn-primary" type="submit" id="placeOrder"' + (bad ? ' disabled' : '') + '>Finalizar pedido</button>' + (bad ? '<small style="color:var(--danger)">Resolva os itens marcados em vermelho para continuar.</small>' : '') +
      '</form></div></div>'
    );

    $('#checkout').addEventListener('submit', async (e) => {
      e.preventDefault();
      $$('#checkout .invalid').forEach((x) => x.classList.remove('invalid'));
      const miss = [];
      const need = (k, id) => { if (!String(draft[k]).trim()) miss.push(id); };
      need('name', 'fName'); need('date', 'fDate');
      if (String(draft.phone).replace(/\D/g, '').length < 10) miss.push('fPhone');
      if (draft.type === 'entrega') { need('street', 'fStreet'); need('number', 'fNum'); need('district', 'fDist'); }
      if (draft.date && draft.date < min && !miss.includes('fDate')) miss.push('fDate');
      if (miss.length) {
        miss.forEach((id) => $('#' + id).classList.add('invalid'));
        $('#' + miss[0]).focus();
        toast(miss.includes('fPhone') && draft.phone ? 'Informe um telefone com DDD.' : miss.includes('fDate') && draft.date ? 'Escolha uma data a partir de ' + fmtDate(min) + '.' : 'Preencha os campos marcados.', { type: 'error' });
        return;
      }
      const btn = $('#placeOrder'); btn.disabled = true; btn.textContent = 'Enviando…';
      try {
        const order = await DB.orders.create({
          customer: { name: draft.name.trim(), phone: draft.phone.trim(), email: draft.email.trim() },
          delivery: { type: draft.type, street: draft.street.trim(), number: draft.number.trim(), district: draft.district.trim(), complement: draft.complement.trim(), date: draft.date, time: draft.time },
          payment: draft.payment, notes: draft.notes.trim(),
          items: cart.map((i) => i.kind === 'cake' ? { kind: 'cake', qty: 1, sel: i.sel } : { kind: 'product', productId: i.productId, qty: i.qty, note: i.note })
        });
        cart = []; saveCart(); draft.notes = '';
        await load();
        location.hash = '#/pedido/' + order.id;
      } catch (err) {
        const raw = String(err?.message || '');
        const friendly = /decrement_product_stock|function .* does not exist|PGRST202/i.test(raw)
          ? 'Não foi possível concluir o pedido porque o estoque ainda não está configurado no banco. Avise o administrador.'
          : raw || 'Não foi possível concluir o pedido. Tente novamente.';
        toast(friendly, { type: 'error', ms: 6000 });
        btn.disabled = false; btn.textContent = 'Finalizar pedido';
        await load(); pCart();
      }
    });
  }

  async function pOrder(id) {
    const o = await DB.orders.get(id);
    if (!o) { mount('<div class="wrap"><div class="empty" style="margin:56px 0"><p>Pedido não encontrado.</p><a class="btn btn-primary" href="#/">Voltar ao início</a></div></div>'); return; }
    const s = C.settings;
    const txt = 'Olá! Fiz o pedido #' + o.number + ' pelo site.\n' + o.items.map((i) => '• ' + i.qty + 'x ' + i.name + (i.summary ? ' (' + i.summary + ')' : '')).join('\n') +
      '\nTotal: ' + brl(o.total) + '\n' + (o.delivery.type === 'entrega' ? 'Entrega' : 'Retirada') + ' em ' + fmtDate(o.delivery.date) + (o.delivery.time ? ' às ' + o.delivery.time : '') + '\nNome: ' + o.customer.name;
    const wa = waLink(txt);
    mount('<div class="wrap"><div class="done"><span class="big-ic" aria-hidden="true">🎉</span><p class="eyebrow">Pedido concluído</p><h1>Obrigada, <em>' + esc(o.customer.name.split(' ')[0]) + '</em>!</h1>' +
      '<p class="lead">Seu pedido <b>#' + o.number + '</b> foi realizado com sucesso! Entraremos em contato para confirmar os detalhes.</p>' +
      '<div class="panel"><h2>Resumo</h2>' + o.items.map((i) => '<div style="display:flex;justify-content:space-between;gap:12px"><span>' + i.qty + '× ' + esc(i.name) + (i.summary ? '<br><small style="color:var(--ink-soft)">' + esc(i.summary) + '</small>' : '') + '</span><b>' + brl(i.unitPrice * i.qty) + '</b></div>').join('') +
      '<div class="totals"><div><span>Subtotal</span><span>' + brl(o.subtotal) + '</span></div><div><span>Entrega</span><span>' + (o.delivery.type === 'entrega' ? (o.deliveryFee ? brl(o.deliveryFee) : 'Grátis') : '—') + '</span></div><div class="big"><span>Total</span><span>' + brl(o.total) + '</span></div></div>' +
      '<p style="color:var(--ink-soft);font-size:.9rem">' + (o.delivery.type === 'entrega' ? 'Entrega' : 'Retirada') + ' em ' + fmtDate(o.delivery.date) + (o.delivery.time ? ' às ' + esc(o.delivery.time) : '') + ' · Pagamento: ' + esc(o.payment) + '</p>' +
      (o.payment === 'pix' && s.pixKey ? '<p>Chave Pix: <b>' + esc(s.pixKey) + '</b></p>' : '') + '</div>' +
      '<div class="btn-row">' + (wa ? '<a class="btn btn-primary" target="_blank" rel="noopener" href="' + wa + '">Enviar pelo WhatsApp</a>' : '') + '<a class="btn btn-ghost" href="#/cardapio">Continuar comprando</a><a class="btn btn-ghost" href="#/">Início</a></div></div></div>');
  }

  /* ---------- rodapé / cabeçalho ---------- */
  function renderChrome() {
    const s = C.settings;
    $('#brand').innerHTML = '<i aria-hidden="true">🧁</i><span>' + brandHTML(s.storeName) + '</span>';
    document.title = s.storeName || 'Doceria';
    $('#nav a[data-r="bolos"]').hidden = !C.cakes.enabled;
    const ig = String(s.instagram || '').replace(/^@/, '');
    const PIN = ICO.pin, CLOCK = ICO.clock, IG = ICO.ig;
    const lines = hoursRows(s).map((r) => r.label + ': ' + r.value);
    const wa = waLink('Olá!');
    $('#contato').innerHTML = '<div class="wrap"><div class="foot-grid"><div><div class="foot-brand">' + esc(s.storeName) + '</div><p class="foot-tag">' + esc(s.tagline) + '</p></div>' +
      '<div class="foot-info">' + (s.address || s.address2 ? '<p class="fi">' + PIN + '<span>' + esc(s.address || '') + (s.address && s.address2 ? '<br>' : '') + esc(s.address2 || '') + '</span></p>' : '') +
      (lines.length ? '<p class="fi">' + CLOCK + '<span>' + lines.map(esc).join('<br>') + '</span></p>' : '') + '</div>' +
      '<div class="foot-links"><a href="#/cardapio">Cardápio</a><a href="#/carrinho">Meu pedido</a>' +
      (ig ? '<a href="https://instagram.com/' + esc(ig) + '" target="_blank" rel="noopener">' + IG + '@' + esc(ig) + '</a>' : '') +
      (wa ? '<a href="' + wa + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + (s.phone ? '<span>' + esc(s.phone) + '</span>' : '') + (s.email ? '<span>' + esc(s.email) + '</span>' : '') + '</div></div></div>' +
      '<div class="foot-bottom"><div class="wrap"><span>© ' + new Date().getFullYear() + ' ' + esc(s.storeName) + (s.city ? ' — ' + esc(String(s.city).replace(' · ', ', ')) : '') + '</span></div></div>';
  }

  /* ---------- roteador ---------- */
  async function render(keepScroll) {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const page = parts[0] || '';
    $$('#nav a[data-r]').forEach((a) => a.classList.toggle('on', a.dataset.r === page));
    $('#nav').classList.remove('open'); $('#navToggle').setAttribute('aria-expanded', 'false');
    if (page === 'cardapio') pMenu(parts[1]);
    else if (page === 'bolos') pCakes(parts[1]);
    else if (page === 'contato') pContact();
    else if (page === 'carrinho') pCart();
    else if (page === 'pedido') await pOrder(parts[1]);
    else pHome();
    if (!keepScroll) window.scrollTo(0, 0);
  }

  // cliques delegados: adicionar, abrir produto, quantidade, remover, rolar até contato
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) { e.stopPropagation(); addToCart(add.dataset.add, 1, ''); if (location.hash.startsWith('#/cardapio') || !location.hash || location.hash === '#/') render(true); return; }
    const open = e.target.closest('[data-open]');
    if (open) { openProduct(open.dataset.open); return; }
    const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), del = e.target.closest('[data-del]');
    if (inc || dec || del) {
      const key = (inc || dec || del).dataset.inc || (dec && dec.dataset.dec) || (del && del.dataset.del);
      const line = cart.find((i) => i.key === key);
      if (line) {
        if (inc) { const p = prod(line.productId); if (p && inCart(p.id) < p.stock) line.qty++; }
        else if (dec) line.qty = Math.max(1, line.qty - 1);
        else cart = cart.filter((i) => i.key !== key);
        saveCart(); pCart();
      }
      return;
    }
    const sc = e.target.closest('[data-scroll]');
    if (sc) { e.preventDefault(); $('#' + sc.dataset.scroll).scrollIntoView({ behavior: 'smooth' }); $('#nav').classList.remove('open'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('.pcard')) openProduct(e.target.dataset.open);
  });
  document.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.draft; if (k && e.target.type !== 'radio') draft[k] = e.target.value; });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.draft;
    if (!k) return;
    if (k === 'dtype') { draft.type = e.target.value; pCart(); }
    else if (k === 'payment') { draft.payment = e.target.value; }
    else draft[k] = e.target.value;
  });
  $('#navToggle').addEventListener('click', () => { const o = $('#nav').classList.toggle('open'); $('#navToggle').setAttribute('aria-expanded', String(o)); });
  window.addEventListener('hashchange', () => render(false));
  DB.onChange(async () => { await load(); renderChrome(); if (!document.querySelector('.modal-back') && !(location.hash.startsWith('#/carrinho') || location.hash.startsWith('#/bolos'))) render(true); });

  (async function init() {
    await load();
    renderChrome(); updateBadge();
    await render(false);
  })();
})();
