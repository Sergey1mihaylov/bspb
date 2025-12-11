/* (Место разрыва) */
(() => {
  "use strict";

  const STORAGE_KEY = "bspb-zp-calculator-v1";

  const MONTH_NAMES = [
    "Январь","Февраль","Март","Апрель","Май","Июнь",
    "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"
  ];

  const TAX_RATE = 0.13;
  const SERVICE_DAY_BONUS = 500;
/* (Место разрыва) */
/* (Место разрыва) */
  const SHELVES_CONFIG = [
    {
      id:"consumer_loan",
      name:"Потребительский кредит",
      inPlan:true,
      products:[
        {id:"consumer_app",name:"Заявка",type:"fixed",value:0},
        {id:"consumer_issue",name:"Выдача",type:"fixed",value:2500}
      ]
    },
    {
      id:"credit_cards",
      name:"Кредитные карты",
      inPlan:true,
      products:[
/* (Место разрыва) */
/* (Место разрыва) */
        {id:"card_review",name:"С рассмотрением",type:"fixed",value:1000},
        {id:"card_split",name:"Сплит",type:"fixed",value:400},
        {id:"card_app",name:"Заявка",type:"fixed",value:0}
      ]
    },
    {
      id:"debit_activation",
      name:"Активация ДК",
      inPlan:true,
      products:[
        {id:"dk_issue",name:"Выдача карты",type:"fixed",value:0},
/* (Место разрыва) */
/* (Место разрыва) */
        {id:"dk_yarkaya",name:'ТА по "Яркой"',type:"fixed",value:600},
        {id:"dk_other",name:"ТА по остальным (кроме ЕКП)",type:"fixed",value:350},
        {id:"dk_ekp",name:"ТА по ЕКП",type:"fixed",value:250}
      ]
    },
    {
      id:"savings",
      name:"Накопительная полка",
      inPlan:true,
      products:[
        {id:"deposit",name:"Вклад",type:"fixed",value:450},
/* (Место разрыва) */
/* (Место разрыва) */
        {id:"savings_account",name:"Накопительный счёт",type:"fixed",value:350},
        {id:"premium_light_issue",name:"Выдача Premium Light",type:"fixed",value:300},
        {id:"premium_light_sticker",name:"Кнопка учёта стикеров Premium Light",type:"fixed",value:49},
        {id:"sms_info",name:"СМС-информирование",type:"fixed",value:70},
        {id:"lead_cpo",name:"Лид ЦПО",type:"fixed",value:500},
        {id:"lead_mortgage",name:"Лид ипотека",type:"fixed",value:500},
        {id:"card_safe",name:'Страхование "Карточный сейф"',type:"fixed",value:100}
      ]
/* (Место разрыва) */
/* (Место разрыва) */
    },
    {
      id:"box_insurance",
      name:"Коробочное страхование",
      inPlan:false,
      products:[
        {id:"box_standard",name:"Стандартное (8% от суммы)",type:"percent",value:8},
        {id:"box_promo",name:"Акционное (1% от суммы)",type:"percent",value:1},
        {id:"box_credit_standard",name:"Стандартное (3% от суммы)",type:"percent",value:3}
      ]
    },
    {
      id:"pension",
      name:"Перевод пенсии",
/* (Место разрыва) */
/* (Место разрыва) */
      inPlan:true,
      products:[
        {id:"pension_insurance",name:"Страховая пенсия",type:"fixed",value:1500},
        {id:"pension_military",name:"Военная пенсия",type:"fixed",value:1500}
      ]
    }
  ];

  const PLAN_SHELF_IDS = SHELVES_CONFIG.filter(s=>s.inPlan).map(s=>s.id);
/* (Место разрыва) */
/* (Место разрыва) */
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));

  const formatCurrency = v => `${Math.round(v).toLocaleString("ru-RU")} ₽`;
  const clampNumber = n => Number.isFinite(n)&&n>=0?n:0;

  const getMonthKey = (y,m)=>`${y}-${String(m+1).padStart(2,"0")}`;

  const parseNumberInput = input=>{
    if(!input)return 0;
    const v = parseFloat(String(input).replace(",",".")); 
    return Number.isFinite(v)&&v>=0?v:0;
  };
/* (Место разрыва) */
/* (Место разрыва) */
  const genId = ()=>`${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}`;

  function getProgressColor(percent){
    const p = Math.max(0,Math.min(percent,100));
    const lerp=(a,b,t)=>Math.round(a+(b-a)*t);
    const rgb=(r,g,b)=>`rgb(${r},${g},${b})`;
    const red=[242,95,92], yellow=[255,193,7], green=[46,204,113];
    if(p<=80){
      const t=p/80;
      return rgb(lerp(red[0],yellow[0],t),lerp(red[1],yellow[1],t),lerp(red[2],yellow[2],t));
    }
    const t=(p-80)/20;
    return rgb(lerp(yellow[0],green[0],t),lerp(yellow[1],green[1],t),lerp(yellow[2],green[2],t));
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function formatDateRu(dateStr){
    const [y,m,d]=dateStr.split("-").map(v=>parseInt(v,10));
    const dt=new Date(y,m-1,d);
    const names=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    return `${d} ${names[dt.getMonth()]} ${dt.getFullYear()}`;
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function getDefaultState(){
    const today=new Date();
    const y=today.getFullYear();
    const m=today.getMonth();
    const key=getMonthKey(y,m);

    const emptyPlan={};
    PLAN_SHELF_IDS.forEach(id=>emptyPlan[id]=0);

    return {
      salary:0,
      serviceWorker:false,
      currentYear:y,
      currentMonth:m,
      pricesOverrides:{},
/* (Место разрыва) */
/* (Место разрыва) */
      plans:{[key]:emptyPlan},
      sales:[],
      weekends:{}
    };
  }

  function loadState(){
    try{
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw)return getDefaultState();
      const parsed=JSON.parse(raw);
      const def=getDefaultState();
      return {
        ...def,
        ...parsed,
        pricesOverrides:{...def.pricesOverrides,...(parsed.pricesOverrides||{})},
/* (Место разрыва) */
/* (Место разрыва) */
        plans:{...def.plans,...(parsed.plans||{})},
        sales:parsed.sales||[],
        weekends:parsed.weekends||{}
      };
    }catch(e){
      console.error("loadState error",e);
      return getDefaultState();
    }
  }

  function saveState(){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
    }catch(e){
      console.error("saveState error",e);
    }
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function resetState(){
    state=getDefaultState();
    saveState();
    rerenderAll();
    showToast("Данные сброшены","info");
  }

  let state=loadState();
  let currentYear=state.currentYear;
  let currentMonth=state.currentMonth;
  let currentDayDate=null;
  let pendingDeleteSaleId=null;
/* (Место разрыва) */
/* (Место разрыва) */
  const tabButtons=qsa(".tab-btn");
  const tabPanels=qsa(".tab-panel");

  const editPricesBtn=qs("#edit-prices-btn");
  const resetDataBtn=qs("#reset-data-btn");

  const salaryInput=qs("#salary-input");
  const serviceWorkerToggle=qs("#service-worker-toggle");
  const earnTotalEl=qs("#earn-total");
  const earnServiceEl=qs("#earn-service");
  const coefValueEl=qs("#coef-value");
  const bonusGrossEl=qs("#bonus-gross");
  const bonusNetEl=qs("#bonus-net");
/* (Место разрыва) */
/* (Место разрыва) */
  const totalWithSalaryEl=qs("#total-with-salary");

  const editPlanBtn=qs("#edit-plan-btn");
  const planProgressContainer=qs("#plan-progress-container");

  const shelvesInfoContainer=qs("#shelves-info-container");

  const calendarMonthLabel=qs("#calendar-month-label");
  const prevMonthBtn=qs("#prev-month-btn");
  const nextMonthBtn=qs("#next-month-btn");
  const todayMonthBtn=qs("#today-month-btn");
  const calendarGrid=qs("#calendar-grid");
  const salesChartCanvas=qs("#sales-chart");
/* (Место разрыва) */
/* (Место разрыва) */
  const dealsShelfFilter=qs("#deals-shelf-filter");
  const dealsList=qs("#deals-list");

  const dayModal=qs("#day-modal");
  const dayModalTitle=qs("#day-modal-title");
  const dayTotalAmountEl=qs("#day-total-amount");
  const dayWeekendToggle=qs("#day-weekend-toggle");
  const daySalesList=qs("#day-sales-list");
  const daySaleForm=qs("#day-sale-form");
  const saleShelfSelect=qs("#sale-shelf-select");
/* (Место разрыва) */
/* (Место разрыва) */
  const saleProductSelect=qs("#sale-product-select");
  const saleProductWrapper=qs("#sale-product-wrapper");
  const saleInsuranceSumWrapper=qs("#sale-insurance-sum-wrapper");
  const saleInsuranceSumInput=qs("#sale-insurance-sum");
  const saleCommentInput=qs("#sale-comment");
  const saleEditIdInput=qs("#sale-edit-id");
  const daySaleCancelEditBtn=qs("#day-sale-cancel-edit-btn");

  const pricesModal=qs("#prices-modal");
  const pricesModalBody=qs("#prices-modal-body");
  const pricesSaveBtn=qs("#prices-save-btn");
/* (Место разрыва) */
/* (Место разрыва) */
  const planModal=qs("#plan-modal");
  const planModalBody=qs("#plan-modal-body");
  const planSaveBtn=qs("#plan-save-btn");

  const dealDetailsModal=qs("#deal-details-modal");
  const dealDetailsBody=qs("#deal-details-body");
  const dealDetailsEditBtn=qs("#deal-details-edit-btn");
  const dealDetailsDeleteBtn=qs("#deal-details-delete-btn");

  const confirmModal=qs("#confirm-modal");
  const confirmYesBtn=qs("#confirm-yes-btn");
  const confirmNoBtn=qs("#confirm-no-btn");

  const toastContainer=qs("#toast-container");
/* (Место разрыва) */
/* (Место разрыва) */
  function openModal(id){
    const m=qs("#"+id);
    if(!m)return;
    m.classList.remove("hidden");
    m.setAttribute("aria-hidden","false");
  }
  function closeModal(id){
    const m=qs("#"+id);
    if(!m)return;
    m.classList.add("hidden");
    m.setAttribute("aria-hidden","true");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function attachModalGlobalHandlers(){
    qsa(".modal").forEach(modal=>{
      const backdrop=modal.querySelector(".modal-backdrop");
      if(backdrop){
        backdrop.addEventListener("click",()=>{
          modal.classList.add("hidden");
          modal.setAttribute("aria-hidden","true");
        });
      }
    });
    qsa("[data-close-modal]").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const id=btn.getAttribute("data-close-modal");
        if(id)closeModal(id);
      });
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function showToast(message,type="info"){
    if(!toastContainer)return;
    const el=document.createElement("div");
    el.className=`toast toast-${type}`;
    el.textContent=message;
    toastContainer.appendChild(el);
    requestAnimationFrame(()=>el.classList.add("visible"));
    setTimeout(()=>{
      el.classList.remove("visible");
      setTimeout(()=>el.remove(),300);
    },2800);
  }

  function askDeleteSale(id){
    pendingDeleteSaleId=id;
    openModal("confirm-modal");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function getProductValue(shelfId,productId){
    const shelf=SHELVES_CONFIG.find(s=>s.id===shelfId);
    if(!shelf)return 0;
    const product=shelf.products.find(p=>p.id===productId);
    if(!product)return 0;
    const ovShelf=state.pricesOverrides[shelfId];
    if(ovShelf && typeof ovShelf[productId]==="number")return ovShelf[productId];
    return product.value;
  }
  function setProductOverrideValue(shelfId,productId,value){
    if(!state.pricesOverrides[shelfId])state.pricesOverrides[shelfId]={};
    state.pricesOverrides[shelfId][productId]=value;
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function ensureMonthPlan(y,m){
    const key=getMonthKey(y,m);
    if(!state.plans[key]){
      const p={};
      PLAN_SHELF_IDS.forEach(id=>p[id]=0);
      state.plans[key]=p;
    }
    return state.plans[key];
  }
  function getCurrentMonthPlan(){
    return ensureMonthPlan(currentYear,currentMonth);
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function renderPlanModal(){
    const plan=getCurrentMonthPlan();
    planModalBody.innerHTML="";
    PLAN_SHELF_IDS.forEach(id=>{
      const shelf=SHELVES_CONFIG.find(s=>s.id===id);
      const row=document.createElement("div");
      row.className="plan-modal-row";
      const label=document.createElement("label");
      label.className="field-label";
      label.htmlFor=`plan-input-${id}`;
      label.textContent=shelf?shelf.name:id;
      const field=document.createElement("div");
      field.className="field";
      const input=document.createElement("input");
/* (Место разрыва) */
/* (Место разрыва) */
      input.type="number";
      input.min="0";
      input.step="1000";
      input.id=`plan-input-${id}`;
      input.value=plan[id]||0;
      field.appendChild(input);
      row.appendChild(label);
      row.appendChild(field);
      planModalBody.appendChild(row);
    });
  }

  function savePlanFromModal(){
    const plan=getCurrentMonthPlan();
    PLAN_SHELF_IDS.forEach(id=>{
      const input=qs(`#plan-input-${id}`);
      if(!input)return;
      plan[id]=parseNumberInput(input.value);
    });
    saveState();
    renderPlanProgress();
    recalcSummary();
    showToast("План сохранён","success");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function computeShelfEarningsForMonth(shelfId,y,m){
    const key=getMonthKey(y,m);
    return state.sales
      .filter(s=>s.shelfId===shelfId && s.date.startsWith(key))
      .reduce((sum,s)=>sum+s.amount,0);
  }

  function renderPlanProgress(){
    const plan=getCurrentMonthPlan();
    planProgressContainer.innerHTML="";
    PLAN_SHELF_IDS.forEach(id=>{
      const shelf=SHELVES_CONFIG.find(s=>s.id===id);
      const fact=computeShelfEarningsForMonth(id,currentYear,currentMonth);
/* (Место разрыва) */
/* (Место разрыва) */
      const target=plan[id]||0;
      const percent=target>0?(fact/target)*100:0;
      const display=Math.round(percent);
      const clamped=Math.min(percent,100);
      const color=getProgressColor(percent);

      const row=document.createElement("div");
      row.className="plan-row";

      const header=document.createElement("div");
      header.className="plan-row-header";
      const nameSpan=document.createElement("span");
      nameSpan.className="plan-row-name";
      nameSpan.textContent=shelf?shelf.name:id;
/* (Место разрыва) */
/* (Место разрыва) */
      const valueSpan=document.createElement("span");
      valueSpan.className="plan-row-value";
      valueSpan.textContent=`${formatCurrency(fact)} / ${formatCurrency(target)} · ${display}%`;
      header.appendChild(nameSpan);
      header.appendChild(valueSpan);

      const bar=document.createElement("div");
      bar.className="plan-progress-bar";
      const fill=document.createElement("div");
      fill.className="plan-progress-fill";
      fill.style.width=`${clamped}%`;
      fill.style.background=color;
      bar.appendChild(fill);

      row.appendChild(header);
      row.appendChild(bar);
      planProgressContainer.appendChild(row);
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function computeCoefficient(){
    const plan=getCurrentMonthPlan();
    let completed=0;
    let pensionCompleted=false;

    PLAN_SHELF_IDS.forEach(id=>{
      const target=plan[id]||0;
      if(target<=0)return;
      const fact=computeShelfEarningsForMonth(id,currentYear,currentMonth);
      if(fact>=target){
        completed++;
        if(id==="pension")pensionCompleted=true;
      }
    });

    let coef=0;
    if(completed===0)coef=0;
    else if(completed<=3)coef=1.0;
    else if(completed>=5)coef=1.3;
    else if(completed>=4)coef=1.2;

    if(completed>0 && !pensionCompleted)coef=Math.max(0,coef-0.1);
    return {coef,completed};
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function renderShelvesInfo(){
    shelvesInfoContainer.innerHTML="";
    SHELVES_CONFIG.forEach(shelf=>{
      const block=document.createElement("div");
      block.className="shelf-info-block";
      const title=document.createElement("h3");
      title.className="shelf-info-title";
      title.textContent=shelf.name;
      block.appendChild(title);
      const list=document.createElement("div");
      list.className="shelf-info-products";
      shelf.products.forEach(p=>{
        const row=document.createElement("div");
        row.className="shelf-info-row";
/* (Место разрыва) */
/* (Место разрыва) */
        const name=document.createElement("span");
        name.className="shelf-info-name";
        name.textContent=p.name;
        const val=document.createElement("span");
        val.className="shelf-info-value";
        const v=getProductValue(shelf.id,p.id);
        val.textContent=p.type==="fixed"?formatCurrency(v):`${v}% от суммы`;
        row.appendChild(name);
        row.appendChild(val);
        list.appendChild(row);
      });
      block.appendChild(list);
      shelvesInfoContainer.appendChild(block);
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function getSalesForDate(dateStr){
    return state.sales.filter(s=>s.date===dateStr);
  }
  function getDayTotalForDate(dateStr){
    return getSalesForDate(dateStr).reduce((sum,s)=>sum+s.amount,0);
  }

  function buildCalendar(){
    calendarGrid.innerHTML="";
    const first=new Date(currentYear,currentMonth,1);
    const daysInMonth=new Date(currentYear,currentMonth+1,0).getDate();
    const jsWd=first.getDay();
    const offset=(jsWd+6)%7;
/* (Место разрыва) */
/* (Место разрыва) */
    for(let i=0;i<offset;i++){
      const cell=document.createElement("div");
      cell.className="calendar-cell calendar-cell-empty";
      calendarGrid.appendChild(cell);
    }

    const key=getMonthKey(currentYear,currentMonth);
    for(let day=1;day<=daysInMonth;day++){
      const dateStr=`${key}-${String(day).padStart(2,"0")}`;
      const total=getDayTotalForDate(dateStr);
      const dt=new Date(currentYear,currentMonth,day);
      const jsDay=dt.getDay();
      const isWeekend=jsDay===0||jsDay===6;
      const isMarked=!!state.weekends[dateStr];

      const cell=document.createElement("button");
/* (Место разрыва) */
/* (Место разрыва) */
      cell.type="button";
      cell.className="calendar-cell calendar-day";
      cell.dataset.date=dateStr;
      if(isMarked)cell.classList.add("calendar-day-off");

      const num=document.createElement("div");
      num.className="calendar-day-number";
      num.textContent=day;
      const totalDiv=document.createElement("div");
      totalDiv.className="calendar-day-total";
      totalDiv.textContent=total>0?formatCurrency(total):"";

      cell.appendChild(num);
      cell.appendChild(totalDiv);
      calendarGrid.appendChild(cell);
    }
    calendarMonthLabel.textContent=`${MONTH_NAMES[currentMonth]} ${currentYear}`;
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function openDayModal(dateStr){
    currentDayDate=dateStr;
    dayModalTitle.textContent=formatDateRu(dateStr);
    dayWeekendToggle.checked=!!state.weekends[dateStr];
    saleEditIdInput.value="";
    saleShelfSelect.value="";
    saleProductSelect.innerHTML="";
    saleInsuranceSumInput.value="";
    saleCommentInput.value="";
    updateSaleFormForShelf();
    renderDaySalesList();
    updateDayTotal();
    openModal("day-modal");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function updateDayTotal(){
    if(!currentDayDate)return;
    const total=getDayTotalForDate(currentDayDate);
    dayTotalAmountEl.textContent=formatCurrency(total);
  }

  function renderDaySalesList(){
    if(!currentDayDate)return;
    daySalesList.innerHTML="";
    const sales=getSalesForDate(currentDayDate);
    if(sales.length===0){
      const p=document.createElement("p");
      p.className="empty-placeholder";
      p.textContent="За этот день продаж нет.";
      daySalesList.appendChild(p);
      return;
    }
/* (Место разрыва) */
/* (Место разрыва) */
    sales.slice().sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).forEach(sale=>{
      const shelf=SHELVES_CONFIG.find(s=>s.id===sale.shelfId);
      const product=shelf?shelf.products.find(p=>p.id===sale.productId):null;

      const row=document.createElement("div");
      row.className="day-sale-row";
      row.dataset.saleId=sale.id;

      const main=document.createElement("div");
      main.className="day-sale-main";
      const title=document.createElement("div");
      title.className="day-sale-title";
      title.textContent=`${shelf?shelf.name:sale.shelfId} — ${product?product.name:""}`;
      const amount=document.createElement("div");
      amount.className="day-sale-amount";
      amount.textContent=`+${formatCurrency(sale.amount)}`;
/* (Место разрыва) */
/* (Место разрыва) */
      main.appendChild(title);
      main.appendChild(amount);

      const meta=document.createElement("div");
      meta.className="day-sale-meta";
      if(sale.comment){
        meta.textContent=sale.comment;
      }else if(sale.insuranceSum){
        meta.textContent=`Сумма страховки: ${formatCurrency(sale.insuranceSum)}`;
      }else{
        meta.textContent="";
      }

      const actions=document.createElement("div");
      actions.className="day-sale-actions";
/* (Место разрыва) */
/* (Место разрыва) */
      const editBtn=document.createElement("button");
      editBtn.type="button";
      editBtn.className="icon-btn small";
      editBtn.dataset.action="edit-sale";
      editBtn.textContent="✎";

      const delBtn=document.createElement("button");
      delBtn.type="button";
      delBtn.className="icon-btn small danger";
      delBtn.dataset.action="delete-sale";
      delBtn.textContent="🗑";

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      row.appendChild(main);
      row.appendChild(meta);
      row.appendChild(actions);
      daySalesList.appendChild(row);
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function updateSaleFormForShelf(){
    const shelfId=saleShelfSelect.value;
    const shelf=SHELVES_CONFIG.find(s=>s.id===shelfId);
    if(!shelf){
      saleProductWrapper.classList.add("hidden");
      saleInsuranceSumWrapper.classList.add("hidden");
      saleProductSelect.innerHTML="";
      return;
    }
    saleProductSelect.innerHTML="";
    shelf.products.forEach(p=>{
      const opt=document.createElement("option");
      opt.value=p.id;
      opt.textContent=p.name;
      saleProductSelect.appendChild(opt);
    });
    saleProductWrapper.classList.remove("hidden");
    if(shelfId==="box_insurance"){
      saleInsuranceSumWrapper.classList.remove("hidden");
    }else{
      saleInsuranceSumWrapper.classList.add("hidden");
      saleInsuranceSumInput.value="";
    }
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function addOrUpdateSaleFromForm(){
    if(!currentDayDate)return;
    const shelfId=saleShelfSelect.value;
    const productId=saleProductSelect.value;
    if(!shelfId||!productId){
      showToast("Выберите полку и продукт","error");
      return;
    }
    const shelf=SHELVES_CONFIG.find(s=>s.id===shelfId);
    const product=shelf?shelf.products.find(p=>p.id===productId):null;
    if(!product){
      showToast("Некорректный продукт","error");
      return;
    }
    let amount=0;
    let insuranceSum=null;
/* (Место разрыва) */
/* (Место разрыва) */
    if(product.type==="fixed"){
      amount=clampNumber(getProductValue(shelfId,productId));
    }else{
      const sum=parseNumberInput(saleInsuranceSumInput.value);
      if(sum<=0){
        showToast("Введите сумму страховки","error");
        return;
      }
      insuranceSum=sum;
      const percent=getProductValue(shelfId,productId);
      amount=clampNumber(sum*percent/100);
    }

    const comment=saleCommentInput.value.trim();
    const editId=saleEditIdInput.value||null;
    const nowIso=new Date().toISOString();
/* (Место разрыва) */
/* (Место разрыва) */
    if(editId){
      const target=state.sales.find(s=>s.id===editId);
      if(!target){
        showToast("Продажа не найдена","error");
      }else{
        target.shelfId=shelfId;
        target.productId=productId;
        target.amount=amount;
        target.comment=comment;
        target.insuranceSum=insuranceSum;
        target.insuranceType=product.type==="percent"?productId:null;
        target.updatedAt=nowIso;
      }
    }else{
      state.sales.push({
        id:genId(),
        date:currentDayDate,
        shelfId,
        productId,
        amount,
        comment,
        insuranceSum,
        insuranceType:product.type==="percent"?productId:null,
        createdAt:nowIso,
        updatedAt:nowIso
      });
    }
/* (Место разрыва) */
/* (Место разрыва) */
    saleEditIdInput.value="";
    saleCommentInput.value="";
    if(shelfId==="box_insurance")saleInsuranceSumInput.value="";

    saveState();
    renderDaySalesList();
    updateDayTotal();
    buildCalendar();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа сохранена","success");
  }

  function fillSaleFormForEdit(id){
    const sale=state.sales.find(s=>s.id===id);
    if(!sale)return;
    saleEditIdInput.value=sale.id;
/* (Место разрыва) */
/* (Место разрыва) */
    saleShelfSelect.value=sale.shelfId;
    updateSaleFormForShelf();
    saleProductSelect.value=sale.productId||"";
    saleCommentInput.value=sale.comment||"";
    saleInsuranceSumInput.value=sale.insuranceSum||"";
  }

  function deleteSaleById(id){
    const idx=state.sales.findIndex(s=>s.id===id);
    if(idx===-1)return;
    state.sales.splice(idx,1);
    saveState();
    buildCalendar();
    renderDaySalesList();
    updateDayTotal();
    renderPlanProgress();
    recalcSummary();
    renderDealsList();
    renderSalesChart();
    showToast("Продажа удалена","info");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function attachCalendarHandlers(){
    prevMonthBtn&&prevMonthBtn.addEventListener("click",()=>{
      currentMonth--;
      if(currentMonth<0){currentMonth=11;currentYear--;}
      state.currentYear=currentYear;
      state.currentMonth=currentMonth;
      ensureMonthPlan(currentYear,currentMonth);
      saveState();
      rerenderAll();
    });
/* (Место разрыва) */
/* (Место разрыва) */
    nextMonthBtn&&nextMonthBtn.addEventListener("click",()=>{
      currentMonth++;
      if(currentMonth>11){currentMonth=0;currentYear++;}
      state.currentYear=currentYear;
      state.currentMonth=currentMonth;
      ensureMonthPlan(currentYear,currentMonth);
      saveState();
      rerenderAll();
    });

    todayMonthBtn&&todayMonthBtn.addEventListener("click",()=>{
      const t=new Date();
      currentYear=t.getFullYear();
      currentMonth=t.getMonth();
      state.currentYear=currentYear;
      state.currentMonth=currentMonth;
      ensureMonthPlan(currentYear,currentMonth);
      saveState();
      rerenderAll();
    });
/* (Место разрыва) */
/* (Место разрыва) */
    calendarGrid&&calendarGrid.addEventListener("click",e=>{
      const cell=e.target.closest(".calendar-day");
      if(!cell)return;
      const dateStr=cell.dataset.date;
      if(!dateStr)return;
      openDayModal(dateStr);
    });

    dayWeekendToggle&&dayWeekendToggle.addEventListener("change",()=>{
      if(!currentDayDate)return;
      if(dayWeekendToggle.checked)state.weekends[currentDayDate]=true;
      else delete state.weekends[currentDayDate];
      saveState();
      buildCalendar();
      renderSalesChart();
      recalcSummary();
    });
/* (Место разрыва) */
/* (Место разрыва) */
    daySaleForm&&daySaleForm.addEventListener("submit",e=>{
      e.preventDefault();
      addOrUpdateSaleFromForm();
    });

    saleShelfSelect&&saleShelfSelect.addEventListener("change",updateSaleFormForShelf);

    daySaleCancelEditBtn&&daySaleCancelEditBtn.addEventListener("click",()=>{
      saleEditIdInput.value="";
      saleCommentInput.value="";
      saleInsuranceSumInput.value="";
      saleShelfSelect.value="";
      saleProductSelect.innerHTML="";
      saleProductWrapper.classList.add("hidden");
      saleInsuranceSumWrapper.classList.add("hidden");
    });
/* (Место разрыва) */
/* (Место разрыва) */
    daySalesList&&daySalesList.addEventListener("click",e=>{
      const btn=e.target.closest("button");
      if(!btn)return;
      const action=btn.dataset.action;
      const row=btn.closest(".day-sale-row");
      if(!row)return;
      const id=row.dataset.saleId;
      if(!id)return;
      if(action==="edit-sale")fillSaleFormForEdit(id);
      else if(action==="delete-sale")askDeleteSale(id);
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function buildDealsShelfFilterOptions(){
    SHELVES_CONFIG.forEach(shelf=>{
      const opt=document.createElement("option");
      opt.value=shelf.id;
      opt.textContent=shelf.name;
      dealsShelfFilter.appendChild(opt);
    });
  }

  function renderDealsList(){
    if(!dealsList)return;
    dealsList.innerHTML="";
    const key=getMonthKey(currentYear,currentMonth);
    let deals=state.sales.filter(s=>s.date.startsWith(key));
/* (Место разрыва) */
/* (Место разрыва) */
    const filter=dealsShelfFilter?dealsShelfFilter.value:"all";
    if(filter&&filter!=="all")deals=deals.filter(s=>s.shelfId===filter);
    if(deals.length===0){
      const p=document.createElement("p");
      p.className="empty-placeholder";
      p.textContent="В этом месяце ещё нет сделок.";
      dealsList.appendChild(p);
      return;
    }
    deals.slice().sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).forEach(sale=>{
      const shelf=SHELVES_CONFIG.find(s=>s.id===sale.shelfId);
      const product=shelf?shelf.products.find(p=>p.id===sale.productId):null;
/* (Место разрыва) */
/* (Место разрыва) */
      const item=document.createElement("div");
      item.className="deal-item";
      item.dataset.saleId=sale.id;

      const top=document.createElement("div");
      top.className="deal-item-top";
      const title=document.createElement("div");
      title.className="deal-item-title";
      title.textContent=`${shelf?shelf.name:sale.shelfId} — ${product?product.name:""}`;
      const amount=document.createElement("div");
      amount.className="deal-item-amount";
      amount.textContent=`+${formatCurrency(sale.amount)}`;
      top.appendChild(title);
      top.appendChild(amount);
/* (Место разрыва) */
/* (Место разрыва) */
      const bottom=document.createElement("div");
      bottom.className="deal-item-bottom";
      const createdAt=sale.createdAt?new Date(sale.createdAt):new Date(sale.date);
      const dateSpan=document.createElement("span");
      dateSpan.className="deal-item-date";
      dateSpan.textContent=`${formatDateRu(sale.date)}, ${createdAt.toTimeString().slice(0,5)}`;
      const comment=document.createElement("span");
      comment.className="deal-item-comment";
      comment.textContent=sale.comment||"";
      bottom.appendChild(dateSpan);
      bottom.appendChild(comment);

      item.appendChild(top);
      item.appendChild(bottom);
/* (Место разрыва) */
/* (Место разрыва) */
      item.addEventListener("click",()=>openDealDetailsModal(sale.id));
      dealsList.appendChild(item);
    });
  }

  function openDealDetailsModal(id){
    const sale=state.sales.find(s=>s.id===id);
    if(!sale)return;
    dealDetailsBody.innerHTML="";
    const shelf=SHELVES_CONFIG.find(s=>s.id===sale.shelfId);
    const product=shelf?shelf.products.find(p=>p.id===sale.productId):null;
/* (Место разрыва) */
/* (Место разрыва) */
    const dl=document.createElement("dl");
    dl.className="details-dl";
    const addRow=(label,value)=>{
      const dt=document.createElement("dt");
      dt.textContent=label;
      const dd=document.createElement("dd");
      dd.textContent=value;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    addRow("Дата",formatDateRu(sale.date));
    if(sale.createdAt){
      const dt=new Date(sale.createdAt);
      addRow("Время",dt.toTimeString().slice(0,8));
    }
/* (Место разрыва) */
/* (Место разрыва) */
    addRow("Полка",shelf?shelf.name:sale.shelfId);
    addRow("Продукт",product?product.name:"");
    addRow("Сумма",formatCurrency(sale.amount));
    if(sale.insuranceSum)addRow("Сумма страховки",formatCurrency(sale.insuranceSum));
    addRow("Комментарий",sale.comment||"—");
    dealDetailsBody.appendChild(dl);
    dealDetailsModal.dataset.saleId=sale.id;
    openModal("deal-details-modal");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function renderSalesChart(){
    if(!salesChartCanvas)return;
    const ctx=salesChartCanvas.getContext("2d");
    const w=salesChartCanvas.width;
    const h=salesChartCanvas.height;
    ctx.clearRect(0,0,w,h);

    const key=getMonthKey(currentYear,currentMonth);
    const daysInMonth=new Date(currentYear,currentMonth+1,0).getDate();
    const points=[];
    for(let day=1;day<=daysInMonth;day++){
      const dateStr=`${key}-${String(day).padStart(2,"0")}`;
      const dt=new Date(currentYear,currentMonth,day);
      const js=dt.getDay();
      const weekend=js===0||js===6;
      if(weekend)continue;
      if(state.weekends[dateStr])continue;
/* (Место разрыва) */
/* (Место разрыва) */
      const total=getDayTotalForDate(dateStr);
      points.push({dateStr,total});
    }
    if(points.length===0){
      ctx.fillStyle="#9ca3af";
      ctx.font="14px system-ui";
      ctx.fillText("Нет данных для графика",20,h/2);
      return;
    }
    const maxY=Math.max(...points.map(p=>p.total),1);
    const pad=32;
    const cw=w-pad*2;
    const ch=h-pad*2;

    ctx.strokeStyle="rgba(255,255,255,.3)";
    ctx.lineWidth=1;
    ctx.beginPath();
    ctx.moveTo(pad,pad);
    ctx.lineTo(pad,pad+ch);
    ctx.lineTo(pad+cw,pad+ch);
    ctx.stroke();
/* (Место разрыва) */
/* (Место разрыва) */
    const gridLines=4;
    ctx.strokeStyle="rgba(255,255,255,.12)";
    ctx.setLineDash([4,4]);
    for(let i=1;i<=gridLines;i++){
      const y=pad+ch*i/gridLines;
      ctx.beginPath();
      ctx.moveTo(pad,y);
      ctx.lineTo(pad+cw,y);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.lineWidth=2;
    ctx.strokeStyle="#38bdf8";
    ctx.beginPath();
/* (Место разрыва) */
/* (Место разрыва) */
    points.forEach((p,idx)=>{
      const x=pad+cw*(idx/Math.max(points.length-1,1));
      const y=pad+ch-ch*(p.total/maxY);
      if(idx===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    ctx.fillStyle="#ef4444";
    points.forEach((p,idx)=>{
      const x=pad+cw*(idx/Math.max(points.length-1,1));
      const y=pad+ch-ch*(p.total/maxY);
      ctx.beginPath();
      ctx.arc(x,y,4,0,Math.PI*2);
      ctx.fill();
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function computeMonthStats(y,m){
    const key=getMonthKey(y,m);
    const monthSales=state.sales.filter(s=>s.date.startsWith(key));
    const totalEarnings=monthSales.reduce((sum,s)=>sum+s.amount,0);

    const days=new Set(monthSales.map(s=>s.date));
    let serviceDays=0;
    days.forEach(dateStr=>{
      const [Y,M,D]=dateStr.split("-").map(v=>parseInt(v,10));
      const dt=new Date(Y,M-1,D);
      const js=dt.getDay();
      const weekend=js===0||js===6;
      const custom=!!state.weekends[dateStr];
      if(!weekend&&!custom)serviceDays++;
    });
    const serviceBonus=state.serviceWorker?SERVICE_DAY_BONUS*serviceDays:0;
    return {totalEarnings,serviceBonus};
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function recalcSummary(){
    const {totalEarnings,serviceBonus}=computeMonthStats(currentYear,currentMonth);
    const {coef}=computeCoefficient();
    const salary=clampNumber(state.salary||0);
    const salaryNet=salary*(1-TAX_RATE);
    const base=totalEarnings+serviceBonus;
    const bonusGross=base*coef;
    const bonusNet=bonusGross*(1-TAX_RATE);

    earnTotalEl&&(earnTotalEl.textContent=formatCurrency(totalEarnings));
    earnServiceEl&&(earnServiceEl.textContent=formatCurrency(serviceBonus));
    coefValueEl&&(coefValueEl.textContent=coef.toFixed(1));
    bonusGrossEl&&(bonusGrossEl.textContent=formatCurrency(bonusGross));
    bonusNetEl&&(bonusNetEl.textContent=formatCurrency(bonusNet));
    totalWithSalaryEl&&(totalWithSalaryEl.textContent=formatCurrency(salaryNet+bonusNet));
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function renderPricesModal(){
    pricesModalBody.innerHTML="";
    SHELVES_CONFIG.forEach(shelf=>{
      const block=document.createElement("div");
      block.className="prices-shelf-block";
      const title=document.createElement("h3");
      title.className="prices-shelf-title";
      title.textContent=shelf.name;
      block.appendChild(title);
      shelf.products.forEach(p=>{
        const row=document.createElement("div");
        row.className="prices-row";
/* (Место разрыва) */
/* (Место разрыва) */
        const label=document.createElement("label");
        label.className="field-label";
        label.htmlFor=`price-${shelf.id}-${p.id}`;
        label.textContent=p.name;
        const field=document.createElement("div");
        field.className="field";
        const input=document.createElement("input");
        input.type="number";
        input.min="0";
        input.step=p.type==="percent"?"0.1":"50";
        input.id=`price-${shelf.id}-${p.id}`;
        input.inputMode="decimal";
        input.value=getProductValue(shelf.id,p.id);
/* (Место разрыва) */
/* (Место разрыва) */
        const suffix=document.createElement("span");
        suffix.className="prices-suffix";
        suffix.textContent=p.type==="percent"?"% от суммы":"₽";
        field.appendChild(input);
        field.appendChild(suffix);
        row.appendChild(label);
        row.appendChild(field);
        block.appendChild(row);
      });
      pricesModalBody.appendChild(block);
    });
  }

  function savePricesFromModal(){
    SHELVES_CONFIG.forEach(shelf=>{
      shelf.products.forEach(p=>{
        const input=qs(`#price-${shelf.id}-${p.id}`);
        if(!input)return;
        setProductOverrideValue(shelf.id,p.id,parseNumberInput(input.value));
      });
    });
    saveState();
    renderShelvesInfo();
    showToast("Цены обновлены","success");
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function attachTabsHandlers(){
    tabButtons.forEach(btn=>{
      btn.addEventListener("click",()=>{
        const tab=btn.dataset.tab;
        if(!tab)return;
        tabButtons.forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        tabPanels.forEach(p=>{
          p.classList.toggle("active",p.id===`tab-${tab}`);
        });
      });
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function attachGlobalHandlers(){
    if(salaryInput){
      salaryInput.value=state.salary||"";
      salaryInput.addEventListener("change",()=>{
        state.salary=parseNumberInput(salaryInput.value);
        saveState();
        recalcSummary();
      });
    }
    if(serviceWorkerToggle){
      serviceWorkerToggle.checked=!!state.serviceWorker;
      serviceWorkerToggle.addEventListener("change",()=>{
        state.serviceWorker=serviceWorkerToggle.checked;
        saveState();
        recalcSummary();
      });
    }
/* (Место разрыва) */
/* (Место разрыва) */
    editPlanBtn&&editPlanBtn.addEventListener("click",()=>{
      renderPlanModal();
      openModal("plan-modal");
    });
    planSaveBtn&&planSaveBtn.addEventListener("click",()=>{
      savePlanFromModal();
      closeModal("plan-modal");
    });

    editPricesBtn&&editPricesBtn.addEventListener("click",()=>{
      renderPricesModal();
      openModal("prices-modal");
    });
    pricesSaveBtn&&pricesSaveBtn.addEventListener("click",()=>{
      savePricesFromModal();
      closeModal("prices-modal");
    });
/* (Место разрыва) */
/* (Место разрыва) */
    resetDataBtn&&resetDataBtn.addEventListener("click",()=>{
      if(window.confirm("Вы точно хотите полностью сбросить все данные?")){
        resetState();
      }
    });

    confirmYesBtn&&confirmYesBtn.addEventListener("click",()=>{
      closeModal("confirm-modal");
      if(pendingDeleteSaleId){
        deleteSaleById(pendingDeleteSaleId);
        pendingDeleteSaleId=null;
      }
    });
    confirmNoBtn&&confirmNoBtn.addEventListener("click",()=>{
      pendingDeleteSaleId=null;
      closeModal("confirm-modal");
    });

    if(dealsShelfFilter && dealsShelfFilter.options.length===1){
      buildDealsShelfFilterOptions();
    }
/* (Место разрыва) */
/* (Место разрыва) */
  function attachDealsHandlers(){
    dealsShelfFilter&&dealsShelfFilter.addEventListener("change",renderDealsList);
    dealDetailsEditBtn&&dealDetailsEditBtn.addEventListener("click",()=>{
      const id=dealDetailsModal.dataset.saleId;
      if(!id)return;
      const sale=state.sales.find(s=>s.id===id);
      if(!sale)return;
      closeModal("deal-details-modal");
      const dt=new Date(sale.date);
      currentYear=dt.getFullYear();
      currentMonth=dt.getMonth();
      state.currentYear=currentYear;
      state.currentMonth=currentMonth;
      saveState();
      buildCalendar();
      openDayModal(sale.date);
      fillSaleFormForEdit(id);
    });
/* (Место разрыва) */
/* (Место разрыва) */
    dealDetailsDeleteBtn&&dealDetailsDeleteBtn.addEventListener("click",()=>{
      const id=dealDetailsModal.dataset.saleId;
      if(!id)return;
      closeModal("deal-details-modal");
      askDeleteSale(id);
    });
  }
/* (Место разрыва) */
/* (Место разрыва) */
  function rerenderAll(){
    ensureMonthPlan(currentYear,currentMonth);
    renderShelvesInfo();
    renderPlanProgress();
    buildCalendar();
    renderDealsList();
    renderSalesChart();
    recalcSummary();
  }

  function init(){
    attachTabsHandlers();
    attachGlobalHandlers();
    attachCalendarHandlers();
    attachDealsHandlers();
    attachModalGlobalHandlers();
    rerenderAll();
  }

  document.addEventListener("DOMContentLoaded",init);
})();
 /* (Место разрыва) */
