/* =======================================================
   CARDÁPIO DIGITAL DE PÁSCOA — Lógica de Negócio
   Arquivo: script.js
   
   ÍNDICE:
   1. Estado global
   2. Definições de produtos e sabores
   3. Seleção de sabores (multi e single)
   4. Controle de quantidade — P4 Pirulito
   5. Carrinho (adicionar, remover, renderizar)
   6. Geração e envio via WhatsApp
   7. Navegação entre páginas
   8. Utilitários (toast, formatação)
======================================================= */


// ─────────────────────────────────────────────────────────
// 1. ESTADO GLOBAL
//    Toda mutação de estado passa por aqui.
//    Nunca leia estado do DOM — leia de state.
// ─────────────────────────────────────────────────────────
const state = {
  // Seleções temporárias (resetadas após addToCart)
  p1:       { flavors: [] },    // Ovo Tablete → até 2 sabores
  p2:       { flavors: [] },    // 2 Mini Ovos → até 2 sabores
  'p3-egg': { flavor: null },   // Mini ovo do combo
  'p3-b1':  { flavor: null },   // Brigadeiro 1 do combo
  'p3-b2':  { flavor: null },   // Brigadeiro 2 do combo
  p4:       { qty: 0 },         // Pirulito → apenas quantidade

  cart: [],                     // Itens confirmados no pedido
};


// ─────────────────────────────────────────────────────────
// 2. DEFINIÇÕES DE PRODUTOS E SABORES
// ─────────────────────────────────────────────────────────
const PRODUCTS = {
  p1: { name: 'Ovo Tablete',              weight: '200g',     price: 40, emoji: '🍬',   maxFlavors: 2 },
  p2: { name: '02 Mini Ovos',             weight: '50g cada', price: 24, emoji: '🍬', maxFlavors: 2 },
  p3: { name: 'Mini Ovo + 2 Brigadeiros', weight: 'Combo',    price: 22, emoji: '🍬' },
  p4: { name: 'Pirulito de Chocolate',    weight: 'Unidade',  price: 7,  emoji: '🍭'   },
};

// Nomes amigáveis dos sabores (usados na mensagem do WhatsApp e no carrinho)
const FLAVOR_NAMES = {
  brigadeiro: 'Brigadeiro Tradicional',
  beijinho:   'Beijinho',
  ninho:      'Ninho',
  bicho:      'Bicho de Pé',
};

// IDs dos contadores dos subgrupos do P3
const P3_COUNTER_IDS = {
  'p3-egg': 'p3-egg-counter',
  'p3-b1':  'p3-b1-counter',
  'p3-b2':  'p3-b2-counter',
};


// ─────────────────────────────────────────────────────────
// 3. SELEÇÃO DE SABORES
// ─────────────────────────────────────────────────────────

/**
 * toggleFlavor — Multi-seleção para P1 e P2
 * Regra: ao atingir maxFlavors, botões não selecionados são desabilitados.
 * O cliente não consegue fisicamente selecionar um 3º sabor.
 *
 * @param {string} productId - 'p1' ou 'p2'
 * @param {string} flavor    - chave do sabor (ex: 'brigadeiro')
 * @param {HTMLElement} btn  - botão clicado
 */
function toggleFlavor(productId, flavor, btn) {
  const prod = state[productId];
  const max  = PRODUCTS[productId].maxFlavors;
  const idx  = prod.flavors.indexOf(flavor);

  if (idx === -1) {
    // Adicionar sabor — verificação dupla de segurança
    if (prod.flavors.length >= max) return;
    prod.flavors.push(flavor);
    btn.classList.add('selected');
  } else {
    // Remover sabor já selecionado
    prod.flavors.splice(idx, 1);
    btn.classList.remove('selected');
  }

  _updateMultiFlavorUI(productId);
  _updateAddButton(productId);
}

/**
 * _updateMultiFlavorUI — Atualiza contador, bloqueio de botões e badge de misto
 * Chamado sempre que toggleFlavor é executado.
 */
function _updateMultiFlavorUI(productId) {
  const count  = state[productId].flavors.length;
  const max    = PRODUCTS[productId].maxFlavors;
  const isFull = count >= max;

  // Contador visual (ex: "1/2", "2/2")
  const counter = document.getElementById(`${productId}-counter`);
  if (counter) {
    counter.textContent = `${count}/${max}`;
    counter.classList.toggle('full', isFull);
  }

  // Bloquear botões não selecionados quando o limite foi atingido
  document.querySelectorAll(`[data-product="${productId}"]`).forEach(btn => {
    btn.disabled = isFull && !btn.classList.contains('selected');
  });

  // Badge de "Misto" — aparece só com 2 sabores
  const badge = document.getElementById(`${productId}-misto`);
  if (badge) badge.classList.toggle('visible', count === 2);
}

/**
 * toggleFlavorSingle — Seleção única (comportamento radio) para os subgrupos do P3
 * Permite deselecionar clicando no mesmo item novamente.
 *
 * @param {string} groupId - 'p3-egg', 'p3-b1' ou 'p3-b2'
 * @param {string} flavor  - chave do sabor
 * @param {HTMLElement} btn
 */
function toggleFlavorSingle(groupId, flavor, btn) {
  const group = state[groupId];

  // Limpa seleção visual de todos os botões do grupo
  document.querySelectorAll(`[data-product="${groupId}"]`).forEach(b => b.classList.remove('selected'));

  if (group.flavor === flavor) {
    // Clicou no mesmo → deselecionar (toggle off)
    group.flavor = null;
  } else {
    group.flavor = flavor;
    btn.classList.add('selected');
  }

  // Atualizar contador do subgrupo
  const counterEl = document.getElementById(P3_COUNTER_IDS[groupId]);
  if (counterEl) {
    const has = group.flavor !== null;
    counterEl.textContent = has ? '1/1' : '0/1';
    counterEl.classList.toggle('full', has);
  }

  _updateAddButton('p3');
}

/**
 * _updateAddButton — Habilita ou desabilita o botão "Adicionar ao Pedido"
 * Cada produto tem sua regra própria de validação.
 */
function _updateAddButton(productId) {
  let ready = false;

  if (productId === 'p1') {
    // Pelo menos 1 sabor selecionado
    ready = state.p1.flavors.length >= 1;

  } else if (productId === 'p2') {
    // Pelo menos 1 sabor selecionado
    ready = state.p2.flavors.length >= 1;

  } else if (productId === 'p3') {
    // Todos os 3 subgrupos precisam ter sabor
    ready = state['p3-egg'].flavor !== null
         && state['p3-b1'].flavor  !== null
         && state['p3-b2'].flavor  !== null;

  } else if (productId === 'p4') {
    // Quantidade maior que zero
    ready = state.p4.qty > 0;
  }

  const btn = document.getElementById(`${productId}-btn`);
  if (btn) btn.disabled = !ready;
}


// ─────────────────────────────────────────────────────────
// 4. CONTROLE DE QUANTIDADE — P4 (Pirulito)
// ─────────────────────────────────────────────────────────

/**
 * changeQty — Incrementa ou decrementa a quantidade do pirulito
 * @param {number} delta - +1 para adicionar, -1 para remover
 */
function changeQty(delta) {
  const newQty = state.p4.qty + delta;
  if (newQty < 0) return; // Não permite quantidade negativa

  state.p4.qty = newQty;

  document.getElementById('p4-qty').textContent          = newQty;
  document.getElementById('p4-minus').disabled           = newQty === 0;
  document.getElementById('p4-price').textContent        = _formatPrice(newQty * PRODUCTS.p4.price);

  _updateAddButton('p4');
}


// ─────────────────────────────────────────────────────────
// 5. CARRINHO
// ─────────────────────────────────────────────────────────

/**
 * addToCart — Lê o estado atual, cria o objeto do item e adiciona ao carrinho.
 * Após confirmar, reseta todas as seleções do produto para o estado inicial.
 *
 * @param {string} productId - 'p1', 'p2', 'p3' ou 'p4'
 */
function addToCart(productId) {
  let item = null;

  // ── PRODUTO 1: Ovo Tablete ──────────────────────────
  if (productId === 'p1') {
    const flavors = [...state.p1.flavors];
    const isMisto = flavors.length === 2;
    const description = isMisto
      ? `Misto: ${FLAVOR_NAMES[flavors[0]]} + ${FLAVOR_NAMES[flavors[1]]}`
      : FLAVOR_NAMES[flavors[0]];

    item = {
      id: Date.now(),
      productId: 'p1',
      ...PRODUCTS.p1,
      qty: 1,
      flavors,
      isMisto,
      description,
    };

    // Reset
    state.p1.flavors = [];
    document.querySelectorAll('[data-product="p1"]').forEach(b => {
      b.classList.remove('selected');
      b.disabled = false;
    });
    _updateMultiFlavorUI('p1');
  }

  // ── PRODUTO 2: 2 Mini Ovos ──────────────────────────
  else if (productId === 'p2') {
    const flavors = [...state.p2.flavors];
    const isMisto = flavors.length === 2;
    const description = flavors.length === 1
      ? `Ambos com: ${FLAVOR_NAMES[flavors[0]]}`
      : `Mini Ovo 1: ${FLAVOR_NAMES[flavors[0]]} | Mini Ovo 2: ${FLAVOR_NAMES[flavors[1]]}`;

    item = {
      id: Date.now(),
      productId: 'p2',
      ...PRODUCTS.p2,
      qty: 1,
      flavors,
      isMisto,
      description,
    };

    // Reset
    state.p2.flavors = [];
    document.querySelectorAll('[data-product="p2"]').forEach(b => {
      b.classList.remove('selected');
      b.disabled = false;
    });
    _updateMultiFlavorUI('p2');
  }

  // ── PRODUTO 3: Mini Ovo + 2 Brigadeiros ────────────
  else if (productId === 'p3') {
    const egg = state['p3-egg'].flavor;
    const b1  = state['p3-b1'].flavor;
    const b2  = state['p3-b2'].flavor;

    item = {
      id: Date.now(),
      productId: 'p3',
      ...PRODUCTS.p3,
      qty: 1,
      flavors: [egg, b1, b2],
      description: `Mini Ovo: ${FLAVOR_NAMES[egg]} | Brigadeiro 1: ${FLAVOR_NAMES[b1]} | Brigadeiro 2: ${FLAVOR_NAMES[b2]}`,
    };

    // Reset P3
    state['p3-egg'].flavor = null;
    state['p3-b1'].flavor  = null;
    state['p3-b2'].flavor  = null;

    ['p3-egg', 'p3-b1', 'p3-b2'].forEach(groupId => {
      document.querySelectorAll(`[data-product="${groupId}"]`).forEach(b => b.classList.remove('selected'));
      const counterEl = document.getElementById(P3_COUNTER_IDS[groupId]);
      if (counterEl) { counterEl.textContent = '0/1'; counterEl.classList.remove('full'); }
    });
  }

  // ── PRODUTO 4: Pirulito ─────────────────────────────
  else if (productId === 'p4') {
    const qty = state.p4.qty;

    item = {
      id: Date.now(),
      productId: 'p4',
      ...PRODUCTS.p4,
      qty,
      description: `${qty} unidade${qty > 1 ? 's' : ''}`,
    };

    // Reset P4
    state.p4.qty = 0;
    document.getElementById('p4-qty').textContent   = '0';
    document.getElementById('p4-minus').disabled    = true;
    document.getElementById('p4-price').textContent = 'R$ 0,00';
  }

  // Adiciona e atualiza a UI
  if (item) {
    state.cart.push(item);
    _updateAddButton(productId);
    _updateCartBadge();
    _renderCartPage();
    showToast('✅ Adicionado ao pedido!');
  }
}

/**
 * removeFromCart — Remove um item pelo id único
 * @param {number} itemId
 */
function removeFromCart(itemId) {
  state.cart = state.cart.filter(i => i.id !== itemId);
  _updateCartBadge();
  _renderCartPage();
  showToast('🗑️ Item removido.');
}

/** Retorna o valor total do carrinho */
function _getCartTotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/** Atualiza o badge numérico na aba "Meu Pedido" */
function _updateCartBadge() {
  const count = state.cart.length;
  const badge = document.getElementById('cart-badge');
  badge.textContent  = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

/** Renderiza a lista de itens na página do carrinho */
function _renderCartPage() {
  const container    = document.getElementById('cart-items-container');
  const totalSection = document.getElementById('cart-total-section');

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧺</div>
        <p>Nenhum item ainda.<br>Volte ao cardápio e adicione produtos!</p>
      </div>`;
    totalSection.style.display = 'none';
    return;
  }

  container.innerHTML = state.cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-icon">${item.emoji}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">
          ${item.name}${item.qty > 1 ? ` × ${item.qty}` : ''}
        </div>
        <div class="cart-item-details">
          ${item.description || ''}
          ${item.isMisto ? ' &nbsp;<strong style="color:#d4a017;font-size:.75rem">✨ Misto</strong>' : ''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.4rem">
        <div class="cart-item-price">${_formatPrice(item.price * item.qty)}</div>
        <button class="btn-remove" onclick="removeFromCart(${item.id})" aria-label="Remover item">🗑️</button>
      </div>
    </div>
  `).join('');

  const total = _getCartTotal();
  document.getElementById('summary-subtotal').textContent = _formatPrice(total);
  document.getElementById('summary-total').textContent    = _formatPrice(total);
  totalSection.style.display = 'block';
}


// ─────────────────────────────────────────────────────────
// 6. WHATSAPP
// ─────────────────────────────────────────────────────────

/**
 * sendWhatsApp — Valida o pedido, monta a mensagem formatada e abre o WhatsApp.
 *
 * ⚠️ IMPORTANTE: Altere STORE_PHONE para o número real da doceria.
 * Formato: 55 + DDD + número, sem espaços ou caracteres especiais.
 * Exemplo: '5511987654321'
 */
function sendWhatsApp() {
  const name  = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();

  // Validações antes de montar a mensagem
  if (!name) {
    showToast('⚠️ Por favor, informe seu nome!');
    document.getElementById('customer-name').focus();
    return;
  }
  if (state.cart.length === 0) {
    showToast('⚠️ Seu pedido está vazio!');
    return;
  }

  // ── ALTERE AQUI ──────────────────────────────────────
  const STORE_PHONE = '5519997125214'; 
  // ─────────────────────────────────────────────────────

  const now     = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Montar mensagem
  let msg = `🐣 *PEDIDO DE PÁSCOA* 🍫\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg    += `👤 *Cliente:* ${name}\n`;
  if (phone) msg += `📱 *Telefone:* ${phone}\n`;
  msg    += `📅 *Data:* ${dateStr}\n`;
  msg    += `🕐 *Horário:* ${timeStr}\n`;
  msg    += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg    += `🛒 *ITENS DO PEDIDO:*\n\n`;

  state.cart.forEach((item, i) => {
    msg += `${i + 1}. ${item.emoji} *${item.name}*`;
    if (item.qty > 1) msg += ` × ${item.qty}`;
    msg += `\n`;
    if (item.description) msg += `   ↳ ${item.description}\n`;
    if (item.isMisto)      msg += `   ↳ ✨ *Ovo Misto*\n`;
    msg += `   ↳ Valor: *${_formatPrice(item.price * item.qty)}*\n\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *TOTAL: ${_formatPrice(_getCartTotal())}*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `_Pedido feito pelo Cardápio Digital_ 🌷`;

  const url = `https://wa.me/${STORE_PHONE}?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}


// ─────────────────────────────────────────────────────────
// 7. NAVEGAÇÃO ENTRE PÁGINAS
// ─────────────────────────────────────────────────────────

/**
 * showPage — Alterna entre as páginas "Cardápio" e "Meu Pedido"
 * @param {string} page - 'menu' ou 'cart'
 */
function showPage(page) {
  document.getElementById('page-menu').classList.toggle('active', page === 'menu');
  document.getElementById('page-cart').classList.toggle('active', page === 'cart');
  document.getElementById('tab-menu').classList.toggle('active',  page === 'menu');
  document.getElementById('tab-cart').classList.toggle('active',  page === 'cart');

  // Sempre re-renderiza ao entrar na página do carrinho
  if (page === 'cart') _renderCartPage();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}


// ─────────────────────────────────────────────────────────
// 8. UTILITÁRIOS
// ─────────────────────────────────────────────────────────

/** Timer do toast para evitar sobreposição */
let _toastTimer;

/**
 * showToast — Exibe uma notificação flutuante temporária
 * @param {string} msg - Texto da notificação
 */
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/**
 * _formatPrice — Formata um número como moeda brasileira
 * @param {number} value
 * @returns {string} ex: "R$ 40,00"
 */
function _formatPrice(value) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}