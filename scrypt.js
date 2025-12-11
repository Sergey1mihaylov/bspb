(() => {
  "use strict";

  const STORAGE_KEY = "bspb-zp-calculator-v1";

  const MONTH_NAMES = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
  ];

  const TAX_RATE = 0.13;
  const SERVICE_DAY_BONUS = 500;

  const SHELVES = [
    {
      id: "consumer_loan",
      name: "Потребительский кредит",
      inPlan: true,
      products: [
        { id: "consumer_app", name: "Заявка", type: "fixed", value: 0 },
        { id: "consumer_issue", name: "Выдача", type: "fixed", value: 2500 }
      ]
    },
    {
      id: "credit_cards",
      name: "Кредитные карты",
      inPlan: true,
      products: [
        { id: "card_review", name: "С рассмотрением", type: "fixed", value: 1000 },
        { id: "card_split", name: "Сплит", type: "fixed", value: 400 },
        { id: "card_app", name: "Заявка", type: "fixed", value: 0 }
      ]
    },
    {
      id: "debit_activation",
      name: "Активация ДК",
      inPlan: true,
      products: [
        { id: "dk_issue", name: "Выдача карты", type: "fixed", value: 0 },
        { id: "dk_yarkaya", name: "ТА по \"Яркой\"", type: "fixed", value: 600 },
        { id: "dk_other", name: "ТА по остальным (кроме ЕКП)", type: "fixed", value: 350 },
        { id: "dk_ekp", name: "ТА по ЕКП", type: "fixed", value: 250 }
      ]
    },
    {
      id: "savings",
      name: "Накопительная полка",
      inPlan: true,
      products: [
        { id: "deposit", name: "Вклад", type: "fixed", value: 450 },
        { id: "savings_account", name: "Накопительный счёт", type: "fixed", value: 350 },
        { id: "premium_light_issue", name: "Выдача Premium Light", type: "fixed", value: 300 },
        { id: "premium_light_sticker", name: "Кнопка учёта стикеров Premium Light", type: "fixed", value: 49 },
        { id: "sms_info", name: "СМС-информирование", type: "fixed", value: 70 },
        { id: "lead_cpo", name: "Лид ЦПО", type: "fixed", value: 500 },
        { id: "lead_mortgage", name: "Лид ипотека", type: "fixed", value: 500 },
        { id: "card_safe", name: "Страхование \"Карточный сейф\"", type: "fixed", value: 100 }
      ]
    },
    {
      id: "box_insurance",
      name: "Коробочное страхование",
      inPlan: false,
      products: [
        { id: "box_standard", name: "Стандартное (8% от суммы)", type: "percent", value: 8 },
        { id: "box_promo", name: "Акционное (1% от суммы)", type: "percent", value: 1 },
        { id: "box_credit_standard", name: "Стандартное (3% от суммы)", type: "percent", value: 3 }
      ]
    },
    {
      id: "pension",
      name: "Перевод пенсии",
      inPlan: true,
      products: [
        { id: "pension_insurance", name: "Страховая пенсия", type: "fixed", value: 1500 },
        { id: "pension_military", name: "Военная пенсия", type: "fixed", value: 1500 }
      ]
    }
  ];

  const PLAN_SHELVES = SHELVES.filter(s => s.inPlan).map(s => s.id);

  const qs = sel => document.querySelector(sel);
  const qsa = sel => Array.from(document.querySelectorAll(sel));

  const formatCurrency = v => `${Math.round(v).toLocaleString("ru-RU")} ₽`;
  const clampNumber = n => (Number.isFinite(n) && n >= 0 ? n : 0);
  const parseNumber = raw => {
    if (raw === null || raw === undefined) return 0;
    const v = parseFloat(String(raw).replace(",", "."));
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  const getMonthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
  const genId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  function getProgressColor(percent) {
    const p = Math.max(0, Math.min(percent, 100));
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const rgb = (r, g, b) => `rgb(${r},${g},${b})`;
    const red = [239, 68, 68];
    const yellow = [234, 179, 8];
    const green = [34, 197, 94];

    if (p <= 80) {
      const t = p / 80;
      return rgb(
        lerp(red[0], yellow[0], t),
        lerp(red[1], yellow[1], t),
        lerp(red[2], yellow[2], t)
      );
    }
    const t = (p - 80) / 20;
    return rgb(
      lerp(yellow[0], green[0], t),
      lerp(yellow[1], green[1], t),
      lerp(yellow[2], green[2], t)
    );
  }

  function formatDateRu(dateStr) {
    const [y, m, d] = dateStr.split("-").map(v => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    const names = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    return `${d} ${names[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  function getDefaultState() {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const key = getMonthKey(y, m);
    const defaultPlan = {};
    PLAN_SHELVES.forEach(id => defaultPlan[id] = 0);

    return {
      salary: 0,
      serviceWorker: false,
      currentYear: y,
      currentMonth: m,
      prices: {},
      plans: { [key]: defaultPlan },
      sales: [],
      weekends: {}
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);
      const def = getDefaultState();
      return {
        ...def,
        ...parsed,
        prices: parsed.prices || {},
        plans: { ...def.plans, ...(parsed.plans || {}) },
        sales: parsed.sales || [],
        weekends: parsed.weekends || {}
      };
    } catch (e) {
      console.error("loadState error", e);
      return getDefaultState();
    }
  }

  let state = loadState();
  let currentYear = state.currentYear;
  let currentMonth = state.currentMonth;
  let currentDay = null;
  let pendingDeleteSaleId = null;

  function saveState() {
    try {
      state.currentYear = currentYear;
      state.currentMonth = currentMonth;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("saveState error", e);
    }
  }

  function resetState() {
    state = getDefaultState();
    currentYear = state.currentYear;
    currentMonth = state.currentMonth;
    saveState();
    rerenderAll();
  }

  /* DOM GETTERS */
  const tabButtons = () => qsa(".tab-btn");
  const tabPanels = () => qsa(".tab-panel");

  const salaryInput = () => qs("#salary-input");
  const serviceWorkerToggle = () => qs("#service-worker-toggle");
  const earnTotalEl = () => qs("#earn-total");
  const earnServiceEl = () => qs("#earn-service");
  const coefValueEl = () => qs("#coef-value");
  const bonusGrossEl = () => qs("#bonus-gross");
  const bonusNetEl = () => qs("#bonus-net");
  const totalWithSalaryEl = () => qs("#total-with-salary");

  const editPlanBtn = () => qs("#edit-plan-btn");
  const editPricesBtn = () => qs("#edit-prices-btn");
  const resetDataBtn = () => qs("#reset-data-btn");

  const shelvesInfoContainer = () => qs("#shelves-info-container");
  const planProgressContainer = () => qs("#plan-progress-container");

  const calendarMonthLabel = () => qs("#calendar-month-label");
  const prevMonthBtn = () => qs("#prev-month-btn");
  const nextMonthBtn = () => qs("#next-month-btn");
  const todayMonthBtn = () => qs("#today-month-btn");
  const calendarGrid = () => qs("#calendar-grid");
  const salesChartCanvas = () => qs("#sales-chart");

  const dealsShelfFilter = () => qs("#deals-shelf-filter");
  const dealsList = () => qs("#deals-list");

  const dayModal = () => qs("#day-modal");
  const dayModalTitle = () => qs("#day-modal-title");
  const dayTotalAmountEl = () => qs("#day-total-amount");
  const dayWeekendToggle = () => qs("#day-weekend-toggle");
  const daySalesList = () => qs("#day-sales-list");
  const daySaleForm = () => qs("#day-sale-form");
  const saleShelfSelect = () => qs("#sale-shelf-select");
  const saleProductSelect = () => qs("#sale-product-select");
  const saleProductWrapper = () => qs("#sale-product-wrapper");
  const saleInsuranceSumWrapper = () => qs("#sale-insurance-sum-wrapper");
  const saleInsuranceSumInput = () => qs("#sale-insurance-sum");
  const saleCommentInput = () => qs("#sale-comment");
  const saleEditIdInput = () => qs("#sale-edit-id");
  const daySaleCancelEditBtn = () => qs("#day-sale-cancel-edit-btn");

  const pricesModal = () => qs("#prices-modal");
  const pricesModalBody = () => qs("#prices-modal-body");
  const pricesSaveBtn = () => qs("#prices-save-btn");

  const planModal = () => qs("#plan-modal");
  const planModalBody = () => qs("#plan-modal-body");
  const planSaveBtn = () => qs("#plan-save-btn");

  const dealDetailsModal = () => qs("#deal-details-modal");
  const dealDetailsBody = () => qs("#deal-details-body");
  const dealDetailsEditBtn = () => qs("#deal-details-edit-btn");
  const dealDetailsDeleteBtn = () => qs("#deal-details-delete-btn");

  const confirmModal = () => qs("#confirm-modal");
  const confirmYesBtn = () => qs("#confirm-yes-btn");
  const confirmNoBtn = () => qs("#confirm-no-btn");

  const toastContainer = () => qs("#toast-container");

  /* MODALS / TOASTS */
  function openModal(id) {
    const m = qs("#" + id);
    if (!m) return;
    m.classList.remove("hidden");
    m.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const m = qs("#" + id);
    if (!m) return;
    m.classList.add("hidden");
    m.setAttribute("aria-hidden", "true");
  }

  function attachModalGlobalHandlers() {
    qsa(".modal").forEach(modal => {
      const backdrop = modal.querySelector(".modal-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", () => {
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden", "true");
        });
      }
    });
    qsa("[data-close-modal]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-close-modal");
        if (id) closeModal(id);
      });
    });
  }

  function showToast(message, type = "info") {
    const container = toastContainer();
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    setTimeout(() => {
      el.classList.remove("visible");
      setTimeout(() => el.remove(), 250);
    }, 2600);
  }

  function askDeleteSale(id) {
    pendingDeleteSaleId = id;
    openModal("confirm-modal");
  }

  /* PRICES + PLAN */
  function getProductBaseValue(shelfId, productId) {
    const shelf = SHELVES.find(s => s.id === shelfId);
    if (!shelf) return 0;
    const product = shelf.products.find(p => p.id === productId);
    if (!product) return 0;
    return product.value;
  }

  function getProductValue(shelfId, productId) {
    const shelfOverrides = state.prices[shelfId];
    if (shelfOverrides && typeof shelfOverrides[productId] === "number") {
      return shelfOverrides[productId];
    }
    return getProductBaseValue(shelfId, productId);
  }

  function setProductValue(shelfId, productId, value) {
    if (!state.prices[shelfId]) state.prices[shelfId] = {};
    state.prices[shelfId][productId] = value;
  }

  function ensureMonthPlan(y, m) {
    const key = getMonthKey(y, m);
    if (!state.plans[key]) {
      const p = {};
      PLAN_SHELVES.forEach(id => p[id] = 0);
      state.plans[key] = p;
    }
    return state.plans[key];
  }

  function getCurrentMonthPlan() {
    return ensureMonthPlan(currentYear, currentMonth);
  }

  function computeShelfEarningsForMonth(shelfId, y, m) {
    const key = getMonthKey(y, m);
    return state.sales
      .filter(s => s.shelfId === shelfId && s.date.startsWith(key))
      .reduce((sum, s) => sum + s.amount, 0);
  }

  function computeCoefficient() {
    const plan = getCurrentMonthPlan();
    let completed = 0;
    let pensionCompleted = false;

    PLAN_SHELVES.forEach(id => {
      const target = plan[id] || 0;
      if (target <= 0) return;
      const fact = computeShelfEarningsForMonth(id, currentYear, currentMonth);
      if (fact >= target) {
        completed++;
        if (id === "pension") pensionCompleted = true;
      }
    });

    let coef = 0;
    if (completed === 0) coef = 0;
    else if (completed <= 3) coef = 1.0;
    else if (completed >= 5) coef = 1.3;
    else if (completed >= 4) coef = 1.2;

    if (completed > 0 && !pensionCompleted) coef = Math.max(0, coef - 0.1);

    return { coef, completed };
  }

  function renderShelvesInfo() {
    const container = shelvesInfoContainer();
    if (!container) return;
    container.innerHTML = "";
    SHELVES.forEach(shelf => {
      const block = document.createElement("div");
      block.className = "shelf-info-block";
      const title = document.createElement("h3");
      title.className = "shelf-info-title";
      title.textContent = shelf.name;
      block.appendChild(title);
      const list = document.createElement("div");
      list.className = "shelf-info-products";
      shelf.products.forEach(p => {
        const row = document.createElement("div");
        row.className = "shelf-info-row";
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name;
        const valueSpan = document.createElement("span");
        valueSpan.className = "shelf-info-value";
        const v = getProductValue(shelf.id, p.id);
        valueSpan.textContent = p.type === "fixed" ? formatCurrency(v) : `${v}% от суммы`;
        row.appendChild(nameSpan);
        row.appendChild(valueSpan);
        list.appendChild(row);
      });
      block.appendChild(list);
      container.appendChild(block);
    });
  }

  function renderPlanProgress() {
    const container = planProgressContainer();
    if (!container) return;
    container.innerHTML = "";
    const plan = getCurrentMonthPlan();
    PLAN_SHELVES.forEach(id => {
      const shelf = SHELVES.find(s => s.id === id);
      const fact = computeShelfEarningsForMonth(id, currentYear, currentMonth);
      const target = plan[id] || 0;
      const percent = target > 0 ? (fact / target) * 100 : 0;
      const displayPercent = Math.round(percent);
      const clamped = Math.min(percent, 100);
      const color = getProgressColor(percent);

      const row = document.createElement("div");
      row.className = "plan-row";

      const header = document.createElement("div");
      header.className = "plan-row-header";
      const nameSpan = document.createElement("span");
      nameSpan.className = "plan-row-name";
      nameSpan.textContent = shelf ? shelf.name : id;
      const valSpan = document.createElement("span");
      valSpan.className = "plan-row-value";
      valSpan.textContent = `${formatCurrency(fact)} / ${formatCurrency(target)} · ${displayPercent}%`;
      header.appendChild(nameSpan);
      header.appendChild(valSpan);

      const bar = document.createElement("div");
      bar.className = "plan-progress-bar";
      const fill = document.createElement("div");
      fill.className = "plan-progress-fill";
      fill.style.width = `${clamped}%`;
      fill.style.background = color;
      bar.appendChild(fill);

      row.appendChild(header);
      row.appendChild(bar);
      container.appendChild(row);
    });
  }

  /* CALENDAR & DAY MODAL */
  function getSalesForDate(dateStr) {
    return state.sales.filter(s => s.date === dateStr);
  }

  function getDayTotal(dateStr) {
    return getSalesForDate(dateStr).reduce((sum, s) => sum + s.amount, 0);
  }

  function buildCalendar() {
    const grid = calendarGrid();
    const label = calendarMonthLabel();
    if (!grid || !label) return;

    grid.innerHTML = "";
    const first = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const jsWeekday = first.getDay(); // 0 - вс, 1 - пн...
    const offset = (jsWeekday + 6) % 7; // понедельник = 0

    for (let i = 0; i < offset; i++) {
      const empty = document.createElement("div");
      empty.className = "calendar-cell calendar-cell-empty";
      grid.appendChild(empty);
    }

    const monthKey = getMonthKey(currentYear, currentMonth);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
      const total = getDayTotal(dateStr);
      const dt = new Date(currentYear, currentMonth, day);
      const jsDay = dt.getDay();
      const isWeekend = jsDay === 0 || jsDay === 6;
      const isCustomOff = !!state.weekends[dateStr];

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-cell calendar-day";
      cell.dataset.date = dateStr;
      if (isCustomOff) cell.classList.add("calendar-day-off");

      const num = document.createElement("div");
      num.className = "calendar-day-number";
      num.textContent = day;
      const totalEl = document.createElement("div");
      totalEl.className = "calendar-day-total";
      totalEl.textContent = total > 0 ? formatCurrency(total) : "";

      cell.appendChild(num);
      cell.appendChild(totalEl);
      grid.appendChild(cell);
    }

    label.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }

  function updateDayModalTotals() {
    const totalEl = dayTotalAmountEl();
    if (!totalEl || !currentDay) return;
    const total = getDayTotal(currentDay);
    totalEl.textContent = formatCurrency(total);
  }

  function renderDaySalesList() {
    const list = daySalesList();
    if (!list || !currentDay) return;
    list.innerHTML = "";
    const sales = getSalesForDate(currentDay);
    if (sales.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-placeholder";
      p.textContent = "За этот день продаж нет.";
      list.appendChild(p);
      return;
    }
    sales
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .forEach(sale => {
        const shelf = SHELVES.find(s => s.id === sale.shelfId);
        const product = shelf ? shelf.products.find(p => p.id === sale.productId) : null;

        const row = document.createElement("div");
        row.className = "day-sale-row";
        row.dataset.saleId = sale.id;

        const main = document.createElement("div");
        main.className = "day-sale-main";
        const title = document.createElement("div");
        title.className = "day-sale-title";
        title.textContent = `${shelf ? shelf.name : sale.shelfId} — ${product ? product.name : ""}`;
        const amount = document.createElement("div");
        amount.className = "day-sale-amount";
        amount.textContent = `+${formatCurrency(sale.amount)}`;
        main.appendChild(title);
        main.appendChild(amount);

        const meta = document.createElement("div");
        meta.className = "day-sale-meta";
        if (sale.comment) {
          meta.textContent = sale.comment;
        } else if (sale.insuranceSum) {
          meta.textContent = `Сумма страховки: ${formatCurrency(sale.insuranceSum)}`;
        } else {
          meta.textContent = "";
        }

        const actions = document.createElement("div");
        actions.className = "day-sale-actions";
        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn small";
        editBtn.dataset.action = "edit-sale";
        editBtn.textContent = "✎";

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "icon-btn small danger";
        delBtn.dataset.action = "delete-sale";
        delBtn.textContent = "🗑";

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        row.appendChild(main);
        row.appendChild(meta);
        row.appendChild(actions);

        list.appendChild(row);
      });
  }

  function updateSaleFormForShelf() {
    const shelfId = (saleShelfSelect() || {}).value || "";
    const wrapper = saleProductWrapper();
    const productSelect = saleProductSelect();
    const insWrapper = saleInsuranceSumWrapper();
    const insInput = saleInsuranceSumInput();
    if (!productSelect || !wrapper || !insWrapper || !insInput) return;

    const shelf = SHELVES.find(s => s.id === shelfId);
    if (!shelf) {
      wrapper.classList.add("hidden");
      insWrapper.classList.add("hidden");
      productSelect.innerHTML = "";
      return;
    }

    productSelect.innerHTML = "";
    shelf.products.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      productSelect.appendChild(opt);
    });
    wrapper.classList.remove("hidden");

    if (shelfId === "box_insurance") {
      insWrapper.classList.remove("hidden");
    } else {
      insWrapper.classList.add("hidden");
      insInput.value = "";
    }
  }

  function openDayModal(dateStr) {
    currentDay = dateStr;
    const titleEl = dayModalTitle();
    const weekendToggle = dayWeekendToggle();
    const editInput = saleEditIdInput();
    const commentInput = saleCommentInput();
    const insInput = saleInsuranceSumInput();
    const shelfSelect = saleShelfSelect();
    const productSelect = saleProductSelect();

    if (titleEl) titleEl.textContent = formatDateRu(dateStr);
    if (weekendToggle) weekendToggle.checked = !!state.weekends[dateStr];
    if (editInput) editInput.value = "";
    if (commentInput) commentInput.value = "";
    if (insInput) insInput.value = "";
    if (shelfSelect) shelfSelect.value = "";
    if (productSelect) productSelect.innerHTML = "";
    updateSaleFormForShelf();
    renderDaySalesList();
    updateDayModalTotals();
    openModal("day-modal");
  }

  function addOrUpdateSaleFromForm() {
    if (!currentDay) return;
    const shelfSelect = saleShelfSelect();
    const productSelect = saleProductSelect();
    const insInput = saleInsuranceSumInput();
    const commentInput = saleCommentInput();
    const editInput = saleEditIdInput();
    if (!shelfSelect || !productSelect || !insInput || !commentInput || !editInput) return;

    const shelfId = shelfSelect.value;
    const productId = productSelect.value;
    if (!shelfId || !productId) {
      showToast("Выберите полку и продукт", "error");
      return;
    }
    const shelf = SHELVES.find(s => s.id === shelfId);
    const product = shelf ? shelf.products.find(p => p.id === productId) : null;
    if (!product) {
      showToast("Некорректный продукт", "error");
      return;
    }

    let amount = 0;
    let insuranceSum = null;
    if (product.type === "fixed") {
      amount = clampNumber(getProductValue(shelfId, productId));
    } else {
      const sum = parseNumber(insInput.value);
      if (sum <= 0) {
        showToast("Введите сумму страховки", "error");
        return;
      }
      insuranceSum = sum;
      const percent = getProductValue(shelfId, productId);
      amount = clampNumber(sum * percent / 100);
    }

    const comment = commentInput.value.trim();
    const editId = editInput.value || null;
    const nowIso = new Date().toISOString();

    if (editId) {
      const existing = state.sales.find(s => s.id === editId);
      if (!existing) {
        showToast("Продажа не найдена", "error");
      } else {
        existing.shelfId = shelfId;
        existing.productId = productId;
        existing.amount = amount;
        existing.comment = comment;
        existing.insuranceSum = insuranceSum;
        existing.updatedAt = nowIso;
      }
    } else {
      state.sales.push({
        id: genId(),
        date: currentDay,
        shelfId,
        productId,
        amount,
        comment,
        insuranceSum,
        createdAt: nowIso,
        updatedAt: nowIso
      });
    }

    editInput.value = "";
    commentInput.value = "";
    insInput.value = "";

    saveState();
    renderDaySalesList();
    updateDayModalTotals();
    buildCalendar();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа сохранена", "success");
  }

  function fillSaleFormForEdit(id) {
    const sale = state.sales.find(s => s.id === id);
    if (!sale) return;
    const shelfSelect = saleShelfSelect();
    const productSelect = saleProductSelect();
    const insInput = saleInsuranceSumInput();
    const commentInput = saleCommentInput();
    const editInput = saleEditIdInput();
    if (!shelfSelect || !productSelect || !insInput || !commentInput || !editInput) return;

    editInput.value = sale.id;
    shelfSelect.value = sale.shelfId;
    updateSaleFormForShelf();
    productSelect.value = sale.productId || "";
    commentInput.value = sale.comment || "";
    insInput.value = sale.insuranceSum || "";
  }

  function deleteSaleById(id) {
    const idx = state.sales.findIndex(s => s.id === id);
    if (idx === -1) return;
    state.sales.splice(idx, 1);
    saveState();
    buildCalendar();
    renderDaySalesList();
    updateDayModalTotals();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа удалена", "info");
  }

  /* DEALS LIST */
  function buildDealsShelfFilterOptions() {
    const filter = dealsShelfFilter();
    if (!filter) return;
    SHELVES.forEach(shelf => {
      const opt = document.createElement("option");
      opt.value = shelf.id;
      opt.textContent = shelf.name;
      filter.appendChild(opt);
    });
  }

  function renderDealsList() {
    const list = dealsList();
    const filter = dealsShelfFilter();
    if (!list) return;
    list.innerHTML = "";
    const key = getMonthKey(currentYear, currentMonth);
    let items = state.sales.filter(s => s.date.startsWith(key));
    const filterVal = filter ? filter.value : "all";
    if (filterVal && filterVal !== "all") {
      items = items.filter(s => s.shelfId === filterVal);
    }
    if (items.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-placeholder";
      p.textContent = "В этом месяце ещё нет сделок.";
      list.appendChild(p);
      return;
    }
    items
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .forEach(sale => {
        const shelf = SHELVES.find(s => s.id === sale.shelfId);
        const product = shelf ? shelf.products.find(p => p.id === sale.productId) : null;

        const item = document.createElement("div");
        item.className = "deal-item";
        item.dataset.saleId = sale.id;

        const top = document.createElement("div");
        top.className = "deal-item-top";
        const title = document.createElement("div");
        title.className = "deal-item-title";
        title.textContent = `${shelf ? shelf.name : sale.shelfId} — ${product ? product.name : ""}`;
        const amount = document.createElement("div");
        amount.className = "deal-item-amount";
        amount.textContent = `+${formatCurrency(sale.amount)}`;
        top.appendChild(title);
        top.appendChild(amount);

        const bottom = document.createElement("div");
        bottom.className = "deal-item-bottom";
        const createdAt = sale.createdAt ? new Date(sale.createdAt) : new Date(sale.date);
        const dateSpan = document.createElement("span");
        dateSpan.className = "deal-item-date";
        dateSpan.textContent = `${formatDateRu(sale.date)}, ${createdAt.toTimeString().slice(0, 5)}`;
        const commentSpan = document.createElement("span");
        commentSpan.className = "deal-item-comment";
        commentSpan.textContent = sale.comment || "";
        bottom.appendChild(dateSpan);
        bottom.appendChild(commentSpan);

        item.appendChild(top);
        item.appendChild(bottom);

        item.addEventListener("click", () => openDealDetailsModal(sale.id));

        list.appendChild(item);
      });
  }

  function openDealDetailsModal(id) {
    const sale = state.sales.find(s => s.id === id);
    const body = dealDetailsBody();
    const modal = dealDetailsModal();
    if (!sale || !body || !modal) return;
    body.innerHTML = "";
    const shelf = SHELVES.find(s => s.id === sale.shelfId);
    const product = shelf ? shelf.products.find(p => p.id === sale.productId) : null;

    const dl = document.createElement("dl");
    dl.className = "details-dl";
    const addRow = (label, value) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    addRow("Дата", formatDateRu(sale.date));
    if (sale.createdAt) {
      const dt = new Date(sale.createdAt);
      addRow("Время", dt.toTimeString().slice(0, 8));
    }
    addRow("Полка", shelf ? shelf.name : sale.shelfId);
    addRow("Продукт", product ? product.name : "");
    addRow("Сумма", formatCurrency(sale.amount));
    if (sale.insuranceSum) addRow("Сумма страховки", formatCurrency(sale.insuranceSum));
    addRow("Комментарий", sale.comment || "—");

    body.appendChild(dl);
    modal.dataset.saleId = sale.id;
    openModal("deal-details-modal");
  }

  /* CHART */
  function renderSalesChart() {
    const canvas = salesChartCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const key = getMonthKey(currentYear, currentMonth);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const points = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${key}-${String(day).padStart(2, "0")}`;
      const dt = new Date(currentYear, currentMonth, day);
      const js = dt.getDay();
      const isWeekend = js === 0 || js === 6;
      if (isWeekend) continue;
      if (state.weekends[dateStr]) continue;
      const total = getDayTotal(dateStr);
      points.push({ dateStr, total });
    }
    if (points.length === 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "14px system-ui";
      ctx.fillText("Нет данных для графика", 20, h / 2);
      return;
    }

    const maxY = Math.max(...points.map(p => p.total), 1);
    const pad = 32;
    const cw = w - pad * 2;
    const ch = h - pad * 2;

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, pad + ch);
    ctx.lineTo(pad + cw, pad + ch);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.setLineDash([4, 4]);
    const gridLines = 4;
    for (let i = 1; i <= gridLines; i++) {
      const y = pad + (ch * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(pad + cw, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#38bdf8";
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = pad + cw * (idx / Math.max(points.length - 1, 1));
      const y = pad + ch - ch * (p.total / maxY);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    points.forEach((p, idx) => {
      const x = pad + cw * (idx / Math.max(points.length - 1, 1));
      const y = pad + ch - ch * (p.total / maxY);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /* SUMMARY */
  function computeMonthStats(y, m) {
    const key = getMonthKey(y, m);
    const monthSales = state.sales.filter(s => s.date.startsWith(key));
    const totalEarnings = monthSales.reduce((sum, s) => sum + s.amount, 0);

    const dates = new Set(monthSales.map(s => s.date));
    let serviceDays = 0;
    dates.forEach(dateStr => {
      const [Y, M, D] = dateStr.split("-").map(v => parseInt(v, 10));
      const dt = new Date(Y, M - 1, D);
      const js = dt.getDay();
      const isWeekend = js === 0 || js === 6;
      const isCustomOff = !!state.weekends[dateStr];
      if (!isWeekend && !isCustomOff) serviceDays++;
    });
    const serviceBonus = state.serviceWorker ? SERVICE_DAY_BONUS * serviceDays : 0;
    return { totalEarnings, serviceBonus };
  }

  function recalcSummary() {
    const { totalEarnings, serviceBonus } = computeMonthStats(currentYear, currentMonth);
    const { coef } = computeCoefficient();
    const salaryVal = clampNumber(state.salary || 0);
    const salaryNet = salaryVal * (1 - TAX_RATE);
    const base = totalEarnings + serviceBonus;
    const bonusGross = base * coef;
    const bonusNet = bonusGross * (1 - TAX_RATE);

    if (earnTotalEl()) earnTotalEl().textContent = formatCurrency(totalEarnings);
    if (earnServiceEl()) earnServiceEl().textContent = formatCurrency(serviceBonus);
    if (coefValueEl()) coefValueEl().textContent = coef.toFixed(1);
    if (bonusGrossEl()) bonusGrossEl().textContent = formatCurrency(bonusGross);
    if (bonusNetEl()) bonusNetEl().textContent = formatCurrency(bonusNet);
    if (totalWithSalaryEl()) totalWithSalaryEl().textContent = formatCurrency(salaryNet + bonusNet);
  }

  /* PRICES + PLAN MODALS */
  function renderPricesModal() {
    const body = pricesModalBody();
    if (!body) return;
    body.innerHTML = "";
    SHELVES.forEach(shelf => {
      const block = document.createElement("div");
      block.className = "prices-shelf-block";
      const title = document.createElement("h3");
      title.className = "prices-shelf-title";
      title.textContent = shelf.name;
      block.appendChild(title);
      shelf.products.forEach(p => {
        const row = document.createElement("div");
        row.className = "prices-row";
        const label = document.createElement("label");
        label.className = "field-label";
        label.htmlFor = `price-${shelf.id}-${p.id}`;
        label.textContent = p.name;
        const field = document.createElement("div");
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = p.type === "percent" ? "0.1" : "50";
        input.id = `price-${shelf.id}-${p.id}`;
        input.value = getProductValue(shelf.id, p.id);
        const suffix = document.createElement("span");
        suffix.className = "prices-suffix";
        suffix.textContent = p.type === "percent" ? "% от суммы" : "₽";
        field.appendChild(input);
        field.appendChild(suffix);
        row.appendChild(label);
        row.appendChild(field);
        block.appendChild(row);
      });
      body.appendChild(block);
    });
  }

  function savePricesFromModal() {
    SHELVES.forEach(shelf => {
      shelf.products.forEach(p => {
        const input = qs(`#price-${shelf.id}-${p.id}`);
        if (!input) return;
        const value = parseNumber(input.value);
        setProductValue(shelf.id, p.id, value);
      });
    });
    saveState();
    renderShelvesInfo();
    showToast("Цены сохранены", "success");
  }

  function renderPlanModal() {
    const body = planModalBody();
    if (!body) return;
    body.innerHTML = "";
    const plan = getCurrentMonthPlan();
    PLAN_SHELVES.forEach(id => {
      const shelf = SHELVES.find(s => s.id === id);
      const row = document.createElement("div");
      row.className = "plan-modal-row";
      const label = document.createElement("label");
      label.className = "field-label";
      label.htmlFor = `plan-${id}`;
      label.textContent = shelf ? shelf.name : id;
      const field = document.createElement("div");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1000";
      input.id = `plan-${id}`;
      input.value = plan[id] || 0;
      field.appendChild(input);
      row.appendChild(label);
      row.appendChild(field);
      body.appendChild(row);
    });
  }

  function savePlanFromModal() {
    const plan = getCurrentMonthPlan();
    PLAN_SHELVES.forEach(id => {
      const input = qs(`#plan-${id}`);
      if (!input) return;
      plan[id] = parseNumber(input.value);
    });
    saveState();
    renderPlanProgress();
    recalcSummary();
    showToast("План сохранён", "success");
  }

  /* HANDLERS */
  function attachTabsHandlers() {
    tabButtons().forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (!tab) return;
        tabButtons().forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        tabPanels().forEach(p => {
          p.classList.toggle("active", p.id === `tab-${tab}`);
        });
      });
    });
  }

  function attachCalendarHandlers() {
    const prevBtn = prevMonthBtn();
    const nextBtn = nextMonthBtn();
    const todayBtn = todayMonthBtn();
    const grid = calendarGrid();
    const weekendToggle = dayWeekendToggle();
    const form = daySaleForm();
    const shelfSelectEl = saleShelfSelect();
    const cancelBtn = daySaleCancelEditBtn();
    const salesList = daySalesList();

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }
    if (todayBtn) {
      todayBtn.addEventListener("click", () => {
        const t = new Date();
        currentYear = t.getFullYear();
        currentMonth = t.getMonth();
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }
    if (grid) {
      grid.addEventListener("click", (e) => {
        const btn = e.target.closest(".calendar-day");
        if (!btn) return;
        const dateStr = btn.dataset.date;
        if (!dateStr) return;
        openDayModal(dateStr);
      });
    }
    if (weekendToggle) {
      weekendToggle.addEventListener("change", () => {
        if (!currentDay) return;
        if (weekendToggle.checked) state.weekends[currentDay] = true;
        else delete state.weekends[currentDay];
        saveState();
        buildCalendar();
        renderSalesChart();
        recalcSummary();
      });
    }
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        addOrUpdateSaleFromForm();
      });
    }
    if (shelfSelectEl) {
      shelfSelectEl.addEventListener("change", updateSaleFormForShelf);
    }
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        const editInput = saleEditIdInput();
        const commentInput = saleCommentInput();
        const insInput = saleInsuranceSumInput();
        const shelfSelect = saleShelfSelect();
        const productSelect = saleProductSelect();
        if (editInput) editInput.value = "";
        if (commentInput) commentInput.value = "";
        if (insInput) insInput.value = "";
        if (shelfSelect) shelfSelect.value = "";
        if (productSelect) productSelect.innerHTML = "";
        updateSaleFormForShelf();
      });
    }
    if (salesList) {
      salesList.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const row = btn.closest(".day-sale-row");
        if (!row) return;
        const id = row.dataset.saleId;
        if (!id) return;
        const action = btn.dataset.action;
        if (action === "edit-sale") fillSaleFormForEdit(id);
        else if (action === "delete-sale") askDeleteSale(id);
      });
    }
  }

  function attachDealsHandlers() {
    const filter = dealsShelfFilter();
    const editBtn = dealDetailsEditBtn();
    const delBtn = dealDetailsDeleteBtn();

    if (filter) {
      filter.addEventListener("change", renderDealsList);
    }
    if (editBtn) {
      editBtn.addEventListener("click", () => {
        const modal = dealDetailsModal();
        const id = modal ? modal.dataset.saleId : null;
        if (!id) return;
        const sale = state.sales.find(s => s.id === id);
        if (!sale) return;
        closeModal("deal-details-modal");
        const dt = new Date(sale.date);
        currentYear = dt.getFullYear();
        currentMonth = dt.getMonth();
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        buildCalendar();
        openDayModal(sale.date);
        fillSaleFormForEdit(id);
      });
    }
    if (delBtn) {
      delBtn.addEventListener("click", () => {
        const modal = dealDetailsModal();
        const id = modal ? modal.dataset.saleId : null;
        if (!id) return;
        closeModal("deal-details-modal");
        askDeleteSale(id);
      });
    }
  }

  function attachGlobalHandlers() {
    const salaryEl = salaryInput();
    const serviceToggle = serviceWorkerToggle();
    const planBtn = editPlanBtn();
    const planSave = planSaveBtn();
    const pricesBtn = editPricesBtn();
    const pricesSave = pricesSaveBtn();
    const resetBtn = resetDataBtn();
    const confirmYes = confirmYesBtn();
    const confirmNo = confirmNoBtn();

    if (salaryEl) {
      salaryEl.value = state.salary || "";
      salaryEl.addEventListener("change", () => {
        state.salary = parseNumber(salaryEl.value);
        saveState();
        recalcSummary();
      });
    }
    if (serviceToggle) {
      serviceToggle.checked = !!state.serviceWorker;
      serviceToggle.addEventListener("change", () => {
        state.serviceWorker = serviceToggle.checked;
        saveState();
        recalcSummary();
      });
    }
    if (planBtn) {
      planBtn.addEventListener("click", () => {
        renderPlanModal();
        openModal("plan-modal");
      });
    }
    if (planSave) {
      planSave.addEventListener("click", () => {
        savePlanFromModal();
        closeModal("plan-modal");
      });
    }
    if (pricesBtn) {
      pricesBtn.addEventListener("click", () => {
        renderPricesModal();
        openModal("prices-modal");
      });
    }
    if (pricesSave) {
      pricesSave.addEventListener("click", () => {
        savePricesFromModal();
        closeModal("prices-modal");
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        if (window.confirm("Вы точно хотите полностью сбросить все данные?")) {
          resetState();
        }
      });
    }
    if (confirmYes) {
      confirmYes.addEventListener("click", () => {
        closeModal("confirm-modal");
        if (pendingDeleteSaleId) {
          deleteSaleById(pendingDeleteSaleId);
          pendingDeleteSaleId = null;
        }
      });
    }
    if (confirmNo) {
      confirmNo.addEventListener("click", () => {
        pendingDeleteSaleId = null;
        closeModal("confirm-modal");
      });
    }

    if (dealsShelfFilter() && dealsShelfFilter().options.length === 1) {
      buildDealsShelfFilterOptions();
    }
  }

  /* INIT */
  function rerenderAll() {
    ensureMonthPlan(currentYear, currentMonth);
    renderShelvesInfo();
    renderPlanProgress();
    buildCalendar();
    renderDealsList();
    renderSalesChart();
    recalcSummary();
  }

  function init() {
    attachTabsHandlers();
    attachGlobalHandlers();
    attachCalendarHandlers();
    attachDealsHandlers();
    attachModalGlobalHandlers();
    rerenderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
