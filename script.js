// scrypt.js
// ЛОГИКА КАЛЬКУЛЯТОРА ЗП СТАРШЕГО ЭКСПЕРТА (SPA, localStorage, календарь, сделки, звонки)
// -----------------------------------------------------------------------------
// ВАЖНО: Этот файл отвечает ТОЛЬКО за JS-логику.
// Разметку и стили ты уже делаешь сам, но ниже я пишу, какие ID/атрибуты ожидаются.
// Ты можешь адаптировать селекторы под свою HTML-структуру, если нужно.
//
// ОЖИДАЕМЫЕ ОСНОВНЫЕ ЭЛЕМЕНТЫ В HTML:
//
// 1) Навигация по вкладкам (SPA):
//    Кнопки/элементы с data-tab-target="#id_вкладки"
//    Секции/вкладки с атрибутом data-tab-content и соответствующим id:
//      <section id="tab-calc" data-tab-content></section>
//      <section id="tab-calendar" data-tab-content></section>
//      <section id="tab-deals" data-tab-content></section>
//      div/section id="tab-calls" data-tab-content></section>
//
// 2) Вкладка "Подсчет":
//    - Оклад:   <input id="salary-base-input" type="number">
//    - Кнопка "План": <button id="btn-open-plan"></button>
//    - Кнопка "Редактировать цены": <button id="btn-open-prices"></button>
//    - Тоггл "Сервисный сотрудник": <input id="service-toggle" type="checkbox">
//    - Вывод общей выручки (без коэффициента):    <span id="total-raw-earnings"></span>
//    - Вывод дохода с учетом коэффициента:        <span id="total-earnings-with-coef"></span>
//    - Текущий коэффициент:                       <span id="current-coef"></span>
//    - Премия (грязная):                          <span id="premium-gross"></span>
//    - Премия (на руки):                          <span id="premium-net"></span>
//    - Полки и прогресс по ним (минимум): span'ы
//      data-shelf-progress="consumer|cards|dk|savings|pension"
//      data-shelf-earned="consumer|cards|dk|savings|pension"
//      data-shelf-plan="consumer|cards|dk|savings|pension"
//
// 3) Вкладка "Календарь":
//    - Контейнер дней:     <div id="calendar-grid"></div>
//    - Контейнер дней недели (опционально): <div id="calendar-weekdays"></div>
//    - Канвас графика:     <canvas id="sales-chart"></canvas>
//
// 4) Вкладка "Мои сделки":
//    - Селект фильтра полок: <select id="deals-filter"></select>
//    - Контейнер списка:     <div id="deals-list"></div>
//
// 5) Вкладка "Звонки":
//    - Кнопка "Добавить звонок": <button id="btn-add-call"></button>
//    - Контейнер списка:         <div id="calls-list"></div>
//
// 6) Общие модальные окна:
//    - Оверлей / контейнер для модалок: <div id="modal-root"></div> (JS сам будет внутрь вставлять)
//
// -----------------------------------------------------------------------------
// ВЕСЬ КОД ЗАВЕРНУТ В IIFE, ЧТОБЫ НЕ МУСОРИТЬ В ГЛОБАЛЬНОЙ ОБЛАСТИ
// -----------------------------------------------------------------------------

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // УТИЛИТЫ
  // ---------------------------------------------------------------------------

  const LS_KEY = "senior_expert_app_state_v1";

  function formatMoney(value) {
    if (!isFinite(value)) return "0 ₽";
    return (
      Math.round((value + Number.EPSILON) * 100) / 100
    ).toLocaleString("ru-RU", { minimumFractionDigits: 0 }) + " ₽";
  }

  function formatPercent(value) {
    if (!isFinite(value)) return "0%";
    return (Math.round(value * 10) / 10).toLocaleString("ru-RU") + "%";
  }

  function formatDateISO(date) {
    // date: Date
    return date.toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function parseISOToDate(iso) {
    // iso: "YYYY-MM-DD"
    return new Date(iso + "T00:00:00");
  }

  function todayISO() {
    return formatDateISO(new Date());
  }

  function getCurrentMonthKey() {
    const now = new Date();
    return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0"); // YYYY-MM
  }

  function createElement(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.text) el.textContent = options.text;
    if (options.html != null) el.innerHTML = options.html;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    }
    if (options.children) {
      options.children.forEach((child) => child && el.appendChild(child));
    }
    return el;
  }

  function generateId(prefix) {
    return prefix + "_" + Math.random().toString(36).slice(2, 9);
  }

  // ---------------------------------------------------------------------------
  // ДЕФОЛТНЫЕ НАСТРОЙКИ ПОЛОК И ЦЕН
  // ---------------------------------------------------------------------------

  const DEFAULT_STATE = {
    monthKey: getCurrentMonthKey(),
    // Оклад
    salaryBase: 0,
    // Режим сервисного сотрудника
    serviceMode: false,
    // План по полкам (только 5 полок, без коробочного страхования)
    plan: {
      consumer: 0,
      cards: 0,
      dk: 0,
      savings: 0,
      pension: 0,
    },
    // Цены/проценты по продуктам
    prices: {
      // 1. Потребительский кредит
      consumer: {
        loanApplication: 0, // Заявка: 0 ₽
        loanIssue: 2500, // Выдача: 2500 ₽
      },
      // 2. Кредитные карты
      cards: {
        withReview: 1000, // С рассмотрением: 1000 ₽
        split: 400, // Сплит: 400 ₽
        application: 0, // Заявка: 0 ₽
      },
      // 3. Активация ДК
      dk: {
        cardIssue: 0, // Выдача карты: 0 ₽
        taYarkaya: 600, // ТА "Яркой"
        taOther: 350, // ТА остальным (кроме ЕКП)
        taEkp: 250, // ТА по ЕКП
      },
      // 4. Накопительная полка
      savings: {
        deposit: 450, // Вклад
        savingsAccount: 350, // Накопительный счёт
        premiumLightIssue: 300, // Выдача Premium Light
        premiumLightSticker: 49, // Кнопка учёта стикеров Premium Light
        smsInfo: 70, // СМС информирование
        leadCpo: 500, // Лид ЦПО
        leadMortgage: 500, // Лид ипотека
        cardSafeIns: 100, // Страхование "Карточный сейф"
      },
      // 5. Коробочное страхование (проценты от суммы)
      box: {
        general: 8, // Стандартное: 8% от суммы
        promo: 1, // Акционное: 1%
        standard: 3, // Стандартное: 3%
      },
      // 6. Перевод пенсии
      pension: {
        insurance: 1500, // Страховая пенсия
        military: 1500, // Военная пенсия
      },
    },
    // Продажи по дням: { "YYYY-MM-DD": { isWeekend: bool, sales:[...] } }
    days: {},
    // Звонки: массив
    calls: [],
  };

  // ---------------------------------------------------------------------------
  // РАБОТА С localStorage
  // ---------------------------------------------------------------------------

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return structuredClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);

      // Если месяц сменился — план сбрасываем, остальное оставляем
      const currentMonth = getCurrentMonthKey();
      if (parsed.monthKey !== currentMonth) {
        parsed.monthKey = currentMonth;
        parsed.plan = structuredClone(DEFAULT_STATE.plan);
      }

      // Защита на случай отсутствующих полей
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
        plan: { ...structuredClone(DEFAULT_STATE.plan), ...(parsed.plan || {}) },
        prices: mergeDeep(structuredClone(DEFAULT_STATE.prices), parsed.prices || {}),
      };
    } catch (e) {
      console.warn("Ошибка загрузки состояния, используем дефолт:", e);
      return structuredClone(DEFAULT_STATE);
    }
  }

  function mergeDeep(target, source) {
    if (typeof source !== "object" || source === null) return target;
    Object.keys(source).forEach((key) => {
      if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        mergeDeep(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    });
    return target;
  }

  function saveState() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Ошибка сохранения в localStorage:", e);
    }
  }

  // ---------------------------------------------------------------------------
  // ГЛОБАЛЬНОЕ СОСТОЯНИЕ В ПАМЯТИ
  // ---------------------------------------------------------------------------

  let state = loadState();

  // ---------------------------------------------------------------------------
  // ТАБЫ / SPA
  // ---------------------------------------------------------------------------

  function initTabs() {
    const tabButtons = document.querySelectorAll("[data-tab-target]");
    const tabContents = document.querySelectorAll("[data-tab-content]");

    function activateTab(targetId) {
      tabContents.forEach((c) => {
        c.classList.toggle("is-active", "#" + c.id === targetId);
      });
      tabButtons.forEach((btn) => {
        const t = btn.getAttribute("data-tab-target");
        btn.classList.toggle("is-active", t === targetId);
      });
    }

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-tab-target");
        if (!target) return;
        activateTab(target);
      });
    });

    // По умолчанию активируем первую вкладку, если ничего не активно
    if (!document.querySelector("[data-tab-content].is-active") && tabContents[0]) {
      activateTab("#" + tabContents[0].id);
    }
  }

  // ---------------------------------------------------------------------------
  // МОДАЛЬНЫЕ ОКНА (общий механизм)
  // ---------------------------------------------------------------------------

  function getModalRoot() {
    let root = document.getElementById("modal-root");
    if (!root) {
      root = createElement("div", { attrs: { id: "modal-root" } });
      document.body.appendChild(root);
    }
    return root;
  }

  function openModal(contentEl, options = {}) {
    const root = getModalRoot();
    const backdrop = createElement("div", {
      className: "modal-backdrop",
    });
    const modal = createElement("div", { className: "modal-shell" });

    if (options.maxWidth) {
      modal.style.maxWidth = options.maxWidth;
    }

    modal.appendChild(contentEl);
    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    function close() {
      backdrop.remove();
      if (typeof options.onClose === "function") options.onClose();
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop && !options.disableBackdropClose) {
        close();
      }
    });

    return { close, backdrop, modal };
  }

  function openConfirmDialog(message, onConfirm) {
    const content = createElement("div", {
      className: "modal-card",
    });

    const title = createElement("h3", {
      className: "modal-title",
      text: "Подтверждение",
    });

    const text = createElement("p", {
      className: "modal-text",
      text: message || "Вы точно хотите удалить?",
    });

    const buttonsRow = createElement("div", {
      className: "modal-actions",
    });

    const btnYes = createElement("button", {
      className: "btn btn-danger",
      text: "Да",
    });
    const btnNo = createElement("button", {
      className: "btn btn-secondary",
      text: "Нет",
    });

    buttonsRow.appendChild(btnYes);
    buttonsRow.appendChild(btnNo);

    content.appendChild(title);
    content.appendChild(text);
    content.appendChild(buttonsRow);

    const { close } = openModal(content, { maxWidth: "360px" });

    btnYes.addEventListener("click", () => {
      if (typeof onConfirm === "function") onConfirm();
      close();
    });

    btnNo.addEventListener("click", () => {
      close();
    });
  }

  // ---------------------------------------------------------------------------
  // ПЛАН ПО ПОЛКАМ
  // ---------------------------------------------------------------------------

  const SHELVES_META = {
    consumer: { label: "Потребительский кредит" },
    cards: { label: "Кредитные карты" },
    dk: { label: "Активация ДК" },
    savings: { label: "Накопительная полка" },
    pension: { label: "Перевод пенсии" },
  };

  function openPlanModal() {
    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: "План по полкам (за месяц)",
    });

    const form = createElement("form", {
      className: "modal-form",
    });

    Object.entries(SHELVES_META).forEach(([key, meta]) => {
      const wrapper = createElement("div", { className: "form-row" });
      const label = createElement("label", {
        className: "form-label",
        text: meta.label,
      });
      const input = createElement("input", {
        className: "form-input",
        attrs: { type: "number", min: "0", step: "1", "data-plan-shelf": key },
      });
      input.value = state.plan[key] ?? 0;
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      form.appendChild(wrapper);
    });

    const helpText = createElement("p", {
      className: "form-help",
      text: "План действует с 1 по последнее число текущего месяца. В новом месяце план обнуляется, а данные продаж и цены сохраняются.",
    });

    const actions = createElement("div", { className: "modal-actions" });
    const btnSave = createElement("button", {
      className: "btn btn-primary",
      text: "Сохранить план",
      attrs: { type: "submit" },
    });

    const btnCancel = createElement("button", {
      className: "btn btn-secondary",
      text: "Отмена",
      attrs: { type: "button" },
    });

    actions.appendChild(btnSave);
    actions.appendChild(btnCancel);

    content.appendChild(title);
    content.appendChild(form);
    content.appendChild(helpText);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "480px" });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputs = form.querySelectorAll("input[data-plan-shelf]");
      inputs.forEach((input) => {
        const shelf = input.getAttribute("data-plan-shelf");
        let value = parseFloat(input.value.replace(",", "."));
        if (!isFinite(value) || value < 0) value = 0;
        state.plan[shelf] = value;
      });
      state.monthKey = getCurrentMonthKey();
      saveState();
      recalcAndRenderAll();
      close();
    });

    btnCancel.addEventListener("click", () => {
      close();
    });
  }

  // ---------------------------------------------------------------------------
  // РЕДАКТИРОВАНИЕ ЦЕН ПО ПРОДУКТАМ
  // ---------------------------------------------------------------------------

  function openPricesModal() {
    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: "Настройка цен и процентов по продуктам",
    });

    const form = createElement("form", {
      className: "modal-form modal-form-scroll",
    });

    // Потребительский кредит
    const blockConsumer = createElement("div", { className: "prices-block" });
    blockConsumer.appendChild(
      createElement("h4", { className: "block-title", text: "Потребительский кредит" })
    );
    blockConsumer.appendChild(
      createPriceRow(
        "Заявка",
        "consumer",
        "loanApplication",
        state.prices.consumer.loanApplication,
        "₽ за штуку"
      )
    );
    blockConsumer.appendChild(
      createPriceRow(
        "Выдача",
        "consumer",
        "loanIssue",
        state.prices.consumer.loanIssue,
        "₽ за штуку"
      )
    );
    form.appendChild(blockConsumer);

    // Кредитные карты
    const blockCards = createElement("div", { className: "prices-block" });
    blockCards.appendChild(
      createElement("h4", { className: "block-title", text: "Кредитные карты" })
    );
    blockCards.appendChild(
      createPriceRow(
        "С рассмотрением",
        "cards",
        "withReview",
        state.prices.cards.withReview,
        "₽ за штуку"
      )
    );
    blockCards.appendChild(
      createPriceRow("Сплит", "cards", "split", state.prices.cards.split, "₽ за штуку")
    );
    blockCards.appendChild(
      createPriceRow(
        "Заявка",
        "cards",
        "application",
        state.prices.cards.application,
        "₽ за штуку"
      )
    );
    form.appendChild(blockCards);

    // Активация ДК
    const blockDk = createElement("div", { className: "prices-block" });
    blockDk.appendChild(
      createElement("h4", { className: "block-title", text: "Активация ДК" })
    );
    blockDk.appendChild(
      createPriceRow(
        "Выдача карты",
        "dk",
        "cardIssue",
        state.prices.dk.cardIssue,
        "₽ за штуку"
      )
    );
    blockDk.appendChild(
      createPriceRow(
        'ТА по "Яркой"',
        "dk",
        "taYarkaya",
        state.prices.dk.taYarkaya,
        "₽ за штуку"
      )
    );
    blockDk.appendChild(
      createPriceRow(
        "ТА по остальным (кроме ЕКП)",
        "dk",
        "taOther",
        state.prices.dk.taOther,
        "₽ за штуку"
      )
    );
    blockDk.appendChild(
      createPriceRow(
        "ТА по ЕКП",
        "dk",
        "taEkp",
        state.prices.dk.taEkp,
        "₽ за штуку"
      )
    );
    form.appendChild(blockDk);

    // Накопительная полка
    const blockSavings = createElement("div", { className: "prices-block" });
    blockSavings.appendChild(
      createElement("h4", { className: "block-title", text: "Накопительная полка" })
    );
    blockSavings.appendChild(
      createPriceRow("Вклад", "savings", "deposit", state.prices.savings.deposit, "₽")
    );
    blockSavings.appendChild(
      createPriceRow(
        "Накопительный счёт",
        "savings",
        "savingsAccount",
        state.prices.savings.savingsAccount,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        "Выдача Premium Light",
        "savings",
        "premiumLightIssue",
        state.prices.savings.premiumLightIssue,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        "Кнопка учёта стикеров Premium Light",
        "savings",
        "premiumLightSticker",
        state.prices.savings.premiumLightSticker,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        "СМС-информирование",
        "savings",
        "smsInfo",
        state.prices.savings.smsInfo,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        "Лид ЦПО",
        "savings",
        "leadCpo",
        state.prices.savings.leadCpo,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        "Лид ипотека",
        "savings",
        "leadMortgage",
        state.prices.savings.leadMortgage,
        "₽"
      )
    );
    blockSavings.appendChild(
      createPriceRow(
        'Страхование "Карточный сейф"',
        "savings",
        "cardSafeIns",
        state.prices.savings.cardSafeIns,
        "₽"
      )
    );
    form.appendChild(blockSavings);

    // Коробочное страхование
    const blockBox = createElement("div", { className: "prices-block" });
    blockBox.appendChild(
      createElement("h4", {
        className: "block-title",
        text: "Коробочное страхование (проценты от суммы)",
      })
    );
    blockBox.appendChild(
      createPriceRow(
        "Стандартное (без общих условий)",
        "box",
        "general",
        state.prices.box.general,
        "% от суммы"
      )
    );
    blockBox.appendChild(
      createPriceRow(
        "Акционное (со снижением ставки)",
        "box",
        "promo",
        state.prices.box.promo,
        "% от суммы"
      )
    );
    blockBox.appendChild(
      createPriceRow(
        "Стандартное (без снижения ставки)",
        "box",
        "standard",
        state.prices.box.standard,
        "% от суммы"
      )
    );
    form.appendChild(blockBox);

    // Перевод пенсии
    const blockPension = createElement("div", { className: "prices-block" });
    blockPension.appendChild(
      createElement("h4", {
        className: "block-title",
        text: "Перевод пенсии",
      })
    );
    blockPension.appendChild(
      createPriceRow(
        "Страховая пенсия",
        "pension",
        "insurance",
        state.prices.pension.insurance,
        "₽"
      )
    );
    blockPension.appendChild(
      createPriceRow(
        "Военная пенсия",
        "pension",
        "military",
        state.prices.pension.military,
        "₽"
      )
    );
    form.appendChild(blockPension);

    const actions = createElement("div", { className: "modal-actions" });
    const btnSave = createElement("button", {
      className: "btn btn-primary",
      text: "Сохранить",
      attrs: { type: "submit" },
    });
    const btnCancel = createElement("button", {
      className: "btn btn-secondary",
      text: "Отмена",
      attrs: { type: "button" },
    });

    actions.appendChild(btnSave);
    actions.appendChild(btnCancel);

    content.appendChild(title);
    content.appendChild(form);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "640px" });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const inputs = form.querySelectorAll("[data-price-shelf][data-price-key]");
      inputs.forEach((input) => {
        const shelf = input.getAttribute("data-price-shelf");
        const key = input.getAttribute("data-price-key");
        let value = parseFloat(input.value.replace(",", "."));
        if (!isFinite(value) || value < 0) value = 0;
        if (!state.prices[shelf]) state.prices[shelf] = {};
        state.prices[shelf][key] = value;
      });
      saveState();
      recalcAndRenderAll();
      close();
    });

    btnCancel.addEventListener("click", () => {
      close();
    });
  }

  function createPriceRow(labelText, shelfKey, priceKey, value, unitText) {
    const row = createElement("div", { className: "form-row" });
    const label = createElement("label", { className: "form-label", text: labelText });
    const inputWrap = createElement("div", { className: "input-with-unit" });

    const input = createElement("input", {
      className: "form-input",
      attrs: {
        type: "number",
        step: "0.01",
        min: "0",
        "data-price-shelf": shelfKey,
        "data-price-key": priceKey,
      },
    });
    input.value = value;

    const unit = createElement("span", { className: "input-unit", text: unitText });
    inputWrap.appendChild(input);
    inputWrap.appendChild(unit);

    row.appendChild(label);
    row.appendChild(inputWrap);
    return row;
  }

  // ---------------------------------------------------------------------------
  // ПРОДАЖИ / ДНИ
  // ---------------------------------------------------------------------------

  function getDayState(dateIso) {
    if (!state.days[dateIso]) {
      state.days[dateIso] = { isWeekend: false, sales: [] };
    }
    return state.days[dateIso];
  }

  function setDayWeekend(dateIso, isWeekend) {
    const day = getDayState(dateIso);
    day.isWeekend = !!isWeekend;
    saveState();
    recalcAndRenderAll();
  }

  function addSale(sale) {
    const day = getDayState(sale.date);
    day.sales.push(sale);
    saveState();
    recalcAndRenderAll();
  }

  function updateSale(saleId, updater) {
    let changed = false;
    Object.values(state.days).forEach((day) => {
      day.sales.forEach((sale) => {
        if (sale.id === saleId) {
          updater(sale);
          changed = true;
        }
      });
    });
    if (changed) {
      saveState();
      recalcAndRenderAll();
    }
  }

  function deleteSaleById(saleId) {
    let changed = false;
    Object.values(state.days).forEach((day) => {
      const before = day.sales.length;
      day.sales = day.sales.filter((s) => s.id !== saleId);
      if (day.sales.length !== before) changed = true;
    });
    if (changed) {
      saveState();
      recalcAndRenderAll();
    }
  }

  function getAllSalesForCurrentMonth() {
    const res = [];
    const monthKey = getCurrentMonthKey();
    Object.entries(state.days).forEach(([dateIso, day]) => {
      if (!dateIso.startsWith(monthKey + "-")) return;
      day.sales.forEach((sale) => {
        res.push({ ...sale, isWeekend: day.isWeekend });
      });
    });
    // Сортировка по дате и времени создания (по убыванию)
    res.sort((a, b) => {
      if (a.date === b.date) {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      }
      return b.date.localeCompare(a.date);
    });
    return res;
  }

  // ---------------------------------------------------------------------------
  // ДОХОД ПО ПОЛКАМ / КОЭФФИЦИЕНТЫ / ПРЕМИЯ
  // ---------------------------------------------------------------------------

  function calculateShelfEarnings() {
    const shelfTotals = {
      consumer: 0,
      cards: 0,
      dk: 0,
      savings: 0,
      pension: 0,
      box: 0, // отдельно, для информации
    };

    const monthKey = getCurrentMonthKey();
    Object.entries(state.days).forEach(([dateIso, day]) => {
      if (!dateIso.startsWith(monthKey + "-")) return;
      day.sales.forEach((sale) => {
        if (!shelfTotals.hasOwnProperty(sale.shelf)) {
          shelfTotals[sale.shelf] = 0;
        }
        shelfTotals[sale.shelf] += sale.reward || 0;
      });
    });

    return shelfTotals;
  }

  function calculateCoefficient(shelfTotals) {
    // Считаем полки, достигшие 100% плана
    const plan = state.plan;
    const fullShelves = [];

    ["consumer", "cards", "dk", "savings", "pension"].forEach((shelf) => {
      const planVal = plan[shelf] || 0;
      if (planVal <= 0) return;
      const earned = shelfTotals[shelf] || 0;
      const progress = (earned / planVal) * 100;
      if (progress >= 100) fullShelves.push(shelf);
    });

    let coef = 0;
    const fullCount = fullShelves.length;

    if (fullCount === 0) {
      coef = 0;
    } else if (fullCount <= 3) {
      coef = 1.0;
    } else if (fullCount >= 5) {
      coef = 1.3;
    } else {
      // 4 полки
      coef = 1.2;
    }

    // Штраф за невыполненный "Перевод пенсии"
    if (fullCount > 0) {
      const pensionPlan = plan.pension || 0;
      let pensionFull = false;
      if (pensionPlan > 0) {
        const earnedPension = shelfTotals.pension || 0;
        const prog = (earnedPension / pensionPlan) * 100;
        pensionFull = prog >= 100;
      }
      if (!pensionFull) {
        coef -= 0.1;
      }
    }

    if (coef < 0) coef = 0;
    return { coef, fullShelves };
  }

  function countWorkingDaysCurrentMonth() {
    const monthKey = getCurrentMonthKey();
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1..12

    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yearStr}-${monthStr}-${String(d).padStart(2, "0")}`;
      const dayState = state.days[iso];
      const isWeekend = dayState?.isWeekend || false;
      if (!isWeekend) count++;
    }
    return count;
  }

  function calculatePremium() {
    const shelfTotals = calculateShelfEarnings();
    const { coef } = calculateCoefficient(shelfTotals);

    const totalEarnings =
      (shelfTotals.consumer || 0) +
      (shelfTotals.cards || 0) +
      (shelfTotals.dk || 0) +
      (shelfTotals.savings || 0) +
      (shelfTotals.pension || 0) +
      (shelfTotals.box || 0); // коробочное тоже платится

    const earningsWithCoef = totalEarnings * coef;

    let serviceBonus = 0;
    if (state.serviceMode) {
      const workingDays = countWorkingDaysCurrentMonth();
      serviceBonus = workingDays * 500;
    }

    const grossPremium = earningsWithCoef + serviceBonus;
    const netPremium = grossPremium * 0.87; // -13%

    return {
      shelfTotals,
      coef,
      totalEarnings,
      earningsWithCoef,
      serviceBonus,
      grossPremium,
      netPremium,
    };
  }

  // ---------------------------------------------------------------------------
  // ВКЛАДКА "ПОДСЧЕТ" — ОТРИСОВКА
  // ---------------------------------------------------------------------------

  function renderCalcView() {
    const baseInput = document.getElementById("salary-base-input");
    const toggleService = document.getElementById("service-toggle");

    if (baseInput) {
      baseInput.value = state.salaryBase ?? 0;
      baseInput.addEventListener("change", () => {
        let v = parseFloat(baseInput.value.replace(",", "."));
        if (!isFinite(v) || v < 0) v = 0;
        state.salaryBase = v;
        saveState();
        recalcAndRenderAll();
      });
    }

    if (toggleService) {
      toggleService.checked = !!state.serviceMode;
      toggleService.addEventListener("change", () => {
        state.serviceMode = toggleService.checked;
        saveState();
        recalcAndRenderAll();
      });
    }

    const {
      shelfTotals,
      coef,
      totalEarnings,
      earningsWithCoef,
      serviceBonus,
      grossPremium,
      netPremium,
    } = calculatePremium();

    const elTotalRaw = document.getElementById("total-raw-earnings");
    const elTotalWithCoef = document.getElementById("total-earnings-with-coef");
    const elCoef = document.getElementById("current-coef");
    const elPremiumGross = document.getElementById("premium-gross");
    const elPremiumNet = document.getElementById("premium-net");

    if (elTotalRaw) elTotalRaw.textContent = formatMoney(totalEarnings);
    if (elTotalWithCoef) elTotalWithCoef.textContent = formatMoney(earningsWithCoef + serviceBonus);
    if (elCoef) elCoef.textContent = coef.toFixed(2);

    if (elPremiumGross) {
      elPremiumGross.textContent = formatMoney(grossPremium);
    }
    if (elPremiumNet) {
      elPremiumNet.textContent = formatMoney(netPremium);
    }

    // Прогресс по полкам
    Object.entries(SHELVES_META).forEach(([shelfKey]) => {
      const earnedEl = document.querySelector(
        `[data-shelf-earned="${shelfKey}"]`
      );
      const planEl = document.querySelector(`[data-shelf-plan="${shelfKey}"]`);
      const progressEl = document.querySelector(
        `[data-shelf-progress="${shelfKey}"]`
      );

      const planVal = state.plan[shelfKey] || 0;
      const earnedVal = shelfTotals[shelfKey] || 0;
      const progress = planVal > 0 ? (earnedVal / planVal) * 100 : 0;

      if (earnedEl) earnedEl.textContent = formatMoney(earnedVal);
      if (planEl) planEl.textContent = planVal > 0 ? formatMoney(planVal) : "0 ₽";

      if (progressEl) {
        const capped = Math.max(0, progress);
        progressEl.textContent = formatPercent(capped);
        // Можно использовать data-атрибут для CSS (градиент по проценту)
        progressEl.dataset.progress = String(capped);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // КАЛЕНДАРЬ
  // ---------------------------------------------------------------------------

  function initCalendar() {
    const grid = document.getElementById("calendar-grid");
    if (!grid) return;

    grid.innerHTML = "";

    const monthKey = getCurrentMonthKey();
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1..12
    const daysInMonth = new Date(year, month, 0).getDate();

    const firstDay = new Date(year, month - 1, 1);
    const firstWeekday = (firstDay.getDay() + 6) % 7; // 0 = Monday

    // Заполняем пустые слоты до 1 числа
    for (let i = 0; i < firstWeekday; i++) {
      const emptyCell = createElement("div", { className: "calendar-cell empty" });
      grid.appendChild(emptyCell);
    }

    // Дни месяца
    for (let d = 1; d <= daysInMonth; d++) {
      const dateIso = `${yearStr}-${monthStr}-${String(d).padStart(2, "0")}`;
      const dayState = state.days[dateIso] || { isWeekend: false, sales: [] };
      const isWeekend = !!dayState.isWeekend;

      const cell = createElement("button", {
        className: "calendar-cell day-cell",
        attrs: { "data-date": dateIso, type: "button" },
      });

      if (isWeekend) {
        cell.classList.add("day-weekend");
      }

      const dayNumber = createElement("div", {
        className: "day-number",
        text: String(d),
      });

      const total = (dayState.sales || []).reduce(
        (sum, s) => sum + (s.reward || 0),
        0
      );

      const totalEl = createElement("div", {
        className: "day-total",
        text: total > 0 ? formatMoney(total) : "",
      });

      cell.appendChild(dayNumber);
      cell.appendChild(totalEl);

      cell.addEventListener("click", () => {
        openDayModal(dateIso);
      });

      grid.appendChild(cell);
    }

    renderChart();
  }

  function renderChart() {
    const canvas = document.getElementById("sales-chart");
    if (!canvas || !canvas.getContext) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 260;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const monthKey = getCurrentMonthKey();
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1..12
    const daysInMonth = new Date(year, month, 0).getDate();

    const points = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${yearStr}-${monthStr}-${String(d).padStart(2, "0")}`;
      const dayState = state.days[iso] || { isWeekend: false, sales: [] };
      if (dayState.isWeekend) continue;

      const total = (dayState.sales || []).reduce(
        (sum, s) => sum + (s.reward || 0),
        0
      );
      points.push({ dateIso: iso, value: total });
    }

    if (!points.length) {
      // Ничего не рисуем, можно написать "Нет данных"
      ctx.font = "14px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("Нет данных", width / 2, height / 2);
      return;
    }

    const paddingLeft = 40;
    const paddingRight = 10;
    const paddingTop = 10;
    const paddingBottom = 30;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxVal = Math.max(...points.map((p) => p.value), 1);

    // Ось Y (просто линия)
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, paddingTop + chartHeight);
    ctx.stroke();

    // Ось X
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop + chartHeight);
    ctx.lineTo(width - paddingRight, paddingTop + chartHeight);
    ctx.stroke();

    // Подготовим точки
    const stepX = points.length > 1 ? chartWidth / (points.length - 1) : 0;

    const xyPoints = points.map((p, idx) => {
      const x = paddingLeft + stepX * idx;
      const y =
        paddingTop + chartHeight - (p.value / maxVal) * chartHeight;
      return { ...p, x, y };
    });

    // Линия
    ctx.beginPath();
    xyPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 150, 255, 0.9)";
    ctx.stroke();

    // Плавное заполнение под линией
    const gradient = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
    gradient.addColorStop(0, "rgba(0,150,255,0.35)");
    gradient.addColorStop(1, "rgba(0,150,255,0)");

    ctx.beginPath();
    xyPoints.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.lineTo(
      xyPoints[xyPoints.length - 1].x,
      paddingTop + chartHeight
    );
    ctx.lineTo(xyPoints[0].x, paddingTop + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Точки
    ctx.fillStyle = "#ffffff";
    xyPoints.forEach((pt) => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Подписи по X (даты)
    ctx.font = "11px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    xyPoints.forEach((pt, idx) => {
      // показываем не каждую, чтобы не было каши
      if (points.length > 15 && idx % 2 !== 0) return;
      const d = parseISOToDate(pt.dateIso).getDate();
      ctx.fillText(String(d), pt.x, paddingTop + chartHeight + 14);
    });

    // Подпись максимума по Y
    ctx.textAlign = "right";
    ctx.fillText(
      formatMoney(maxVal),
      paddingLeft - 4,
      paddingTop + 10
    );
  }

  // ---------------------------------------------------------------------------
  // МОДАЛКА ДНЯ (СПИСОК ПРОДАЖ + ДОБАВИТЬ ПРОДАЖУ + ВЫХОДНОЙ)
  // ---------------------------------------------------------------------------

  function openDayModal(dateIso) {
    const dayState = getDayState(dateIso);
    const dateObj = parseISOToDate(dateIso);

    const content = createElement("div", { className: "modal-card modal-day-card" });

    const title = createElement("h3", {
      className: "modal-title",
      text: `Продажи за ${dateObj.toLocaleDateString("ru-RU")}`,
    });

    const total = (dayState.sales || []).reduce(
      (sum, s) => sum + (s.reward || 0),
      0
    );

    const totalEl = createElement("div", {
      className: "day-total-header",
      text: `Итого за день: ${formatMoney(total)}`,
    });

    const weekendRow = createElement("label", { className: "form-row weekend-row" });
    const weekendCheckbox = createElement("input", {
      className: "weekend-checkbox",
      attrs: { type: "checkbox" },
    });
    weekendCheckbox.checked = !!dayState.isWeekend;
    const weekendLabelText = createElement("span", {
      text: "Выходной день",
    });

    weekendRow.appendChild(weekendCheckbox);
    weekendRow.appendChild(weekendLabelText);

    weekendCheckbox.addEventListener("change", () => {
      setDayWeekend(dateIso, weekendCheckbox.checked);
    });

    const btnAddSale = createElement("button", {
      className: "btn btn-primary",
      text: "Добавить продажу",
    });

    btnAddSale.addEventListener("click", () => {
      openSaleEditorModal({ dateIso });
    });

    const salesList = createElement("div", { className: "sales-list" });
    if (!dayState.sales.length) {
      salesList.appendChild(
        createElement("div", {
          className: "empty-placeholder",
          text: "Продаж за день пока нет.",
        })
      );
    } else {
      dayState.sales.forEach((sale) => {
        const item = renderSaleListItem(sale);
        salesList.appendChild(item);
      });
    }

    const actions = createElement("div", { className: "modal-actions" });
    const btnClose = createElement("button", {
      className: "btn btn-secondary",
      text: "Закрыть",
    });
    actions.appendChild(btnClose);

    content.appendChild(title);
    content.appendChild(totalEl);
    content.appendChild(weekendRow);
    content.appendChild(btnAddSale);
    content.appendChild(salesList);
    content.appendChild(actions);

    const { close } = openModal(content, {
      maxWidth: "720px",
      disableBackdropClose: false,
    });

    btnClose.addEventListener("click", () => {
      close();
    });
  }

  function renderSaleListItem(sale) {
    const item = createElement("div", {
      className: "sale-item",
      attrs: { "data-sale-id": sale.id },
    });

    const shelfName = getShelfLabel(sale.shelf);
    const title = createElement("div", {
      className: "sale-item-title",
      text: `${shelfName} — ${formatMoney(sale.reward)} (${sale.productLabel || ""})`,
    });

    const comment = createElement("div", {
      className: "sale-item-comment",
      text: sale.comment || "",
    });

    const actions = createElement("div", { className: "sale-item-actions" });
    const btnEdit = createElement("button", {
      className: "btn btn-ghost",
      text: "Изменить",
    });
    const btnDelete = createElement("button", {
      className: "btn btn-ghost btn-danger",
      text: "Удалить",
    });

    btnEdit.addEventListener("click", () => {
      openSaleEditorModal({ existingSaleId: sale.id });
    });

    btnDelete.addEventListener("click", () => {
      openConfirmDialog("Вы точно хотите удалить продажу?", () => {
        deleteSaleById(sale.id);
      });
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    item.appendChild(title);
    item.appendChild(comment);
    item.appendChild(actions);

    return item;
  }

  function getShelfLabel(shelfKey) {
    switch (shelfKey) {
      case "consumer":
        return "Потребительский кредит";
      case "cards":
        return "Кредитные карты";
      case "dk":
        return "Активация ДК";
      case "savings":
        return "Накопительная полка";
      case "box":
        return "Коробочное страхование";
      case "pension":
        return "Перевод пенсии";
      default:
        return "Продукт";
    }
  }

  // ---------------------------------------------------------------------------
  // ФОРМА ДОБАВЛЕНИЯ / РЕДАКТИРОВАНИЯ ПРОДАЖИ
  // ---------------------------------------------------------------------------

  function openSaleEditorModal({ dateIso, existingSaleId }) {
    const isEdit = !!existingSaleId;
    let sale = null;

    if (isEdit) {
      Object.values(state.days).forEach((day) => {
        day.sales.forEach((s) => {
          if (s.id === existingSaleId) sale = s;
        });
      });
    }

    const targetDateIso = dateIso || (sale ? sale.date : todayISO());
    const dateObj = parseISOToDate(targetDateIso);

    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: isEdit
        ? `Изменить продажу (${dateObj.toLocaleDateString("ru-RU")})`
        : `Добавить продажу (${dateObj.toLocaleDateString("ru-RU")})`,
    });

    const form = createElement("form", { className: "modal-form" });

    // Полка
    const shelfRow = createElement("div", { className: "form-row" });
    const shelfLabel = createElement("label", {
      className: "form-label",
      text: "Полка",
    });
    const shelfSelect = createElement("select", {
      className: "form-input",
      attrs: { required: "required" },
    });

    [
      { value: "consumer", label: "Потребительский кредит" },
      { value: "cards", label: "Кредитные карты" },
      { value: "dk", label: "Активация ДК" },
      { value: "savings", label: "Накопительная полка" },
      { value: "box", label: "Коробочное страхование" },
      { value: "pension", label: "Перевод пенсии" },
    ].forEach((opt) => {
      const o = createElement("option", {
        text: opt.label,
        attrs: { value: opt.value },
      });
      shelfSelect.appendChild(o);
    });
    shelfRow.appendChild(shelfLabel);
    shelfRow.appendChild(shelfSelect);
    form.appendChild(shelfRow);

    // Подпродукт
    const productRow = createElement("div", { className: "form-row" });
    const productLabel = createElement("label", {
      className: "form-label",
      text: "Продукт",
    });
    const productSelect = createElement("select", {
      className: "form-input",
      attrs: { required: "required" },
    });
    productRow.appendChild(productLabel);
    productRow.appendChild(productSelect);
    form.appendChild(productRow);

    // Поле суммы для коробочного страхования
    const amountRow = createElement("div", {
      className: "form-row",
      attrs: { "data-field": "amount" },
    });
    const amountLabel = createElement("label", {
      className: "form-label",
      text: "Сумма (для страхования)",
    });
    const amountInput = createElement("input", {
      className: "form-input",
      attrs: { type: "number", step: "0.01", min: "0" },
    });
    amountRow.style.display = "none";
    amountRow.appendChild(amountLabel);
    amountRow.appendChild(amountInput);
    form.appendChild(amountRow);

    // Комментарий
    const commentRow = createElement("div", { className: "form-row" });
    const commentLabel = createElement("label", {
      className: "form-label",
      text: "Комментарий",
    });
    const commentInput = createElement("textarea", {
      className: "form-input",
      attrs: { rows: "2" },
    });
    commentRow.appendChild(commentLabel);
    commentRow.appendChild(commentInput);
    form.appendChild(commentRow);

    const actions = createElement("div", { className: "modal-actions" });
    const btnSave = createElement("button", {
      className: "btn btn-primary",
      text: isEdit ? "Сохранить изменения" : "Добавить продажу",
      attrs: { type: "submit" },
    });
    const btnCancel = createElement("button", {
      className: "btn btn-secondary",
      text: "Отмена",
      attrs: { type: "button" },
    });

    actions.appendChild(btnSave);
    actions.appendChild(btnCancel);

    content.appendChild(title);
    content.appendChild(form);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "520px" });

    function refreshProductOptions() {
      const shelf = shelfSelect.value;
      productSelect.innerHTML = "";

      if (shelf === "consumer") {
        productSelect.appendChild(
          createElement("option", {
            text: "Заявка",
            attrs: { value: "loanApplication" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Выдача",
            attrs: { value: "loanIssue" },
          })
        );
        amountRow.style.display = "none";
      } else if (shelf === "cards") {
        productSelect.appendChild(
          createElement("option", {
            text: "С рассмотрением",
            attrs: { value: "withReview" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Сплит",
            attrs: { value: "split" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Заявка",
            attrs: { value: "application" },
          })
        );
        amountRow.style.display = "none";
      } else if (shelf === "dk") {
        productSelect.appendChild(
          createElement("option", {
            text: "Выдача карты",
            attrs: { value: "cardIssue" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: 'ТА по "Яркой"',
            attrs: { value: "taYarkaya" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "ТА по остальным (кроме ЕКП)",
            attrs: { value: "taOther" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "ТА по ЕКП",
            attrs: { value: "taEkp" },
          })
        );
        amountRow.style.display = "none";
      } else if (shelf === "savings") {
        productSelect.appendChild(
          createElement("option", {
            text: "Вклад",
            attrs: { value: "deposit" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Накопительный счёт",
            attrs: { value: "savingsAccount" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Выдача Premium Light",
            attrs: { value: "premiumLightIssue" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Кнопка учёта стикеров Premium Light",
            attrs: { value: "premiumLightSticker" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "СМС-информирование",
            attrs: { value: "smsInfo" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Лид ЦПО",
            attrs: { value: "leadCpo" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Лид ипотека",
            attrs: { value: "leadMortgage" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: 'Страхование "Карточный сейф"',
            attrs: { value: "cardSafeIns" },
          })
        );
        amountRow.style.display = "none";
      } else if (shelf === "box") {
        productSelect.appendChild(
          createElement("option", {
            text: "Стандартное (8% от суммы)",
            attrs: { value: "general" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Акционное (1% от суммы)",
            attrs: { value: "promo" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Стандартное (3% от суммы)",
            attrs: { value: "standard" },
          })
        );
        amountRow.style.display = "";
      } else if (shelf === "pension") {
        productSelect.appendChild(
          createElement("option", {
            text: "Страховая пенсия",
            attrs: { value: "insurance" },
          })
        );
        productSelect.appendChild(
          createElement("option", {
            text: "Военная пенсия",
            attrs: { value: "military" },
          })
        );
        amountRow.style.display = "none";
      }
    }

    shelfSelect.addEventListener("change", refreshProductOptions);

    // Префилл при редактировании
    if (sale) {
      shelfSelect.value = sale.shelf;
      refreshProductOptions();
      if (sale.productKey) {
        productSelect.value = sale.productKey;
      }
      if (sale.shelf === "box") {
        amountRow.style.display = "";
        amountInput.value = sale.amount ?? 0;
      } else {
        amountRow.style.display = "none";
      }
      commentInput.value = sale.comment || "";
    } else {
      shelfSelect.value = "consumer";
      refreshProductOptions();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const shelf = shelfSelect.value;
      const productKey = productSelect.value;
      const comment = commentInput.value.trim();

      let amount = 0;
      if (shelf === "box") {
        amount = parseFloat(amountInput.value.replace(",", "."));
        if (!isFinite(amount) || amount <= 0) {
          alert("Укажите корректную сумму для страхования");
          return;
        }
      }

      // Расчитываем reward
      let reward = 0;
      let productLabel = productSelect.options[productSelect.selectedIndex]?.text || "";

      if (shelf === "box") {
        const percent = state.prices.box[productKey] || 0;
        reward = amount * (percent / 100);
      } else {
        const shelfPrices = state.prices[shelf] || {};
        reward = shelfPrices[productKey] || 0;
      }

      if (!isEdit) {
        const newSale = {
          id: generateId("sale"),
          date: targetDateIso,
          shelf,
          productKey,
          productLabel,
          amount: shelf === "box" ? amount : 1,
          reward,
          comment,
          createdAt: new Date().toISOString(),
        };
        addSale(newSale);
      } else if (sale) {
        updateSale(sale.id, (s) => {
          s.shelf = shelf;
          s.productKey = productKey;
          s.productLabel = productLabel;
          s.amount = shelf === "box" ? amount : 1;
          s.reward = reward;
          s.comment = comment;
        });
      }

      close();
    });

    btnCancel.addEventListener("click", () => {
      close();
    });
  }

  // ---------------------------------------------------------------------------
  // ВКЛАДКА "МОИ СДЕЛКИ"
  // ---------------------------------------------------------------------------

  function initDealsView() {
    const filterSelect = document.getElementById("deals-filter");
    if (filterSelect && !filterSelect.dataset._initialized) {
      filterSelect.dataset._initialized = "1";
      filterSelect.innerHTML = "";

      const optAll = createElement("option", {
        text: "Все полки",
        attrs: { value: "" },
      });
      filterSelect.appendChild(optAll);

      [
        { value: "consumer", label: "Потребительский кредит" },
        { value: "cards", label: "Кредитные карты" },
        { value: "dk", label: "Активация ДК" },
        { value: "savings", label: "Накопительная полка" },
        { value: "box", label: "Коробочное страхование" },
        { value: "pension", label: "Перевод пенсии" },
      ].forEach((opt) => {
        const o = createElement("option", {
          text: opt.label,
          attrs: { value: opt.value },
        });
        filterSelect.appendChild(o);
      });

      filterSelect.addEventListener("change", renderDealsList);
    }

    renderDealsList();
  }

  function renderDealsList() {
    const container = document.getElementById("deals-list");
    if (!container) return;

    const filterSelect = document.getElementById("deals-filter");
    const shelfFilter = filterSelect ? filterSelect.value : "";

    const allSales = getAllSalesForCurrentMonth();
    const filtered = shelfFilter
      ? allSales.filter((s) => s.shelf === shelfFilter)
      : allSales;

    container.innerHTML = "";

    if (!filtered.length) {
      container.appendChild(
        createElement("div", {
          className: "empty-placeholder",
          text: "За текущий месяц сделок пока нет.",
        })
      );
      return;
    }

    filtered.forEach((sale) => {
      const card = createElement("div", { className: "deal-card" });

      const header = createElement("div", { className: "deal-card-header" });
      const date = parseISOToDate(sale.date);
      const dateLabel = createElement("div", {
        className: "deal-date",
        text: date.toLocaleDateString("ru-RU"),
      });
      const timeLabel = createElement("div", {
        className: "deal-time",
        text: sale.createdAt
          ? new Date(sale.createdAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      });

      header.appendChild(dateLabel);
      header.appendChild(timeLabel);

      const title = createElement("div", {
        className: "deal-title",
        text: `${getShelfLabel(sale.shelf)} — ${formatMoney(sale.reward)}`,
      });

      const comment = createElement("div", {
        className: "deal-comment",
        text: sale.comment || "",
      });

      const footer = createElement("div", { className: "deal-footer" });
      const btnDetails = createElement("button", {
        className: "btn btn-ghost",
        text: "Подробнее",
      });

      btnDetails.addEventListener("click", () => {
        openSaleDetailsModal(sale.id);
      });

      footer.appendChild(btnDetails);

      card.appendChild(header);
      card.appendChild(title);
      card.appendChild(comment);
      card.appendChild(footer);

      container.appendChild(card);
    });
  }

  function openSaleDetailsModal(saleId) {
    let sale = null;
    let dateIso = null;
    Object.entries(state.days).forEach(([iso, day]) => {
      day.sales.forEach((s) => {
        if (s.id === saleId) {
          sale = s;
          dateIso = iso;
        }
      });
    });
    if (!sale) return;

    const dateObj = parseISOToDate(dateIso || sale.date);

    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: "Детали продажи",
    });

    const info = createElement("div", { className: "details-grid" });

    info.appendChild(
      createDetailRow(
        "Дата",
        dateObj.toLocaleDateString("ru-RU")
      )
    );
    info.appendChild(
      createDetailRow(
        "Время",
        sale.createdAt
          ? new Date(sale.createdAt).toLocaleTimeString("ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-"
      )
    );
    info.appendChild(
      createDetailRow("Полка", getShelfLabel(sale.shelf))
    );
    info.appendChild(
      createDetailRow("Продукт", sale.productLabel || sale.productKey || "-")
    );
    info.appendChild(
      createDetailRow("Сумма вознаграждения", formatMoney(sale.reward))
    );
    if (sale.shelf === "box") {
      info.appendChild(
        createDetailRow("Сумма страховки", formatMoney(sale.amount || 0))
      );
    }
    info.appendChild(
      createDetailRow("Комментарий", sale.comment || "—")
    );

    const actions = createElement("div", { className: "modal-actions" });
    const btnEdit = createElement("button", {
      className: "btn btn-primary",
      text: "Изменить",
    });
    const btnDelete = createElement("button", {
      className: "btn btn-danger",
      text: "Удалить",
    });
    const btnClose = createElement("button", {
      className: "btn btn-secondary",
      text: "Закрыть",
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    actions.appendChild(btnClose);

    content.appendChild(title);
    content.appendChild(info);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "520px" });

    btnClose.addEventListener("click", () => close());
    btnEdit.addEventListener("click", () => {
      close();
      openSaleEditorModal({ existingSaleId: saleId });
    });
    btnDelete.addEventListener("click", () => {
      openConfirmDialog("Вы точно хотите удалить продажу?", () => {
        deleteSaleById(saleId);
        close();
      });
    });
  }

  function createDetailRow(label, value) {
    const row = createElement("div", { className: "details-row" });
    const l = createElement("div", { className: "details-label", text: label });
    const v = createElement("div", { className: "details-value", text: value });
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  // ---------------------------------------------------------------------------
  // ВКЛАДКА "ЗВОНКИ"
  // ---------------------------------------------------------------------------

  function initCallsView() {
    const btnAdd = document.getElementById("btn-add-call");
    if (btnAdd && !btnAdd.dataset._initialized) {
      btnAdd.dataset._initialized = "1";
      btnAdd.addEventListener("click", () => {
        openCallEditorModal();
      });
    }

    renderCallsList();
  }

  function renderCallsList() {
    const container = document.getElementById("calls-list");
    if (!container) return;

    container.innerHTML = "";

    const calls = [...(state.calls || [])];
    // сортировка по убыванию даты
    calls.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    if (!calls.length) {
      container.appendChild(
        createElement("div", {
          className: "empty-placeholder",
          text: "Звонков пока нет.",
        })
      );
      return;
    }

    calls.forEach((call) => {
      const card = createElement("div", { className: "call-card" });

      const header = createElement("div", { className: "call-card-header" });
      const nameEl = createElement("div", {
        className: "call-name",
        text: call.clientName,
      });
      const phoneEl = createElement("div", {
        className: "call-phone",
        text: call.phoneFormatted || call.phoneRaw,
      });
      header.appendChild(nameEl);
      header.appendChild(phoneEl);

      const resultEl = createElement("div", {
        className:
          "call-result call-result-" +
          (call.result === "positive" ? "pos" : "neg"),
        text: call.result === "positive" ? "Положительный" : "Отрицательный",
      });

      const dateEl = createElement("div", {
        className: "call-date",
        text: call.createdAt
          ? new Date(call.createdAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
      });

      const footer = createElement("div", { className: "call-footer" });
      const btnDetails = createElement("button", {
        className: "btn btn-ghost",
        text: "Подробнее",
      });

      btnDetails.addEventListener("click", () => {
        openCallDetailsModal(call.id);
      });

      footer.appendChild(btnDetails);

      card.appendChild(header);
      card.appendChild(resultEl);
      card.appendChild(dateEl);
      card.appendChild(footer);

      container.appendChild(card);
    });
  }

  function openCallEditorModal(existingCallId) {
    const isEdit = !!existingCallId;
    let call = null;
    if (isEdit) {
      call = (state.calls || []).find((c) => c.id === existingCallId) || null;
    }

    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: isEdit ? "Изменить звонок" : "Добавить звонок",
    });

    const form = createElement("form", { className: "modal-form" });

    // ФИО
    const nameRow = createElement("div", { className: "form-row" });
    const nameLabel = createElement("label", {
      className: "form-label",
      text: "ФИО клиента",
    });
    const nameInput = createElement("input", {
      className: "form-input",
      attrs: { type: "text", required: "required" },
    });
    nameRow.appendChild(nameLabel);
    nameRow.appendChild(nameInput);
    form.appendChild(nameRow);

    // Телефон
    const phoneRow = createElement("div", { className: "form-row" });
    const phoneLabel = createElement("label", {
      className: "form-label",
      text: "Номер телефона",
    });
    const phoneInput = createElement("input", {
      className: "form-input",
      attrs: {
        type: "tel",
        required: "required",
        maxlength: "18", // +7(XXX)-XXX-XX-XX
      },
    });
    phoneRow.appendChild(phoneLabel);
    phoneRow.appendChild(phoneInput);
    form.appendChild(phoneRow);

    // Результат звонка
    const resultRow = createElement("div", { className: "form-row" });
    const resultLabel = createElement("label", {
      className: "form-label",
      text: "Результат звонка",
    });
    const resultSelect = createElement("select", {
      className: "form-input",
      attrs: { required: "required" },
    });
    resultSelect.appendChild(
      createElement("option", { text: "Положительный", attrs: { value: "positive" } })
    );
    resultSelect.appendChild(
      createElement("option", { text: "Отрицательный", attrs: { value: "negative" } })
    );
    resultRow.appendChild(resultLabel);
    resultRow.appendChild(resultSelect);
    form.appendChild(resultRow);

    // Причина отказа (для отрицательного звонка)
    const reasonRow = createElement("div", {
      className: "form-row",
      attrs: { "data-field": "reason" },
    });
    const reasonLabel = createElement("label", {
      className: "form-label",
      text: "Причина отказа",
    });
    const reasonSelect = createElement("select", {
      className: "form-input",
    });
    [
      { value: "", label: "Выберите причину" },
      { value: "no_answer", label: "Недозвон" },
      { value: "auto_answer", label: "Автоответчик" },
      { value: "not_interested", label: "Не интересно" },
      { value: "already_have", label: "Уже есть" },
      { value: "other", label: "Другое" },
    ].forEach((opt) => {
      reasonSelect.appendChild(
        createElement("option", { text: opt.label, attrs: { value: opt.value } })
      );
    });
    reasonRow.appendChild(reasonLabel);
    reasonRow.appendChild(reasonSelect);
    form.appendChild(reasonRow);

    // Комментарий (для "Другое" обязателен)
    const commentRow = createElement("div", {
      className: "form-row",
      attrs: { "data-field": "comment" },
    });
    const commentLabel = createElement("label", {
      className: "form-label",
      text: "Комментарий",
    });
    const commentInput = createElement("textarea", {
      className: "form-input",
      attrs: { rows: "2" },
    });
    commentRow.appendChild(commentLabel);
    commentRow.appendChild(commentInput);
    form.appendChild(commentRow);

    const actions = createElement("div", { className: "modal-actions" });
    const btnSave = createElement("button", {
      className: "btn btn-primary",
      text: isEdit ? "Сохранить" : "Добавить звонок",
      attrs: { type: "submit" },
    });
    const btnCancel = createElement("button", {
      className: "btn btn-secondary",
      text: "Отмена",
      attrs: { type: "button" },
    });
    actions.appendChild(btnSave);
    actions.appendChild(btnCancel);

    content.appendChild(title);
    content.appendChild(form);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "520px" });

    function updateVisibilityByResult() {
      const isNegative = resultSelect.value === "negative";
      reasonRow.style.display = isNegative ? "" : "none";
      const reasonVal = reasonSelect.value;
      const needComment =
        isNegative && reasonVal === "other";
      commentRow.style.display = needComment ? "" : "none";
    }

    function updateVisibilityByReason() {
      const isNegative = resultSelect.value === "negative";
      const reasonVal = reasonSelect.value;
      const needComment = isNegative && reasonVal === "other";
      commentRow.style.display = needComment ? "" : "none";
    }

    resultSelect.addEventListener("change", updateVisibilityByResult);
    reasonSelect.addEventListener("change", updateVisibilityByReason);

    // Маска телефона
    phoneInput.addEventListener("input", () => {
      const digits = phoneInput.value.replace(/\D/g, "");
      const formatted = formatPhoneNumber(digits);
      phoneInput.value = formatted;
    });

    // Префилл при редактировании
    if (call) {
      nameInput.value = call.clientName || "";
      phoneInput.value = call.phoneFormatted || "";
      resultSelect.value = call.result || "positive";
      reasonSelect.value = call.refusalReason || "";
      commentInput.value = call.comment || "";
      updateVisibilityByResult();
      updateVisibilityByReason();
    } else {
      resultSelect.value = "positive";
      reasonSelect.value = "";
      commentInput.value = "";
      updateVisibilityByResult();
      updateVisibilityByReason();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      const clientName = nameInput.value.trim();
      const phoneFormatted = phoneInput.value.trim();
      const digits = phoneFormatted.replace(/\D/g, "");

      if (!clientName) {
        alert("Введите ФИО клиента");
        return;
      }
      if (digits.length !== 11 && digits.length !== 10) {
        // допустим 10 или 11 цифр, но в России обычно 11 (7 + 10)
        alert("Введите корректный номер телефона (10–11 цифр)");
        return;
      }

      const result = resultSelect.value;
      let refusalReason = "";
      let comment = commentInput.value.trim();

      if (result === "negative") {
        refusalReason = reasonSelect.value;
        if (!refusalReason) {
          alert("Выберите причину отказа");
          return;
        }
        if (refusalReason === "other" && !comment) {
          alert('При выборе "Другое" комментарий обязателен');
          return;
        }
      }

      if (!isEdit) {
        const newCall = {
          id: generateId("call"),
          clientName,
          phoneRaw: digits,
          phoneFormatted,
          result,
          refusalReason,
          comment,
          createdAt: new Date().toISOString(),
        };
        state.calls.push(newCall);
      } else if (call) {
        call.clientName = clientName;
        call.phoneRaw = digits;
        call.phoneFormatted = phoneFormatted;
        call.result = result;
        call.refusalReason = refusalReason;
        call.comment = comment;
      }

      saveState();
      renderCallsList();
      close();
    });

    btnCancel.addEventListener("click", () => {
      close();
    });
  }

  function openCallDetailsModal(callId) {
    const call =
      (state.calls || []).find((c) => c.id === callId) || null;
    if (!call) return;

    const content = createElement("div", { className: "modal-card" });
    const title = createElement("h3", {
      className: "modal-title",
      text: "Детали звонка",
    });

    const info = createElement("div", { className: "details-grid" });

    info.appendChild(createDetailRow("Клиент", call.clientName));
    info.appendChild(
      createDetailRow("Телефон", call.phoneFormatted || call.phoneRaw)
    );
    info.appendChild(
      createDetailRow(
        "Результат",
        call.result === "positive" ? "Положительный" : "Отрицательный"
      )
    );
    if (call.result === "negative") {
      info.appendChild(
        createDetailRow(
          "Причина отказа",
          mapRefusalReason(call.refusalReason)
        )
      );
    }
    info.appendChild(
      createDetailRow("Комментарий", call.comment || "—")
    );
    info.appendChild(
      createDetailRow(
        "Дата и время",
        call.createdAt
          ? new Date(call.createdAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""
      )
    );

    const actions = createElement("div", { className: "modal-actions" });
    const btnEdit = createElement("button", {
      className: "btn btn-primary",
      text: "Изменить",
    });
    const btnDelete = createElement("button", {
      className: "btn btn-danger",
      text: "Удалить",
    });
    const btnClose = createElement("button", {
      className: "btn btn-secondary",
      text: "Закрыть",
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    actions.appendChild(btnClose);

    content.appendChild(title);
    content.appendChild(info);
    content.appendChild(actions);

    const { close } = openModal(content, { maxWidth: "520px" });

    btnClose.addEventListener("click", () => close());
    btnEdit.addEventListener("click", () => {
      close();
      openCallEditorModal(callId);
    });
    btnDelete.addEventListener("click", () => {
      openConfirmDialog("Вы точно хотите удалить звонок?", () => {
        state.calls = (state.calls || []).filter((c) => c.id !== callId);
        saveState();
        renderCallsList();
        close();
      });
    });
  }

  function mapRefusalReason(reason) {
    switch (reason) {
      case "no_answer":
        return "Недозвон";
      case "auto_answer":
        return "Автоответчик";
      case "not_interested":
        return "Не интересно";
      case "already_have":
        return "Уже есть";
      case "other":
        return "Другое";
      default:
        return "—";
    }
  }

  function formatPhoneNumber(digits) {
    // Ожидаем 10 или 11 цифр; если пусто — возвращаем "+7("
    let d = digits;
    if (d.length > 11) d = d.slice(-11);

    // Если первая цифра 8, меняем на 7
    if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1);
    if (d.length === 10) d = "7" + d; // если ввели 10 цифр, добавим 7 впереди

    const parts = [];
    const country = d[0] || "7";
    parts.push("+", country, "(");

    if (d.length > 1) parts.push(d.slice(1, 4));
    if (d.length > 4) parts.push(")-", d.slice(4, 7));
    if (d.length > 7) parts.push("-", d.slice(7, 9));
    if (d.length > 9) parts.push("-", d.slice(9, 11));

    return parts.join("");
  }

  // ---------------------------------------------------------------------------
  // ГЛОБАЛЬНЫЙ РЕРЕНДЕР
  // ---------------------------------------------------------------------------

  function recalcAndRenderAll() {
    renderCalcView();
    initCalendar();
    initDealsView();
    initCallsView();
  }

  // ---------------------------------------------------------------------------
  // ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
  // ---------------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initTabs();

    // Кнопка "План"
    const btnPlan = document.getElementById("btn-open-plan");
    if (btnPlan) btnPlan.addEventListener("click", openPlanModal);

    // Кнопка "Редактировать цены"
    const btnPrices = document.getElementById("btn-open-prices");
    if (btnPrices) btnPrices.addEventListener("click", openPricesModal);

    recalcAndRenderAll();
  });
})();
