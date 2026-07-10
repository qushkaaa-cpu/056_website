const API_BASE = "http://localhost:8080/api/v1";
const CUSTOMER_ID = "5f7b9b42-1bb4-4f6f-80de-b671f1c28a32";

const fallback = {
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
  dashboard: fallback,
  selectedCurrency: "USDC",
  activeView: "home",
  toastTimer: null,
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
  bindNavigation();
  bindModals();
  bindActions();
  initMarkets();
  render();
  loadDashboard();
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
  document.querySelector("#lock-card").addEventListener("click", toggleLock);
  document.querySelector("#apple-pay").addEventListener("click", () => {
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
  document.querySelectorAll("[data-auth-provider]").forEach((button) => {
    button.addEventListener("click", () => signIn(button.dataset.authProvider));
  });
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
    state.dashboard = await api("/dashboard");
    document.querySelector("#connection-state").textContent = "API connected";
  } catch {
    state.dashboard = fallback;
    document.querySelector("#connection-state").textContent = "Local data";
  } finally {
    refresh.classList.remove("is-loading");
    render();
  }
}

async function issueCard() {
  await createCard({
    displayName: "Black Reserve",
    holderName: "ALEX MORGAN",
    network: "visa",
    dailyLimit: "5000"
  });
}

async function addCardFromForm(event) {
  event.preventDefault();
  const displayName = document.querySelector("#new-card-name").value.trim();
  const holderName = document.querySelector("#new-card-holder").value.trim().toUpperCase();
  const network = document.querySelector("#new-card-network").value;
  const dailyLimit = document.querySelector("#new-card-limit").value.trim();

  if (!displayName || !holderName || Number(dailyLimit) <= 0) {
    toast("Add a card name, holder and a positive daily limit.");
    return;
  }

  await createCard({ displayName, holderName, network, dailyLimit });
}

async function createCard({ displayName, holderName, network, dailyLimit }) {
  try {
    const card = await api("/cards", {
      method: "POST",
      body: JSON.stringify({ display_name: displayName, holder_name: holderName })
    });
    card.display_name = displayName;
    card.holder_name = holderName;
    card.network = network;
    card.limits = { ...card.limits, daily: dailyLimit };
    state.dashboard.cards.unshift(card);
  } catch {
    const card = {
      ...fallback.cards[0],
      id: createID(),
      display_name: displayName,
      holder_name: holderName,
      network,
      limits: { ...fallback.cards[0].limits, daily: dailyLimit },
      last4: String(Math.floor(Math.random() * 10000)).padStart(4, "0")
    };
    card.masked_pan = `4242 42** **** ${card.last4}`;
    state.dashboard.cards.unshift(card);
  }
  showView("card");
  render();
  toast(`${displayName} card added.`);
}

async function toggleLock() {
  const card = primaryCard();
  const shouldLock = card.status === "active";
  try {
    const updated = await api(`/cards/${card.id}/lock`, {
      method: "PATCH",
      body: JSON.stringify({ locked: shouldLock })
    });
    replaceCard(updated);
  } catch {
    card.status = shouldLock ? "locked" : "active";
  }
  render();
  toast(card.status === "active" ? "Card unlocked." : "Card locked.");
}

async function generateDeposit() {
  const amount = document.querySelector("#deposit-amount").value || "0";
  const error = document.querySelector("#deposit-error");
  if (Number(amount) <= 0) {
    error.hidden = false;
    return;
  }
  error.hidden = true;
  let quote;
  try {
    quote = await api("/deposit", {
      method: "POST",
      body: JSON.stringify({ currency: state.selectedCurrency, amount })
    });
  } catch {
    const wallet = state.dashboard.wallets.find((item) => item.currency === state.selectedCurrency);
    quote = {
      network: "Ethereum",
      address: wallet.deposit_address,
      qr_payload: `${state.selectedCurrency}:${wallet.deposit_address}?amount=${amount}&network=ethereum`
    };
  }

  document.querySelector("#qr-card").hidden = false;
  document.querySelector("#deposit-network").textContent = quote.network;
  document.querySelector("#deposit-address").textContent = quote.address;
  toast(`${state.selectedCurrency} deposit address generated.`);
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
  document.querySelector(`#${prefix}card-name`).textContent = card.display_name;
  document.querySelector(`#${prefix}card-number`).textContent = card.masked_pan;
  document.querySelector(`#${prefix}card-holder`).textContent = card.holder_name;
  document.querySelector(`#${prefix}card-expiry`).textContent = `${String(card.expiry_month).padStart(2, "0")}/${String(card.expiry_year).slice(-2)}`;
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
      render();
      toast(`${card.display_name} selected.`);
    });
  });
}

function renderTransactions() {
  const latest = state.dashboard.transactions.slice(0, 4);
  document.querySelector("#latest-transactions").innerHTML = latest.map(transactionMarkup).join("");
  document.querySelector("#transactions").innerHTML = state.dashboard.transactions.map(transactionMarkup).join("");
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
  renderCardInfo(primaryCard());
  document.querySelector("#card-modal").showModal();
}

function openProfileModal() {
  renderAccount();
  document.querySelector("#profile-modal").showModal();
}

function primaryCard() {
  return state.dashboard.cards[0] || fallback.cards[0];
}

function replaceCard(card) {
  state.dashboard.cards = state.dashboard.cards.map((item) => item.id === card.id ? card : item);
}

function wallet(currency) {
  return state.dashboard.wallets.find((item) => item.currency === currency) || fallback.wallets[0];
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

function signIn(provider) {
  const names = {
    Apple: "Alex Morgan",
    Google: "Alexander Morgan",
    GitHub: "amorgan-finance",
    Email: "Alex Morgan"
  };
  state.account = {
    signedIn: true,
    provider,
    name: names[provider] || "Alex Morgan"
  };
  saveAccount();
  renderAccount();
  toast(`Signed in with ${provider}.`);
}

function signOut() {
  state.account = {
    signedIn: false,
    provider: "Guest",
    name: "Guest"
  };
  saveAccount();
  renderAccount();
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
    if (saved) return JSON.parse(saved);
  } catch {}
  return {
    signedIn: true,
    provider: "Demo",
    name: "Alex Morgan"
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
