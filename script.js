// scrypt.js
// Калькулятор ЗП старшего эксперта
// Вся логика приложения: вкладки, полки, план, календарь, сделки, звонки, localStorage, график.

(() => {
  "use strict";

  // ==============================
  // Константы и пресеты
  // ==============================

  const STORAGE_KEY = "bspb-zp-calculator-v1";

  const MONTH_NAMES = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const WEEKDAY_MON_TO_SUN = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const TAX_RATE = 0.13;
  const SERVICE_DAY_BONUS = 500;

  // Описание полок и продуктов
  // type: "fixed" — фиксированная сумма, "percent" — проценты от суммы страховки
  const SHELVES_CONFIG = [
    {
      id: "consumer_loan",
      name: "Потребительский кредит",
      inPlan: true,
      products: [
        { id: "consumer_app", name: "Заявка", type: "fixed", value: 0 },
        { id: "consumer_issue", name: "Выдача", type: "fixed", value: 2500 },
      ],
    },
    {
      id: "credit_cards",
      name: "Кредитные карты",
      inPlan: true,
      products: [
        {
          id: "card_review",
          name: "С рассмотрением",
          type: "fixed",
          value: 1000,
        },
        { id: "card_split", name: "Сплит", type: "fixed", value: 400 },
        { id: "card_app", name: "Заявка", type: "fixed", value: 0 },
      ],
    },
    {
      id: "debit_activation",
      name: "Активация ДК",
      inPlan: true,
      products: [
        { id: "dk_issue", name: "Выдача карты", type: "fixed", value: 0 },
        {
          id: "dk_yarkaya",
          name: 'ТА по "Яркой"',
          type: "fixed",
          value: 600,
        },
        {
          id: "dk_other",
          name: "ТА по остальным (кроме ЕКП)",
          type: "fixed",
          value: 350,
        },
        {
          id: "dk_ekp",
          name: "ТА по ЕКП",
          type: "fixed",
          value: 250,
        },
      ],
    },
    {
      id: "savings",
      name: "Накопительная полка",
      inPlan: true,
      products: [
        { id: "deposit", name: "Вклад", type: "fixed", value: 450 },
        {
          id: "savings_account",
          name: "Накопительный счёт",
          type: "fixed",
          value: 350,
        },
        {
          id: "premium_light_issue",
          name: "Выдача Premium Light",
          type: "fixed",
          value: 300,
        },
        {
          id: "premium_light_sticker",
          name: "Кнопка учёта стикеров Premium Light",
          type: "fixed",
          value: 49,
        },
        {
          id: "sms_info",
          name: "СМС-информирование",
          type: "fixed",
          value: 70,
        },
        { id: "lead_cpo", name: "Лид ЦПО", type: "fixed", value: 500 },
        {
          id: "lead_mortgage",
          name: "Лид ипотека",
          type: "fixed",
          value: 500,
        },
        {
          id: "card_safe",
          name: 'Страхование "Карточный сейф"',
          type: "fixed",
          value: 100,
        },
      ],
    },
    {
      id: "box_insurance",
      name: "Коробочное страхование",
      inPlan: false, // В плане не участвует
      products: [
        {
          id: "box_standard",
          name: "Стандартное (8% от суммы)",
          type: "percent",
          value: 8,
        },
        {
          id: "box_promo",
          name: "Акционное (1% от суммы)",
          type: "percent",
          value: 1,
        },
        {
          id: "box_credit_standard",
          name: "Стандартное (3% от суммы)",
          type: "percent",
          value: 3,
        },
      ],
    },
    {
      id: "pension",
      name: "Перевод пенсии",
      inPlan: true,
      products: [
        {
          id: "pension_insurance",
          name: "Страховая пенсия",
          type: "fixed",
          value: 1500,
        },
        {
          id: "pension_military",
          name: "Военная пенсия",
          type: "fixed",
          value: 1500,
        },
      ],
    },
  ];

  const PLAN_SHELF_IDS = SHELVES_CONFIG.filter((s) => s.inPlan).map(
    (s) => s.id
  );

  // ==============================
  // Утилиты
  // ==============================

  const qs = (sel) => document.querySelector(sel);
  const qsa = (sel) => Array.from(document.querySelectorAll(sel));

  const formatCurrency = (value) =>
    `${Math.round(value).toLocaleString("ru-RU")} ₽`;

  const clampNumber = (n) =>
    Number.isFinite(n) && n >= 0 ? n : 0;

  const getMonthKey = (year, monthIndex) =>
    `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

  const parseNumberInput = (input) => {
    if (!input) return 0;
    const val = parseFloat(String(input).replace(",", "."));
    return Number.isFinite(val) && val >= 0 ? val : 0;
  };

  const genId = () =>
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  // Цвет для прогресса плана
  function getProgressColor(percent) {
    const p = Math.max(0, Math.min(percent, 100));
    const lerp = (a, b, t) => Math.round(a + (b - a) * t);
    const rgbToCss = (r, g, b) => `rgb(${r}, ${g}, ${b})`;

    const red = [242, 95, 92];
    const yellow = [255, 193, 7];
    const green = [46, 204, 113];

    if (p <= 80) {
      const t = p / 80;
      const r = lerp(red[0], yellow[0], t);
      const g = lerp(red[1], yellow[1], t);
      const b = lerp(red[2], yellow[2], t);
      return rgbToCss(r, g, b);
    }

    const t = (p - 80) / 20;
    const r = lerp(yellow[0], green[0], t);
    const g = lerp(yellow[1], green[1], t);
    const b = lerp(yellow[2], green[2], t);
    return rgbToCss(r, g, b);
  }

  function formatDateRu(dateStr) {
    const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    const monthNamesGen = [
      "января",
      "февраля",
      "марта",
      "апреля",
      "мая",
      "июня",
      "июля",
      "августа",
      "сентября",
      "октября",
      "ноября",
      "декабря",
    ];
    return `${d} ${monthNamesGen[dt.getMonth()]} ${dt.getFullYear()}`;
  }

  // ==============================
  // Работа с localStorage
  // ==============================

  function getDefaultState() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const monthKey = getMonthKey(year, month);

    // Заготовка плана: 0 по всем полкам
    const emptyPlan = {};
    PLAN_SHELF_IDS.forEach((id) => {
      emptyPlan[id] = 0;
    });

    return {
      salary: 0,
      serviceWorker: false,
      currentYear: year,
      currentMonth: month,
      // переопределённые цены
      pricesOverrides: {},
      // планы по месяцам: { 'YYYY-MM': { shelfId: number } }
      plans: {
        [monthKey]: emptyPlan,
      },
      // продажи
      sales: [],
      // выходные дни: { 'YYYY-MM-DD': true }
      weekends: {},
      // звонки
      calls: [],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return getDefaultState();
      const parsed = JSON.parse(raw);

      const defaults = getDefaultState();
      // мягкий merge
      return {
        ...defaults,
        ...parsed,
        pricesOverrides: {
          ...defaults.pricesOverrides,
          ...(parsed.pricesOverrides || {}),
        },
        plans: {
          ...defaults.plans,
          ...(parsed.plans || {}),
        },
        sales: parsed.sales || [],
        weekends: parsed.weekends || {},
        calls: parsed.calls || [],
      };
    } catch (e) {
      console.error("Ошибка чтения state:", e);
      return getDefaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Ошибка сохранения state:", e);
    }
  }

  function resetState() {
    state = getDefaultState();
    saveState();
    rerenderAll();
    showToast("Данные сброшены", "info");
  }

  // ==============================
  // Глобальный state
  // ==============================

  let state = loadState();

  // Текущий просмотримый месяц
  let currentYear = state.currentYear;
  let currentMonth = state.currentMonth; // 0-11

  // Текущий выбранный день в модалке
  let currentDayDate = null; // 'YYYY-MM-DD'

  // ID продажи, которую собираемся удалить (через confirm-modal)
  let pendingDeleteSaleId = null;

  // ==============================
  // Кэш DOM
  // ==============================

  // Вкладки
  const tabButtons = qsa(".tab-btn");
  const tabPanels = qsa(".tab-panel");

  // Шапка
  const editPricesBtn = qs("#edit-prices-btn");
  const resetDataBtn = qs("#reset-data-btn");

  // Общий итог
  const salaryInput = qs("#salary-input");
  const serviceWorkerToggle = qs("#service-worker-toggle");
  const earnTotalEl = qs("#earn-total");
  const earnServiceEl = qs("#earn-service");
  const coefValueEl = qs("#coef-value");
  const bonusGrossEl = qs("#bonus-gross");
  const bonusNetEl = qs("#bonus-net");
  const totalWithSalaryEl = qs("#total-with-salary");

  // План
  const editPlanBtn = qs("#edit-plan-btn");
  const planProgressContainer = qs("#plan-progress-container");

  // Полки и продукты
  const shelvesInfoContainer = qs("#shelves-info-container");

  // Календарь
  const calendarMonthLabel = qs("#calendar-month-label");
  const prevMonthBtn = qs("#prev-month-btn");
  const nextMonthBtn = qs("#next-month-btn");
  const todayMonthBtn = qs("#today-month-btn");
  const calendarGrid = qs("#calendar-grid");
  const salesChartCanvas = qs("#sales-chart");

  // Мои сделки
  const dealsShelfFilter = qs("#deals-shelf-filter");
  const dealsList = qs("#deals-list");

  // Звонки
  const addCallBtn = qs("#add-call-btn");
  const callsList = qs("#calls-list");

  // Модалки
  const dayModal = qs("#day-modal");
  const dayModalTitle = qs("#day-modal-title");
  const dayTotalAmountEl = qs("#day-total-amount");
  const dayWeekendToggle = qs("#day-weekend-toggle");
  const daySalesList = qs("#day-sales-list");
  const daySaleForm = qs("#day-sale-form");
  const saleShelfSelect = qs("#sale-shelf-select");
  const saleProductSelect = qs("#sale-product-select");
  const saleProductWrapper = qs("#sale-product-wrapper");
  const saleInsuranceSumWrapper = qs("#sale-insurance-sum-wrapper");
  const saleInsuranceSumInput = qs("#sale-insurance-sum");
  const saleCommentInput = qs("#sale-comment");
  const saleEditIdInput = qs("#sale-edit-id");
  const daySaleCancelEditBtn = qs("#day-sale-cancel-edit-btn");

  const pricesModal = qs("#prices-modal");
  const pricesModalBody = qs("#prices-modal-body");
  const pricesSaveBtn = qs("#prices-save-btn");

  const planModal = qs("#plan-modal");
  const planModalBody = qs("#plan-modal-body");
  const planSaveBtn = qs("#plan-save-btn");

  const dealDetailsModal = qs("#deal-details-modal");
  const dealDetailsBody = qs("#deal-details-body");
  const dealDetailsEditBtn = qs("#deal-details-edit-btn");
  const dealDetailsDeleteBtn = qs("#deal-details-delete-btn");

  const callModal = qs("#call-modal");
  const callForm = qs("#call-form");
  const callResultSelect = qs("#call-result");
  const callReasonWrapper = qs("#call-reason-wrapper");
  const callReasonSelect = qs("#call-reason");
  const callCommentWrapper = qs("#call-comment-wrapper");
  const callCommentInput = qs("#call-comment");

  const confirmModal = qs("#confirm-modal");
  const confirmYesBtn = qs("#confirm-yes-btn");
  const confirmNoBtn = qs("#confirm-no-btn");

  const toastContainer = qs("#toast-container");

  // ==============================
  // Модалки и тосты
  // ==============================

  function openModal(id) {
    const modal = qs(`#${id}`);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal(id) {
    const modal = qs(`#${id}`);
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  }

  function attachModalGlobalHandlers() {
    // Клик по бэкдропу
    qsa(".modal").forEach((modal) => {
      const backdrop = modal.querySelector(".modal-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", () => {
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden", "true");
        });
      }
    });

    // Кнопки с data-close-modal
    qsa("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-close-modal");
        if (targetId) closeModal(targetId);
      });
    });
  }

  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("visible");
    });

    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2800);
  }

  // Подтверждение удаления продажи
  function askDeleteSale(saleId) {
    pendingDeleteSaleId = saleId;
    openModal("confirm-modal");
  }

  // ==============================
  // Работа с ценами
  // ==============================

  // Текущая цена/процент для продукта с учётом overrides
  function getProductValue(shelfId, productId) {
    const shelf = SHELVES_CONFIG.find((s) => s.id === shelfId);
    if (!shelf) return 0;
    const product = shelf.products.find((p) => p.id === productId);
    if (!product) return 0;

    const overrideShelf = state.pricesOverrides[shelfId];
    if (overrideShelf && typeof overrideShelf[productId] === "number") {
      return overrideShelf[productId];
    }
    return product.value;
  }

  function setProductOverrideValue(shelfId, productId, value) {
    if (!state.pricesOverrides[shelfId]) {
      state.pricesOverrides[shelfId] = {};
    }
    state.pricesOverrides[shelfId][productId] = value;
  }

  // ==============================
  // План по полкам
  // ==============================

  function ensureMonthPlan(year, monthIndex) {
    const key = getMonthKey(year, monthIndex);
    if (!state.plans[key]) {
      const empty = {};
      PLAN_SHELF_IDS.forEach((id) => {
        empty[id] = 0;
      });
      state.plans[key] = empty;
    }
    return state.plans[key];
  }

  function getCurrentMonthPlan() {
    return ensureMonthPlan(currentYear, currentMonth);
  }

  function renderPlanModal() {
    const monthPlan = getCurrentMonthPlan();
    planModalBody.innerHTML = "";

    PLAN_SHELF_IDS.forEach((shelfId) => {
      const shelf = SHELVES_CONFIG.find((s) => s.id === shelfId);
      const row = document.createElement("div");
      row.className = "plan-modal-row";

      const label = document.createElement("label");
      label.className = "field-label";
      label.setAttribute("for", `plan-input-${shelfId}`);
      label.textContent = shelf ? shelf.name : shelfId;

      const inputWrap = document.createElement("div");
      inputWrap.className = "field";
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1000";
      input.id = `plan-input-${shelfId}`;
      input.value = monthPlan[shelfId] || 0;
      input.inputMode = "decimal";

      inputWrap.appendChild(input);
      row.appendChild(label);
      row.appendChild(inputWrap);
      planModalBody.appendChild(row);
    });
  }

  function savePlanFromModal() {
    const monthPlan = getCurrentMonthPlan();
    PLAN_SHELF_IDS.forEach((shelfId) => {
      const input = qs(`#plan-input-${shelfId}`);
      if (!input) return;
      const val = parseNumberInput(input.value);
      monthPlan[shelfId] = val;
    });
    saveState();
    renderPlanProgress();
    recalcSummary();
    showToast("План сохранён", "success");
  }

  function computeShelfEarningsForMonth(shelfId, year, monthIndex) {
    const monthKey = getMonthKey(year, monthIndex);
    return state.sales
      .filter((s) => s.shelfId === shelfId && s.date.startsWith(monthKey))
      .reduce((acc, s) => acc + s.amount, 0);
  }

  function renderPlanProgress() {
    const monthPlan = getCurrentMonthPlan();
    planProgressContainer.innerHTML = "";

    PLAN_SHELF_IDS.forEach((shelfId) => {
      const shelf = SHELVES_CONFIG.find((s) => s.id === shelfId);

      const fact = computeShelfEarningsForMonth(
        shelfId,
        currentYear,
        currentMonth
      );
      const plan = monthPlan[shelfId] || 0;
      const percent = plan > 0 ? (fact / plan) * 100 : 0;
      const displayPercent = Math.round(percent);
      const clampedPercent = Math.min(percent, 100);
      const color = getProgressColor(percent);

      const row = document.createElement("div");
      row.className = "plan-row";

      const header = document.createElement("div");
      header.className = "plan-row-header";

      const nameSpan = document.createElement("span");
      nameSpan.className = "plan-row-name";
      nameSpan.textContent = shelf ? shelf.name : shelfId;

      const valueSpan = document.createElement("span");
      valueSpan.className = "plan-row-value";
      valueSpan.textContent = `${formatCurrency(
        fact
      )} / ${formatCurrency(plan)} · ${displayPercent}%`;

      header.appendChild(nameSpan);
      header.appendChild(valueSpan);

      const progressOuter = document.createElement("div");
      progressOuter.className = "plan-progress-bar";

      const progressInner = document.createElement("div");
      progressInner.className = "plan-progress-fill";
      progressInner.style.width = `${clampedPercent}%`;
      progressInner.style.background = color;

      progressOuter.appendChild(progressInner);

      row.appendChild(header);
      row.appendChild(progressOuter);

      planProgressContainer.appendChild(row);
    });
  }

  function computeCoefficient() {
    const monthPlan = getCurrentMonthPlan();

    let completed = 0;
    let pensionCompleted = false;

    PLAN_SHELF_IDS.forEach((shelfId) => {
      const plan = monthPlan[shelfId] || 0;
      if (plan <= 0) return;
      const fact = computeShelfEarningsForMonth(
        shelfId,
        currentYear,
        currentMonth
      );
      if (fact >= plan) {
        completed += 1;
        if (shelfId === "pension") pensionCompleted = true;
      }
    });

    let coef = 0;
    if (completed === 0) {
      coef = 0;
    } else if (completed <= 3) {
      coef = 1.0;
    } else if (completed >= 5) {
      coef = 1.3;
    } else if (completed >= 4) {
      coef = 1.2;
    }

    // Штраф за пенсию (кроме 0 полок)
    if (completed > 0 && !pensionCompleted) {
      coef = Math.max(0, coef - 0.1);
    }

    return { coef, completed };
  }

  // ==============================
  // Полки и продукты — инфо-блок
  // ==============================

  function renderShelvesInfo() {
    shelvesInfoContainer.innerHTML = "";

    SHELVES_CONFIG.forEach((shelf) => {
      const shelfBlock = document.createElement("div");
      shelfBlock.className = "shelf-info-block";

      const title = document.createElement("h3");
      title.className = "shelf-info-title";
      title.textContent = shelf.name;
      shelfBlock.appendChild(title);

      const list = document.createElement("div");
      list.className = "shelf-info-products";

      shelf.products.forEach((product) => {
        const row = document.createElement("div");
        row.className = "shelf-info-row";

        const nameSpan = document.createElement("span");
        nameSpan.className = "shelf-info-name";
        nameSpan.textContent = product.name;

        const valSpan = document.createElement("span");
        valSpan.className = "shelf-info-value";

        const value = getProductValue(shelf.id, product.id);

        if (product.type === "fixed") {
          valSpan.textContent = formatCurrency(value);
        } else {
          valSpan.textContent = `${value}% от суммы`;
        }

        row.appendChild(nameSpan);
        row.appendChild(valSpan);
        list.appendChild(row);
      });

      shelfBlock.appendChild(list);
      shelvesInfoContainer.appendChild(shelfBlock);
    });
  }

  // ==============================
  // Календарь
  // ==============================

  function getSalesForDate(dateStr) {
    return state.sales.filter((s) => s.date === dateStr);
  }

  function getDayTotalForDate(dateStr) {
    return getSalesForDate(dateStr).reduce((sum, s) => sum + s.amount, 0);
  }

  function isCustomWeekend(dateStr) {
    return !!state.weekends[dateStr];
  }

  function buildCalendar() {
    calendarGrid.innerHTML = "";

    const firstDay = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const jsWeekday = firstDay.getDay(); // 0 — вс, 1 — пн ...
    const offset = (jsWeekday + 6) % 7; // 0 — пн, 6 — вс

    // Пустые клетки до первого числа
    for (let i = 0; i < offset; i++) {
      const cell = document.createElement("div");
      cell.className = "calendar-cell calendar-cell-empty";
      calendarGrid.appendChild(cell);
    }

    const monthKey = getMonthKey(currentYear, currentMonth);

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
      const total = getDayTotalForDate(dateStr);
      const jsDate = new Date(currentYear, currentMonth, day);
      const jsDay = jsDate.getDay();
      const isWeekend = jsDay === 0 || jsDay === 6;
      const isMarkedWeekend = isCustomWeekend(dateStr);

      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "calendar-cell calendar-day";
      cell.dataset.date = dateStr;

      if (isMarkedWeekend) {
        cell.classList.add("calendar-day-off");
      }

      const numDiv = document.createElement("div");
      numDiv.className = "calendar-day-number";
      numDiv.textContent = day;

      const totalDiv = document.createElement("div");
      totalDiv.className = "calendar-day-total";
      totalDiv.textContent = total > 0 ? formatCurrency(total) : "";

      cell.appendChild(numDiv);
      cell.appendChild(totalDiv);

      calendarGrid.appendChild(cell);
    }

    calendarMonthLabel.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }

  function openDayModal(dateStr) {
    currentDayDate = dateStr;
    dayModalTitle.textContent = formatDateRu(dateStr);
    dayWeekendToggle.checked = !!state.weekends[dateStr];
    saleEditIdInput.value = "";
    saleShelfSelect.value = "";
    saleProductSelect.innerHTML = "";
    saleInsuranceSumInput.value = "";
    saleCommentInput.value = "";
    updateSaleFormForShelf(); // скрыть/показать поле суммы страховки
    renderDaySalesList();
    updateDayTotal();
    openModal("day-modal");
  }

  function updateDayTotal() {
    if (!currentDayDate) return;
    const total = getDayTotalForDate(currentDayDate);
    dayTotalAmountEl.textContent = formatCurrency(total);
  }

  function renderDaySalesList() {
    if (!currentDayDate) return;
    daySalesList.innerHTML = "";

    const sales = getSalesForDate(currentDayDate);

    if (sales.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-placeholder";
      empty.textContent = "За этот день продаж нет.";
      daySalesList.appendChild(empty);
      return;
    }

    // сортировка по createdAt убыванию
    sales
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .forEach((sale) => {
        const shelf = SHELVES_CONFIG.find((s) => s.id === sale.shelfId);
        const product = shelf
          ? shelf.products.find((p) => p.id === sale.productId)
          : null;

        const row = document.createElement("div");
        row.className = "day-sale-row";
        row.dataset.saleId = sale.id;

        const main = document.createElement("div");
        main.className = "day-sale-main";

        const title = document.createElement("div");
        title.className = "day-sale-title";
        title.textContent = `${shelf ? shelf.name : sale.shelfId} — ${
          product ? product.name : ""
        }`;

        const amount = document.createElement("div");
        amount.className = "day-sale-amount";
        amount.textContent = `+${formatCurrency(sale.amount)}`;

        main.appendChild(title);
        main.appendChild(amount);

        const meta = document.createElement("div");
        meta.className = "day-sale-meta";
        if (sale.comment) {
          meta.textContent = sale.comment;
        } else if (
          sale.insuranceSum &&
          (sale.insuranceType || sale.productId.startsWith("box_"))
        ) {
          meta.textContent = `Сумма страховки: ${formatCurrency(
            sale.insuranceSum
          )}`;
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

        daySalesList.appendChild(row);
      });
  }

  function updateSaleFormForShelf() {
    const shelfId = saleShelfSelect.value;
    const shelf = SHELVES_CONFIG.find((s) => s.id === shelfId);

    if (!shelf) {
      saleProductWrapper.classList.add("hidden");
      saleInsuranceSumWrapper.classList.add("hidden");
      saleProductSelect.innerHTML = "";
      return;
    }

    // Заполняем продукты
    saleProductSelect.innerHTML = "";
    shelf.products.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      saleProductSelect.appendChild(opt);
    });

    saleProductWrapper.classList.remove("hidden");

    // Для коробочного страхования — показываем поле "Сумма страховки"
    if (shelfId === "box_insurance") {
      saleInsuranceSumWrapper.classList.remove("hidden");
    } else {
      saleInsuranceSumWrapper.classList.add("hidden");
      saleInsuranceSumInput.value = "";
    }
  }

  function addOrUpdateSaleFromForm() {
    if (!currentDayDate) return;

    const shelfId = saleShelfSelect.value;
    const productId = saleProductSelect.value;

    if (!shelfId || !productId) {
      showToast("Выберите полку и продукт", "error");
      return;
    }

    const shelf = SHELVES_CONFIG.find((s) => s.id === shelfId);
    const product = shelf
      ? shelf.products.find((p) => p.id === productId)
      : null;
    if (!product) {
      showToast("Некорректный продукт", "error");
      return;
    }

    let amount = 0;
    let insuranceSum = null;

    if (product.type === "fixed") {
      const price = getProductValue(shelfId, productId);
      amount = clampNumber(price);
    } else if (product.type === "percent") {
      const sum = parseNumberInput(saleInsuranceSumInput.value);
      if (sum <= 0) {
        showToast("Введите сумму страховки", "error");
        return;
      }
      insuranceSum = sum;
      const percent = getProductValue(shelfId, productId);
      amount = clampNumber((sum * percent) / 100);
    }

    const comment = saleCommentInput.value.trim();
    const editId = saleEditIdInput.value || null;
    const nowIso = new Date().toISOString();

    if (editId) {
      const target = state.sales.find((s) => s.id === editId);
      if (!target) {
        showToast("Продажа не найдена", "error");
      } else {
        target.shelfId = shelfId;
        target.productId = productId;
        target.amount = amount;
        target.comment = comment;
        target.insuranceSum = insuranceSum;
        target.insuranceType =
          product.type === "percent" ? productId : null;
        target.updatedAt = nowIso;
      }
    } else {
      const sale = {
        id: genId(),
        date: currentDayDate,
        shelfId,
        productId,
        amount,
        comment,
        insuranceSum,
        insuranceType: product.type === "percent" ? productId : null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      state.sales.push(sale);
    }

    // Сброс формы
    saleEditIdInput.value = "";
    saleCommentInput.value = "";
    if (shelfId === "box_insurance") {
      saleInsuranceSumInput.value = "";
    }

    saveState();
    renderDaySalesList();
    updateDayTotal();
    buildCalendar();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа сохранена", "success");
  }

  function fillSaleFormForEdit(saleId) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;
    saleEditIdInput.value = sale.id;

    saleShelfSelect.value = sale.shelfId;
    updateSaleFormForShelf();
    saleProductSelect.value = sale.productId || "";
    saleCommentInput.value = sale.comment || "";
    if (sale.insuranceSum) {
      saleInsuranceSumInput.value = sale.insuranceSum;
    } else {
      saleInsuranceSumInput.value = "";
    }
  }

  function deleteSaleById(saleId) {
    const idx = state.sales.findIndex((s) => s.id === saleId);
    if (idx === -1) return;
    state.sales.splice(idx, 1);
    saveState();
    buildCalendar();
    renderDaySalesList();
    updateDayTotal();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа удалена", "info");
  }

  function attachCalendarHandlers() {
    if (prevMonthBtn) {
      prevMonthBtn.addEventListener("click", () => {
        currentMonth -= 1;
        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear -= 1;
        }
        state.currentYear = currentYear;
        state.currentMonth = currentMonth;
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener("click", () => {
        currentMonth += 1;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear += 1;
        }
        state.currentYear = currentYear;
        state.currentMonth = currentMonth;
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }

    if (todayMonthBtn) {
      todayMonthBtn.addEventListener("click", () => {
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
        state.currentYear = currentYear;
        state.currentMonth = currentMonth;
        ensureMonthPlan(currentYear, currentMonth);
        saveState();
        rerenderAll();
      });
    }

    // Клик по дням календаря
    if (calendarGrid) {
      calendarGrid.addEventListener("click", (e) => {
        const cell = e.target.closest(".calendar-day");
        if (!cell) return;
        const dateStr = cell.dataset.date;
        if (!dateStr) return;
        openDayModal(dateStr);
      });
    }

    if (dayWeekendToggle) {
      dayWeekendToggle.addEventListener("change", () => {
        if (!currentDayDate) return;
        if (dayWeekendToggle.checked) {
          state.weekends[currentDayDate] = true;
        } else {
          delete state.weekends[currentDayDate];
        }
        saveState();
        buildCalendar();
        renderSalesChart();
        recalcSummary();
      });
    }

    if (daySaleForm) {
      daySaleForm.addEventListener("submit", (e) => {
        e.preventDefault();
        addOrUpdateSaleFromForm();
      });
    }

    if (saleShelfSelect) {
      saleShelfSelect.addEventListener("change", () => {
        updateSaleFormForShelf();
      });
    }

    if (daySaleCancelEditBtn) {
      daySaleCancelEditBtn.addEventListener("click", () => {
        saleEditIdInput.value = "";
        saleCommentInput.value = "";
        saleInsuranceSumInput.value = "";
        saleShelfSelect.value = "";
        saleProductSelect.innerHTML = "";
        saleInsuranceSumWrapper.classList.add("hidden");
        saleProductWrapper.classList.add("hidden");
      });
    }

    // Делегирование для кнопок "изменить/удалить" в окне дня
    if (daySalesList) {
      daySalesList.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;
        const action = btn.dataset.action;
        const row = btn.closest(".day-sale-row");
        if (!row) return;
        const saleId = row.dataset.saleId;
        if (!saleId) return;

        if (action === "edit-sale") {
          fillSaleFormForEdit(saleId);
        } else if (action === "delete-sale") {
          askDeleteSale(saleId);
        }
      });
    }
  }

  // ==============================
  // Мои сделки
  // ==============================

  function buildDealsShelfFilterOptions() {
    // базовая опция "Все полки" уже есть
    SHELVES_CONFIG.forEach((shelf) => {
      const opt = document.createElement("option");
      opt.value = shelf.id;
      opt.textContent = shelf.name;
      dealsShelfFilter.appendChild(opt);
    });
  }

  function renderDealsList() {
    if (!dealsList) return;
    dealsList.innerHTML = "";

    const monthKey = getMonthKey(currentYear, currentMonth);

    let deals = state.sales.filter((s) => s.date.startsWith(monthKey));

    const filterShelf = dealsShelfFilter ? dealsShelfFilter.value : "all";
    if (filterShelf && filterShelf !== "all") {
      deals = deals.filter((s) => s.shelfId === filterShelf);
    }

    if (deals.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-placeholder";
      empty.textContent =
        "В этом месяце ещё нет сделок с выбранным фильтром.";
      dealsList.appendChild(empty);
      return;
    }

    deals
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
      .forEach((sale) => {
        const shelf = SHELVES_CONFIG.find((s) => s.id === sale.shelfId);
        const product = shelf
          ? shelf.products.find((p) => p.id === sale.productId)
          : null;

        const item = document.createElement("div");
        item.className = "deal-item";
        item.dataset.saleId = sale.id;

        const top = document.createElement("div");
        top.className = "deal-item-top";

        const title = document.createElement("div");
        title.className = "deal-item-title";
        title.textContent = `${shelf ? shelf.name : sale.shelfId} — ${
          product ? product.name : ""
        }`;

        const amount = document.createElement("div");
        amount.className = "deal-item-amount";
        amount.textContent = `+${formatCurrency(sale.amount)}`;

        top.appendChild(title);
        top.appendChild(amount);

        const bottom = document.createElement("div");
        bottom.className = "deal-item-bottom";

        const dt = new Date(sale.date);
        const createdAt = sale.createdAt
          ? new Date(sale.createdAt)
          : dt;

        const dateSpan = document.createElement("span");
        dateSpan.className = "deal-item-date";
        dateSpan.textContent = `${formatDateRu(
          sale.date
        )}, ${createdAt.toTimeString().slice(0, 5)}`;

        const commentSpan = document.createElement("span");
        commentSpan.className = "deal-item-comment";
        commentSpan.textContent = sale.comment || "";

        bottom.appendChild(dateSpan);
        bottom.appendChild(commentSpan);

        item.appendChild(top);
        item.appendChild(bottom);

        // Клик — показать модалку с деталями
        item.addEventListener("click", () => {
          openDealDetailsModal(sale.id);
        });

        dealsList.appendChild(item);
      });
  }

  function openDealDetailsModal(saleId) {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    dealDetailsBody.innerHTML = "";

    const shelf = SHELVES_CONFIG.find((s) => s.id === sale.shelfId);
    const product = shelf
      ? shelf.products.find((p) => p.id === sale.productId)
      : null;

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

    addRow(
      "Дата",
      formatDateRu(sale.date)
    );
    const createdAt = sale.createdAt ? new Date(sale.createdAt) : null;
    if (createdAt) {
      addRow(
        "Время",
        createdAt.toTimeString().slice(0, 8)
      );
    }
    addRow("Полка", shelf ? shelf.name : sale.shelfId);
    addRow("Продукт", product ? product.name : "");
    addRow("Сумма", formatCurrency(sale.amount));
    if (sale.insuranceSum) {
      addRow("Сумма страховки", formatCurrency(sale.insuranceSum));
    }
    addRow("Комментарий", sale.comment || "—");

    dealDetailsBody.appendChild(dl);

    // навешиваем ID
    dealDetailsModal.dataset.saleId = sale.id;

    openModal("deal-details-modal");
  }

  function attachDealsHandlers() {
    if (dealsShelfFilter) {
      dealsShelfFilter.addEventListener("change", () => {
        renderDealsList();
      });
    }

    if (dealDetailsEditBtn) {
      dealDetailsEditBtn.addEventListener("click", () => {
        const saleId = dealDetailsModal.dataset.saleId;
        if (!saleId) return;
        const sale = state.sales.find((s) => s.id === saleId);
        if (!sale) return;
        closeModal("deal-details-modal");
        // Открываем день и сразу в режим редактирования
        currentYear = new Date(sale.date).getFullYear();
        currentMonth = new Date(sale.date).getMonth();
        state.currentYear = currentYear;
        state.currentMonth = currentMonth;
        saveState();
        buildCalendar();
        openDayModal(sale.date);
        fillSaleFormForEdit(saleId);
      });
    }

    if (dealDetailsDeleteBtn) {
      dealDetailsDeleteBtn.addEventListener("click", () => {
        const saleId = dealDetailsModal.dataset.saleId;
        if (!saleId) return;
        closeModal("deal-details-modal");
        askDeleteSale(saleId);
      });
    }
  }

  // ==============================
  // График по будним дням
  // ==============================

  function renderSalesChart() {
    if (!salesChartCanvas) return;
    const ctx = salesChartCanvas.getContext("2d");
    const width = salesChartCanvas.width;
    const height = salesChartCanvas.height;

    ctx.clearRect(0, 0, width, height);

    const monthKey = getMonthKey(currentYear, currentMonth);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const points = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
      const dt = new Date(currentYear, currentMonth, day);
      const jsDay = dt.getDay();
      const isWeekend = jsDay === 0 || jsDay === 6;
      if (isWeekend) continue;
      if (state.weekends[dateStr]) continue;

      const total = getDayTotalForDate(dateStr);
      points.push({ dateStr, total });
    }

    if (points.length === 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Нет данных для графика", 20, height / 2);
      return;
    }

    const maxY = Math.max(...points.map((p) => p.total), 1);
    const padding = 32;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Оси
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + chartHeight);
    ctx.lineTo(padding + chartWidth, padding + chartHeight);
    ctx.stroke();

    // Горизонтальные линии
    const gridLines = 4;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    for (let i = 1; i <= gridLines; i++) {
      const y =
        padding +
        (chartHeight * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + chartWidth, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Линия графика
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#38bdf8"; // яркий синий
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x =
        padding +
        (chartWidth *
          (idx / Math.max(points.length - 1, 1)));
      const y =
        padding +
        chartHeight -
        (chartHeight * p.total) / maxY;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Точки
    ctx.fillStyle = "#ef4444"; // красные точки
    points.forEach((p, idx) => {
      const x =
        padding +
        (chartWidth *
          (idx / Math.max(points.length - 1, 1)));
      const y =
        padding +
        chartHeight -
        (chartHeight * p.total) / maxY;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ==============================
  // Звонки
  // ==============================

  function renderCallsList() {
    if (!callsList) return;
    callsList.innerHTML = "";

    if (state.calls.length === 0) {
      const p = document.createElement("p");
      p.className = "empty-placeholder";
      p.textContent = "Звонков ещё нет.";
      callsList.appendChild(p);
      return;
    }

    const sorted = state.calls
      .slice()
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    sorted.forEach((call) => {
      const item = document.createElement("div");
      item.className = "call-item";

      const top = document.createElement("div");
      top.className = "call-item-top";

      const nameSpan = document.createElement("span");
      nameSpan.className = "call-item-name";
      nameSpan.textContent = call.name || "Без имени";

      const resultSpan = document.createElement("span");
      resultSpan.className = `call-item-result call-item-result-${
        call.result || "positive"
      }`;
      resultSpan.textContent =
        call.result === "negative" ? "Отрицательный" : "Положительный";

      top.appendChild(nameSpan);
      top.appendChild(resultSpan);

      const bottom = document.createElement("div");
      bottom.className = "call-item-bottom";

      const phoneSpan = document.createElement("span");
      phoneSpan.className = "call-item-phone";
      phoneSpan.textContent = call.phone;

      const dt = call.createdAt ? new Date(call.createdAt) : new Date();
      const dateSpan = document.createElement("span");
      dateSpan.className = "call-item-date";
      dateSpan.textContent = `${dt
        .toLocaleDateString("ru-RU")
        .replace(/\u202F/g, " ")} ${dt
        .toTimeString()
        .slice(0, 5)}`;

      const commentSpan = document.createElement("span");
      commentSpan.className = "call-item-comment";
      commentSpan.textContent = call.comment || "";

      bottom.appendChild(phoneSpan);
      bottom.appendChild(dateSpan);
      bottom.appendChild(commentSpan);

      item.appendChild(top);
      item.appendChild(bottom);

      callsList.appendChild(item);
    });
  }

  function formatPhoneRu(value) {
    const digits = value.replace(/\D/g, "");
    let clean = digits;

    if (clean.startsWith("8")) {
      clean = "7" + clean.slice(1);
    }
    if (!clean.startsWith("7")) {
      clean = "7" + clean;
    }
    clean = clean.slice(0, 11);

    const parts = [];
    parts.push("+7(");
    if (clean.length > 1) {
      parts.push(clean.slice(1, 4));
    } else {
      parts.push("___");
    }
    parts.push(")-");
    if (clean.length > 4) {
      parts.push(clean.slice(4, 7));
    } else {
      parts.push("___");
    }
    parts.push("-");
    if (clean.length > 7) {
      parts.push(clean.slice(7, 9));
    } else {
      parts.push("__");
    }
    parts.push("-");
    if (clean.length > 9) {
      parts.push(clean.slice(9, 11));
    } else {
      parts.push("__");
    }

    return parts.join("");
  }

  function attachCallsHandlers() {
    if (addCallBtn) {
      addCallBtn.addEventListener("click", () => {
        callForm.reset();
        callReasonWrapper.classList.add("hidden");
        callCommentWrapper.classList.add("hidden");
        openModal("call-modal");
      });
    }

    if (callResultSelect) {
      callResultSelect.addEventListener("change", () => {
        if (callResultSelect.value === "negative") {
          callReasonWrapper.classList.remove("hidden");
        } else {
          callReasonWrapper.classList.add("hidden");
          callCommentWrapper.classList.add("hidden");
          callReasonSelect.value = "no-answer";
          callCommentInput.value = "";
        }
      });
    }

    if (callReasonSelect) {
      callReasonSelect.addEventListener("change", () => {
        if (callReasonSelect.value === "other") {
          callCommentWrapper.classList.remove("hidden");
        } else {
          callCommentWrapper.classList.add("hidden");
          callCommentInput.value = "";
        }
      });
    }

    const callPhoneInput = qs("#call-phone");
    if (callPhoneInput) {
      callPhoneInput.addEventListener("input", (e) => {
        const caretEnd = e.target.selectionEnd;
        const oldLen = e.target.value.length;
        const formatted = formatPhoneRu(e.target.value);
        e.target.value = formatted;
        const diff = formatted.length - oldLen;
        e.target.setSelectionRange(caretEnd + diff, caretEnd + diff);
      });
    }

    if (callForm) {
      callForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const name = qs("#call-name").value.trim();
        const phone = qs("#call-phone").value.trim();
        const result = callResultSelect.value;
        const reason = callReasonSelect.value;
        const comment = callCommentInput.value.trim();

        if (!name) {
          showToast("Введите ФИО клиента", "error");
          return;
        }
        if (!phone || phone.indexOf("_") !== -1) {
          showToast("Введите корректный номер телефона", "error");
          return;
        }

        if (result === "negative") {
          if (!reason) {
            showToast("Выберите причину отказа", "error");
            return;
          }
          if (reason === "other" && !comment) {
            showToast(
              "Укажите комментарий при причине 'Другое'",
              "error"
            );
            return;
          }
        }

        const call = {
          id: genId(),
          name,
          phone,
          result,
          reason: result === "negative" ? reason : null,
          comment: result === "negative" ? comment : "",
          createdAt: new Date().toISOString(),
        };

        state.calls.push(call);
        saveState();
        renderCallsList();
        closeModal("call-modal");
        showToast("Звонок сохранён", "success");
      });
    }
  }

  // ==============================
  // Редактирование цен
  // ==============================

  function renderPricesModal() {
    pricesModalBody.innerHTML = "";

    SHELVES_CONFIG.forEach((shelf) => {
      const block = document.createElement("div");
      block.className = "prices-shelf-block";

      const title = document.createElement("h3");
      title.className = "prices-shelf-title";
      title.textContent = shelf.name;
      block.appendChild(title);

      shelf.products.forEach((product) => {
        const row = document.createElement("div");
        row.className = "prices-row";

        const label = document.createElement("label");
        label.className = "field-label";
        label.setAttribute(
          "for",
          `price-${shelf.id}-${product.id}`
        );
        label.textContent = product.name;

        const field = document.createElement("div");
        field.className = "field";

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.step = product.type === "percent" ? "0.1" : "50";
        input.id = `price-${shelf.id}-${product.id}`;
        input.inputMode = "decimal";

        const value = getProductValue(shelf.id, product.id);
        input.value = value;

        const suffix = document.createElement("span");
        suffix.className = "prices-suffix";
        suffix.textContent =
          product.type === "percent" ? "% от суммы" : "₽";

        field.appendChild(input);
        field.appendChild(suffix);

        row.appendChild(label);
        row.appendChild(field);

        block.appendChild(row);
      });

      pricesModalBody.appendChild(block);
    });
  }

  function savePricesFromModal() {
    SHELVES_CONFIG.forEach((shelf) => {
      shelf.products.forEach((product) => {
        const input = qs(
          `#price-${shelf.id}-${product.id}`
        );
        if (!input) return;
        const value = parseNumberInput(input.value);
        setProductOverrideValue(shelf.id, product.id, value);
      });
    });

    saveState();
    renderShelvesInfo();
    // Новые цены применяются только к новым продажам — старые не пересчитываем
    showToast("Цены обновлены", "success");
  }

  // ==============================
  // Общий итог / премия
  // ==============================

  function computeMonthStats(year, monthIndex) {
    const monthKey = getMonthKey(year, monthIndex);

    const monthSales = state.sales.filter((s) =>
      s.date.startsWith(monthKey)
    );

    const earningsByShelf = {};
    monthSales.forEach((s) => {
      earningsByShelf[s.shelfId] =
        (earningsByShelf[s.shelfId] || 0) + s.amount;
    });

    const totalEarnings = monthSales.reduce(
      (sum, s) => sum + s.amount,
      0
    );

    // Кол-во рабочих дней с продажами (не выходные, не кастомный "выходной")
    const daysWithSalesSet = new Set(
      monthSales.map((s) => s.date)
    );
    let serviceDays = 0;
    daysWithSalesSet.forEach((dateStr) => {
      const [y, m, d] = dateStr
        .split("-")
        .map((v) => parseInt(v, 10));
      const dt = new Date(y, m - 1, d);
      const jsDay = dt.getDay();
      const weekend = jsDay === 0 || jsDay === 6;
      const customWeekend = !!state.weekends[dateStr];
      if (!weekend && !customWeekend) {
        serviceDays += 1;
      }
    });

    const serviceBonus =
      state.serviceWorker ? SERVICE_DAY_BONUS * serviceDays : 0;

    return {
      earningsByShelf,
      totalEarnings,
      serviceDays,
      serviceBonus,
    };
  }

  function recalcSummary() {
    const { totalEarnings, serviceBonus } = computeMonthStats(
      currentYear,
      currentMonth
    );

    const { coef } = computeCoefficient();

    const salary = clampNumber(state.salary || 0);
    const salaryNet = salary * (1 - TAX_RATE);

    const baseForBonus = totalEarnings + serviceBonus;
    const bonusGross = baseForBonus * coef;
    const bonusNet = bonusGross * (1 - TAX_RATE);

    if (earnTotalEl) {
      earnTotalEl.textContent = formatCurrency(totalEarnings);
    }
    if (earnServiceEl) {
      earnServiceEl.textContent = formatCurrency(serviceBonus);
    }
    if (coefValueEl) {
      coefValueEl.textContent = coef.toFixed(1);
    }
    if (bonusGrossEl) {
      bonusGrossEl.textContent = formatCurrency(bonusGross);
    }
    if (bonusNetEl) {
      bonusNetEl.textContent = formatCurrency(bonusNet);
    }
    if (totalWithSalaryEl) {
      totalWithSalaryEl.textContent = formatCurrency(
        salaryNet + bonusNet
      );
    }
  }

  // ==============================
  // Вкладки
  // ==============================

  function attachTabsHandlers() {
    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        if (!tab) return;

        tabButtons.forEach((b) =>
          b.classList.remove("active")
        );
        btn.classList.add("active");

        tabPanels.forEach((panel) => {
          panel.classList.toggle(
            "active",
            panel.id === `tab-${tab}`
          );
        });
      });
    });
  }

  // ==============================
  // Общие обработчики
  // ==============================

  function attachGlobalHandlers() {
    if (salaryInput) {
      salaryInput.value = state.salary || "";
      salaryInput.addEventListener("change", () => {
        const val = parseNumberInput(salaryInput.value);
        state.salary = val;
        saveState();
        recalcSummary();
      });
    }

    if (serviceWorkerToggle) {
      serviceWorkerToggle.checked = !!state.serviceWorker;
      serviceWorkerToggle.addEventListener("change", () => {
        state.serviceWorker = serviceWorkerToggle.checked;
        saveState();
        recalcSummary();
      });
    }

    if (editPlanBtn) {
      editPlanBtn.addEventListener("click", () => {
        renderPlanModal();
        openModal("plan-modal");
      });
    }

    if (planSaveBtn) {
      planSaveBtn.addEventListener("click", () => {
        savePlanFromModal();
        closeModal("plan-modal");
      });
    }

    if (editPricesBtn) {
      editPricesBtn.addEventListener("click", () => {
        renderPricesModal();
        openModal("prices-modal");
      });
    }

    if (pricesSaveBtn) {
      pricesSaveBtn.addEventListener("click", () => {
        savePricesFromModal();
        closeModal("prices-modal");
      });
    }

    if (resetDataBtn) {
      resetDataBtn.addEventListener("click", () => {
        if (
          window.confirm(
            "Вы точно хотите полностью сбросить все данные?"
          )
        ) {
          resetState();
        }
      });
    }

    if (confirmYesBtn) {
      confirmYesBtn.addEventListener("click", () => {
        closeModal("confirm-modal");
        if (pendingDeleteSaleId) {
          deleteSaleById(pendingDeleteSaleId);
          pendingDeleteSaleId = null;
        }
      });
    }

    if (confirmNoBtn) {
      confirmNoBtn.addEventListener("click", () => {
        pendingDeleteSaleId = null;
        closeModal("confirm-modal");
      });
    }
  }

  // ==============================
  // Полный ререндер
  // ==============================

  function rerenderAll() {
    ensureMonthPlan(currentYear, currentMonth);
    renderShelvesInfo();
    renderPlanProgress();
    buildCalendar();
    renderDealsList();
    renderSalesChart();
    renderCallsList();
    recalcSummary();
  }

  // ==============================
  // INIT
  // ==============================

  function init() {
    attachTabsHandlers();
    attachGlobalHandlers();
    attachCalendarHandlers();
    attachDealsHandlers();
    attachCallsHandlers();
    attachModalGlobalHandlers();
    if (dealsShelfFilter && dealsShelfFilter.options.length === 1) {
      buildDealsShelfFilterOptions();
    }
    rerenderAll();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
