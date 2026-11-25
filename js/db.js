/*
 * CAMADA DE DADOS (modo local)
 * ---------------------------------------------------------------
 * Todo o site e o painel falam com o banco SOMENTE através de window.DB.
 * Hoje os dados ficam no localStorage do navegador (dados simulados).
 * Todas as funções são assíncronas (retornam Promise) para que, no futuro,
 * basta reescrever ESTE arquivo apontando para Firebase / Supabase / API,
 * sem mexer em nenhuma tela.
 *
 * Coleções: settings, categories, products, cakes, orders (+ counters)
 * Autenticação: DB.auth (simulada, ver comentário abaixo)
 */
(function (w) {
  'use strict';
  const KEY = 'doceria.data.v1';
  const SESSION_KEY = 'doceria.session.v1';
  const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const STATUSES = [
    { id: 'novo', label: 'Novo', tone: 'info' },
    { id: 'preparo', label: 'Em preparo', tone: 'warn' },
    { id: 'pronto', label: 'Pronto', tone: '' },
    { id: 'concluido', label: 'Concluído', tone: 'ok' },
    { id: 'cancelado', label: 'Cancelado', tone: 'danger' }
  ];

  /* ---------- utilidades de regra de negócio ---------- */
  const util = {
    isSellable: (p) => !!p.available && p.stock > 0,
    stockStatus: (p) => (p.stock <= 0 ? 'out' : p.stock <= (p.minStock || 0) ? 'low' : 'ok'),
    statusLabel: (id) => (STATUSES.find((s) => s.id === id) || {}).label || id,
    statusTone: (id) => (STATUSES.find((s) => s.id === id) || {}).tone || ''
  };

  function cakePrice(cakes, sel) {
    const f = (g, id) => (cakes[g] || []).find((x) => x.id === id);
    const type = f('types', sel.typeId), size = f('sizes', sel.sizeId), dough = f('doughs', sel.doughId),
      filling = f('fillings', sel.fillingId), topping = f('toppings', sel.toppingId), occasion = f('occasions', sel.occasionId);
    const extras = (sel.extraIds || []).map((id) => f('extras', id)).filter(Boolean);
    let price = size ? Number(size.price) || 0 : 0;
    [type, dough, filling, topping, ...extras].forEach((x) => { if (x) price += Number(x.price) || 0; });
    const lines = [];
    if (type) lines.push(['Tipo', type.name]);
    if (size) lines.push(['Tamanho', size.name + (size.serves ? ' (' + size.serves + ')' : '')]);
    if (dough) lines.push(['Massa', dough.name]);
    if (filling) lines.push(['Recheio', filling.name]);
    if (topping) lines.push(['Cobertura', topping.name]);
    if (extras.length) lines.push(['Extras', extras.map((e) => e.name).join(', ')]);
    if (occasion) lines.push(['Ocasião', occasion.name]);
    if (sel.text) lines.push(['Texto no bolo', '“' + sel.text + '”']);
    return { price, lines, complete: !!(type && size && dough && filling && topping) };
  }

  function feeFor(settings, type, subtotal) {
    if (type !== 'entrega') return 0;
    const free = Number(settings.freeDeliveryAbove) || 0;
    if (free > 0 && subtotal >= free) return 0;
    return Number(settings.deliveryFee) || 0;
  }

  /* ---------- dados de exemplo ---------- */
  /* Dados da D'Lola Doceria (copiados do site de referência) */
  function DLOLA_INFO() {
    const H = (day, o, c) => ({ day, open: o, close: c, closed: !o });
    return {
      storeName: "D'Lola Doceria", rating: '5,0 no Google · 9 avaliações',
      tagline: 'Doces feitos para transformar pequenos momentos em momentos especiais.',
      city: 'Uberaba · MG', phone: '', whatsapp: '', email: '',
      instagram: '@dloladoceria_',
      address: 'Av. Umuarama, 123 - José Valim de Melo', address2: 'Uberaba - MG — CEP 38037-490',
      hours: [H('Segunda', '', ''), H('Terça', '11:00', '17:00'), H('Quarta', '11:00', '17:00'), H('Quinta', '11:00', '17:00'),
        H('Sexta', '11:00', '17:00'), H('Sábado', '11:00', '15:00'), H('Domingo', '11:00', '15:00')],
      closedExtra: 'feriados', mapQuery: '', mapsUrl: '', googleReviewsUrl: '', reviews: []
    };
  }

  function seed() {
    const now = Date.now(), D = 864e5;
    const categories = [
      { id: 'cat_brig', name: 'Brigadeiros gourmet', emoji: '🍫', description: 'Enrolados à mão, em caixas com 6 unidades.', order: 1, visible: true },
      { id: 'cat_finos', name: 'Doces finos', emoji: '🍬', description: 'Bem-casados, trufas e doces para festas.', order: 2, visible: true },
      { id: 'cat_tortas', name: 'Tortas e cheesecakes', emoji: '🥧', description: 'Por fatia ou inteiras.', order: 3, visible: true },
      { id: 'cat_pote', name: 'Bolos no pote', emoji: '🍰', description: 'Camadas de massa, recheio e cobertura.', order: 4, visible: true },
      { id: 'cat_cookies', name: 'Cookies e brownies', emoji: '🍪', description: 'Assados para a sua encomenda.', order: 5, visible: true },
      { id: 'cat_kits', name: 'Kits e presentes', emoji: '🎁', description: 'Caixas para presentear e para festas.', order: 6, visible: true }
    ];
    const P = (id, name, categoryId, price, stock, minStock, unit, description, emoji, hue, o = {}) =>
      ({ id, name, categoryId, price, stock, minStock, unit, description, emoji, hue, images: [], available: true, featured: false, createdAt: now, ...o });
    const products = [
      P('p_brig_trad', 'Brigadeiro tradicional', 'cat_brig', 24, 40, 10, 'caixa com 6', 'Chocolate cremoso enrolado em granulado fino.', '🍫', 20),
      P('p_brig_ninho', 'Brigadeiro de ninho com morango', 'cat_brig', 30, 25, 10, 'caixa com 6', 'Leite ninho e pedacinhos de morango.', '🍓', 350, { featured: true }),
      P('p_brig_pist', 'Brigadeiro de pistache', 'cat_brig', 36, 0, 5, 'caixa com 6', 'Creme de pistache com cobertura crocante.', '🌿', 100),
      P('p_beijinho', 'Beijinho de coco', 'cat_brig', 24, 6, 10, 'caixa com 6', 'Coco fresco e cravo na medida certa.', '🥥', 55),
      P('p_bem', 'Bem-casado', 'cat_finos', 6.5, 60, 20, 'unidade', 'Pão de ló macio com recheio de doce de leite.', '🤍', 40),
      P('p_trufa', 'Trufa de maracujá', 'cat_finos', 32, 18, 8, 'caixa com 6', 'Ganache de chocolate branco com maracujá.', '🍋', 48, { featured: true }),
      P('p_panetone', 'Panetone trufado (sazonal)', 'cat_finos', 58, 5, 2, 'unidade', 'Edição de fim de ano, disponível por tempo limitado.', '🎄', 8, { available: false }),
      P('p_torta_fatia', 'Torta de limão', 'cat_tortas', 14, 12, 4, 'fatia', 'Base crocante, creme de limão e merengue maçaricado.', '🍋', 70),
      P('p_torta_int', 'Torta de limão inteira', 'cat_tortas', 110, 3, 2, 'serve 10 fatias', 'A mesma torta da vitrine, em tamanho para a mesa.', '🥧', 65),
      P('p_cheese', 'Cheesecake de frutas vermelhas', 'cat_tortas', 18, 10, 3, 'fatia', 'Cremoso, com calda artesanal de frutas vermelhas.', '🫐', 330, { featured: true }),
      P('p_pote_ninho', 'Bolo no pote de ninho', 'cat_pote', 16, 20, 6, 'pote 200 ml', 'Massa branca, creme de ninho e geleia de morango.', '🍰', 15, { featured: true }),
      P('p_pote_choc', 'Bolo no pote de chocolate', 'cat_pote', 16, 15, 6, 'pote 200 ml', 'Massa de chocolate e brigadeiro cremoso.', '🍫', 25),
      P('p_cookie', 'Cookie com gotas de chocolate', 'cat_cookies', 9, 30, 10, 'unidade', 'Casquinha crocante e miolo macio.', '🍪', 35),
      P('p_brownie', 'Brownie recheado', 'cat_cookies', 12, 4, 6, 'unidade', 'Brownie denso com recheio de doce de leite.', '🍫', 18),
      P('p_kit_pres', 'Kit presente', 'cat_kits', 49, 8, 3, '6 doces variados', 'Caixa decorada com seleção da casa e cartão.', '🎁', 340, { featured: true }),
      P('p_kit_festa', 'Box festa', 'cat_kits', 95, 5, 2, '30 docinhos', 'Trinta docinhos sortidos para a sua comemoração.', '🎉', 280)
    ];
    const O = (g, id, name, price, extra = {}) => ({ id: g + '_' + id, name, price, available: true, ...extra });
    const cakes = {
      enabled: true,
      leadDays: 3,
      types: [
        O('t', 'chantilly', 'Decorado com chantilly', 0, { description: 'Cobertura lisa ou com bicos, em cores à escolha.', emoji: '🎂', images: [] }),
        O('t', 'naked', 'Naked cake', 10, { description: 'Camadas aparentes, frutas e flores.', emoji: '🍰', images: [] }),
        O('t', 'pasta', 'Pasta americana', 40, { description: 'Acabamento liso para temas e figuras.', emoji: '🎀', images: [] })
      ],
      sizes: [
        O('s', 'p', 'Pequeno 15 cm', 120, { serves: '8 a 10 fatias' }),
        O('s', 'm', 'Médio 20 cm', 180, { serves: '15 a 20 fatias' }),
        O('s', 'g', 'Grande 25 cm', 260, { serves: '25 a 30 fatias' }),
        O('s', 'f', 'Festa 30 cm', 360, { serves: '40 a 50 fatias' })
      ],
      doughs: [O('d', 'baunilha', 'Baunilha', 0), O('d', 'choc', 'Chocolate', 0), O('d', 'cenoura', 'Cenoura', 0), O('d', 'redv', 'Red velvet', 15), O('d', 'laranja', 'Laranja', 0)],
      fillings: [O('f', 'brig', 'Brigadeiro', 0), O('f', 'beij', 'Beijinho', 0), O('f', 'dl', 'Doce de leite', 10), O('f', 'ninho', 'Ninho com morango', 15), O('f', 'mar', 'Mousse de maracujá', 15)],
      toppings: [O('c', 'chantilly', 'Chantilly', 0), O('c', 'ganache', 'Ganache de chocolate', 15), O('c', 'butter', 'Buttercream', 20)],
      extras: [O('e', 'topo', 'Topo de bolo personalizado', 25), O('e', 'frutas', 'Frutas frescas', 20), O('e', 'flores', 'Flores comestíveis', 35), O('e', 'caixa', 'Caixa para presente', 15)],
      occasions: [
        O('o', 'aniv', 'Aniversários', 0, { emoji: '🎂' }), O('o', 'cas', 'Casamentos', 0, { emoji: '💍' }),
        O('o', 'comem', 'Comemorações', 0, { emoji: '🥂' }), O('o', 'festas', 'Festas', 0, { emoji: '🎁' }),
        O('o', 'datas', 'Datas especiais', 0, { emoji: '📅' })
      ]
    };
    const settings = {
      ...DLOLA_INFO(),
      deliveryEnabled: true, pickupEnabled: true, deliveryFee: 8, freeDeliveryAbove: 150,
      payments: { pix: true, dinheiro: true, cartao: true }, pixKey: '',
      autoDisableOutOfStock: false,
      orderNote: 'O pagamento é combinado na confirmação do pedido.'
    };
    const state = { version: 1, settings, categories, products, cakes, orders: [], counters: { order: 1000 } };
    const mk = (ago, status, name, phone, type, payment, raw) => {
      const r = resolveItems(state, raw, false);
      const fee = feeFor(settings, type, r.subtotal);
      const at = now - ago;
      const n = ++state.counters.order;
      state.orders.push({
        id: 'ord_seed' + n, number: n, createdAt: at, status,
        customer: { name, phone, email: '' },
        delivery: { type, street: type === 'entrega' ? 'Rua das Acácias' : '', number: type === 'entrega' ? '45' : '', district: type === 'entrega' ? 'Centro' : '', complement: '', date: new Date(at + 2 * D).toISOString().slice(0, 10), time: '15:00' },
        payment, notes: '', items: r.items, subtotal: r.subtotal, deliveryFee: fee, total: r.subtotal + fee,
        history: [{ status: 'novo', at }].concat(status === 'novo' ? [] : [{ status, at: at + 36e5 }])
      });
    };
    mk(2 * 36e5, 'novo', 'Marina Souza', '(00) 90000-1111', 'entrega', 'pix', [{ kind: 'product', productId: 'p_brig_ninho', qty: 2 }, { kind: 'product', productId: 'p_cookie', qty: 4 }]);
    mk(1 * D, 'preparo', 'Rafael Lima', '(00) 90000-2222', 'retirada', 'dinheiro', [{ kind: 'cake', qty: 1, sel: { typeId: 't_naked', sizeId: 's_m', doughId: 'd_redv', fillingId: 'f_ninho', toppingId: 'c_chantilly', extraIds: ['e_frutas'], occasionId: 'o_aniv', text: 'Parabéns, Lia!', theme: 'Flores rosa e branco', notes: '' } }]);
    mk(3 * D, 'concluido', 'Camila Prado', '(00) 90000-3333', 'entrega', 'cartao', [{ kind: 'product', productId: 'p_kit_pres', qty: 1 }, { kind: 'product', productId: 'p_pote_ninho', qty: 3 }]);
    mk(5 * D, 'cancelado', 'João Alves', '(00) 90000-4444', 'retirada', 'pix', [{ kind: 'product', productId: 'p_torta_int', qty: 1 }]);
    return state;
  }

  /* ---------- itens do pedido ---------- */
  function resolveItems(state, raw, checkStock) {
    if (!raw || !raw.length) throw new Error('O carrinho está vazio.');
    const items = []; let subtotal = 0;
    const need = {};
    raw.forEach((r) => {
      const qty = Math.max(1, parseInt(r.qty, 10) || 1);
      if (r.kind === 'cake') {
        const c = cakePrice(state.cakes, r.sel || {});
        if (!c.complete) throw new Error('Há um bolo com opções incompletas no carrinho.');
        const note = [r.sel.theme && 'Tema: ' + r.sel.theme, r.sel.notes && 'Obs.: ' + r.sel.notes].filter(Boolean).join(' | ');
        items.push({ kind: 'cake', name: 'Bolo personalizado', summary: c.lines.map((l) => l[0] + ': ' + l[1]).join(' · '), lines: c.lines, qty, unitPrice: c.price, note, refImage: r.sel.refImage || '' });
        subtotal += c.price * qty;
      } else {
        const p = state.products.find((x) => x.id === r.productId);
        if (!p) throw new Error('Um produto do carrinho não existe mais.');
        if (checkStock) {
          need[p.id] = (need[p.id] || 0) + qty;
          if (!p.available) throw new Error('"' + p.name + '" não está disponível no momento.');
          if (p.stock < need[p.id]) throw new Error('"' + p.name + '" tem apenas ' + p.stock + ' em estoque.');
        }
        items.push({ kind: 'product', productId: p.id, name: p.name, summary: p.unit || '', qty, unitPrice: p.price, note: r.note || '', refImage: '' });
        subtotal += p.price * qty;
      }
    });
    return { items, subtotal };
  }

  function applyStock(state, order, sign) {
    order.items.forEach((it) => {
      if (it.kind !== 'product') return;
      const p = state.products.find((x) => x.id === it.productId);
      if (!p) return;
      p.stock = Math.max(0, p.stock - sign * it.qty);
      if (sign > 0 && p.stock <= 0 && state.settings.autoDisableOutOfStock) p.available = false;
    });
  }


  /* ---------- Supabase ---------- */
  const sb = w.supabase.createClient(w.SUPABASE_URL, w.SUPABASE_ANON_KEY);
  const listeners = [];
  let cachedSession = null;
  const notify = () => listeners.slice().forEach((fn) => { try { fn(); } catch (_) {} });

  const mapProduct = (r) => r ? ({
    id: r.id, name: r.name, categoryId: r.category_id || '', price: Number(r.price) || 0,
    stock: Number(r.stock) || 0, minStock: Number(r.min_stock) || 0, unit: r.unit || '',
    description: r.description || '', emoji: r.emoji || '🧁', hue: r.hue || 340,
    images: Array.isArray(r.images) ? r.images : [], available: !!r.available,
    featured: !!r.featured, createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now()
  }) : null;
  const mapCategory = (r) => r ? ({ id:r.id, name:r.name, emoji:r.emoji||'🍬', description:r.description||'', order:Number(r.order)||0, visible:!!r.visible }) : null;
  const mapSetting = (r) => r ? ({
    storeName:r.store_name, rating:r.rating||'', tagline:r.tagline||'', city:r.city||'', phone:r.phone||'', whatsapp:r.whatsapp||'',
    email:r.email||'', instagram:r.instagram||'', address:r.address||'', address2:r.address2||'', hours:Array.isArray(r.hours)?r.hours:[],
    closedExtra:r.closed_extra||'', mapQuery:r.map_query||'', mapsUrl:r.maps_url||'', googleReviewsUrl:r.google_reviews_url||'', reviews:Array.isArray(r.reviews)?r.reviews:[],
    deliveryEnabled:!!r.delivery_enabled, pickupEnabled:!!r.pickup_enabled, deliveryFee:Number(r.delivery_fee)||0,
    freeDeliveryAbove:Number(r.free_delivery_above)||0, payments:r.payments||{}, pixKey:r.pix_key||'', autoDisableOutOfStock:!!r.auto_disable_out_of_stock, orderNote:r.order_note||''
  }) : null;
  const mapCake = (r) => r ? ({ group_key:r.group_key, id:r.id, name:r.name, price:Number(r.price)||0, available:!!r.available, order:Number(r.order)||0, description:r.description||'', emoji:r.emoji||'', images:Array.isArray(r.images)?r.images:[], serves:r.serves||'' }) : null;
  const mapOrder = (r, items) => r ? ({
    id:r.id, number:Number(r.number), createdAt:r.created_at?new Date(r.created_at).getTime():Date.now(), updatedAt:r.updated_at?new Date(r.updated_at).getTime():Date.now(),
    status:r.status, customer:r.customer||{}, delivery:r.delivery||{}, payment:r.payment||'', notes:r.notes||'', subtotal:Number(r.subtotal)||0,
    deliveryFee:Number(r.delivery_fee)||0, total:Number(r.total)||0, history:Array.isArray(r.history)?r.history:[], items:items||[]
  }) : null;
  const mapItem = (r) => ({ id:r.id, kind:r.kind, productId:r.product_id||'', name:r.name, summary:r.summary||'', lines:Array.isArray(r.lines)?r.lines:[], qty:Number(r.qty)||1, unitPrice:Number(r.unit_price)||0, note:r.note||'', refImage:r.ref_image||'', cakeSelection:r.cake_selection||null });

  async function assertOk(q) { const { data, error } = await q; if (error) throw new Error(error.message); return data; }
  async function adminUser() { const { data } = await sb.auth.getUser(); return !!data.user && (data.user.email || '').toLowerCase() === 'dloladoceria@gmail.com'; }

  async function seedDatabase() {
    if (!(await adminUser())) return;
    const cats = await assertOk(sb.from('categories').select('id').limit(1));
    const prods = await assertOk(sb.from('products').select('id').limit(1));
    if (!cats.length && !prods.length) {
      const s = seed();
      await assertOk(sb.from('categories').upsert(s.categories.map(c => ({ id:c.id,name:c.name,emoji:c.emoji,description:c.description,"order":c.order,visible:c.visible }))));
      await assertOk(sb.from('products').upsert(s.products.map(p => ({ id:p.id,name:p.name,category_id:p.categoryId,price:p.price,stock:p.stock,min_stock:p.minStock,unit:p.unit,description:p.description,emoji:p.emoji,hue:p.hue,images:p.images,available:p.available,featured:p.featured }))));
      await assertOk(sb.from('cake_config').upsert({id:1,enabled:s.cakes.enabled,lead_days:s.cakes.leadDays}));
      const opts=[];
      for (const g of ['types','sizes','doughs','fillings','toppings','extras','occasions']) for (const x of s.cakes[g]) opts.push({id:x.id,group_key:g,name:x.name,price:x.price,description:x.description||null,emoji:x.emoji||null,images:x.images||[],serves:x.serves||null,available:x.available!==false,"order":x.order||0});
      await assertOk(sb.from('cake_options').upsert(opts));
      const set=s.settings;
      await assertOk(sb.from('settings').upsert({id:1,store_name:set.storeName,rating:set.rating,tagline:set.tagline,city:set.city,phone:set.phone,whatsapp:set.whatsapp,email:set.email,instagram:set.instagram,address:set.address,address2:set.address2,hours:set.hours,closed_extra:set.closedExtra,map_query:set.mapQuery,maps_url:set.mapsUrl,google_reviews_url:set.googleReviewsUrl,reviews:set.reviews,delivery_enabled:set.deliveryEnabled,pickup_enabled:set.pickupEnabled,delivery_fee:set.deliveryFee,free_delivery_above:set.freeDeliveryAbove,payments:set.payments,pix_key:set.pixKey,auto_disable_out_of_stock:set.autoDisableOutOfStock,order_note:set.orderNote}));
    }
  }

  const products = {
    async list(){ return (await assertOk(sb.from('products').select('*').order('created_at',{ascending:true}))).map(mapProduct); },
    async get(id){ const d=await assertOk(sb.from('products').select('*').eq('id',id).maybeSingle()); return mapProduct(d); },
    async save(item){
      const row={id:item.id||uid('p'),name:item.name,category_id:item.categoryId||null,price:Number(item.price)||0,stock:Math.max(0,Math.floor(Number(item.stock)||0)),min_stock:Math.max(0,Math.floor(Number(item.minStock)||0)),unit:item.unit||'',description:item.description||'',emoji:item.emoji||'🧁',hue:item.hue||340,images:item.images||[],available:item.available!==false,featured:!!item.featured};
      const d=await assertOk(sb.from('products').upsert(row).select().single()); notify(); return mapProduct(d);
    },
    async remove(id){ await assertOk(sb.from('products').delete().eq('id',id)); notify(); }
  };

  const categories = {
    async list(){ return (await assertOk(sb.from('categories').select('*').order('order',{ascending:true}))).map(mapCategory); },
    async get(id){ return mapCategory(await assertOk(sb.from('categories').select('*').eq('id',id).maybeSingle())); },
    async save(item){ const row={id:item.id||uid('cat'),name:item.name,emoji:item.emoji||'🍬',description:item.description||'',visible:item.visible!==false,"order":item.order||0}; if(!item.id){ const max=await assertOk(sb.from('categories').select('order').order('order',{ascending:false}).limit(1)); row.order=(max[0]?.order||0)+1; } const d=await assertOk(sb.from('categories').upsert(row).select().single()); notify(); return mapCategory(d); },
    async remove(id){ await assertOk(sb.from('categories').delete().eq('id',id)); notify(); },
    async move(id,dir){ const arr=await this.list(), i=arr.findIndex(c=>c.id===id), j=i+dir; if(i<0||j<0||j>=arr.length)return; const a=arr[i],b=arr[j]; await assertOk(sb.from('categories').update({"order":b.order}).eq('id',a.id)); await assertOk(sb.from('categories').update({"order":a.order}).eq('id',b.id)); notify(); },
    async assignProducts(catId,ids){ await assertOk(sb.from('products').update({category_id:null}).eq('category_id',catId)); if(ids.length) await assertOk(sb.from('products').update({category_id:catId}).in('id',ids)); notify(); }
  };

  const cakes = {
    async get(){ const cfg=await assertOk(sb.from('cake_config').select('*').eq('id',1).maybeSingle()); const rows=await assertOk(sb.from('cake_options').select('*').order('order',{ascending:true})); const out={enabled:cfg?!!cfg.enabled:true,leadDays:cfg?Number(cfg.lead_days)||0:3,types:[],sizes:[],doughs:[],fillings:[],toppings:[],extras:[],occasions:[]}; rows.map(mapCake).forEach(x=>{ if(out[x.group_key]) out[x.group_key].push(x); }); return out; },
    async saveConfig(cfg){ await assertOk(sb.from('cake_config').upsert({id:1,enabled:!!cfg.enabled,lead_days:Math.max(0,parseInt(cfg.leadDays,10)||0)})); notify(); },
    async saveItem(group,item){ const row={id:item.id||uid(group[0]),group_key:group,name:item.name,price:Number(item.price)||0,description:item.description||null,emoji:item.emoji||null,images:item.images||[],serves:item.serves||null,available:item.available!==false,"order":item.order||0}; if(!item.id){const max=await assertOk(sb.from('cake_options').select('order').eq('group_key',group).order('order',{ascending:false}).limit(1)); row.order=(max[0]?.order||0)+1;} const d=await assertOk(sb.from('cake_options').upsert(row).select().single()); notify(); return mapCake(d); },
    async removeItem(group,id){ await assertOk(sb.from('cake_options').delete().eq('group_key',group).eq('id',id)); notify(); },
    async moveItem(group,id,dir){ const arr=(await this.get())[group],i=arr.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=arr.length)return;const a=arr[i],b=arr[j];await assertOk(sb.from('cake_options').update({"order":b.order}).eq('id',a.id));await assertOk(sb.from('cake_options').update({"order":a.order}).eq('id',b.id));notify(); }
  };

  const settings = {
    async get(){ return mapSetting(await assertOk(sb.from('settings').select('*').eq('id',1).maybeSingle())); },
    async save(patch){ const row={id:1}; const m={storeName:'store_name',rating:'rating',tagline:'tagline',city:'city',phone:'phone',whatsapp:'whatsapp',email:'email',instagram:'instagram',address:'address',address2:'address2',hours:'hours',closedExtra:'closed_extra',mapQuery:'map_query',mapsUrl:'maps_url',googleReviewsUrl:'google_reviews_url',reviews:'reviews',deliveryEnabled:'delivery_enabled',pickupEnabled:'pickup_enabled',deliveryFee:'delivery_fee',freeDeliveryAbove:'free_delivery_above',payments:'payments',pixKey:'pix_key',autoDisableOutOfStock:'auto_disable_out_of_stock',orderNote:'order_note'}; Object.keys(patch).forEach(k=>{if(m[k])row[m[k]]=patch[k];}); const d=await assertOk(sb.from('settings').upsert(row).select().single()); notify(); return mapSetting(d); }
  };

  async function getOrder(id){ const o=await assertOk(sb.from('orders').select('*').eq('id',id).maybeSingle()); if(!o)return null; const its=await assertOk(sb.from('order_items').select('*').eq('order_id',id).order('created_at',{ascending:true})); return mapOrder(o,its.map(mapItem)); }
  const orders = {
    async list(){ const os=await assertOk(sb.from('orders').select('*').order('created_at',{ascending:false})); const ids=os.map(x=>x.id); let its=[]; if(ids.length) its=await assertOk(sb.from('order_items').select('*').in('order_id',ids)); const by={}; its.forEach(i=>(by[i.order_id]??=[]).push(mapItem(i))); return os.map(o=>mapOrder(o,by[o.id]||[])); },
    async get(id){ return getOrder(id); },
    async create(payload){
      const [s,ps,k]=await Promise.all([settings.get(),products.list(),cakes.get()]);
      const fake={settings:s,products:ps,cakes:k}; const r=resolveItems(fake,payload.items,true); const fee=feeFor(s,payload.delivery.type,r.subtotal); const now=new Date().toISOString();
      const order=await assertOk(sb.from('orders').insert({status:'novo',customer:payload.customer,delivery:payload.delivery,payment:payload.payment,notes:payload.notes||'',subtotal:r.subtotal,delivery_fee:fee,total:r.subtotal+fee,history:[{status:'novo',at:Date.now()}]}).select().single());
      const rows=r.items.map(it=>({order_id:order.id,kind:it.kind,product_id:it.productId||null,name:it.name,summary:it.summary||'',lines:it.lines||[],qty:it.qty,unit_price:it.unitPrice,note:it.note||'',ref_image:it.refImage||'',cake_selection:it.kind==='cake'?(payload.items.find(x=>x.kind==='cake')?.sel||null):null}));
      await assertOk(sb.from('order_items').insert(rows));
      for(const it of r.items) if(it.kind==='product'){const p=ps.find(x=>x.id===it.productId); const ns=Math.max(0,p.stock-it.qty); await assertOk(sb.rpc('decrement_product_stock',{p_product_id:p.id,p_qty:it.qty}));}
      notify(); return await getOrder(order.id);
    },
    async setStatus(id,status){ const o=await getOrder(id); if(!o||o.status===status)return o; if(status==='cancelado'&&o.status!=='cancelado'){for(const it of o.items)if(it.kind==='product'){const p=await products.get(it.productId);if(p)await products.save({id:p.id,stock:p.stock+it.qty});}} else if(o.status==='cancelado'&&status!=='cancelado'){for(const it of o.items)if(it.kind==='product'){const p=await products.get(it.productId);if(p)await products.save({id:p.id,stock:Math.max(0,p.stock-it.qty)});}} const h=[...(o.history||[]),{status,at:Date.now()}]; await assertOk(sb.from('orders').update({status,history:h,updated_at:new Date().toISOString()}).eq('id',id)); notify(); return getOrder(id); },
    async remove(id){ await assertOk(sb.from('orders').delete().eq('id',id)); notify(); }
  };

  const auth = {
    async login(email,password){ const e=String(email||'').trim().toLowerCase(); if(e!=='dloladoceria@gmail.com') throw new Error('E-mail não autorizado.'); const {data,error}=await sb.auth.signInWithPassword({email:e,password:String(password||'')}); if(error)throw new Error(error.message); cachedSession=data.session; await seedDatabase(); return data.session; },
    async logout(){ await sb.auth.signOut(); cachedSession=null; },
    async current(){ if(cachedSession)return cachedSession; const {data}=await sb.auth.getSession(); cachedSession=data.session; return cachedSession; }
  };

  const data = {
    async export(){ const [settings,categories,products,cakes,orders]=await Promise.all([settings.get(),categories.list(),products.list(),cakes.get(),orders.list()]); return JSON.stringify({settings,categories,products,cakes,orders,counters:{order:Math.max(1000,...orders.map(o=>o.number||0))}},null,2); },
    async import(text){ let s;try{s=JSON.parse(text)}catch(_){throw new Error('Arquivo inválido: não é um JSON.');} if(!s||!Array.isArray(s.products)||!Array.isArray(s.categories)||!s.cakes||!s.settings)throw new Error('Arquivo inválido: faltam dados da doceria.'); for(const c of s.categories)await categories.save(c);for(const p of s.products)await products.save(p);await cakes.saveConfig(s.cakes);for(const g of ['types','sizes','doughs','fillings','toppings','extras','occasions'])for(const it of (s.cakes[g]||[]))await cakes.saveItem(g,it);await settings.save(s.settings);notify(); },
    async reset(){ if(!(await adminUser()))throw new Error('Apenas o administrador pode restaurar os dados.'); await assertOk(sb.from('order_items').delete().neq('id','')); await assertOk(sb.from('orders').delete().neq('id','')); await assertOk(sb.from('products').delete().neq('id','')); await assertOk(sb.from('categories').delete().neq('id','')); await assertOk(sb.from('cake_options').delete().neq('id','')); await assertOk(sb.from('cake_config').delete().neq('id',0)); await assertOk(sb.from('settings').delete().neq('id',0)); await seedDatabase(); notify(); }
  };

  function onChange(cb){ listeners.push(cb); return () => { const i=listeners.indexOf(cb); if(i>=0)listeners.splice(i,1); }; }
  w.DB={STATUSES,util,cakePrice,feeFor,products,categories,cakes,settings,orders,auth,data,onChange};
  sb.auth.onAuthStateChange((_event,session)=>{cachedSession=session;});
})(window);
