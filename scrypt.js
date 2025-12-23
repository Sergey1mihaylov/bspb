'use strict';

const shelves = {
  'Потребительский кредит': ['Заявка', 'Выдача'],
  'Кредитные карты': ['С рассмотрением', 'Сплит', 'Заявка'],
  'Активация ДК': ['Выдача карты', 'ТА по "Яркой"', 'ТА по остальным (кроме ЕКП)', 'ТА по ЕКП'],
  'Накопительная полка': ['Вклад', 'Накопительный счёт', 'Выдача Premium Light'],
  'Выдача стикеров Premium Light': ['СМС-информирование', 'Лид ЦПО', 'Лид ипотека', 'Страхование "Карточный сейф"'],
  'Перевод пенсии': []
};

const defaultPrices = {
  'Потребительский кредит': {'Заявка': 100, 'Выдача': 200},
  'Кредитные карты': {'С рассмотрением': 150, 'Сплит': 120, 'Заявка': 100},
  'Активация ДК': {'Выдача карты': 130, 'ТА по "Яркой"': 110, 'ТА по остальным (кроме ЕКП)': 90, 'ТА по ЕКП': 80},
  'Накопительная полка': {'Вклад': 170, 'Накопительный счёт': 160, 'Выдача Premium Light': 180},
  'Выдача стикеров Premium Light': {'СМС-информирование': 50, 'Лид ЦПО': 40, 'Лид ипотека': 45, 'Страхование "Карточный сейф"': 60},
  'Перевод пенсии': {}
};

let prices = JSON.parse(localStorage.getItem('prices')) || JSON.parse(JSON.stringify(defaultPrices));
let plan = JSON.parse(localStorage.getItem('plan')) || {};
let sales = JSON.parse(localStorage.getItem('sales')) || [];
let calls = JSON.parse(localStorage.getItem('calls')) || [];
let serviceMode = JSON.parse(localStorage.getItem('serviceMode')) || false;
let salary = Number(localStorage.getItem('salary')) || 0;

const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const salaryInput = document.getElementById('salary-input');
const serviceCheckbox = document.getElementById('service-mode');
const coefSpan = document.getElementById('coef-span');
const premiumSpan = document.getElementById('premium-span');
const netSpan = document.getElementById('net-span');
const totalEarningsSpan = document.getElementById('total-earnings-span');
const progressContainer = document.getElementById('progress-container');

const editPlanBtn = document.getElementById('edit-plan-btn');
const planEditorModal = document.getElementById('plan-editor');
const planEditContainer = document.getElementById('plan-edit-container');
const savePlanBtn = document.getElementById('save-plan-btn');
const cancelPlanBtn = document.getElementById('cancel-plan-btn');

const editPricesBtn = document.getElementById('edit-prices-btn');
const pricesEditorModal = document.getElementById('prices-editor');
const pricesEditContainer = document.getElementById('prices-edit-container');
const savePricesBtn = document.getElementById('save-prices-btn');
const cancelPricesBtn = document.getElementById('cancel-prices-btn');

// Календарь
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const currentMonthYear = document.getElementById('current-month-year');
const calendarGrid = document.getElementById('calendar-grid');

const daySalesModal = document.getElementById('day-sales-modal');
const salesList = document.getElementById('sales-list');
const addSaleBtn = document.getElementById('add-sale-btn');
const closeDayModalBtn = document.getElementById('close-day-modal-btn');

const addSaleModal = document.getElementById('add-sale-modal');
const addSaleForm = document.getElementById('add-sale-form');
const saleShelfSelect = document.getElementById('sale-shelf');
const saleProductSelect = document.getElementById('sale-product');
const saleAmountInput = document.getElementById('sale-amount');
const saleCommentInput = document.getElementById('sale-comment');
const cancelAddSaleBtn = document.getElementById('cancel-add-sale-btn');

// Мои сделки
const filterShelfSelect = document.getElementById('filter-shelf');
const dealsList = document.getElementById('deals-list');

// Звонки
const addCallBtn = document.getElementById('add-call-btn');
const callsList = document.getElementById('calls-list');
const addCallModal = document.getElementById('add-call-modal');
const addCallForm = document.getElementById('add-call-form');
const callFioInput = document.getElementById('call-fio');
const callPhoneInput = document.getElementById('call-phone');
const callResultSelect = document.getElementById('call-result');
const callReasonContainer = document.getElementById('call-reason-container');
const callReasonSelect = document.getElementById('call-reason');
const callReasonComment = document.getElementById('call-reason-comment');
const cancelAddCallBtn = document.getElementById('cancel-add-call-btn');

let currentDate = new Date();
let selectedDay = null;

// --- Инициализация интерфейса ---
function init() {
  salaryInput.value = salary;
  serviceCheckbox.checked = serviceMode;

  // Заполнить селекты продуктов для продажи
  fillShelfSelect(saleShelfSelect);
  fillFilterShelfSelect();

  // Вешаем события
  bindEvents();

  // Отрисовать календарь
  renderCalendar(currentDate.getFullYear(), currentDate.getMonth());

  // Обновить прогресс и результаты
  updateResults();

  // Обновить вкладки по дефолту
  showTab('calc');
}

function bindEvents() {
  // Табы
  tabs.forEach(tab => {
    tab.addEventListener('click', () => showTab(tab.id.replace('tab-', '')));
  });

  salaryInput.addEventListener('input', () => {
    let val = Number(salaryInput.value);
    if (val < 0 || isNaN(val)) val = 0;
    salary = val;
    localStorage.setItem('salary', salary);
    updateResults();
  });

  serviceCheckbox.addEventListener('change', () => {
    serviceMode = serviceCheckbox.checked;
    localStorage.setItem('serviceMode', JSON.stringify(serviceMode));
    updateResults();
  });

  // План
  editPlanBtn.addEventListener('click', openPlanEditor);
  savePlanBtn.addEventListener('click', savePlan);
  cancelPlanBtn.addEventListener('click', () => closeModal(planEditorModal));

  // Цены
  editPricesBtn.addEventListener('click', openPricesEditor);
  savePricesBtn.addEventListener('click', savePrices);
  cancelPricesBtn.addEventListener('click', () => closeModal(pricesEditorModal));

  // Календарь переключение месяцев
  prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  });
  nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  });

  // Открыть окно продаж по дню
  calendarGrid.addEventListener('click', (e) => {
    const dayDiv = e.target.closest('.day');
    if (!dayDiv || dayDiv.classList.contains('disabled')) return;
    const dateStr = dayDiv.dataset.date;
    if (!dateStr) return;
    openDaySalesModal(dateStr);
  });

  // Закрыть окно продаж за день
  closeDayModalBtn.addEventListener('click', () => {
    closeModal(daySalesModal);
  });

  // Добавить продажу
  addSaleBtn.addEventListener('click', () => {
    openAddSaleModal();
  });

  cancelAddSaleBtn.addEventListener('click', () => {
    closeModal(addSaleModal);
  });

  addSaleForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addSale();
  });

  // Фильтр сделок
  filterShelfSelect.addEventListener('change', renderDealsList);

  // Сделки - клик по элементу (можно добавить детали позже)
  dealsList.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    alert('Для редактирования сделок реализуй отдельное окно (пока заглушка)');
  });

  // Звонки
  addCallBtn.addEventListener('click', () => {
    openModal(addCallModal);
  });

  cancelAddCallBtn.addEventListener('click', () => {
    closeModal(addCallModal);
  });

  addCallForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addCall();
  });

  callResultSelect.addEventListener('change', () => {
    if (callResultSelect.value === 'negative') {
      callReasonContainer.classList.remove('hidden');
      callReasonSelect.setAttribute('required', 'required');
    } else {
      callReasonContainer.classList.add('hidden');
      callReasonSelect.removeAttribute('required');
      callReasonComment.classList.add('hidden');
      callReasonComment.value = '';
      callReasonSelect.value = '';
    }
  });

  callReasonSelect.addEventListener('change', () => {
    if (callReasonSelect.value === 'other') {
      callReasonComment.classList.remove('hidden');
      callReasonComment.setAttribute('required', 'required');
    } else {
      callReasonComment.classList.add('hidden');
      callReasonComment.removeAttribute('required');
      callReasonComment.value = '';
    }
  });
}

// Показывать вкладку
function showTab(name) {
  tabs.forEach(t => {
    const active = t.id === 'tab-' + name;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active);
  });
  tabContents.forEach(c => {
    c.classList.toggle('active', c.id === name);
  });
}

// Рендер календаря (показываем дни, с суммами, дни недели, выходные, градация)
function renderCalendar(year, month) {
  currentMonthYear.textContent = new Date(year, month).toLocaleString('ru-RU', { month: 'long', year: 'numeric' });
  calendarGrid.innerHTML = '';

  // Сначала получить первый день недели (понедельник = 1, воскресенье = 7)
  // В JS: воскресенье = 0, понедельник = 1, ... воскресенье = 0
  // Преобразуем в 1-7 (понедельник - 1)
  const firstDate = new Date(year, month, 1);
  let firstWeekday = firstDate.getDay();
  firstWeekday = firstWeekday === 0 ? 7 : firstWeekday; // Воскресенье = 7
  // Добавляем пустые ячейки до первого дня месяца
  for (let i = 1; i < firstWeekday; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty';
    calendarGrid.appendChild(emptyDiv);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day';
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    dayDiv.dataset.date = dateStr;

    const dateNumber = document.createElement('div');
    dateNumber.className = 'date-number';
    dateNumber.textContent = day;

    const salesSum = sales
      .filter(s => s.date === dateStr)
      .reduce((acc, cur) => acc + Number(cur.amount), 0);

    const salesSumDiv = document.createElement('div');
    salesSumDiv.className = 'sales-sum';
    salesSumDiv.textContent = salesSum > 0 ? salesSum.toLocaleString('ru-RU') + ' ₽' : '';

    // Отметка выходного дня (сохраняется в localStorage)
    let weekends = JSON.parse(localStorage.getItem('weekends') || '{}');
    if (weekends[dateStr]) {
      dayDiv.classList.add('weekend');
    }

    // Добавляем чекбокс выходного внутри дня
    const weekendCheckbox = document.createElement('input');
    weekendCheckbox.type = 'checkbox';
    weekendCheckbox.title = 'Выходной день';
    weekendCheckbox.className = 'weekend-checkbox';
    weekendCheckbox.checked = !!weekends[dateStr];
    weekendCheckbox.addEventListener('click', (ev) => {
      ev.stopPropagation();
      weekends = JSON.parse(localStorage.getItem('weekends') || '{}');
      if (weekendCheckbox.checked) weekends[dateStr] = true;
      else delete weekends[dateStr];
      localStorage.setItem('weekends', JSON.stringify(weekends));
      renderCalendar(year, month);
      updateResults();
    });

    dayDiv.appendChild(weekendCheckbox);
    dayDiv.appendChild(dateNumber);
    dayDiv.appendChild(salesSumDiv);

    calendarGrid.appendChild(dayDiv);
  }
}

// Открываем модалку с продажами за выбранный день
function openDaySalesModal(dateStr) {
  selectedDay = dateStr;
  document.getElementById('day-sales-title').textContent = `Продажи за ${dateStr}`;
  renderSalesListForDay(dateStr);
  openModal(daySalesModal);
}

function renderSalesListForDay(dateStr) {
  salesList.innerHTML = '';
  const daySales = sales.filter(s => s.date === dateStr);
  if (daySales.length === 0) {
    salesList.textContent = 'Продаж нет';
    return;
  }
  daySales.forEach((sale, idx) => {
    const div = document.createElement('div');
    div.className = 'sale-item';
    div.textContent = `${sale.shelf} > ${sale.product}: ${Number(sale.amount).toLocaleString('ru-RU')} ₽${sale.comment ? ' (' + sale.comment + ')' : ''}`;

    // Кнопки изменить и удалить
    const editBtn = document.createElement('button');
    editBtn.textContent = 'Изменить';
    editBtn.className = 'btn btn-secondary btn-small';
    editBtn.addEventListener('click', () => {
      alert('Редактирование продажи реализуется позже');
    });

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Удалить';
    delBtn.className = 'btn btn-danger btn-small';
    delBtn.addEventListener('click', () => {
      if (confirm('Вы точно хотите удалить продажу?')) {
        sales.splice(sales.indexOf(sale), 1);
        localStorage.setItem('sales', JSON.stringify(sales));
        renderSalesListForDay(dateStr);
        renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
        updateResults();
      }
    });

    div.appendChild(editBtn);
    div.appendChild(delBtn);
    salesList.appendChild(div);
  });
}

function openAddSaleModal() {
  saleAmountInput.value = '';
  saleCommentInput.value = '';
  saleShelfSelect.value = Object.keys(shelves)[0];
  updateSaleProductOptions();
  openModal(addSaleModal);
}

function updateSaleProductOptions() {
  const shelf = saleShelfSelect.value;
  saleProductSelect.innerHTML = '';
  if (shelf === 'Перевод пенсии') {
    // Нет продуктов, вводим сумму
    saleProductSelect.disabled = true;
    saleProductSelect.innerHTML = '<option>-- введите сумму --</option>';
  } else {
    saleProductSelect.disabled = false;
    shelves[shelf].forEach(prod => {
      const option = document.createElement('option');
      option.value = prod;
      option.textContent = prod;
      saleProductSelect.appendChild(option);
    });
  }
}

saleShelfSelect.addEventListener('change', updateSaleProductOptions);

function addSale() {
  const shelf = saleShelfSelect.value;
  const product = saleProductSelect.value;
  const amount = Number(saleAmountInput.value);
  const comment = saleCommentInput.value.trim();

  if (!amount || amount <= 0) {
    alert('Введите корректную сумму');
    return;
  }

  sales.push({
    date: selectedDay,
    shelf,
    product,
    amount,
    comment
  });
  localStorage.setItem('sales', JSON.stringify(sales));
  closeModal(addSaleModal);
  renderSalesListForDay(selectedDay);
  renderCalendar(currentDate.getFullYear(), currentDate.getMonth());
  updateResults();
}

// Рендер прогресса (сумма продаж по полкам / план)
function updateResults() {
  const weekends = JSON.parse(localStorage.getItem('weekends') || '{}');
  // Кол-во рабочих дней месяца
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workDaysCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (!isWeekend && !weekends[dateStr]) {
      workDaysCount++;
    }
  }

  // Суммарная выручка
  const totalSales = sales.reduce((acc, s) => acc + Number(s.amount), 0);

  // Коэффициент — пример расчет, сумма / план (средний по всем полкам)
  let coef = 0;
  let totalPlanAmount = 0;
  let totalSalesByShelf = {};

  for (const shelf in shelves) {
    totalSalesByShelf[shelf] = sales.filter(s => s.shelf === shelf).reduce((a, c) => a + Number(c.amount), 0);
  }

  // В план кладём среднее значение, если есть, иначе 0
  let coefSum = 0;
  let coefCount = 0;
  for (const shelf in plan) {
    const planAmount = Number(plan[shelf]) || 0;
    totalPlanAmount += planAmount;
    const salesAmount = totalSalesByShelf[shelf] || 0;
    if (planAmount > 0) {
      coefSum += salesAmount / planAmount;
      coefCount++;
    }
  }
  coef = coefCount > 0 ? coefSum / coefCount : 0;
  coef = Math.min(coef, 2); // Ограничим максимум

  // Премия — пример расчет (коэффициент * сумма продаж * 0.1)
  let premium = coef * totalSales * 0.1;

  // +500 ₽ за каждый рабочий день, если сервисный сотрудник
  if (serviceMode) {
    premium += 500 * workDaysCount;
  }

  const net = premium * 0.87; // минус 13%

  coefSpan.textContent = coef.toFixed(2);
  premiumSpan.textContent = premium.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + ' ₽';
  netSpan.textContent = net.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + ' ₽';
  totalEarningsSpan.textContent = totalSales.toLocaleString('ru-RU', {maximumFractionDigits: 0}) + ' ₽';

  renderProgress(totalPlanAmount, totalSalesByShelf);
  renderDealsList();
  renderCallsList();
}

// Рендер прогресса по полкам
function renderProgress(totalPlanAmount, totalSalesByShelf) {
  progressContainer.innerHTML = '';
  for (const shelf in shelves) {
    const planAmount = Number(plan[shelf]) || 0;
    const salesAmount = totalSalesByShelf[shelf] || 0;
    const percent = planAmount > 0 ? Math.min(salesAmount / planAmount, 1) : 0;
    const bar = document.createElement('div');
    bar.className = 'progress-bar';

    const barInner = document.createElement('div');
    barInner.className = 'progress-bar-inner';
    barInner.style.width = (percent * 100) + '%';

    // Цвет прогресс-бара
    if (percent < 0.7) {
      barInner.style.backgroundColor = '#d32f2f'; // красный
    } else if (percent < 1) {
      barInner.style.backgroundColor = '#fbc02d'; // желтый
    } else {
      barInner.style.backgroundColor = '#388e3c'; // зеленый
    }

    barInner.textContent = `${shelf}: ${salesAmount.toLocaleString('ru-RU')} ₽ / ${planAmount.toLocaleString('ru-RU')} ₽`;

    bar.appendChild(barInner);
    progressContainer.appendChild(bar);
  }
}

// Рендер списка сделок
function fillFilterShelfSelect() {
  filterShelfSelect.innerHTML = '<option value="">Все</option>';
  for (const shelf in shelves) {
    const option = document.createElement('option');
    option.value = shelf;
    option.textContent = shelf;
    filterShelfSelect.appendChild(option);
  }
}

function renderDealsList() {
  const filter = filterShelfSelect.value;
  dealsList.innerHTML = '';

  let filteredSales = sales;
  if (filter) {
    filteredSales = sales.filter(s => s.shelf === filter);
  }
  if (filteredSales.length === 0) {
    dealsList.textContent = 'Нет сделок';
    return;
  }
  filteredSales.forEach(sale => {
    const li = document.createElement('li');
    li.textContent = `${sale.date}: ${sale.shelf} > ${sale.product} — ${Number(sale.amount).toLocaleString('ru-RU')} ₽${sale.comment ? ' (' + sale.comment + ')' : ''}`;
    dealsList.appendChild(li);
  });
}

// Звонки
function renderCallsList() {
  callsList.innerHTML = '';
  if (calls.length === 0) {
    callsList.textContent = 'Нет звонков';
    return;
  }
  calls.forEach(call => {
    const li = document.createElement('li');
    li.textContent = `${call.fio} | ${call.phone} | ${call.result === 'positive' ? 'Положительный' : 'Отрицательный'}${call.reason ? ' — ' + call.reason : ''}${call.reasonComment ? ': ' + call.reasonComment : ''}`;
    callsList.appendChild(li);
  });
}

function addCall() {
  const fio = callFioInput.value.trim();
  const phone = callPhoneInput.value.trim();
  const result = callResultSelect.value;
  const reason = callReasonSelect.value || '';
  const reasonComment = callReasonComment.value.trim();

  if (!fio || !phone || !result) {
    alert('Заполните обязательные поля');
    return;
  }

  calls.push({ fio, phone, result, reason, reasonComment });
  localStorage.setItem('calls', JSON.stringify(calls));

  closeModal(addCallModal);
  addCallForm.reset();
  callReasonContainer.classList.add('hidden');
  callReasonComment.classList.add('hidden');
  renderCallsList();
}

// План редактирование
function openPlanEditor() {
  planEditContainer.innerHTML = '';
  for (const shelf in shelves) {
    const div = document.createElement('div');
    div.className = 'input-group';
    const label = document.createElement('label');
    label.textContent = shelf + ' (₽):';
    label.setAttribute('for', 'plan-' + shelf);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = 0;
    input.value = plan[shelf] || 0;
    input.id = 'plan-' + shelf;
    input.dataset.shelf = shelf;
    div.appendChild(label);
    div.appendChild(input);
    planEditContainer.appendChild(div);
  }
  openModal(planEditorModal);
}

function savePlan() {
  const inputs = planEditContainer.querySelectorAll('input');
  inputs.forEach(input => {
    const shelf = input.dataset.shelf;
    const val = Number(input.value);
    plan[shelf] = val >= 0 ? val : 0;
  });
  localStorage.setItem('plan', JSON.stringify(plan));
  closeModal(planEditorModal);
  updateResults();
}

// Цены редактирование
function openPricesEditor() {
  pricesEditContainer.innerHTML = '';
  for (const shelf in prices) {
    const shelfDiv = document.createElement('fieldset');
    shelfDiv.style.marginBottom = '1rem';
    const legend = document.createElement('legend');
    legend.textContent = shelf;
    shelfDiv.appendChild(legend);

    for (const product in prices[shelf]) {
      const div = document.createElement('div');
      div.className = 'input-group';
      const label = document.createElement('label');
      label.textContent = product + ' (₽):';
      label.setAttribute('for', `price-${shelf}-${product}`);
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 0;
      input.value = prices[shelf][product];
      input.id = `price-${shelf}-${product}`;
      input.dataset.shelf = shelf;
      input.dataset.product = product;
      div.appendChild(label);
      div.appendChild(input);
      shelfDiv.appendChild(div);
    }
    pricesEditContainer.appendChild(shelfDiv);
  }
  openModal(pricesEditorModal);
}

function savePrices() {
  const inputs = pricesEditContainer.querySelectorAll('input');
  inputs.forEach(input => {
    const shelf = input.dataset.shelf;
    const product = input.dataset.product;
    const val = Number(input.value);
    if (!prices[shelf]) prices[shelf] = {};
    prices[shelf][product] = val >= 0 ? val : 0;
  });
  localStorage.setItem('prices', JSON.stringify(prices));
  closeModal(pricesEditorModal);
}

// Модалки открыть/закрыть
function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  // Тёмный фон + фокус
  modal.querySelector('input, button, select, textarea')?.focus();
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

// Заполнить селект полок для добавления продажи
function fillShelfSelect(selectElement) {
  selectElement.innerHTML = '';
  for (const shelf in shelves) {
    const option = document.createElement('option');
    option.value = shelf;
    option.textContent = shelf;
    selectElement.appendChild(option);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  init();
});
