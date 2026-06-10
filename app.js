/* YR Finanças - controle de faturas com sincronização opcional em nuvem.
   O sistema usa Supabase para login e banco online. O LocalStorage continua
   como cache/backup local para melhorar a experiência e facilitar migração. */
(() => {
  const STORAGE_KEY = 'fincard-pro-data-v1';
  const SUPABASE_URL = 'https://xmhypvgggtelgwcbklen.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable__dpSFfjN3AoKThHeE4Xf3A_uUz-ywx5';
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const menu = [
    ['dashboard', '📊', 'Dashboard'], ['newPurchase', '➕', 'Nova compra'], ['purchases', '🧾', 'Compras'],
    ['installments', '📆', 'Parcelas'], ['invoiceCheck', '✅', 'Conferir fatura'], ['cards', '💳', 'Formas de pagamento'], ['people', '👥', 'Pessoas'],
    ['payments', '💸', 'Recebimentos'], ['merchants', '🏪', 'Estabelecimentos'], ['categories', '🏷️', 'Categorias'], ['settings', '⚙️', 'Configurações']
  ];

  const state = {
    currentPage: 'dashboard',
    charts: {},
    filters: {
      dashboard: { month: currentMonth, year: currentYear, cardId: 'all' },
      purchases: { month: 'all', year: String(currentYear), cardId: 'all', personId: 'all', categoryId: 'all', q: '' },
      installments: { month: String(currentMonth), year: String(currentYear), cardId: 'all', personId: 'all', status: 'all' },
      invoiceCheck: { month: currentMonth, year: currentYear, cardId: 'all', bankTotal: '' },
      people: { month: currentMonth, year: currentYear }
    },
    data: null,
    supabase: null,
    user: null,
    cloudRecordId: null,
    syncTimer: null,
    isCloudReady: false
  };

  const $ = (selector) => document.querySelector(selector);

  function applyTouchLayoutClass() {
    const isTouch = (navigator.maxTouchPoints || 0) > 0 || window.matchMedia('(any-pointer: coarse)').matches;
    document.documentElement.classList.toggle('touch-layout', isTouch);
    if (document.body) document.body.classList.toggle('touch-layout', isTouch);
  }
  applyTouchLayoutClass();
  window.addEventListener('resize', applyTouchLayoutClass);

  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const money = (value) => Number(value || 0);
  const formatCurrency = (value) => money(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (date) => date ? new Date(date + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
  const monthName = (m) => new Date(2026, Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'long' });
  const escapeHTML = (str = '') => String(str).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));

  function defaultData() {
    const cards = [
      { id: uid('card'), name: 'Nubank', bank: 'Nubank', nickname: 'Nubank', last4: '', brand: 'Mastercard', type: 'Crédito', closeDay: 3, dueDay: 10, bestDay: 4, limit: 4500, color: '#7C3AED', status: 'Ativo', notes: 'Cartão principal' },
      { id: uid('card'), name: 'PicPay Card', bank: 'PicPay', nickname: 'PicPay', last4: '', brand: 'Mastercard', type: 'Crédito', closeDay: 8, dueDay: 15, bestDay: 9, limit: 3000, color: '#22C55E', status: 'Ativo', notes: '' },
      { id: uid('card'), name: 'Mercado Livre', bank: 'Mercado Pago', nickname: 'Mercado Livre', last4: '', brand: 'Visa', type: 'Crédito', closeDay: 12, dueDay: 20, bestDay: 13, limit: 2500, color: '#FACC15', status: 'Ativo', notes: '' }
    ];
    const defaultCategories = [
      'Alimentação', 'Mercado', 'Restaurante / Lanche', 'Transporte', 'Combustível',
      'Igreja', 'Dízimos / Ofertas', 'Estudos', 'Faculdade', 'Cursos',
      'Casa', 'Contas da casa', 'Compras', 'Roupas', 'Saúde',
      'Farmácia', 'Lazer', 'Assinaturas', 'Viagem', 'Presente',
      'Beleza / Cuidados', 'Pets', 'Serviços', 'Impostos / Taxas',
      'Emergência', 'Outros'
    ];
    const categories = defaultCategories.map((name, i) => ({ id: uid('cat'), name, color: '#6366F1' }));
    const people = ['Ana','Lucas','Pedro'].map(name => ({ id: uid('person'), name, phone: '', notes: '' }));
    const merchants = [
      { id: uid('merchant'), realName: 'Edu Pizzas', invoiceName: 'Lojas e Produtos da Terra', categoryId: categories[0].id, notes: 'Nome da maquininha diferente' },
      { id: uid('merchant'), realName: 'Universidade / Material', invoiceName: 'Papelaria Recife', categoryId: categories[4].id, notes: '' }
    ];
    const data = { cards, people, categories, merchants, purchases: [], installments: [], payments: [], settings: { theme: 'dark', seeded: true } };
    state.data = data;
    savePurchase({ date: `${currentYear}-${String(currentMonth).padStart(2,'0')}-05`, description: 'Mercado do mês', merchantReal: 'Atacadão', invoiceName: 'ATACADAO RECIFE', total: 420, installmentsCount: 1, cardId: cards[0].id, categoryId: categories[0].id, type: 'Minha', personId: '', myShare: 420, otherShare: 0, notes: 'Compra exemplo', status: 'Pendente' }, false);
    savePurchase({ date: `${currentYear}-${String(currentMonth).padStart(2,'0')}-09`, description: 'Pizza do grupo', merchantReal: 'Edu Pizzas', invoiceName: 'Lojas e Produtos da Terra', total: 120, installmentsCount: 1, cardId: cards[0].id, categoryId: categories[0].id, type: 'Dividida', personId: people[0].id, myShare: 40, otherShare: 80, notes: '', status: 'Pendente' }, false);
    savePurchase({ date: `${currentYear}-01-12`, description: 'Notebook faculdade', merchantReal: 'Magazine Luiza', invoiceName: 'MAGAZINE LUIZA', total: 2400, installmentsCount: 12, cardId: cards[1].id, categoryId: categories[4].id, type: 'Minha', personId: '', myShare: 2400, otherShare: 0, notes: 'Parcelado', status: 'Pendente' }, false);
    state.data.payments.push({ id: uid('pay'), date: `${currentYear}-${String(currentMonth).padStart(2,'0')}-15`, personId: people[0].id, amount: 30, method: 'Pix', relatedId: '', month: currentMonth, year: currentYear, notes: 'Pagamento parcial exemplo' });
    return state.data;
  }

  function applyTheme() {
    document.documentElement.classList.toggle('light', state.data?.settings?.theme === 'light');
  }

  function ensureDefaultCategories() {
    if (!state.data) return;
    if (!Array.isArray(state.data.categories)) state.data.categories = [];
    const required = [
      'Alimentação', 'Mercado', 'Restaurante / Lanche', 'Transporte', 'Combustível',
      'Igreja', 'Dízimos / Ofertas', 'Estudos', 'Faculdade', 'Cursos',
      'Casa', 'Contas da casa', 'Compras', 'Roupas', 'Saúde',
      'Farmácia', 'Lazer', 'Assinaturas', 'Viagem', 'Presente',
      'Beleza / Cuidados', 'Pets', 'Serviços', 'Impostos / Taxas',
      'Emergência', 'Outros'
    ];
    const existing = new Set(state.data.categories.map(c => String(c.name || '').trim().toLowerCase()));
    required.forEach(name => {
      if (!existing.has(name.toLowerCase())) {
        state.data.categories.push({ id: uid('cat'), name, color: '#6366F1' });
      }
    });
  }

  function paymentNeedsCard(method) {
    return ['Cartão de crédito', 'Cartão de débito'].includes(method);
  }

  function paymentAllowsInstallments(method) {
    return ['Cartão de crédito', 'Crediário'].includes(method);
  }

  function paymentName(item) {
    const method = item?.paymentMethod || (item?.cardId ? 'Cartão de crédito' : 'Não informado');
    if (item?.cardId) return `${method} • ${cardName(item.cardId)}`;
    return method;
  }

  function institutionPreset(card = {}) {
    const text = `${card.name || ''} ${card.bank || ''} ${card.nickname || ''}`.toLowerCase();

    const presets = [
      {
        match: ['nubank', 'nu bank', 'roxinho', 'nu '],
        key: 'nubank',
        label: 'Nu',
        color: '#7C3AED',
        color2: '#A855F7',
        textColor: '#FFFFFF'
      },
      {
        match: ['picpay', 'pic pay'],
        key: 'picpay',
        label: 'P',
        color: '#22C55E',
        color2: '#16A34A',
        textColor: '#FFFFFF'
      },
      {
        match: ['mercado livre', 'mercado pago', 'mercadopago', 'meli'],
        key: 'mercado',
        label: 'ML',
        color: '#FACC15',
        color2: '#2563EB',
        textColor: '#0F172A'
      },
      {
        match: ['inter', 'banco inter'],
        key: 'inter',
        label: 'Inter',
        color: '#F97316',
        color2: '#FB923C',
        textColor: '#FFFFFF'
      },
      {
        match: ['caixa'],
        key: 'caixa',
        label: 'CX',
        color: '#2563EB',
        color2: '#F59E0B',
        textColor: '#FFFFFF'
      },
      {
        match: ['santander'],
        key: 'santander',
        label: 'S',
        color: '#EF4444',
        color2: '#B91C1C',
        textColor: '#FFFFFF'
      },
      {
        match: ['bradesco'],
        key: 'bradesco',
        label: 'B',
        color: '#DC2626',
        color2: '#991B1B',
        textColor: '#FFFFFF'
      },
      {
        match: ['itaú', 'itau'],
        key: 'itau',
        label: 'Itaú',
        color: '#F97316',
        color2: '#1D4ED8',
        textColor: '#FFFFFF'
      },
      {
        match: ['bb', 'banco do brasil'],
        key: 'bb',
        label: 'BB',
        color: '#FACC15',
        color2: '#1D4ED8',
        textColor: '#0F172A'
      }
    ];

    return presets.find(p => p.match.some(term => text.includes(term))) || {
      key: 'default',
      label: (card.nickname || card.name || card.bank || 'YR').slice(0, 2).toUpperCase(),
      color: card.color || '#6366F1',
      color2: '#06B6D4',
      textColor: '#FFFFFF'
    };
  }

  function institutionBadge(card = {}, size = 'md') {
    const preset = institutionPreset(card);
    return `<span class="institution-badge ${size}" style="--inst-color:${preset.color};--inst-color-2:${preset.color2};--inst-text:${preset.textColor};">${escapeHTML(preset.label)}</span>`;
  }

  function applyInstitutionColor(card = {}) {
    const preset = institutionPreset(card);
    if (preset.key !== 'default') card.color = preset.color;
    return card;
  }


  function paymentFilterOptions(includeAll = false) {
    const methods = ['Pix', 'Dinheiro', 'Boleto', 'Crediário', 'Transferência', 'Outro'];
    const cards = state.data.cards.map(c => `<option value="card:${c.id}">${escapeHTML(c.nickname || c.name)} ${c.last4 ? '••' + c.last4 : ''}</option>`).join('');
    const methodOptions = methods.map(m => `<option value="method:${m}">${m}</option>`).join('');
    return `${includeAll ? '<option value="all">Todas as formas</option>' : ''}${cards}${methodOptions}`;
  }

  function matchesPaymentFilter(item, filter) {
    if (!filter || filter === 'all') return true;
    if (filter.startsWith('card:')) return item.cardId === filter.slice(5);
    if (filter.startsWith('method:')) return (item.paymentMethod || 'Cartão de crédito') === filter.slice(7);
    return item.cardId === filter; // compatibilidade com backups antigos
  }

  function setupSupabase() {
    if (!window.supabase) return null;
    state.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    state.isCloudReady = true;
    return state.supabase;
  }

  function loadLocalDataOrDefault() {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.data = raw ? JSON.parse(raw) : defaultData();
    ensureDataShape();
    applyTheme();
    return { data: state.data, hadLocalData: Boolean(raw) };
  }

  async function loadFromCloud() {
    if (!state.supabase || !state.user) {
      loadLocalDataOrDefault();
      return;
    }

    const { data: record, error } = await state.supabase
      .from('finance_data')
      .select('id,data,updated_at')
      .eq('user_id', state.user.id)
      .maybeSingle();

    if (error) {
      console.error(error);
      loadLocalDataOrDefault();
      toast('Não consegui carregar a nuvem. Usei o backup local deste navegador.', 'error');
      return;
    }

    if (record?.data) {
      state.cloudRecordId = record.id;
      state.data = record.data;
      ensureDataShape();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
      applyTheme();
      return;
    }

    // Primeiro login: migra os dados locais deste navegador para a nuvem.
    loadLocalDataOrDefault();
    await saveToSupabase(false, true);
  }

  function saveToStorage(show = true) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
    if (state.user) scheduleCloudSync(show);
    if (show) toast('Dados salvos com sucesso.', 'success');
  }

  function scheduleCloudSync(show = false) {
    clearTimeout(state.syncTimer);
    state.syncTimer = setTimeout(() => saveToSupabase(show), 700);
  }

  async function saveToSupabase(show = false, immediate = false) {
    if (!state.supabase || !state.user || !state.data) return;
    const payload = {
      user_id: state.user.id,
      data: state.data,
      updated_at: new Date().toISOString()
    };

    let result;
    if (state.cloudRecordId) {
      result = await state.supabase
        .from('finance_data')
        .update(payload)
        .eq('id', state.cloudRecordId)
        .select('id')
        .single();
    } else {
      result = await state.supabase
        .from('finance_data')
        .insert(payload)
        .select('id')
        .single();
    }

    if (result.error) {
      console.error(result.error);
      toast('Não consegui sincronizar com a nuvem. O backup local foi mantido.', 'error');
      return;
    }
    state.cloudRecordId = result.data.id;
    updateAccountPill();
    if (show || immediate) toast('Sincronizado com a nuvem.', 'success');
  }

  function getActiveCards() { return state.data.cards.filter(card => card.status === 'Ativo'); }
  function getById(list, id) { return list.find(item => item.id === id); }
  function cardName(id) { const c = getById(state.data.cards, id); return c ? c.nickname || c.name : '-'; }
  function categoryName(id) { const c = getById(state.data.categories, id); return c ? c.name : '-'; }
  function personName(id) { const p = getById(state.data.people, id); return p ? p.name : '-'; }

  function addMonths(dateText, offset) {
    const [y, m, d] = dateText.split('-').map(Number);
    return new Date(y, m - 1 + offset, d || 1, 12, 0, 0);
  }

  function invoiceReferenceDate(purchase, installmentIndex = 0) {
    const base = new Date(`${purchase.date}T12:00:00`);
    const card = purchase.cardId ? getById(state.data.cards, purchase.cardId) : null;
    const isCredit = (purchase.paymentMethod || 'Cartão de crédito') === 'Cartão de crédito';

    // Regra prática: se comprou depois do fechamento, entra na próxima fatura.
    // Ex: fecha dia 3, compra dia 4 -> fatura do mês seguinte.
    const firstOffset = isCredit && card?.closeDay && base.getDate() > Number(card.closeDay) ? 1 : 0;
    return addMonths(purchase.date, installmentIndex + firstOffset);
  }

  function rebuildAllInstallments(persist = false) {
    if (!state.data?.purchases) return;
    const previous = new Map((state.data.installments || []).map(i => [`${i.purchaseId}-${i.number}`, i]));
    const rebuilt = [];
    state.data.purchases.forEach(purchase => {
      generateInstallments(purchase).forEach(inst => {
        const old = previous.get(`${inst.purchaseId}-${inst.number}`);
        if (old) {
          inst.status = old.status || inst.status;
          inst.invoiceChecked = Boolean(old.invoiceChecked);
        }
        rebuilt.push(inst);
      });
    });
    state.data.installments = rebuilt;
    if (persist) saveToStorage(false);
  }

  function ensureDataShape() {
    if (!state.data) return;
    ['cards','people','categories','merchants','purchases','installments','payments'].forEach(key => { if (!Array.isArray(state.data[key])) state.data[key] = []; });
    if (!state.data.settings) state.data.settings = { theme: 'dark' };
    ensureDefaultCategories();
    const needsRebuild = state.data.purchases.length && (!state.data.installments.length || state.data.installments.some(i => typeof i.invoiceChecked === 'undefined'));
    if (needsRebuild) rebuildAllInstallments(false);
    state.data.installments.forEach(i => { if (typeof i.invoiceChecked === 'undefined') i.invoiceChecked = false; });
  }

  function generateInstallments(purchase) {
    const count = Math.max(1, Number(purchase.installmentsCount || 1));
    const base = Math.floor((money(purchase.total) / count) * 100) / 100;
    let values = Array.from({ length: count }, () => base);
    values[count - 1] = +(money(purchase.total) - base * (count - 1)).toFixed(2);

    const myRatio = money(purchase.total) ? money(purchase.myShare) / money(purchase.total) : 0;
    const otherRatio = money(purchase.total) ? money(purchase.otherShare) / money(purchase.total) : 0;

    return values.map((value, index) => {
      const ref = invoiceReferenceDate(purchase, index);
      return {
        id: uid('inst'), purchaseId: purchase.id, purchaseDate: purchase.date,
        month: ref.getMonth() + 1, year: ref.getFullYear(), description: purchase.description,
        merchantReal: purchase.merchantReal, invoiceName: purchase.invoiceName, number: index + 1,
        totalInstallments: count, label: `${index + 1}/${count}`, amount: value, paymentMethod: purchase.paymentMethod || 'Cartão de crédito', cardId: purchase.cardId || '',
        categoryId: purchase.categoryId, type: purchase.type, personId: purchase.personId, status: purchase.status,
        myAmount: +(value * myRatio).toFixed(2), otherAmount: +(value * otherRatio).toFixed(2),
        invoiceChecked: Boolean(purchase.invoiceChecked)
      };
    });
  }

  function savePurchase(payload, persist = true) {
    const total = money(payload.total);
    const paymentMethod = payload.paymentMethod || 'Cartão de crédito';
    const canInstall = paymentAllowsInstallments(paymentMethod);
    const needsCard = paymentNeedsCard(paymentMethod);
    const count = canInstall ? Math.max(1, Number(payload.installmentsCount || 1)) : 1;
    const type = payload.type;
    let myShare = money(payload.myShare);
    let otherShare = money(payload.otherShare);

    if (!canInstall) payload.installmentsCount = 1;
    if (!needsCard) payload.cardId = '';

    if (type === 'Minha') { myShare = total; otherShare = 0; payload.personId = ''; }
    if (type === 'De outra pessoa') { myShare = 0; otherShare = total; }
    if (type === 'Dividida' && Math.abs((myShare + otherShare) - total) > 0.01) throw new Error('Na compra dividida, sua parte + parte da outra pessoa deve ser igual ao total.');

    const purchase = {
      id: payload.id || uid('purchase'),
      date: payload.date,
      description: payload.description.trim(),
      merchantReal: payload.merchantReal.trim(),
      invoiceName: payload.invoiceName.trim(),
      total,
      paymentMethod,
      installmentsCount: count,
      installmentValue: +(total / count).toFixed(2),
      cardId: payload.cardId || '',
      categoryId: payload.categoryId,
      type,
      personId: payload.personId || '',
      myShare,
      otherShare,
      notes: payload.notes || '',
      status: payload.status || 'Pendente',
      createdAt: new Date().toISOString()
    };

    state.data.purchases = state.data.purchases.filter(p => p.id !== purchase.id);
    state.data.installments = state.data.installments.filter(i => i.purchaseId !== purchase.id);
    state.data.purchases.push(purchase);
    state.data.installments.push(...generateInstallments(purchase));
    if (persist) { saveToStorage(); renderAll(); }
    return purchase;
  }

  function deletePurchase(id) {
    if (!confirm('Excluir esta compra e todas as parcelas geradas?')) return;
    state.data.purchases = state.data.purchases.filter(p => p.id !== id);
    state.data.installments = state.data.installments.filter(i => i.purchaseId !== id);
    saveToStorage(); renderAll();
  }

  function filterByMonthYear(items, month, year) {
    return items.filter(item => (String(month) === 'all' || Number(item.month) === Number(month)) && (String(year) === 'all' || Number(item.year) === Number(year)));
  }

  function paymentsFor(personId, month = 'all', year = 'all') {
    return state.data.payments.filter(p => (!personId || p.personId === personId) && (String(month) === 'all' || Number(p.month) === Number(month)) && (String(year) === 'all' || Number(p.year) === Number(year)));
  }

  function getPersonDebt(personId, month = 'all', year = 'all') {
    const installments = filterByMonthYear(state.data.installments, month, year).filter(i => i.personId === personId);
    const total = installments.reduce((sum, i) => sum + money(i.otherAmount), 0);
    const paid = paymentsFor(personId, month, year).reduce((sum, p) => sum + money(p.amount), 0);
    const pending = Math.max(0, total - paid);
    const openAll = Math.max(0, state.data.installments.filter(i => i.personId === personId).reduce((s, i) => s + money(i.otherAmount), 0) - paymentsFor(personId).reduce((s, p) => s + money(p.amount), 0));
    return { total, paid, pending, openAll, countOpen: installments.filter(i => i.otherAmount > 0).length, status: pending <= 0 ? 'OK' : paid > 0 ? 'Parcial' : 'Pendente' };
  }

  function calculateDashboardTotals() {
    const { month, year, cardId } = state.filters.dashboard;
    let installments = filterByMonthYear(state.data.installments, month, year);
    if (cardId !== 'all') installments = installments.filter(i => matchesPaymentFilter(i, cardId));
    const totalInvoice = installments.reduce((s, i) => s + money(i.amount), 0);
    const mine = installments.reduce((s, i) => s + money(i.myAmount), 0);
    const others = installments.reduce((s, i) => s + money(i.otherAmount), 0);
    const peopleIds = [...new Set(installments.map(i => i.personId).filter(Boolean))];
    const received = peopleIds.reduce((s, id) => s + paymentsFor(id, month, year).reduce((p, pay) => p + money(pay.amount), 0), 0);
    return { installments, totalInvoice, mine, others, received, pending: Math.max(0, others - received), purchaseCount: new Set(installments.map(i => i.purchaseId)).size, activeInstallments: installments.length, activeCards: getActiveCards().length };
  }

  function renderNav() {
    const make = (items) => items.map(([id, icon, label]) => `<button class="nav-btn ${state.currentPage === id ? 'active' : ''}" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');
    $('#desktopNav').innerHTML = make(menu);
    $('#drawerNav').innerHTML = make(menu);
    $('#mobileNav').innerHTML = make(menu);
    $$('.nav-btn').forEach(btn => btn.onclick = () => showPage(btn.dataset.page));
  }

  function showPage(page) {
    state.currentPage = page;
    $$('.page').forEach(p => p.classList.remove('active'));
    $(`#${page}Page`).classList.add('active');
    $('#pageTitle').textContent = menu.find(m => m[0] === page)?.[2] || 'YR Finanças';
    $('#mobileDrawer').classList.remove('show');
    document.body.classList.remove('sidebar-open');
    renderNav();
    renderAll(false);
  }

  function fillMonthYear(selectMonth, selectYear, selectedMonth, selectedYear, allowAll = false) {
    const monthOptions = allowAll ? '<option value="all">Todos</option>' : '';
    selectMonth.innerHTML = monthOptions + Array.from({ length: 12 }, (_, i) => `<option value="${i+1}">${monthName(i+1)}</option>`).join('');
    selectYear.innerHTML = Array.from({ length: 7 }, (_, i) => currentYear - 2 + i).map(y => `<option value="${y}">${y}</option>`).join('');
    selectMonth.value = selectedMonth; selectYear.value = selectedYear;
  }

  function cardOptions(activeOnly = false, includeAll = false) {
    return paymentFilterOptions(includeAll);
  }

  function cardSelectOptions(activeOnly = false) {
    const cards = activeOnly ? getActiveCards() : state.data.cards;
    return cards.map(c => `<option value="${c.id}">${escapeHTML(c.nickname || c.name)} ${c.last4 ? '••' + c.last4 : ''}</option>`).join('');
  }
  const categoryOptions = () => state.data.categories.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
  const peopleOptions = (includeEmpty = false, includeAll = false) => `${includeAll ? '<option value="all">Todas as pessoas</option>' : ''}${includeEmpty ? '<option value="">Nenhuma</option>' : ''}${state.data.people.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}`;

  function renderDashboard() {
    fillMonthYear($('#dashboardMonth'), $('#dashboardYear'), state.filters.dashboard.month, state.filters.dashboard.year);
    $('#dashboardCard').innerHTML = cardOptions(false, true); $('#dashboardCard').value = state.filters.dashboard.cardId;
    const t = calculateDashboardTotals();
    const riskIfUnpaid = t.mine + t.pending;
    const metrics = [
      ['Fatura total', t.totalInvoice, 'Tudo que vai aparecer no banco', 'rgba(99,102,241,.75)'], ['Meu custo real', t.mine, 'O que é seu de verdade', 'rgba(34,197,94,.75)'],
      ['A receber', t.others, 'Parte de outras pessoas', 'rgba(245,158,11,.75)'], ['Já recebido', t.received, 'Pagamentos registrados', 'rgba(6,182,212,.75)'],
      ['Risco se ninguém pagar', riskIfUnpaid, 'Seu custo + pendências abertas', 'rgba(239,68,68,.75)'], ['Compras no mês', t.purchaseCount, 'Compras com parcela neste mês', 'rgba(99,102,241,.75)', false],
      ['Parcelas ativas', t.activeInstallments, 'Parcelas na fatura filtrada', 'rgba(6,182,212,.75)', false], ['Formas ativas', t.activeCards, 'Formas de pagamento disponíveis', 'rgba(34,197,94,.75)', false]
    ];
    $('#dashboardMetrics').innerHTML = metrics.map(m => `<div class="metric-card" style="--accent:${m[3]}"><span>${m[0]}</span><strong>${m[4] === false ? m[1] : formatCurrency(m[1])}</strong><small>${m[2]}</small></div>`).join('');
    renderFinancialOverview(t); renderRankings(t.installments); updateCharts(t);
  }


  function renderFinancialOverview(t) {
    try {
      const hour = new Date().getHours();
      const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
      const greeting = $('#overviewGreeting');
      if (greeting) greeting.textContent = `${greet}, Yuan! 👋`;

      const selectedMonth = Number(state.filters.dashboard.month);
      const selectedYear = Number(state.filters.dashboard.year);

      const income = (state.data.payments || [])
        .filter(p => Number(p.month) === selectedMonth && Number(p.year) === selectedYear)
        .reduce((sum, p) => sum + money(p.amount), 0);

      const expense = money(t?.totalInvoice || 0);
      const balance = income - expense;

      const totals = $('#overviewTotals');
      if (totals) {
        totals.innerHTML = `
          <div><span>Receita mensal</span><strong class="positive">${formatCurrency(income)}</strong><small>Entradas no mês</small></div>
          <div><span>Despesa mensal</span><strong class="danger-text">${formatCurrency(expense)}</strong><small>Saídas no mês</small></div>
          <div><span>Saldo geral</span><strong>${formatCurrency(balance)}</strong><small>Saldo estimado</small></div>
        `;
      }

      const cards = Array.isArray(state.data.cards) ? state.data.cards : [];
      const firstCard = cards[0];
      const secondCard = cards[1];
      const totalInvoice = expense;
      const myExpense = money(t?.mine || 0);
      const othersPending = money(t?.pending || 0);

      const accountData = [
        ['Fatura total', 'O valor que aparece no banco', -totalInvoice, '💳', '#6366F1'],
        ['Meu custo real', 'O que realmente sai do seu bolso', -myExpense, '👤', '#EF4444'],
        ['A receber', 'O que outras pessoas devem', othersPending, '🤝', '#F59E0B'],
        ['Risco se ninguém pagar', 'Seu custo + pendências', -(myExpense + othersPending), '⚠️', '#DC2626']
      ];

      const accounts = $('#overviewAccounts');
      if (accounts) {
        accounts.innerHTML = accountData.map(([name, subtitle, amount, icon, color]) => `
          <div class="overview-row">
            <div class="overview-row-left">
              <span class="overview-icon" style="--icon-bg:${color}">${icon}</span>
              <div><strong>${escapeHTML(name)}</strong><span>${escapeHTML(subtitle)}</span></div>
            </div>
            <div class="overview-row-value ${amount < 0 ? 'danger-text' : ''}">
              <strong>${formatCurrency(amount)}</strong>
              <small>${amount < 0 ? 'em fatura' : 'em conta'}</small>
            </div>
          </div>
        `).join('');
      }

      const chips = $('#overviewAccountChips');
      if (chips) {
        chips.innerHTML = accountData.slice(0, 4).map(([name, subtitle, amount, icon, color]) => `
          <div class="account-chip">
            <span class="overview-icon" style="--icon-bg:${color}">${icon}</span>
            <strong>${escapeHTML(name)}</strong>
            <small>${formatCurrency(amount)}</small>
          </div>
        `).join('');
      }

      const cardsBox = $('#overviewCards');
      if (cardsBox) {
        if (!cards.length) {
          cardsBox.innerHTML = `
            <div class="empty-state compact-empty">
              <strong>Nenhum cartão cadastrado</strong>
              <span>Cadastre seus cartões, como Nubank, PicPay e Mercado Livre, para acompanhar quanto pagará em cada um.</span>
            </div>
          `;
        } else {
          cardsBox.innerHTML = cards.slice(0, 4).map(card => {
            const invoice = (t?.installments || []).filter(i => i.cardId === card.id).reduce((s, i) => s + money(i.amount), 0);
            const limit = money(card.limit);
            const available = limit ? Math.max(0, limit - invoice) : 0;
            const closeText = card.closeDay ? `Fecha dia ${card.closeDay}` : 'Fatura manual';
            return `
              <div class="overview-card-item">
                <div class="mini-card-preview" style="--card-color:${institutionPreset(card).color};--card-color-2:${institutionPreset(card).color2}">
                  ${institutionBadge(card, 'lg')}
                </div>
                <div class="overview-card-info">
                  <strong>${escapeHTML(card.nickname || card.name)}</strong>
                  <span>${escapeHTML(card.type || 'Crédito')}</span>
                  <div class="overview-card-metrics">
                    <small>Valor a pagar<br><b class="${invoice > 0 ? 'danger-text' : ''}">${formatCurrency(invoice)}</b></small>
                    <small>Limite disponível<br><b>${limit ? formatCurrency(available) : 'Sem limite'}</b></small>
                  </div>
                </div>
                <div class="overview-card-actions">
                  <span class="mini-due-pill">${escapeHTML(closeText)}</span>
                  <button class="secondary-button tiny-button" type="button" onclick="FinCard.showCardInvoice('${card.id}')">Ver fatura</button>
                </div>
              </div>
            `;
          }).join('');
        }
      }
    } catch (error) {
      console.error('Erro ao renderizar visão geral financeira:', error);
    }
  }

  function renderRankings(installments) {
    const people = state.data.people.map(p => ({ ...p, debt: getPersonDebt(p.id, state.filters.dashboard.month, state.filters.dashboard.year).pending })).filter(p => p.debt > 0).sort((a,b)=>b.debt-a.debt);
    $('#peopleRanking').innerHTML = people.length ? people.slice(0,5).map(p => `<div class="stack-item"><div><strong>${escapeHTML(p.name)}</strong><span>Pendente no mês</span></div><b>${formatCurrency(p.debt)}</b></div>`).join('') : emptyHTML();
    const cards = state.data.cards.map(c => ({ ...c, total: installments.filter(i => i.cardId === c.id).reduce((s,i)=>s+money(i.amount),0) })).filter(c => c.total > 0).sort((a,b)=>b.total-a.total);
    $('#cardRanking').innerHTML = cards.length ? cards.slice(0,5).map(c => `<div class="stack-item"><div><strong>${escapeHTML(c.nickname || c.name)}</strong><span>${escapeHTML(c.bank || '')}</span></div><b>${formatCurrency(c.total)}</b></div>`).join('') : emptyHTML();
    const next = state.data.installments.filter(i => i.year > currentYear || (i.year === currentYear && i.month >= currentMonth)).sort((a,b)=>a.year-b.year || a.month-b.month).slice(0,6);
    $('#nextInstallments').innerHTML = next.length ? next.map(i => `<div class="stack-item"><div><strong>${escapeHTML(i.description)} <span>${i.label}</span></strong><span>${monthName(i.month)}/${i.year} • ${cardName(i.cardId)}</span></div><b>${formatCurrency(i.amount)}</b></div>`).join('') : emptyHTML();
    $('#cardSummary').innerHTML = cards.length ? cards.map(c => `<div class="stack-item"><div><strong>${escapeHTML(c.nickname || c.name)}</strong><span>${escapeHTML(c.brand)} • ${c.status}</span></div><span class="badge ${c.status === 'Ativo' ? 'ok' : 'danger'}">${formatCurrency(c.total)}</span></div>`).join('') : emptyHTML();
  }

  function chart(id, type, labels, data, label) {
    const ctx = document.getElementById(id);
    if (state.charts[id]) state.charts[id].destroy();
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();
    state.charts[id] = new Chart(ctx, { type, data: { labels, datasets: [{ label, data, borderWidth: 2, tension: .35, fill: type === 'line', backgroundColor: ['#6366F1','#06B6D4','#22C55E','#F59E0B','#EF4444','#8B5CF6','#14B8A6','#F97316'], borderColor: '#6366F1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: textColor } } }, scales: type === 'doughnut' || type === 'pie' ? {} : { x: { ticks: { color: textColor }, grid: { color: 'rgba(148,163,184,.12)' } }, y: { ticks: { color: textColor }, grid: { color: 'rgba(148,163,184,.12)' } } } } });
  }

  function groupSum(items, keyFn, valueFn) {
    return items.reduce((acc, item) => { const k = keyFn(item); acc[k] = (acc[k] || 0) + valueFn(item); return acc; }, {});
  }

  function updateCharts(t) {
    const lastMonths = Array.from({ length: 6 }, (_, idx) => addMonths(`${state.filters.dashboard.year}-${String(state.filters.dashboard.month).padStart(2,'0')}-01`, idx - 5));
    const evoLabels = lastMonths.map(d => `${monthName(d.getMonth()+1).slice(0,3)}/${String(d.getFullYear()).slice(2)}`);
    const evoData = lastMonths.map(d => state.data.installments.filter(i => i.month === d.getMonth()+1 && i.year === d.getFullYear()).reduce((s,i)=>s+money(i.amount),0));
    chart('invoiceEvolutionChart', 'line', evoLabels, evoData, 'Fatura');
    const byCat = groupSum(t.installments, i => categoryName(i.categoryId), i => money(i.amount));
    chart('categoryChart', 'doughnut', Object.keys(byCat), Object.values(byCat), 'Categorias');
    const byCard = groupSum(t.installments, i => paymentName(i), i => money(i.amount));
    chart('cardChart', 'bar', Object.keys(byCard), Object.values(byCard), 'Formas');
    const byPeople = state.data.people.map(p => [p.name, getPersonDebt(p.id, state.filters.dashboard.month, state.filters.dashboard.year).pending]).filter(x=>x[1]>0);
    chart('peopleDebtChart', 'bar', byPeople.map(x=>x[0]), byPeople.map(x=>x[1]), 'Pendências');
    chart('ownerCompareChart', 'pie', ['Minhas compras', 'Compras de terceiros'], [t.mine, t.others], 'Comparação');
    chart('receivedPendingChart', 'doughnut', ['Recebido', 'Pendente'], [t.received, t.pending], 'Recebimentos');
  }

  function renderQuickPurchaseForm() {
    const box = $('#quickPurchaseForm');
    if (!box) return;
    const paymentMethods = ['Cartão de crédito', 'Cartão de débito', 'Pix', 'Dinheiro', 'Boleto', 'Crediário', 'Transferência', 'Outro'];
    box.innerHTML = `
      <label class="field">Data<input name="date" type="date" value="${new Date().toISOString().slice(0,10)}" required></label>
      <label class="field">Nome na fatura<input name="invoiceName" list="quickInvoiceList" placeholder="Ex: LOJAS E PRODUTOS DA TERRA" required><datalist id="quickInvoiceList">${state.data.merchants.map(m=>`<option value="${escapeHTML(m.invoiceName)}"></option>`).join('')}</datalist></label>
      <label class="field">O que foi de verdade<input name="merchantReal" list="quickMerchantList" placeholder="Ex: Edu Pizzas"><datalist id="quickMerchantList">${state.data.merchants.map(m=>`<option value="${escapeHTML(m.realName)}"></option>`).join('')}</datalist></label>
      ${field('Valor', 'total', 'number', '', '0,00', 'step="0.01" min="0" required')}
      <label class="field">Forma<select name="paymentMethod" required>${paymentMethods.map(x=>`<option>${x}</option>`).join('')}</select></label>
      <label class="field quick-card-field">Cartão<select name="cardId">${cardSelectOptions(true)}</select></label>
      <label class="field quick-installment-field">Parcelas<input name="installmentsCount" type="number" value="1" min="1" required></label>
      <label class="field">Tipo<select name="type"><option>Minha</option><option>De outra pessoa</option><option>Dividida</option></select></label>
      <label class="field quick-person-field">Pessoa<select name="personId">${peopleOptions(true)}</select></label>
      <label class="field quick-share-field">Minha parte<input name="myShare" type="number" step="0.01" min="0"></label>
      <label class="field quick-share-field">Parte da outra pessoa<input name="otherShare" type="number" step="0.01" min="0"></label>
      <div class="form-actions"><button class="secondary-button" type="button" id="expandFullPurchase">Preencher completo</button><button class="primary-button" type="submit">Lançar rápido</button></div>`;
    const updateQuick = () => {
      const method = box.elements.paymentMethod.value;
      const showCard = paymentNeedsCard(method);
      const showInstallments = paymentAllowsInstallments(method);
      const type = box.elements.type.value;
      $$('.quick-card-field').forEach(el => el.style.display = showCard ? 'flex' : 'none');
      $$('.quick-installment-field').forEach(el => el.style.display = showInstallments ? 'flex' : 'none');
      $$('.quick-person-field').forEach(el => el.style.display = type === 'Minha' ? 'none' : 'flex');
      $$('.quick-share-field').forEach(el => el.style.display = type === 'Dividida' ? 'flex' : 'none');
      if (!showCard) box.elements.cardId.value = '';
      if (!showInstallments) box.elements.installmentsCount.value = 1;
      const total = money(box.elements.total.value);
      if (type === 'Minha') { box.elements.myShare.value = total || ''; box.elements.otherShare.value = 0; }
      if (type === 'De outra pessoa') { box.elements.myShare.value = 0; box.elements.otherShare.value = total || ''; }
    };
    const fillMerchant = () => {
      const invoice = box.elements.invoiceName.value.trim().toLowerCase();
      const real = box.elements.merchantReal.value.trim().toLowerCase();
      const found = state.data.merchants.find(m => m.invoiceName.toLowerCase() === invoice || m.realName.toLowerCase() === real);
      if (found) {
        box.elements.invoiceName.value = found.invoiceName;
        box.elements.merchantReal.value = found.realName;
      }
    };
    box.oninput = () => { fillMerchant(); updateQuick(); };
    box.elements.paymentMethod.onchange = updateQuick;
    box.elements.type.onchange = updateQuick;
    $('#expandFullPurchase').onclick = () => {
      const v = Object.fromEntries(new FormData(box).entries());
      const found = state.data.merchants.find(m => m.invoiceName.toLowerCase() === String(v.invoiceName || '').toLowerCase() || m.realName.toLowerCase() === String(v.merchantReal || '').toLowerCase());
      renderPurchaseForm({ ...v, description: v.merchantReal || v.invoiceName, categoryId: found?.categoryId || state.data.categories[0]?.id || '', status: 'Pendente', notes: '' });
      document.querySelector('#purchaseForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    box.onsubmit = (e) => {
      e.preventDefault();
      try {
        const v = Object.fromEntries(new FormData(box).entries());
        const found = state.data.merchants.find(m => m.invoiceName.toLowerCase() === String(v.invoiceName || '').toLowerCase() || m.realName.toLowerCase() === String(v.merchantReal || '').toLowerCase());
        const description = v.merchantReal || found?.realName || v.invoiceName;
        savePurchase({ ...v, description, merchantReal: v.merchantReal || found?.realName || description, invoiceName: v.invoiceName || found?.invoiceName || description, categoryId: found?.categoryId || state.data.categories[0]?.id || '', status: 'Pendente', notes: '' });
        box.reset(); renderQuickPurchaseForm(); showPage('purchases');
      } catch (err) { toast(err.message, 'error'); }
    };
    updateQuick();
  }

  function renderPurchaseForm(existing = null) {
    const p = existing || { date: new Date().toISOString().slice(0,10), description: '', merchantReal: '', invoiceName: '', total: '', paymentMethod: 'Cartão de crédito', installmentsCount: 1, cardId: getActiveCards()[0]?.id || '', categoryId: state.data.categories[0]?.id || '', type: 'Minha', personId: '', myShare: '', otherShare: '', notes: '', status: 'Pendente' };
    const paymentMethods = ['Cartão de crédito', 'Cartão de débito', 'Pix', 'Dinheiro', 'Boleto', 'Crediário', 'Transferência', 'Outro'];
    $('#purchaseForm').innerHTML = `
      <input type="hidden" name="id" value="${p.id || ''}">
      ${field('Data da compra', 'date', 'date', p.date)}${field('Descrição da compra', 'description', 'text', p.description, 'Ex: Mercado do mês')}
      <label class="field">Estabelecimento real<input name="merchantReal" list="merchantList" value="${escapeHTML(p.merchantReal)}" required><datalist id="merchantList">${state.data.merchants.map(m=>`<option value="${escapeHTML(m.realName)}"></option>`).join('')}</datalist></label>
      ${field('Nome que aparece na fatura', 'invoiceName', 'text', p.invoiceName)}
      ${field('Valor total', 'total', 'number', p.total, '0,00', 'step="0.01" min="0" required')}
      <label class="field">Forma de pagamento<select name="paymentMethod" required>${paymentMethods.map(x=>`<option ${p.paymentMethod===x?'selected':''}>${x}</option>`).join('')}</select></label>
      <label class="field installment-field">Quantidade de parcelas<input name="installmentsCount" type="number" value="${p.installmentsCount || 1}" min="1" required></label>
      <label class="field installment-field">Valor da parcela<input id="installmentPreview" readonly value="${formatCurrency(money(p.total)/Math.max(1,p.installmentsCount || 1))}"></label>
      <label class="field card-field">Cartão utilizado<select name="cardId">${cardSelectOptions(true)}</select></label>
      <label class="field">Categoria<select name="categoryId" required>${categoryOptions()}</select></label>
      <label class="field">Tipo da compra<select name="type"><option>Minha</option><option>De outra pessoa</option><option>Dividida</option></select></label>
      <label class="field debt-field">Pessoa responsável<select name="personId">${peopleOptions(true)}</select></label>
      ${field('Minha parte', 'myShare', 'number', p.myShare, '0,00', 'step="0.01" min="0"')}${field('Parte da outra pessoa', 'otherShare', 'number', p.otherShare, '0,00', 'step="0.01" min="0"')}
      <label class="field">Status inicial<select name="status"><option>Pendente</option><option>Pago</option><option>Parcial</option></select></label>
      <label class="field full">Observações<textarea name="notes">${escapeHTML(p.notes)}</textarea></label>
      <div class="form-actions"><button class="ghost-button" type="reset">Limpar</button><button class="primary-button" type="submit">Salvar compra</button></div>`;
    const form = $('#purchaseForm');
    ['paymentMethod','cardId','categoryId','type','personId','status'].forEach(name => { if (form.elements[name]) form.elements[name].value = p[name] || form.elements[name].value; });
    updateShareFields();
    updatePaymentMethodFields();
    form.oninput = () => { updateInstallmentPreview(); updateShareFields(); updatePaymentMethodFields(); };
    form.elements.paymentMethod.onchange = () => { updatePaymentMethodFields(); updateInstallmentPreview(); };
    form.elements.merchantReal.onchange = autoFillMerchant;
    form.onsubmit = (e) => { e.preventDefault(); submitPurchaseForm(form); };
  }

  function field(label, name, type, value = '', placeholder = '', extra = '') {
    return `<label class="field">${label}<input name="${name}" type="${type}" value="${escapeHTML(value)}" placeholder="${placeholder}" ${extra}></label>`;
  }

  function updateInstallmentPreview() {
    const form = $('#purchaseForm');
    const total = money(form.elements.total.value);
    const method = form.elements.paymentMethod?.value || 'Cartão de crédito';
    const count = paymentAllowsInstallments(method) ? Math.max(1, Number(form.elements.installmentsCount.value || 1)) : 1;
    if (!paymentAllowsInstallments(method)) form.elements.installmentsCount.value = 1;
    $('#installmentPreview').value = formatCurrency(total / count);
  }

  function updatePaymentMethodFields() {
    const form = $('#purchaseForm'); if (!form?.elements?.paymentMethod) return;
    const method = form.elements.paymentMethod.value;
    const showCard = paymentNeedsCard(method);
    const showInstallments = paymentAllowsInstallments(method);
    $$('.card-field').forEach(el => el.style.display = showCard ? 'flex' : 'none');
    $$('.installment-field').forEach(el => el.style.display = showInstallments ? 'flex' : 'none');
    if (!showCard) form.elements.cardId.value = '';
    if (!showInstallments) form.elements.installmentsCount.value = 1;
  }

  function updateShareFields() {
    const form = $('#purchaseForm'); if (!form?.elements?.type) return;
    const type = form.elements.type.value; const total = money(form.elements.total.value);
    const person = form.elements.personId.closest('.field'); const my = form.elements.myShare.closest('.field'); const other = form.elements.otherShare.closest('.field');
    person.style.display = type === 'Minha' ? 'none' : 'flex'; my.style.display = type === 'Dividida' ? 'flex' : 'none'; other.style.display = type === 'Dividida' ? 'flex' : 'none';
    if (type === 'Minha') { form.elements.myShare.value = total || ''; form.elements.otherShare.value = 0; }
    if (type === 'De outra pessoa') { form.elements.myShare.value = 0; form.elements.otherShare.value = total || ''; }
  }

  function autoFillMerchant() {
    const form = $('#purchaseForm');
    const found = state.data.merchants.find(m => m.realName.toLowerCase() === form.elements.merchantReal.value.toLowerCase());
    if (found) { form.elements.invoiceName.value = found.invoiceName; form.elements.categoryId.value = found.categoryId; toast('Estabelecimento encontrado: nome da fatura e categoria preenchidos.', 'success'); }
  }

  function submitPurchaseForm(form) {
    try {
      const payload = Object.fromEntries(new FormData(form).entries());
      if (!payload.description || !payload.date || !payload.total || !payload.paymentMethod) throw new Error('Preencha data, descrição, valor e forma de pagamento.');
      if (paymentNeedsCard(payload.paymentMethod) && !payload.cardId) throw new Error('Informe qual cartão foi utilizado.');
      if ((payload.type === 'De outra pessoa' || payload.type === 'Dividida') && !payload.personId) throw new Error('Informe a pessoa responsável.');
      savePurchase(payload); showPage('purchases');
    } catch (err) { toast(err.message, 'error'); }
  }

  function renderPurchases() {
    $('#purchaseFilters').innerHTML = filterHTML('purchases'); bindGenericFilters('purchases');
    let list = [...state.data.purchases]; const f = state.filters.purchases;
    if (f.month !== 'all' || f.year !== 'all') { const ids = filterByMonthYear(state.data.installments, f.month, f.year).map(i => i.purchaseId); list = list.filter(p => ids.includes(p.id)); }
    if (f.cardId !== 'all') list = list.filter(p => matchesPaymentFilter(p, f.cardId));
    if (f.personId !== 'all') list = list.filter(p => p.personId === f.personId);
    if (f.categoryId !== 'all') list = list.filter(p => p.categoryId === f.categoryId);
    if (f.q) list = list.filter(p => `${p.description} ${p.merchantReal} ${p.invoiceName}`.toLowerCase().includes(f.q.toLowerCase()));
    $('#purchasesTable').innerHTML = table(list, ['Data','Descrição','Valor','Parcelas','Forma de pagamento','Categoria','Tipo','Pessoa','Status','Ações'], p => [formatDate(p.date), escapeHTML(p.description), formatCurrency(p.total), `${p.installmentsCount}x de ${formatCurrency(p.installmentValue)}`, paymentName(p), categoryName(p.categoryId), p.type, personName(p.personId), statusBadge(p.status), `<div class="actions"><button class="mini-btn" onclick="FinCard.editPurchase('${p.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deletePurchase('${p.id}')">Excluir</button></div>`]);
  }

  function renderInstallments() {
    $('#installmentFilters').innerHTML = filterHTML('installments'); bindGenericFilters('installments');
    let list = [...state.data.installments]; const f = state.filters.installments;
    list = filterByMonthYear(list, f.month, f.year);
    if (f.cardId !== 'all') list = list.filter(i => matchesPaymentFilter(i, f.cardId));
    if (f.personId !== 'all') list = list.filter(i => i.personId === f.personId);
    if (f.status !== 'all') list = list.filter(i => i.status === f.status);
    list.sort((a,b)=>a.year-b.year || a.month-b.month || a.description.localeCompare(b.description));
    $('#installmentsTable').innerHTML = table(list, ['Mês','Descrição','Parcela','Valor','Meu valor','Pessoa deve','Forma','Pessoa','Status','Ações'], i => [`${monthName(i.month)}/${i.year}`, escapeHTML(i.description), i.label, formatCurrency(i.amount), formatCurrency(i.myAmount), formatCurrency(i.otherAmount), paymentName(i), personName(i.personId), statusBadge(i.status), `<div class="actions"><button class="mini-btn" onclick="FinCard.setInstallmentStatus('${i.id}','Pago')">Pago</button><button class="mini-btn" onclick="FinCard.setInstallmentStatus('${i.id}','Pendente')">Pendente</button><button class="mini-btn" onclick="FinCard.showPurchaseDetails('${i.purchaseId}')">Detalhes</button></div>`]);
  }

  function renderInvoiceCheck() {
    fillMonthYear($('#invoiceCheckMonth'), $('#invoiceCheckYear'), state.filters.invoiceCheck.month, state.filters.invoiceCheck.year);
    $('#invoiceCheckCard').innerHTML = cardOptions(false, true);
    $('#invoiceCheckCard').value = state.filters.invoiceCheck.cardId;
    $('#invoiceBankTotal').value = state.filters.invoiceCheck.bankTotal || '';

    const { month, year, cardId, bankTotal } = state.filters.invoiceCheck;
    let list = filterByMonthYear(state.data.installments, month, year).filter(i => (i.paymentMethod || 'Cartão de crédito') === 'Cartão de crédito');
    if (cardId !== 'all') list = list.filter(i => i.cardId === cardId);
    list.sort((a,b) => (a.cardId || '').localeCompare(b.cardId || '') || String(a.invoiceName || a.description).localeCompare(String(b.invoiceName || b.description)));
    const expected = list.reduce((s,i)=>s+money(i.amount),0);
    const checked = list.filter(i => i.invoiceChecked).reduce((s,i)=>s+money(i.amount),0);
    const bank = money(bankTotal);
    const diff = bankTotal === '' ? null : +(bank - expected).toFixed(2);
    const checkedCount = list.filter(i => i.invoiceChecked).length;

    $('#invoiceCheckSummary').innerHTML = `
      <div class="metric-card"><span>Total esperado pelo app</span><strong>${formatCurrency(expected)}</strong><small>${list.length} lançamento(s) na fatura</small></div>
      <div class="metric-card"><span>Já conferido</span><strong>${formatCurrency(checked)}</strong><small>${checkedCount}/${list.length} item(ns) marcados</small></div>
      <div class="metric-card"><span>Total informado pelo banco</span><strong>${bankTotal === '' ? '—' : formatCurrency(bank)}</strong><small>Digite o total da fatura real</small></div>
      <div class="metric-card ${diff === 0 ? 'ok-card' : diff ? 'danger-card' : ''}"><span>Diferença</span><strong>${diff === null ? '—' : formatCurrency(diff)}</strong><small>${diff === 0 ? 'Tudo bateu' : diff ? 'Existe algo para revisar' : 'Aguardando total do banco'}</small></div>`;

    $('#invoiceCheckList').innerHTML = list.length ? `
      <div class="table-wrap"><table class="data-table invoice-check-table"><thead><tr><th>Conferido</th><th>Nome na fatura</th><th>Compra real</th><th>Cartão</th><th>Parcela</th><th>Valor</th><th>Dono</th></tr></thead><tbody>
      ${list.map(i => `<tr class="${i.invoiceChecked ? 'checked-row' : ''}">
        <td><input type="checkbox" ${i.invoiceChecked ? 'checked' : ''} onchange="FinCard.toggleInvoiceChecked('${i.id}', this.checked)"></td>
        <td><strong>${escapeHTML(i.invoiceName || i.description)}</strong></td>
        <td>${escapeHTML(i.merchantReal || i.description)}</td>
        <td>${cardName(i.cardId)}</td>
        <td>${i.label}</td>
        <td><strong>${formatCurrency(i.amount)}</strong></td>
        <td>${i.type === 'Minha' ? 'Meu' : personName(i.personId)}</td>
      </tr>`).join('')}
      </tbody></table></div>` : emptyHTML();
  }

  function filterHTML(kind) {
    const f = state.filters[kind];
    const base = `<label>Mês<select data-filter="month"><option value="all">Todos</option>${Array.from({length:12},(_,i)=>`<option value="${i+1}">${monthName(i+1)}</option>`).join('')}</select></label><label>Ano<select data-filter="year">${Array.from({length:7},(_,i)=>currentYear-2+i).map(y=>`<option value="${y}">${y}</option>`).join('')}</select></label><label>Forma<select data-filter="cardId">${cardOptions(false,true)}</select></label><label>Pessoa<select data-filter="personId">${peopleOptions(false,true)}</select></label>`;
    const extra = kind === 'purchases' ? `<label>Categoria<select data-filter="categoryId"><option value="all">Todas</option>${categoryOptions()}</select></label><label>Buscar<input data-filter="q" value="${escapeHTML(f.q || '')}" placeholder="Descrição, estabelecimento..."></label>` : `<label>Status<select data-filter="status"><option value="all">Todos</option><option>Pendente</option><option>Pago</option><option>Parcial</option></select></label>`;
    return base + extra;
  }

  function bindGenericFilters(kind) {
    $$(`#${kind === 'purchases' ? 'purchaseFilters' : 'installmentFilters'} [data-filter]`).forEach(el => { el.value = state.filters[kind][el.dataset.filter]; el.oninput = () => { state.filters[kind][el.dataset.filter] = el.value; kind === 'purchases' ? renderPurchases() : renderInstallments(); }; });
  }

  function statusBadge(status) { const cls = status === 'Pago' ? 'paid' : status === 'Parcial' ? 'partial' : status === 'OK' ? 'ok' : 'pending'; return `<span class="badge ${cls}">${status}</span>`; }
  function emptyHTML() { return $('#emptyTemplate').innerHTML; }
  function table(list, headers, rowFn) { if (!list.length) return emptyHTML(); return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${list.map(item=>`<tr>${rowFn(item).map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`; }

  function renderCards() {
    $('#cardsGrid').innerHTML = state.data.cards.length ? state.data.cards.map(c => `<article class="credit-card" style="--card-color:${c.color || '#6366F1'}"><div class="card-top"><div class="card-title-wrap">${institutionBadge(c)}<div><h3>${escapeHTML(c.nickname || c.name)}</h3><p>${escapeHTML(c.bank)} • ${escapeHTML(c.brand)}</p></div></div>${statusBadge(c.status)}</div><p>•••• ${escapeHTML(c.last4 || '----')} • ${escapeHTML(c.type)}</p><p>Fecha dia ${c.closeDay} • vence dia ${c.dueDay} • melhor dia ${c.bestDay}</p><div class="limit"><strong>${c.limit ? formatCurrency(c.limit) : 'Sem limite informado'}</strong><div class="actions"><button class="mini-btn" onclick="FinCard.openCardModal('${c.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deleteItem('cards','${c.id}')">Excluir</button></div></div></article>`).join('') : emptyHTML();
  }

  function renderPeople() {
    fillMonthYear($('#peopleMonth'), $('#peopleYear'), state.filters.people.month, state.filters.people.year);
    const { month, year } = state.filters.people;
    $('#peopleGrid').innerHTML = state.data.people.length ? state.data.people.map(p => { const d = getPersonDebt(p.id, month, year); const last = paymentsFor(p.id).sort((a,b)=>b.date.localeCompare(a.date))[0]; return `<article class="person-card" style="--card-color:${d.pending > 0 ? '#F59E0B' : '#22C55E'}"><div class="card-top"><div><h3>${escapeHTML(p.name)}</h3><p>Status: ${d.status}</p></div>${statusBadge(d.status)}</div><p>Deve no mês: <strong>${formatCurrency(d.total)}</strong></p><p>Recebido no mês: <strong>${formatCurrency(d.paid)}</strong></p><p>Pendente no mês: <strong>${formatCurrency(d.pending)}</strong></p><p>Total geral aberto: <strong>${formatCurrency(d.openAll)}</strong></p><p>Último pagamento: ${last ? formatDate(last.date) : '-'}</p><div class="actions"><button class="mini-btn" onclick="FinCard.personHistory('${p.id}')">Histórico</button><button class="mini-btn" onclick="FinCard.openPersonModal('${p.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deleteItem('people','${p.id}')">Excluir</button></div></article>`; }).join('') : emptyHTML();
  }

  function renderPayments() {
    const list = [...state.data.payments].sort((a,b)=>b.date.localeCompare(a.date));
    $('#paymentsTable').innerHTML = table(list, ['Data','Pessoa','Valor','Forma','Referência','Observações','Ações'], p => [formatDate(p.date), personName(p.personId), formatCurrency(p.amount), p.method, `${monthName(p.month)}/${p.year}`, escapeHTML(p.notes || ''), `<div class="actions"><button class="mini-btn" onclick="FinCard.openPaymentModal('${p.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deleteItem('payments','${p.id}')">Excluir</button></div>`]);
  }

  function renderMerchants() {
    $('#merchantsTable').innerHTML = table(state.data.merchants, ['Real','Na fatura','Categoria padrão','Observações','Ações'], m => [escapeHTML(m.realName), escapeHTML(m.invoiceName), categoryName(m.categoryId), escapeHTML(m.notes || ''), `<div class="actions"><button class="mini-btn" onclick="FinCard.openMerchantModal('${m.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deleteItem('merchants','${m.id}')">Excluir</button></div>`]);
  }

  function renderCategories() {
    $('#categoriesGrid').innerHTML = state.data.categories.length ? state.data.categories.map(c => `<div class="tag-pill">🏷️ <strong>${escapeHTML(c.name)}</strong><button class="mini-btn" onclick="FinCard.openCategoryModal('${c.id}')">Editar</button><button class="mini-btn" onclick="FinCard.deleteItem('categories','${c.id}')">Excluir</button></div>`).join('') : emptyHTML();
  }

  function renderAll(includeCurrent = true) {
    if (includeCurrent || state.currentPage === 'dashboard') renderDashboard();
    if (includeCurrent || state.currentPage === 'newPurchase') { renderQuickPurchaseForm(); renderPurchaseForm(); }
    if (includeCurrent || state.currentPage === 'purchases') renderPurchases();
    if (includeCurrent || state.currentPage === 'installments') renderInstallments();
    if (includeCurrent || state.currentPage === 'invoiceCheck') renderInvoiceCheck();
    if (includeCurrent || state.currentPage === 'cards') renderCards();
    if (includeCurrent || state.currentPage === 'people') renderPeople();
    if (includeCurrent || state.currentPage === 'payments') renderPayments();
    if (includeCurrent || state.currentPage === 'merchants') renderMerchants();
    if (includeCurrent || state.currentPage === 'categories') renderCategories();
  }

  function openModal(title, html, onSubmit) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = `<form class="smart-form" id="modalForm">${html}<div class="form-actions"><button type="button" class="ghost-button" id="cancelModal">Cancelar</button><button class="primary-button" type="submit">Salvar</button></div></form>`;
    $('#modalBackdrop').classList.add('show'); $('#modalBackdrop').setAttribute('aria-hidden','false');
    $('#cancelModal').onclick = closeModal; $('#modalForm').onsubmit = (e) => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.target).entries())); closeModal(); saveToStorage(); renderAll(); };
  }
  function closeModal(){ $('#modalBackdrop').classList.remove('show'); $('#modalBackdrop').setAttribute('aria-hidden','true'); }

  function openCardModal(id) {
    const c = getById(state.data.cards,id) || { name:'', bank:'', nickname:'', last4:'', brand:'Visa', type:'Crédito', closeDay:1, dueDay:10, bestDay:2, limit:'', color:'#6366F1', status:'Ativo', notes:'' };
    openModal(id ? 'Editar forma de pagamento' : 'Nova forma de pagamento', `${field('Nome da forma','name','text',c.name,'','required')}${field('Banco, instituição ou descrição','bank','text',c.bank)}${field('Apelido','nickname','text',c.nickname)}${field('Últimos 4 dígitos','last4','text',c.last4)}<label class="field">Bandeira<select name="brand">${['Visa','Mastercard','Elo','Hipercard','American Express','Outro'].map(x=>`<option ${c.brand===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="field">Tipo<select name="type">${['Crédito','Débito','Crédito e Débito','Pix','Dinheiro','Boleto','Crediário','Transferência','Outro'].map(x=>`<option ${c.type===x?'selected':''}>${x}</option>`).join('')}</select></label>${field('Fechamento','closeDay','number',c.closeDay,'','min="1" max="31"')}${field('Vencimento','dueDay','number',c.dueDay,'','min="1" max="31"')}${field('Melhor dia','bestDay','number',c.bestDay,'','min="1" max="31"')}${field('Limite','limit','number',c.limit,'','step="0.01"')}${field('Cor','color','color',c.color)}<div class="field helper-note"><span>O sistema tenta reconhecer Nubank, PicPay, Mercado Livre e outros bancos para sugerir cor e badge automaticamente.</span></div><label class="field">Status<select name="status"><option ${c.status==='Ativo'?'selected':''}>Ativo</option><option ${c.status==='Inativo'?'selected':''}>Inativo</option></select></label><label class="field full">Observações<textarea name="notes">${escapeHTML(c.notes || '')}</textarea></label>`, values => upsert('cards', applyInstitutionColor({ ...c, ...values, id: id || uid('card'), limit: money(values.limit) })));
  }

  function openPersonModal(id) { const p = getById(state.data.people,id) || { name:'', phone:'', notes:'' }; openModal(id?'Editar pessoa':'Nova pessoa', `${field('Nome','name','text',p.name,'','required')}${field('Telefone','phone','text',p.phone)}<label class="field full">Observações<textarea name="notes">${escapeHTML(p.notes || '')}</textarea></label>`, v => upsert('people',{...p,...v,id:id||uid('person')})); }
  function openCategoryModal(id) { const c = getById(state.data.categories,id) || { name:'', color:'#6366F1' }; openModal(id?'Editar categoria':'Nova categoria', `${field('Nome','name','text',c.name,'','required')}${field('Cor','color','color',c.color || '#6366F1')}`, v => upsert('categories',{...c,...v,id:id||uid('cat')})); }
  function openMerchantModal(id) { const m = getById(state.data.merchants,id) || { realName:'', invoiceName:'', categoryId:state.data.categories[0]?.id || '', notes:'' }; openModal(id?'Editar estabelecimento':'Novo estabelecimento', `${field('Estabelecimento real','realName','text',m.realName,'','required')}${field('Nome na fatura','invoiceName','text',m.invoiceName,'','required')}<label class="field">Categoria padrão<select name="categoryId">${categoryOptions()}</select></label><label class="field full">Observações<textarea name="notes">${escapeHTML(m.notes || '')}</textarea></label>`, v => upsert('merchants',{...m,...v,id:id||uid('merchant')})); setTimeout(()=>{$('#modalForm').elements.categoryId.value=m.categoryId},0); }
  function openPaymentModal(id) { const p = getById(state.data.payments,id) || { date:new Date().toISOString().slice(0,10), personId:'', amount:'', method:'Pix', relatedId:'', month:currentMonth, year:currentYear, notes:'' }; openModal(id?'Editar recebimento':'Novo recebimento', `${field('Data','date','date',p.date,'','required')}<label class="field">Pessoa<select name="personId" required>${peopleOptions()}</select></label>${field('Valor recebido','amount','number',p.amount,'','step="0.01" required')}<label class="field">Forma<select name="method">${['Pix','Dinheiro','Transferência','Cartão','Outro'].map(x=>`<option ${p.method===x?'selected':''}>${x}</option>`).join('')}</select></label><label class="field">Mês<select name="month">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${monthName(i+1)}</option>`).join('')}</select></label>${field('Ano','year','number',p.year)}${field('Compra/parcela relacionada','relatedId','text',p.relatedId || '')}<label class="field full">Observações<textarea name="notes">${escapeHTML(p.notes || '')}</textarea></label>`, v => upsert('payments',{...p,...v,id:id||uid('pay'),amount:money(v.amount),month:Number(v.month),year:Number(v.year)})); setTimeout(()=>{const f=$('#modalForm').elements; f.personId.value=p.personId; f.month.value=p.month;},0); }

  function upsert(list, item) { state.data[list] = state.data[list].filter(x => x.id !== item.id); state.data[list].push(item); if (list === 'cards') rebuildAllInstallments(false); }
  function deleteItem(list, id) { if (!confirm('Tem certeza que deseja excluir este item?')) return; state.data[list] = state.data[list].filter(x => x.id !== id); saveToStorage(); renderAll(); }


  function generateMonthlyReport() {
    const month = Number(state.filters.dashboard.month || currentMonth);
    const year = Number(state.filters.dashboard.year || currentYear);
    const installments = filterByMonthYear(state.data.installments, month, year);
    const purchasesIds = new Set(installments.map(i => i.purchaseId));
    const purchases = state.data.purchases.filter(p => purchasesIds.has(p.id));
    const payments = state.data.payments.filter(p => Number(p.month) === month && Number(p.year) === year);

    const totalInvoice = installments.reduce((s, i) => s + money(i.amount), 0);
    const myTotal = installments.reduce((s, i) => s + money(i.myAmount), 0);
    const othersTotal = installments.reduce((s, i) => s + money(i.otherAmount), 0);
    const received = payments.reduce((s, p) => s + money(p.amount), 0);
    const pending = Math.max(0, othersTotal - received);
    const estimatedBalance = received - myTotal;

    const sumBy = (items, keyFn, valueFn) => {
      const out = {};
      items.forEach(item => {
        const key = keyFn(item) || 'Não informado';
        out[key] = (out[key] || 0) + money(valueFn(item));
      });
      return Object.entries(out).sort((a,b) => b[1] - a[1]);
    };

    const byCategory = sumBy(installments, i => categoryName(i.categoryId), i => i.amount);
    const byCard = sumBy(installments.filter(i => i.cardId), i => cardName(i.cardId), i => i.amount);
    const byPerson = state.data.people
      .map(p => {
        const debt = getPersonDebt(p.id, month, year);
        return [p.name, debt.total, debt.paid, debt.pending];
      })
      .filter(row => row[1] > 0 || row[2] > 0 || row[3] > 0)
      .sort((a,b) => b[3] - a[3]);

    const moneyLine = (label, value) => `- ${label}: ${formatCurrency(value)}`;
    const tableLines = (rows, headers) => {
      if (!rows.length) return '_Sem dados neste mês._';
      const head = `| ${headers.join(' | ')} |`;
      const sep = `| ${headers.map(() => '---').join(' | ')} |`;
      const body = rows.map(row => `| ${row.map(cell => String(cell).replace(/\|/g, '/')).join(' | ')} |`).join('\n');
      return `${head}\n${sep}\n${body}`;
    };

    const report = `# Relatório financeiro mensal — ${monthName(month)} de ${year}

## Resumo geral

${moneyLine('Receita/recebimentos registrados', received)}
${moneyLine('Total da fatura/saídas do mês', totalInvoice)}
${moneyLine('Minha parte dos gastos', myTotal)}
${moneyLine('Valor que terceiros me devem', othersTotal)}
${moneyLine('Já recebido de terceiros', received)}
${moneyLine('Pendente a receber', pending)}
${moneyLine('Saldo estimado após pagar minha parte', estimatedBalance)}

## Indicadores

- Compras no mês: ${purchases.length}
- Parcelas no mês: ${installments.length}
- Cartões/formas com gasto: ${byCard.length}
- Categorias usadas: ${byCategory.length}

## Gastos por categoria

${tableLines(byCategory.map(([name, value]) => [name, formatCurrency(value)]), ['Categoria', 'Valor'])}

## Valor a pagar por cartão

${tableLines(byCard.map(([name, value]) => [name, formatCurrency(value)]), ['Cartão', 'Valor do mês'])}

## Pessoas / valores de terceiros

${tableLines(byPerson.map(([name, total, paid, open]) => [name, formatCurrency(total), formatCurrency(paid), formatCurrency(open)]), ['Pessoa', 'Total', 'Recebido', 'Pendente'])}

## Compras do mês

${tableLines(purchases.map(p => [
  formatDate(p.date),
  p.description,
  paymentName(p),
  categoryName(p.categoryId),
  p.type,
  formatCurrency(p.total)
]), ['Data', 'Descrição', 'Forma', 'Categoria', 'Tipo', 'Valor'])}

## Parcelas do mês

${tableLines(installments.map(i => [
  i.label,
  i.description,
  paymentName(i),
  categoryName(i.categoryId),
  formatCurrency(i.amount),
  statusBadgeText(i.status)
]), ['Parcela', 'Descrição', 'Forma', 'Categoria', 'Valor', 'Status'])}

## Pagamentos recebidos

${tableLines(payments.map(p => [
  formatDate(p.date),
  personName(p.personId),
  p.method,
  formatCurrency(p.amount),
  p.notes || '-'
]), ['Data', 'Pessoa', 'Forma', 'Valor', 'Observações'])}

## Pedido para análise no ChatGPT

Analise este relatório financeiro e monte um plano econômico para mim. Quero sugestões práticas para economizar mais, gastar menos, identificar categorias problemáticas, organizar pagamentos de cartão e criar metas realistas para o próximo mês.
`;

    return report;
  }

  function statusBadgeText(status) {
    return String(status || '').replace(/\|/g, '/');
  }

  function downloadMonthlyReport() {
    const report = generateMonthlyReport();
    const month = Number(state.filters.dashboard.month || currentMonth);
    const year = Number(state.filters.dashboard.year || currentYear);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-yr-financas-${year}-${String(month).padStart(2,'0')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Relatório mensal baixado.', 'success');
  }

  async function copyMonthlyReport() {
    const report = generateMonthlyReport();
    try {
      await navigator.clipboard.writeText(report);
      toast('Relatório copiado. Agora é só colar no ChatGPT.', 'success');
    } catch (err) {
      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const month = Number(state.filters.dashboard.month || currentMonth);
      const year = Number(state.filters.dashboard.year || currentYear);
      a.href = url;
      a.download = `relatorio-yr-financas-${year}-${String(month).padStart(2,'0')}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast('Não foi possível copiar; baixei o relatório em TXT.', 'error');
    }
  }


  function exportData() {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `backup-yr-financas-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => { try { const parsed = JSON.parse(reader.result); ['cards','people','categories','merchants','purchases','installments','payments','settings'].forEach(k => { if (!(k in parsed)) throw new Error(`JSON sem a chave ${k}`); }); state.data = parsed; ensureDataShape(); saveToStorage(); document.documentElement.classList.toggle('light', state.data.settings.theme === 'light'); renderAll(); toast('Backup importado com sucesso.', 'success'); } catch(e) { toast('Arquivo inválido: ' + e.message, 'error'); } };
    reader.readAsText(file);
  }

  function toast(message, type = 'success') { const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; $('#toastContainer').appendChild(el); setTimeout(()=>el.remove(), 3200); }


  function setAppVisible(visible) {
    document.body.classList.toggle('auth-mode', !visible);
    const shell = $('.app-shell');
    const mobileNav = $('#mobileNav');
    if (shell) shell.hidden = !visible;
    if (mobileNav) mobileNav.hidden = !visible;
    if (shell) shell.style.display = visible ? '' : 'none';
    if (mobileNav) mobileNav.style.display = visible ? '' : 'none';
  }

  function updateAccountPill() {
    const pill = $('#accountPill');
    if (!pill) return;
    if (!state.user) { pill.hidden = true; return; }
    pill.hidden = false;
    pill.textContent = `☁️ ${state.user.email || 'Conta conectada'}`;
    const cloudText = $('#cloudStatusText');
    if (cloudText) cloudText.textContent = `Conectado como ${state.user.email}. Os dados são salvos localmente e sincronizados com o Supabase.`;
  }

  function ensureAuthGate() {
    let gate = $('#authGate');
    if (gate) return gate;
    gate = document.createElement('section');
    gate.id = 'authGate';
    gate.className = 'auth-gate';
    gate.innerHTML = `
      <div class="auth-card">
        <div class="brand auth-brand"><div class="brand-logo"><img src="icon-192.png?v=25" alt="Logo YR Finanças"></div><div><strong>YR Finanças</strong><span>sincronização em nuvem</span></div></div>
        <div class="auth-copy">
          <span class="auth-kicker">Conta segura</span>
          <h1>Entre para sincronizar seus dados</h1>
          <p>Use o mesmo e-mail e senha no celular e no computador para acessar os mesmos cartões, compras, parcelas e recebimentos.</p>
        </div>
        <form id="authForm" class="auth-form" novalidate>
          <label>E-mail<input name="email" type="email" autocomplete="email" required placeholder="seu@email.com"></label>
          <label>Senha<input name="password" type="password" autocomplete="current-password" required minlength="6" placeholder="mínimo 6 caracteres"></label>
          <div class="auth-message" id="authMessage" role="status" aria-live="polite" hidden></div>
          <div class="auth-actions">
            <button class="primary-button" type="submit" id="loginBtn">Entrar</button>
            <button class="secondary-button" type="button" id="signupBtn">Criar conta</button>
          </div>
        </form>
        <small>Ao entrar pela primeira vez neste navegador, os dados locais existentes serão enviados para a sua conta na nuvem.</small>
      </div>`;
    document.body.appendChild(gate);
    return gate;
  }

  function showAuthMessage(message, type = 'info') {
    const box = $('#authMessage');
    if (!box) return;
    box.hidden = false;
    box.className = `auth-message ${type}`;
    box.textContent = message;
  }

  window.addEventListener('error', (event) => {
    const msg = event?.message || 'Erro desconhecido no JavaScript.';
    console.error(event.error || msg);
    showAuthMessage(`Erro no app: ${msg}`, 'error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || String(event?.reason || 'Falha desconhecida.');
    console.error(event.reason);
    showAuthMessage(`Falha de conexão: ${msg}`, 'error');
  });

  async function handleAuth(mode) {
    const form = $('#authForm');
    if (!form) return;
    if (!form.checkValidity()) {
      form.reportValidity();
      showAuthMessage('Preencha um e-mail válido e uma senha com pelo menos 6 caracteres.', 'error');
      return;
    }

    if (!state.supabase) {
      showAuthMessage('O Supabase não carregou. Recarregue a página e tente novamente.', 'error');
      return;
    }

    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const loginBtn = $('#loginBtn');
    const signupBtn = $('#signupBtn');
    const originalLogin = loginBtn?.textContent || 'Entrar';
    const originalSignup = signupBtn?.textContent || 'Criar conta';

    try {
      if (loginBtn) loginBtn.disabled = true;
      if (signupBtn) signupBtn.disabled = true;
      if (mode === 'signup' && signupBtn) signupBtn.textContent = 'Criando...';
      if (mode !== 'signup' && loginBtn) loginBtn.textContent = 'Entrando...';
      showAuthMessage(mode === 'signup' ? 'Criando sua conta...' : 'Entrando na sua conta...', 'info');

      const action = mode === 'signup'
        ? state.supabase.auth.signUp({ email, password })
        : state.supabase.auth.signInWithPassword({ email, password });
      const { data, error } = await action;
      if (error) {
        showAuthMessage(error.message, 'error');
        return;
      }

      state.user = data.user || data.session?.user || null;
      if (!state.user) {
        showAuthMessage('Conta criada. Se a confirmação de e-mail ainda estiver ligada no Supabase, confirme o e-mail antes de entrar.', 'success');
        return;
      }

      $('#authGate')?.remove();
      setAppVisible(true);
      await loadFromCloud();
      updateAccountPill();
      renderPurchaseForm();
      renderAll();
      toast(mode === 'signup' ? 'Conta criada e conectada.' : 'Login realizado.', 'success');
    } catch (err) {
      console.error(err);
      showAuthMessage('Não foi possível conectar agora. Confira sua internet, a chave do Supabase e tente novamente.', 'error');
    } finally {
      if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = originalLogin; }
      if (signupBtn) { signupBtn.disabled = false; signupBtn.textContent = originalSignup; }
    }
  }

  function showAuthGate() {
    setAppVisible(false);
    const gate = ensureAuthGate();
    const form = gate.querySelector('#authForm');
    const signup = gate.querySelector('#signupBtn');
    const login = gate.querySelector('#loginBtn');

    // Evita perder o clique em alguns navegadores quando o GitHub Pages entrega arquivos em cache.
    // Usamos addEventListener e também onclick como fallback simples.
    const doLogin = (e) => {
      if (e) e.preventDefault();
      handleAuth('login');
    };
    const doSignup = (e) => {
      if (e) e.preventDefault();
      handleAuth('signup');
    };

    if (form) {
      form.onsubmit = doLogin;
      form.addEventListener('submit', doLogin);
    }
    if (signup) {
      signup.onclick = doSignup;
      signup.addEventListener('click', doSignup);
    }
    if (login) {
      login.onclick = doLogin;
    }
  }

  async function signOut() {
    if (!state.supabase) return;
    await saveToSupabase(false);
    await state.supabase.auth.signOut();
    state.user = null;
    state.cloudRecordId = null;
    updateAccountPill();
    showAuthGate();
  }

  function bindEvents() {

    const toggleSidebarMobile = (force = null) => {
      const open = force === null ? !document.body.classList.contains('sidebar-open') : force;
      document.body.classList.toggle('sidebar-open', open);
    };
    
    
    $('#dashboardMonth').onchange = e => { state.filters.dashboard.month = Number(e.target.value); renderDashboard(); };
    $('#dashboardYear').onchange = e => { state.filters.dashboard.year = Number(e.target.value); renderDashboard(); };
    $('#dashboardCard').onchange = e => { state.filters.dashboard.cardId = e.target.value; renderDashboard(); };
    $('#refreshDashboard').onclick = renderDashboard;
    $('#invoiceCheckMonth').onchange = e => { state.filters.invoiceCheck.month = Number(e.target.value); renderInvoiceCheck(); };
    $('#invoiceCheckYear').onchange = e => { state.filters.invoiceCheck.year = Number(e.target.value); renderInvoiceCheck(); };
    $('#invoiceCheckCard').onchange = e => { state.filters.invoiceCheck.cardId = e.target.value; renderInvoiceCheck(); };
    $('#invoiceBankTotal').oninput = e => { state.filters.invoiceCheck.bankTotal = e.target.value; renderInvoiceCheck(); };
    $$('[data-action="new-purchase"]').forEach(btn => btn.onclick = () => showPage('newPurchase'));
    $('#addCardBtn').onclick = () => openCardModal(); $('#addPersonBtn').onclick = () => openPersonModal(); $('#addPaymentBtn').onclick = () => openPaymentModal(); $('#addMerchantBtn').onclick = () => openMerchantModal(); $('#addCategoryBtn').onclick = () => openCategoryModal();
    $('#peopleMonth').onchange = e => { state.filters.people.month = Number(e.target.value); renderPeople(); };
    $('#peopleYear').onchange = e => { state.filters.people.year = Number(e.target.value); renderPeople(); };
    $('#closeModal').onclick = closeModal; $('#modalBackdrop').onclick = e => { if (e.target.id === 'modalBackdrop') closeModal(); };
    $('#toggleThemeBtn').onclick = () => { state.data.settings.theme = state.data.settings.theme === 'dark' ? 'light' : 'dark'; document.documentElement.classList.toggle('light', state.data.settings.theme === 'light'); saveToStorage(); renderDashboard(); };
    $('#monthlyReportBtn') && ($('#monthlyReportBtn').onclick = downloadMonthlyReport); $('#copyMonthlyReportBtn') && ($('#copyMonthlyReportBtn').onclick = copyMonthlyReport);
    $('#exportBtn').onclick = exportData; $('#importBtn').onclick = () => $('#importInput').click(); $('#importInput').onchange = e => e.target.files[0] && importData(e.target.files[0]);
    $('#syncNowBtn').onclick = () => saveToSupabase(true, true); $('#logoutBtn').onclick = signOut;
    $('#clearDataBtn').onclick = () => { if (confirm('Isso apagará todos os dados deste navegador e da sua conta na nuvem. Deseja continuar?')) { localStorage.removeItem(STORAGE_KEY); state.data = { cards:[],people:[],categories:[],merchants:[],purchases:[],installments:[],payments:[],settings:{theme:'dark'} }; saveToStorage(false); renderAll(); toast('Todos os dados foram limpos.'); } };
    $('#seedButton').onclick = () => { if (confirm('Substituir dados atuais por dados de exemplo?')) { state.data = defaultData(); saveToStorage(); renderAll(); } };
    $('#openMobileMenu').onclick = () => $('#mobileDrawer').classList.add('show'); $('#closeMobileMenu').onclick = () => $('#mobileDrawer').classList.remove('show');
    document.body.classList.remove('sidebar-open');
  }

  window.FinCard = {
    editPurchase(id) { showPage('newPurchase'); renderPurchaseForm(getById(state.data.purchases, id)); }, deletePurchase,
    toggleInvoiceChecked(id, checked) { const i = getById(state.data.installments, id); if (i) { i.invoiceChecked = Boolean(checked); saveToStorage(false); renderInvoiceCheck(); } },
    markInvoiceList(checked) { const { month, year, cardId } = state.filters.invoiceCheck; filterByMonthYear(state.data.installments, month, year).filter(i => cardId === 'all' || i.cardId === cardId).forEach(i => i.invoiceChecked = Boolean(checked)); saveToStorage(false); renderInvoiceCheck(); },
    setInstallmentStatus(id, status) { const i = getById(state.data.installments, id); if (i) { i.status = status; saveToStorage(); renderAll(); } },
    showCardInvoice(id) {
      const card = getById(state.data.cards, id);
      if (!card) return;
      const month = state.filters.dashboard.month;
      const year = state.filters.dashboard.year;
      const list = filterByMonthYear(state.data.installments, month, year).filter(i => i.cardId === id);
      const total = list.reduce((s, i) => s + money(i.amount), 0);
      openModal(`Fatura - ${escapeHTML(card.nickname || card.name)}`, `<div class="stack-list"><div class="stack-item"><strong>Total da fatura</strong><b>${formatCurrency(total)}</b></div>${list.length ? list.map(i => `<div class="stack-item"><div><strong>${escapeHTML(i.description)}</strong><span>${i.label} • ${monthName(i.month)}/${i.year}</span></div><b>${formatCurrency(i.amount)}</b></div>`).join('') : emptyHTML()}</div>`, () => {});
      $('#modalForm')?.remove();
    },
    showPurchaseDetails(id) { const p = getById(state.data.purchases, id); if (!p) return; openModal('Detalhes da compra', `<div class="full stack-list"><div class="stack-item"><strong>${escapeHTML(p.description)}</strong><b>${formatCurrency(p.total)}</b></div><p>Cartão: ${cardName(p.cardId)}<br>Categoria: ${categoryName(p.categoryId)}<br>Estabelecimento real: ${escapeHTML(p.merchantReal)}<br>Nome na fatura: ${escapeHTML(p.invoiceName)}<br>Tipo: ${p.type}<br>Pessoa: ${personName(p.personId)}<br>Observações: ${escapeHTML(p.notes || '-')}</p></div>`, () => {}); $('#modalForm .form-actions').remove(); },
    personHistory(id) { const list = state.data.installments.filter(i => i.personId === id); const pays = paymentsFor(id); openModal(`Histórico de ${personName(id)}`, `<div class="full"><h3>Parcelas</h3>${table(list, ['Mês','Descrição','Valor que deve','Status'], i => [`${monthName(i.month)}/${i.year}`, escapeHTML(i.description), formatCurrency(i.otherAmount), statusBadge(i.status)])}<h3>Pagamentos</h3>${table(pays, ['Data','Valor','Forma','Referência'], p => [formatDate(p.date), formatCurrency(p.amount), p.method, `${monthName(p.month)}/${p.year}`])}</div>`, () => {}); $('#modalForm .form-actions').remove(); },
    openCardModal, openPersonModal, openCategoryModal, openMerchantModal, openPaymentModal, deleteItem
  };

  async function init() {
    renderNav();
    bindEvents();
    setAppVisible(false);
    setupSupabase();

    if (!state.supabase) {
      loadLocalDataOrDefault();
      renderPurchaseForm();
      renderAll();
      toast('Supabase não carregou. Usando apenas dados locais.', 'error');
      return;
    }

    const { data } = await state.supabase.auth.getSession();
    state.user = data.session?.user || null;

    state.supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user || null;
      if (nextUser?.id === state.user?.id) return;
      state.user = nextUser;
      if (state.user) {
        $('#authGate')?.remove();
        setAppVisible(true);
        await loadFromCloud();
        updateAccountPill();
        renderPurchaseForm();
        renderAll();
      }
    });

    if (!state.user) {
      showAuthGate();
      return;
    }

    setAppVisible(true);
    await loadFromCloud();
    updateAccountPill();
    renderPurchaseForm();
    renderAll();
  }
  init();
})();


// Registro do Service Worker para PWA.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=25').catch((error) => {
      console.warn('Service Worker não registrado:', error);
    });
  });
}


/* YR v27 visual helpers */
(function(){
  function syncMobileNav(pageId){
    document.querySelectorAll(".mobile-nav button").forEach(btn=>{
      btn.classList.toggle("active", btn.dataset.target === pageId);
    });
  }

  function createMobileNav(){
    if(document.querySelector(".mobile-nav")) return;
    const nav = document.createElement("nav");
    nav.className = "mobile-nav";
    nav.innerHTML = `
      <button data-target="dashboardPage">⌂<span>Início</span></button>
      <button data-target="invoiceCheckPage">☑<span>Conferir</span></button>
      <button data-target="newPurchasePage">＋<span>Novo</span></button>
      <button data-target="purchasesPage">▣<span>Compras</span></button>
      <button data-target="settingsPage">•••<span>Mais</span></button>
    `;
    document.body.appendChild(nav);
    nav.addEventListener("click", function(event){
      const btn = event.target.closest("button[data-target]");
      if(!btn) return;
      const target = btn.dataset.target;
      if(window.FinCard && typeof window.FinCard.showPage === "function"){
        window.FinCard.showPage(target);
      } else {
        document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active", p.id === target));
      }
      syncMobileNav(target);
    });
  }

  function enhance(){
    createMobileNav();

    const sidebar = document.querySelector(".sidebar");
    const menuBtn = document.getElementById("openMobileMenu");
    if(menuBtn && sidebar && !menuBtn.dataset.yrBound){
      menuBtn.dataset.yrBound = "1";
      menuBtn.addEventListener("click", ()=> sidebar.classList.toggle("open"));
    }

    document.addEventListener("click", function(event){
      if(window.innerWidth > 850) return;
      if(!sidebar || !sidebar.classList.contains("open")) return;
      const inside = event.target.closest(".sidebar");
      const isMenu = event.target.closest("#openMobileMenu");
      if(!inside && !isMenu) sidebar.classList.remove("open");
    });

    const active = document.querySelector(".page.active");
    if(active) syncMobileNav(active.id);

    const observer = new MutationObserver(()=>{
      const activePage = document.querySelector(".page.active");
      if(activePage) syncMobileNav(activePage.id);
    });
    document.querySelectorAll(".page").forEach(p=>observer.observe(p,{attributes:true,attributeFilter:["class"]}));
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", enhance);
  else enhance();
})();
