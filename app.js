const API_BASE = "http://localhost:8080/api/v1";
const CUSTOMER_ID = "5f7b9b42-1bb4-4f6f-80de-b671f1c28a32";

const demoTemplate = {
  wallets: [
    { id: "eur", currency: "EUR", balance: "18420.75", change_24h: "1.24", deposit_address: "iban-demo-eu-0842" },
    { id: "usdc", currency: "USDC", balance: "6250.40", change_24h: "0.18", deposit_address: "0xD0f7A1a0E8B92899C4C3f1d1a0a71bF277bC0842" },
    { id: "usdt", currency: "USDT", balance: "3920.00", change_24h: "-0.06", deposit_address: "0x8f1E7d1E1f0a6F2A780C44a79590Dba2F5aC9999" }
  ],
  cards: [
    {
      id: "5d43d02c-9189-48bc-88ff-668a4a6f0842",
      display_name: "Black Reserve",
      holder_name: "ALEX MORGAN",
      network: "visa",
      last4: "0842",
      masked_pan: "4242 42** **** 0842",
      expiry_month: 12,
      expiry_year: 2030,
      status: "active",
      apple_pay_ready: true,
      virtual: true,
      design_theme: "obsidian-teal",
      limits: { daily: "5000", monthly: "50000", atm: "1000", online: true, contactless: true }
    }
  ],
  transactions: [
    { id: "t1", merchant: "Maison Noir", category: "Dining", amount: "-186.40", currency: "EUR", status: "settled", occurred_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() },
    { id: "t2", merchant: "Apple Services", category: "Digital", amount: "-29.99", currency: "EUR", status: "settled", occurred_at: new Date(Date.now() - 7 * 3600 * 1000).toISOString() },
    { id: "t3", merchant: "USDC Deposit", category: "Deposit", amount: "1250.00", currency: "USDC", status: "confirmed", occurred_at: new Date(Date.now() - 16 * 3600 * 1000).toISOString() },
    { id: "t4", merchant: "Zurich Hotels", category: "Travel", amount: "-620.00", currency: "EUR", status: "settled", occurred_at: new Date(Date.now() - 28 * 3600 * 1000).toISOString() },
    { id: "t5", merchant: "Tether Deposit", category: "Deposit", amount: "900.00", currency: "USDT", status: "confirmed", occurred_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString() }
  ]
};

const signedOutDashboard = {
  wallets: [
    { id: "eur", currency: "EUR", balance: "0.00", change_24h: "0.00", deposit_address: "" },
    { id: "usdc", currency: "USDC", balance: "0.00", change_24h: "0.00", deposit_address: "" },
    { id: "usdt", currency: "USDT", balance: "0.00", change_24h: "0.00", deposit_address: "" }
  ],
  cards: [],
  transactions: []
};

const signedOutCard = {
  id: "signed-out",
  display_name: "Add card",
  holder_name: "NO CARD LINKED",
  network: "visa",
  last4: "0000",
  masked_pan: "Click to add your card",
  expiry_month: 0,
  expiry_year: 0,
  status: "locked",
  apple_pay_ready: false,
  virtual: true,
  design_theme: "private",
  limits: { daily: "0", monthly: "0", atm: "0", online: false, contactless: false }
};

const marketConfig = {
  exchanges: ["Binance", "Coinbase", "Kraken", "OKX", "Bitstamp"],
  bases: ["BTC", "ETH", "SOL", "EUR", "USD", "GBP", "CHF", "USDC", "USDT"],
  quotes: ["EUR", "USD", "USDC", "USDT", "GBP", "CHF"],
  usdValue: {
    BTC: 64280,
    ETH: 3484,
    SOL: 151.4,
    EUR: 1.085,
    USD: 1,
    GBP: 1.274,
    CHF: 1.118,
    USDC: 1,
    USDT: 0.999
  },
  exchangeBias: {
    Binance: 1.0008,
    Coinbase: 1.0021,
    Kraken: 0.9993,
    OKX: 0.9988,
    Bitstamp: 1.0014
  }
};

const state = {
  dashboard: cloneDashboard(signedOutDashboard),
  selectedCurrency: "USDC",
  activeView: "home",
  toastTimer: null,
  userId: null,
  dashboardLoading: false,
  pendingDeposit: null,
  account: loadAccount(),
  markets: {
    watchlist: loadMarketWatchlist(),
    autoRefresh: true,
    timer: null
  }
};

const money = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

document.addEventListener("DOMContentLoaded", () => {
  bindFirebaseAuth();
  bindNavigation();
  bindModals();
  bindActions();
  initMarkets();
  render();
  startMarketTicker();
});

function bindNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });
  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.viewJump));
  });
}

function bindModals() {
  document.querySelectorAll("[data-open-deposit]").forEach((button) => {
    button.addEventListener("click", () => document.querySelector("#deposit-modal").showModal());
  });
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelector("#home-card").addEventListener("click", openCardModal);
  document.querySelector("#card-detail-trigger").addEventListener("click", openCardModal);
  document.querySelector("#profile-launcher").addEventListener("click", openProfileModal);
  document.querySelector("#sidebar-profile").addEventListener("click", openProfileModal);
}

function bindActions() {
  document.querySelector("#refresh-button").addEventListener("click", loadDashboard);
  document.querySelector("#issue-from-home").addEventListener("click", issueCard);
  document.querySelector("#issue-card").addEventListener("click", issueCard);
  document.querySelector("#card-form").addEventListener("submit", addCardFromForm);
  bindCardInputFormatting();
  document.querySelector("#lock-card").addEventListener("click", toggleLock);
  document.querySelector("#apple-pay").addEventListener("click", () => {
    if (state.dashboard.cards.length === 0) {
      focusCardForm();
      toast("Add a card before Apple Pay.");
      return;
    }
    pulse(document.querySelector("#apple-pay"));
    toast("Apple Pay provisioning request prepared.");
  });
  document.querySelectorAll("[data-currency]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedCurrency = button.dataset.currency;
      document.querySelectorAll("[data-currency]").forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  document.querySelector("#generate-deposit").addEventListener("click", generateDeposit);
  document.querySelector("#confirm-qr-deposit").addEventListener("click", confirmQrDeposit);
  document.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", () => signIn(button.dataset.authProvider));
  });
  document.querySelector("#email-auth-form").addEventListener("submit", sendEmailSignInLink);
  document.querySelector("#logout-button").addEventListener("click", signOut);
  document.querySelector("#add-market").addEventListener("click", addMarketFromControls);
  document.querySelector("#toggle-market-refresh").addEventListener("click", toggleMarketRefresh);
  ["#market-exchange", "#market-base", "#market-quote"].forEach((selector) => {
    document.querySelector(selector).addEventListener("change", renderMarkets);
  });
}

async function loadDashboard() {
  const refresh = document.querySelector("#refresh-button");
  refresh.classList.add("is-loading");
  try {
    await loadPersonalDashboard();
  } finally {
    refresh.classList.remove("is-loading");
    render();
  }
}

async function issueCard() {
  focusCardForm();
}

async function addCardFromForm(event) {
  event.preventDefault();
  const cardNumber = document.querySelector("#new-card-number").value.trim();
  const network = document.querySelector("#new-card-network").value;
  const expiry = document.querySelector("#new-card-expiry").value.trim();
  const cvc = document.querySelector("#new-card-cvc").value.trim();
  const normalizedNumber = cardNumber.replace(/\D/g, "");
  const parsedExpiry = parseExpiry(expiry);
  const detectedNetwork = detectCardNetwork(normalizedNumber);

  if (!isValidCardNumber(normalizedNumber) || !parsedExpiry || !isValidCvc(cvc, detectedNetwork)) {
    toast("Enter a valid card number, expiry and CVC.");
    return;
  }

  const finalNetwork = detectedNetwork || network;
  const last4 = normalizedNumber.slice(-4);
  const displayName = `${networkLabel(finalNetwork)} • ${last4}`;
  await createCard({
    displayName,
    holderName: "LINKED CARD",
    network: finalNetwork,
    dailyLimit: "1000",
    normalizedNumber,
    expiry: parsedExpiry
  });
  event.target.reset();
}

async function createCard({ displayName, holderName, network, dailyLimit, normalizedNumber, expiry }) {
  if (!requireAccount()) return;
  const last4 = normalizedNumber.slice(-4);
  const card = {
    ...demoTemplate.cards[0],
    id: createID(),
    display_name: displayName,
    holder_name: holderName,
    network,
    limits: { ...demoTemplate.cards[0].limits, daily: dailyLimit },
    last4,
    masked_pan: maskCardNumber(normalizedNumber),
    expiry_month: expiry.month,
    expiry_year: expiry.year,
    status: "active",
    apple_pay_ready: false,
    design_theme: "linked-card"
  };
  state.dashboard.cards.unshift(card);
  addTransaction({
    merchant: `${displayName} issued`,
    category: "Card",
    amount: "0.00",
    currency: "EUR",
    status: "created"
  });
  await savePersonalDashboard();
  showView("card");
  render();
  toast(`${displayName} card linked.`);
}

async function toggleLock() {
  if (!requireAccount()) return;
  if (state.dashboard.cards.length === 0) {
    focusCardForm();
    toast("Add a card before changing card status.");
    return;
  }
  const card = primaryCard();
  const shouldLock = card.status === "active";
  card.status = shouldLock ? "locked" : "active";
  replaceCard(card);
  addTransaction({
    merchant: `${card.display_name} ${shouldLock ? "locked" : "unlocked"}`,
    category: "Security",
    amount: "0.00",
    currency: "EUR",
    status: shouldLock ? "locked" : "active"
  });
  await savePersonalDashboard();
  render();
  toast(card.status === "active" ? "Card unlocked." : "Card locked.");
}

async function generateDeposit() {
  if (!requireAccount()) return;
  const amount = document.querySelector("#deposit-amount").value || "0";
  const service = document.querySelector("#deposit-service").value;
  const error = document.querySelector("#deposit-error");
  if (Number(amount) <= 0) {
    error.hidden = false;
    return;
  }
  error.hidden = true;
  const wallet = ensureWallet(state.selectedCurrency);
  const quote = {
    network: depositNetwork(service, state.selectedCurrency),
    address: wallet.deposit_address,
    qr_payload: `${state.selectedCurrency}:${wallet.deposit_address}?amount=${amount}&service=${encodeURIComponent(service)}`
  };
  state.pendingDeposit = {
    amount: Number(amount).toFixed(2),
    currency: state.selectedCurrency,
    service,
    address: quote.address,
    network: quote.network,
    payload: quote.qr_payload
  };
  renderDepositQr(quote.qr_payload);

  document.querySelector("#qr-card").hidden = false;
  document.querySelector("#deposit-network").textContent = `${quote.network} / ${service}`;
  document.querySelector("#deposit-address").textContent = quote.address;
  toast(`QR code ready for ${state.selectedCurrency} deposit.`);
}

async function confirmQrDeposit() {
  if (!requireAccount() || !state.pendingDeposit) {
    toast("Generate a deposit QR first.");
    return;
  }
  const wallet = ensureWallet(state.pendingDeposit.currency);
  wallet.balance = (Number(wallet.balance) + Number(state.pendingDeposit.amount)).toFixed(2);
  addTransaction({
    merchant: state.pendingDeposit.service,
    category: "Deposit",
    amount: state.pendingDeposit.amount,
    currency: state.pendingDeposit.currency,
    status: "confirmed"
  });
  await savePersonalDashboard();
  render();
  toast(`${state.pendingDeposit.currency} balance topped up.`);
  state.pendingDeposit = null;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Customer-ID": CUSTOMER_ID
    },
    ...options
  });
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}

function showView(view) {
  state.activeView = view;
  document.querySelectorAll(".view").forEach((section) => section.classList.toggle("is-active", section.id === `${view}-view`));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === view));
  document.querySelector("#view-title").textContent = view === "card" ? "Card" : view === "transactions" ? "Transactions" : view === "markets" ? "Markets" : "Home";
}

function render() {
  const card = primaryCard();
  const eur = wallet("EUR");

  document.querySelector("#eur-balance").textContent = money.format(Number(eur.balance));
  renderChange("#eur-change", eur.change_24h);

  fillCard("", card);
  fillCard("detail-", card);
  renderWallets();
  renderLimits(card);
  renderCardStack();
  renderTransactions();
  renderCardStatus(card);
  renderCardInfo(card);
  renderAccount();
  renderMarkets();
}

function fillCard(prefix, card) {
  const empty = state.dashboard.cards.length === 0;
  const element = document.querySelector(`#${prefix ? "card-detail-trigger" : "home-card"}`);
  element?.classList.toggle("is-empty", empty);
  document.querySelector(`#${prefix}card-name`).textContent = card.display_name;
  document.querySelector(`#${prefix}card-number`).textContent = card.masked_pan;
  document.querySelector(`#${prefix}card-holder`).textContent = card.holder_name;
  document.querySelector(`#${prefix}card-expiry`).textContent = card.expiry_month ? `${String(card.expiry_month).padStart(2, "0")}/${String(card.expiry_year).slice(-2)}` : "--/--";
}

function renderWallets() {
  const html = state.dashboard.wallets.map((item) => `
    <article class="wallet">
      <span class="muted">${item.currency}</span>
      <strong>${item.currency === "EUR" ? money.format(Number(item.balance)) : `${number.format(Number(item.balance))} ${item.currency}`}</strong>
      <small class="${Number(item.change_24h) < 0 ? "negative" : "positive"}">${signed(item.change_24h)}% 24h</small>
    </article>
  `).join("");
  document.querySelector("#wallet-strip").innerHTML = html;
}

function renderLimits(card) {
  const limits = [
    ["Daily", money.format(Number(card.limits.daily))],
    ["Monthly", money.format(Number(card.limits.monthly))],
    ["ATM", money.format(Number(card.limits.atm))],
    ["Online", card.limits.online ? "Enabled" : "Disabled"],
    ["Contactless", card.limits.contactless ? "Enabled" : "Disabled"],
    ["Apple Pay", card.apple_pay_ready ? "Ready" : "Pending"]
  ];
  document.querySelector("#limits").innerHTML = limits.map(([label, value]) => `
    <article class="limit">
      <span class="muted">${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function renderCardStack() {
  document.querySelector("#card-count").textContent = `${state.dashboard.cards.length} ${state.dashboard.cards.length === 1 ? "card" : "cards"}`;
  if (state.dashboard.cards.length === 0) {
    document.querySelector("#card-stack").innerHTML = `
      <article class="empty-state">
        <strong>No personal cards yet</strong>
        <button class="inline-link" id="empty-add-card" type="button">Add card</button>
        <small>Link your own card to create a private card stack.</small>
      </article>
    `;
    document.querySelector("#empty-add-card").addEventListener("click", focusCardForm);
    return;
  }
  document.querySelector("#card-stack").innerHTML = state.dashboard.cards.map((card, index) => `
    <button class="stack-card ${index === 0 ? "is-primary" : ""}" type="button" data-card-id="${card.id}">
      <span>
        <strong>${card.display_name}</strong>
        <small>${card.masked_pan} / ${card.holder_name}</small>
      </span>
      <span class="network">${card.network}</span>
      <span class="${card.status === "active" ? "positive" : "negative"}">${card.status}</span>
    </button>
  `).join("");
  document.querySelectorAll("[data-card-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = state.dashboard.cards.find((item) => item.id === button.dataset.cardId);
      if (!card) return;
      state.dashboard.cards = [card, ...state.dashboard.cards.filter((item) => item.id !== card.id)];
      savePersonalDashboard();
      render();
      toast(`${card.display_name} selected.`);
    });
  });
}

function renderTransactions() {
  const latest = state.dashboard.transactions.slice(0, 4);
  const empty = `<article class="empty-state"><strong>No personal transactions yet</strong><small>Your private account history will appear here after deposits and card actions.</small></article>`;
  document.querySelector("#latest-transactions").innerHTML = latest.length ? latest.map(transactionMarkup).join("") : empty;
  document.querySelector("#transactions").innerHTML = state.dashboard.transactions.length ? state.dashboard.transactions.map(transactionMarkup).join("") : empty;
  document.querySelector("#tx-count").textContent = `${state.dashboard.transactions.length} records`;
}

function renderCardStatus(card) {
  const badge = document.querySelector("#card-status");
  badge.textContent = card.status === "active" ? "Active" : "Locked";
  badge.style.color = card.status === "active" ? "var(--success)" : "var(--danger)";
  document.querySelector("#lock-card span").textContent = card.status === "active" ? "Lock Card" : "Unlock Card";
}

function renderCardInfo(card) {
  const info = [
    ["Display name", card.display_name],
    ["Network", card.network.toUpperCase()],
    ["Masked PAN", card.masked_pan],
    ["Holder", card.holder_name],
    ["Status", card.status],
    ["Virtual", card.virtual ? "Yes" : "No"],
    ["Theme", card.design_theme],
    ["Last 4", card.last4]
  ];
  document.querySelector("#card-info").innerHTML = info.map(([label, value]) => `
    <article class="info">
      <span class="muted">${label}</span>
      <strong>${value}</strong>
    </article>
  `).join("");
}

function transactionMarkup(tx) {
  const amount = Number(tx.amount);
  return `
    <article class="transaction">
      <span class="tx-icon">${amount < 0 ? "UP" : "IN"}</span>
      <div>
        <strong>${tx.merchant}</strong>
        <small>${tx.category} / ${new Date(tx.occurred_at).toLocaleString()}</small>
      </div>
      <span class="tx-amount ${amount < 0 ? "negative" : "positive"}">${amount < 0 ? "-" : "+"}${number.format(Math.abs(amount))} ${tx.currency}</span>
    </article>
  `;
}

function openCardModal() {
  if (state.dashboard.cards.length === 0) {
    focusCardForm();
    return;
  }
  renderCardInfo(primaryCard());
  document.querySelector("#card-modal").showModal();
}

function openProfileModal() {
  renderAccount();
  document.querySelector("#profile-modal").showModal();
}

function primaryCard() {
  return state.dashboard.cards[0] || signedOutCard;
}

function replaceCard(card) {
  state.dashboard.cards = state.dashboard.cards.map((item) => item.id === card.id ? card : item);
}

function wallet(currency) {
  return state.dashboard.wallets.find((item) => item.currency === currency) || signedOutDashboard.wallets[0];
}

function focusCardForm() {
  if (!requireAccount()) return;
  showView("card");
  const form = document.querySelector("#add-card-desk");
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => document.querySelector("#new-card-number").focus(), 320);
}

function bindCardInputFormatting() {
  const numberInput = document.querySelector("#new-card-number");
  const expiryInput = document.querySelector("#new-card-expiry");
  const cvcInput = document.querySelector("#new-card-cvc");
  const networkSelect = document.querySelector("#new-card-network");

  numberInput.addEventListener("input", () => {
    const digits = numberInput.value.replace(/\D/g, "").slice(0, 19);
    numberInput.value = formatCardNumber(digits);
    const network = detectCardNetwork(digits);
    if (network && [...networkSelect.options].some((option) => option.value === network)) {
      networkSelect.value = network;
    }
  });

  expiryInput.addEventListener("input", () => {
    const digits = expiryInput.value.replace(/\D/g, "").slice(0, 4);
    expiryInput.value = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
  });

  cvcInput.addEventListener("input", () => {
    cvcInput.value = cvcInput.value.replace(/\D/g, "").slice(0, 4);
  });
}

function formatCardNumber(digits) {
  const network = detectCardNetwork(digits);
  if (network === "amex") {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(" ");
  }
  return digits.match(/.{1,4}/g)?.join(" ") || "";
}

function maskCardNumber(value) {
  const digits = value.replace(/\D/g, "");
  if (detectCardNetwork(digits) === "amex") {
    return `${digits.slice(0, 4)} ${digits.slice(4, 6)}**** ***** ${digits.slice(-4)}`;
  }
  const first = digits.slice(0, 4);
  const second = digits.slice(4, 6).padEnd(2, "*");
  const last4 = digits.slice(-4);
  return `${first} ${second}** **** ${last4}`;
}

function detectCardNetwork(digits) {
  if (/^4\d{12,18}$/.test(digits)) return "visa";
  if (/^(5[1-5]\d{14}|2(2[2-9]\d|[3-6]\d{2}|7[01]\d|720)\d{12})$/.test(digits)) return "mastercard";
  if (/^3[47]\d{13}$/.test(digits)) return "amex";
  return "";
}

function isValidCardNumber(digits) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  if (!detectCardNetwork(digits)) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function isValidCvc(value, network) {
  const digits = value.replace(/\D/g, "");
  return network === "amex" ? /^\d{4}$/.test(digits) : /^\d{3}$/.test(digits);
}

function networkLabel(network) {
  return {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "Amex"
  }[network] || "Card";
}

function parseExpiry(value) {
  const match = value.match(/^(\d{1,2})\s*\/?\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2].length === 2 ? `20${match[2]}` : match[2]);
  if (month < 1 || month > 12) return null;
  const now = new Date();
  const expiryDate = new Date(year, month, 0, 23, 59, 59);
  if (expiryDate < now) return null;
  return { month, year };
}

function ensureWallet(currency) {
  const existing = state.dashboard.wallets.find((item) => item.currency === currency);
  if (existing) return existing;
  const seed = hashString(`${state.userId || "guest"}${currency}`);
  const wallet = {
    id: `${currency.toLowerCase()}-${String(seed).slice(-6)}`,
    currency,
    balance: "0.00",
    change_24h: "0.00",
    deposit_address: currency === "EUR" ? `iban-private-eu-${String(seed).slice(-6)}` : `0x${privateHex(seed, 40)}`
  };
  state.dashboard.wallets.push(wallet);
  return wallet;
}

function depositNetwork(service, currency) {
  if (currency === "EUR") return "SEPA / IBAN";
  if (service === "Binance Pay") return "Binance Pay";
  if (service === "Coinbase Pay") return "Coinbase Pay";
  return currency === "USDT" ? "TRC20 / Ethereum" : "Ethereum";
}

function renderDepositQr(payload) {
  const canvas = document.querySelector("#deposit-qr");
  if (window.QRCode?.toCanvas) {
    window.QRCode.toCanvas(canvas, payload, {
      width: 164,
      margin: 1,
      color: {
        dark: "#062220",
        light: "#e9fffd"
      }
    }, () => {});
    return;
  }

  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cells = 29;
  const cell = size / cells;
  const seed = hashString(payload);
  ctx.fillStyle = "#e9fffd";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#062220";

  drawFinder(ctx, 2, 2, cell);
  drawFinder(ctx, cells - 9, 2, cell);
  drawFinder(ctx, 2, cells - 9, cell);

  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const inFinder = (x < 10 && y < 10) || (x > cells - 11 && y < 10) || (x < 10 && y > cells - 11);
      if (inFinder) continue;
      const bit = hashString(`${payload}-${seed}-${x}-${y}`) % 5;
      if (bit < 2) ctx.fillRect(Math.floor(x * cell), Math.floor(y * cell), Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function drawFinder(ctx, x, y, cell) {
  ctx.fillRect(x * cell, y * cell, 7 * cell, 7 * cell);
  ctx.fillStyle = "#e9fffd";
  ctx.fillRect((x + 1) * cell, (y + 1) * cell, 5 * cell, 5 * cell);
  ctx.fillStyle = "#062220";
  ctx.fillRect((x + 2) * cell, (y + 2) * cell, 3 * cell, 3 * cell);
}

function renderChange(selector, value) {
  const element = document.querySelector(selector);
  element.textContent = `${signed(value)}% 24h`;
  element.classList.toggle("negative", Number(value) < 0);
  element.classList.toggle("positive", Number(value) >= 0);
}

function signed(value) {
  const numeric = Number(value);
  return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}`;
}

function pulse(element) {
  element.animate(
    [{ transform: "scale(1)" }, { transform: "scale(0.97)" }, { transform: "scale(1)" }],
    { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
  );
}

function createID() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `card-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message;
  element.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove("is-visible"), 2600);
}

function initMarkets() {
  fillSelect("#market-exchange", marketConfig.exchanges);
  fillSelect("#market-base", marketConfig.bases);
  fillSelect("#market-quote", marketConfig.quotes);
  document.querySelector("#market-exchange").value = "Binance";
  document.querySelector("#market-base").value = "BTC";
  document.querySelector("#market-quote").value = "EUR";
  if (state.markets.watchlist.length === 0) {
    state.markets.watchlist = [
      createMarket("Binance", "BTC", "EUR"),
      createMarket("Coinbase", "ETH", "USDC"),
      createMarket("Kraken", "EUR", "USD"),
      createMarket("OKX", "SOL", "USDT")
    ];
  }
}

function fillSelect(selector, values) {
  document.querySelector(selector).innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function addMarketFromControls() {
  const exchange = document.querySelector("#market-exchange").value;
  const base = document.querySelector("#market-base").value;
  const quote = document.querySelector("#market-quote").value;
  if (base === quote) {
    toast("Choose different base and quote currencies.");
    return;
  }
  const exists = state.markets.watchlist.some((item) => item.exchange === exchange && item.base === base && item.quote === quote);
  if (exists) {
    toast(`${base}/${quote} on ${exchange} is already tracked.`);
    return;
  }
  state.markets.watchlist.unshift(createMarket(exchange, base, quote));
  saveMarketWatchlist();
  renderMarkets();
  toast(`${base}/${quote} added from ${exchange}.`);
}

function createMarket(exchange, base, quote) {
  const price = marketPrice(exchange, base, quote);
  const history = Array.from({ length: 18 }, (_, index) => price * (1 + Math.sin(index * 0.72) * 0.004 + (index - 9) * 0.00018));
  return {
    id: `${exchange}-${base}-${quote}-${createID()}`,
    exchange,
    base,
    quote,
    price,
    previous: price * 0.997,
    history,
    updatedAt: Date.now()
  };
}

function marketPrice(exchange, base, quote) {
  const baseUSD = marketConfig.usdValue[base] || 1;
  const quoteUSD = marketConfig.usdValue[quote] || 1;
  const bias = marketConfig.exchangeBias[exchange] || 1;
  const wave = Math.sin(Date.now() / 9000 + `${exchange}${base}${quote}`.length) * 0.0028;
  return baseUSD / quoteUSD * bias * (1 + wave);
}

function updateMarketPrices() {
  state.markets.watchlist = state.markets.watchlist.map((item) => {
    const next = marketPrice(item.exchange, item.base, item.quote);
    const blended = item.price * 0.72 + next * 0.28;
    const history = [...item.history.slice(-23), blended];
    return {
      ...item,
      previous: item.price,
      price: blended,
      history,
      updatedAt: Date.now()
    };
  });
  saveMarketWatchlist();
  renderMarkets();
}

function renderMarkets() {
  const count = state.markets.watchlist.length;
  document.querySelector("#market-count").textContent = `${count} ${count === 1 ? "pair" : "pairs"}`;
  document.querySelector("#market-status").textContent = state.markets.autoRefresh ? "Auto refresh on" : "Updates paused";
  document.querySelector("#toggle-market-refresh").textContent = state.markets.autoRefresh ? "Pause updates" : "Resume updates";
  document.querySelector("#market-clock").textContent = new Date().toLocaleTimeString([], { hour12: false });

  document.querySelector("#market-watchlist").innerHTML = state.markets.watchlist.map((item) => {
    const change = ((item.price - item.previous) / item.previous) * 100;
    return `
      <article class="market-card">
        <div class="market-card-head">
          <strong>${item.base} / ${item.quote}</strong>
          <span class="exchange-label">${item.exchange}</span>
        </div>
        <div class="market-price">${formatRate(item.price, item.quote)}</div>
        <div class="market-card-foot">
          <span class="market-meta-line">
            <span class="${change >= 0 ? "positive" : "negative"}">${change >= 0 ? "+" : ""}${change.toFixed(2)}%</span>
            <span class="muted">${new Date(item.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
          </span>
          <button class="text-button" data-remove-market="${item.id}" type="button">Remove</button>
        </div>
        ${sparkline(item.history)}
      </article>
    `;
  }).join("");

  document.querySelectorAll("[data-remove-market]").forEach((button) => {
    button.addEventListener("click", () => {
      state.markets.watchlist = state.markets.watchlist.filter((item) => item.id !== button.dataset.removeMarket);
      saveMarketWatchlist();
      renderMarkets();
      toast("Pair removed from watchlist.");
    });
  });

  renderExchangeComparison();
}

function renderExchangeComparison() {
  const base = document.querySelector("#market-base")?.value || "BTC";
  const quote = document.querySelector("#market-quote")?.value || "EUR";
  document.querySelector("#comparison-pair").textContent = `${base} / ${quote}`;
  const rows = marketConfig.exchanges.map((exchange) => ({
    exchange,
    price: marketPrice(exchange, base, quote)
  }));
  const best = Math.min(...rows.map((row) => row.price));
  const worst = Math.max(...rows.map((row) => row.price));
  document.querySelector("#exchange-table").innerHTML = rows.map((row) => {
    const spread = ((row.price - best) / best) * 100;
    const marker = row.price === best ? "Best" : row.price === worst ? "Wide" : `${spread.toFixed(2)}%`;
    return `
      <div class="exchange-row">
        <strong>${row.exchange}</strong>
        <span>${formatRate(row.price, quote)}</span>
        <span class="${row.price === best ? "positive" : "muted"}">${marker}</span>
      </div>
    `;
  }).join("");
}

function sparkline(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 220;
  const height = 42;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - ((value - min) / Math.max(max - min, 0.000001)) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" aria-hidden="true"><path d="M ${points.join(" L ")}"></path></svg>`;
}

function formatRate(value, quote) {
  if (["EUR", "USD", "GBP", "CHF"].includes(quote)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: quote,
      maximumFractionDigits: value > 100 ? 2 : 5
    }).format(value);
  }
  return `${number.format(value)}\u00A0${quote}`;
}

function toggleMarketRefresh() {
  state.markets.autoRefresh = !state.markets.autoRefresh;
  renderMarkets();
  toast(state.markets.autoRefresh ? "Market updates resumed." : "Market updates paused.");
}

function startMarketTicker() {
  state.markets.timer = setInterval(() => {
    if (state.markets.autoRefresh) {
      updateMarketPrices();
    } else {
      document.querySelector("#market-clock").textContent = new Date().toLocaleTimeString([], { hour12: false });
    }
  }, 3500);
}

function loadMarketWatchlist() {
  try {
    const saved = localStorage.getItem("luxdebit-markets");
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveMarketWatchlist() {
  try {
    localStorage.setItem("luxdebit-markets", JSON.stringify(state.markets.watchlist));
  } catch {}
}

async function signIn(provider) {
  if (provider === "Email") {
    const form = document.querySelector("#email-auth-form");
    form.hidden = false;
    requestAnimationFrame(() => form.classList.add("is-visible"));
    document.querySelector("#auth-email").focus();
    return;
  }

  if (!window.luxDebitAuth?.ready) {
    toast("Firebase is still loading. Try again in a moment.");
    return;
  }

  setAuthButtonsLoading(true);
  try {
    await window.luxDebitAuth.signInWithProvider(provider);
    toast(`Signed in with ${provider}.`);
  } catch (error) {
    toast(authErrorMessage(error));
  } finally {
    setAuthButtonsLoading(false);
  }
}

async function sendEmailSignInLink(event) {
  event.preventDefault();
  const email = document.querySelector("#auth-email").value.trim();
  if (!email) {
    toast("Enter your email address.");
    return;
  }
  if (!window.luxDebitAuth?.ready) {
    toast("Firebase is still loading. Try again in a moment.");
    return;
  }

  setAuthButtonsLoading(true);
  try {
    await window.luxDebitAuth.sendEmailLink(email);
    toast("Sign-in link sent. Check your email.");
  } catch (error) {
    toast(authErrorMessage(error));
  } finally {
    setAuthButtonsLoading(false);
  }
}

async function signOut() {
  if (window.luxDebitAuth?.ready) {
    try {
      await window.luxDebitAuth.signOut();
    } catch (error) {
      toast(authErrorMessage(error));
      return;
    }
  }
  setSignedOut();
  toast("Signed out.");
}

function renderAccount() {
  const initials = initialsFor(state.account.name);
  const providerCopy = state.account.signedIn ? `Signed in with ${state.account.provider}` : "Not signed in";
  document.querySelector("#profile-initial").textContent = initials;
  document.querySelector("#sidebar-profile-initial").textContent = initials;
  document.querySelector("#modal-profile-initial").textContent = initials;
  document.querySelector("#sidebar-profile-name").textContent = state.account.name;
  document.querySelector("#modal-profile-name").textContent = state.account.name;
  document.querySelector("#profile-title").textContent = state.account.signedIn ? "Profile" : "Choose sign-in method";
  document.querySelector("#sidebar-profile-provider").textContent = providerCopy;
  document.querySelector("#modal-profile-copy").textContent = providerCopy;
  document.querySelector("#logout-button").disabled = !state.account.signedIn;
  document.querySelector("#logout-button").textContent = state.account.signedIn ? "Sign out" : "Signed out";
}

function loadAccount() {
  try {
    const saved = localStorage.getItem("luxdebit-account");
    if (saved) {
      const account = JSON.parse(saved);
      if (!account.signedIn) return account;
    }
  } catch {}
  return {
    signedIn: false,
    provider: "Guest",
    name: "Guest"
  };
}

function saveAccount() {
  try {
    localStorage.setItem("luxdebit-account", JSON.stringify(state.account));
  } catch {}
}

function initialsFor(name) {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "G";
}

function bindFirebaseAuth() {
  if (window.luxDebitAuth?.ready) {
    applyFirebaseUser(window.luxDebitAuth.currentUser);
  }

  window.addEventListener("luxdebit-auth-state", (event) => {
    applyFirebaseUser(event.detail);
  });

  window.addEventListener("luxdebit-auth-error", (event) => {
    toast(authErrorMessage(event.detail));
  });
}

async function applyFirebaseUser(user) {
  if (!user) {
    setSignedOut(false);
    return;
  }
  state.userId = user.uid;
  state.account = {
    signedIn: true,
    provider: user.provider,
    name: user.name,
    email: user.email
  };
  saveAccount();
  renderAccount();
  await loadPersonalDashboard();
}

async function loadPersonalDashboard() {
  if (!state.userId || !window.luxDebitData?.ready) {
    state.dashboard = cloneDashboard(signedOutDashboard);
    document.querySelector("#connection-state").textContent = state.account.signedIn ? "Data service loading" : "Sign in required";
    return;
  }

  state.dashboardLoading = true;
  document.querySelector("#connection-state").textContent = "Loading private data";
  try {
    state.dashboard = await window.luxDebitData.loadDashboard({
      uid: state.userId,
      name: state.account.name,
      email: state.account.email
    });
    document.querySelector("#connection-state").textContent = "Private Firebase data";
  } catch (error) {
    state.dashboard = loadLocalDashboardForUser();
    document.querySelector("#connection-state").textContent = "Private local fallback";
    toast(authErrorMessage(error));
  } finally {
    state.dashboardLoading = false;
    render();
  }
}

async function savePersonalDashboard() {
  if (!state.userId) return;
  saveLocalDashboardForUser();
  if (!window.luxDebitData?.ready) return;
  try {
    await window.luxDebitData.saveDashboard(state.userId, state.account, cleanDashboardForStorage(state.dashboard));
    document.querySelector("#connection-state").textContent = "Private Firebase data";
  } catch (error) {
    document.querySelector("#connection-state").textContent = "Private local fallback";
    toast(authErrorMessage(error));
  }
}

function setSignedOut(showToast = false) {
  state.userId = null;
  state.dashboard = cloneDashboard(signedOutDashboard);
  state.account = {
    signedIn: false,
    provider: "Guest",
    name: "Guest",
    email: ""
  };
  saveAccount();
  render();
  if (showToast) toast("Signed out.");
}

function requireAccount() {
  if (state.account.signedIn && state.userId) return true;
  openProfileModal();
  toast("Sign in to use personal account data.");
  return false;
}

function addTransaction({ merchant, category, amount, currency, status }) {
  state.dashboard.transactions.unshift({
    id: createID(),
    merchant,
    category,
    amount,
    currency,
    status,
    occurred_at: new Date().toISOString()
  });
}

function cloneDashboard(dashboard) {
  return JSON.parse(JSON.stringify(dashboard));
}

function cleanDashboardForStorage(dashboard) {
  return {
    wallets: cloneDashboard(dashboard.wallets || []),
    cards: cloneDashboard(dashboard.cards || []),
    transactions: cloneDashboard(dashboard.transactions || [])
  };
}

function localDashboardKey() {
  return `luxdebit-dashboard-${state.userId}`;
}

function loadLocalDashboardForUser() {
  try {
    const saved = localStorage.getItem(localDashboardKey());
    if (saved) return JSON.parse(saved);
  } catch {}
  return createInitialDashboard({
    uid: state.userId,
    name: state.account.name,
    email: state.account.email
  });
}

function saveLocalDashboardForUser() {
  try {
    localStorage.setItem(localDashboardKey(), JSON.stringify(cleanDashboardForStorage(state.dashboard)));
  } catch {}
}

function createInitialDashboard(user) {
  const seed = hashString(`${user.uid}${user.email || ""}`);
  const suffix = String(seed).slice(-6);

  return {
    wallets: [
      { id: `eur-${suffix}`, currency: "EUR", balance: "0.00", change_24h: "0.00", deposit_address: `iban-private-eu-${suffix}` },
      { id: `usdc-${suffix}`, currency: "USDC", balance: "0.00", change_24h: "0.00", deposit_address: `0x${privateHex(seed, 40)}` },
      { id: `usdt-${suffix}`, currency: "USDT", balance: "0.00", change_24h: "0.00", deposit_address: `0x${privateHex(seed * 7, 40)}` }
    ],
    cards: [],
    transactions: []
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function privateHex(seed, length) {
  let value = "";
  let current = seed >>> 0;
  while (value.length < length) {
    current = Math.imul(current ^ 0x9e3779b9, 1664525) + 1013904223;
    value += (current >>> 0).toString(16).padStart(8, "0");
  }
  return value.slice(0, length);
}

window.luxDebitCreateInitialDashboard = createInitialDashboard;

function setAuthButtonsLoading(isLoading) {
  document.querySelectorAll("[data-auth-provider], #email-auth-form button, #logout-button").forEach((button) => {
    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);
  });
}

function authErrorMessage(error) {
  const message = typeof error === "string" ? error : error?.message || "";
  if (message.includes("auth/popup-closed-by-user")) return "Sign-in window was closed.";
  if (message.includes("auth/unauthorized-domain")) return "Add this site domain in Firebase Authentication settings.";
  if (message.includes("auth/operation-not-allowed")) return "Enable this sign-in provider in Firebase.";
  if (message.includes("auth/account-exists-with-different-credential")) return "This email is already connected to another sign-in method.";
  return "Could not complete sign-in. Check Firebase settings.";
}
