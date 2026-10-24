
/* ══ 特價提醒功能 ══ */
const GROCERY_URL = 'https://yenthesoloman.github.io/grocery/';

function openGrocerySearch(keyword) {
  const win = window.open(GROCERY_URL, '_blank');
  // 等新分頁載入完成後自動填入搜尋
  const timer = setInterval(() => {
    try {
      const input = win.document.querySelector('input[type="search"], input[type="text"], .search-wrap input, #search-input, input');
      if (input) {
        input.value = keyword;
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new KeyboardEvent('keyup', {bubbles: true}));
        clearInterval(timer);
      }
    } catch(e) { clearInterval(timer); }
  }, 500);
  setTimeout(() => clearInterval(timer), 8000);
}

// 排除不需要比對的分類（非超市採買類）
const DEAL_EXCLUDE_CATS = ['外食', '交通', '住宅', '保健食品', '個人消費', '呆帳', '房租', '美妝保養', 'GST', 'PST'];

// 台灣用語 → Grocery zh_label 對照表
const ZH_ALIAS = {
  '洋芋片': '薯片',
  '洋芋': '薯片',
  '樂事': '薯片',
  '可樂': '飲料',
  '汽水': '飲料',
  '麵包': '麵包',
  '吐司': '麵包',
  '豬肉': '豬肉',
  '雞肉': '雞肉',
  '牛肉': '牛肉',
  '培根': '培根',
  '火腿': '火腿',
  '雞蛋': '雞蛋',
  '牛奶': '牛奶',
  '奶油': '忌廉',
  '鮮奶油': '忌廉',
  '起司': '芝士',
  '乳酪': '乳酪',
  '優格': '乳酪',
  '鮭魚': '三文魚',
  '蝦': '蝦',
  '鮪魚': '吞拿魚',
  '番茄': '番茄',
  '生菜': '生菜',
  '西蘭花': '西蘭花',
  '花椰菜': '西蘭花',
  '馬鈴薯': '馬鈴薯',
  '葡萄': '葡萄',
  '橘子': '橙',
  '柳橙': '橙',
  '芒果': '芒果',
  '香蕉': '香蕉',
  '蘋果': '蘋果',
  '沙拉油': '食油',
  '醬油': '醬汁',
  '泡麵': '麵',
  '拉麵': '麵',
  '米': '米飯',
  '白米': '米飯',
  '衛生紙': '紙巾',
  '廚房紙巾': '廚房紙',
  '洗碗精': '肥皂',
  '洗手乳': '肥皂',
  '洗衣精': '洗衣液',
  '冷凍': '急凍食品',
};

// 從帳本統計常買品項（排除外食類）
function getFrequentItems() {
  const freq = {};
  // 排除的品項名稱（不是超市採買的）
  const DEAL_EXCLUDE_NAMES = ['電子菸', '菸', '煙', 'vape', 'GST', 'PST'];
  // 只保留真正超市採買的分類
  const DEAL_INCLUDE_CATS = ['咖啡', '日用品', '牛奶', '牛奶/奶製品', '米/麵/泡麵/麵包', '肉類', '蔬菜', '調味料', '雞蛋', '零食', '飲料'];
  state.expenses.forEach(e => {
    if (!DEAL_INCLUDE_CATS.some(c => (e.cat||'').includes(c))) return;
    const key = e.name.trim();
    if (!key) return;
    if (DEAL_EXCLUDE_NAMES.some(n => key.includes(n))) return;
    freq[key] = (freq[key] || 0) + 1;
  });
  return Object.entries(freq)
    .filter(([,v]) => v >= 2)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 60)
    .map(([k]) => k.trim());
}

// 比對 grocery DEALS 陣列和帳本常買品項
function matchDeals(deals, freqItems) {
  return deals.filter(d => {
    const zhLabel = (d.zh_label || '').trim();
    if (!zhLabel) return false;
    return freqItems.some(item => {
      if (!item || item.length < 1) return false;
      // 直接包含比對：帳本品項包含 zh_label，或 zh_label 包含帳本品項
      return item.includes(zhLabel) || zhLabel.includes(item);
    });
  });
}

let dealData = null; // cache
const POSTAL_CODE = 'V5H4L9';
const FLIPP_API = 'https://backflipp.wishabi.com/flipp/items/search?locale=en-CA&postal_code=' + POSTAL_CODE + '&q=';

// 從 Flipp API 抓單一關鍵字的特價
async function fetchFlippItems(query) {
  try {
    const res = await fetch(FLIPP_API + encodeURIComponent(query));
    const data = await res.json();
    return (data.items || []).map(d => ({
      name: d.name || '',
      price: d.current_price,
      original: d.original_price,
      savings_pct: d.original_price && d.current_price ? Math.round((1 - d.current_price / d.original_price) * 100) : null,
      store: d.merchant_name || '',
      zh_label: '',
    }));
  } catch(e) {
    return [];
  }
}

async function loadDeals() {
  if (dealData) return dealData;
  // 用 MY_RULES 裡的 en 關鍵字去 Flipp API 查詢
  const queries = [...new Set(MY_RULES.map(r => r.en))];
  const all = await Promise.all(queries.map(q => fetchFlippItems(q)));
  dealData = all.flat();
  return dealData;
}

function openDealModal() {
  document.getElementById('deal-modal').classList.add('open');
  renderDealModal();
}
function closeDealModal() {
  document.getElementById('deal-modal').classList.remove('open');
}

async function renderDealModal() {
  const body = document.getElementById('deal-box-body');
  body.innerHTML = '<div class="deal-empty">載入中...</div>';
  const deals = await loadDeals();
  const matched = matchDealsByRules(deals);

  if (matched.length === 0) {
    body.innerHTML = '<div class="deal-empty">本週沒有找到你常買的特價商品</div>';
    return;
  }

  const storeOrder = ['Walmart', 'Real Canadian Superstore', 'T&T Supermarket', 'PriceSmart 佳廉', 'Save-On-Foods'];
  const storeEmoji = { 'Walmart':'🟡', 'Real Canadian Superstore':'🟢', 'T&T Supermarket':'🔴', 'Save-On-Foods':'🔵', 'PriceSmart 佳廉':'🟠' };

  const makeLink = (store, en) => {
    const q = encodeURIComponent(en);
    if (store === 'Walmart') return `https://www.walmart.ca/en/search?q=${q}`;
    if (store === 'Real Canadian Superstore') return `https://www.realcanadiansuperstore.ca/en/search?search-bar=${q}`;
    if (store === 'T&T Supermarket') return `https://www.tntsupermarket.com/search#q=${q}`;
    if (store.includes('PriceSmart')) return `https://www.pricesmartfoods.com/sm/pickup/rsid/2274/results?q=${q}&sort=price-asc`;
    if (store.includes('Save-On')) return `https://www.saveonfoods.com/sm/planning/rsid/900/results?q=${q}&sort=price-asc`;
    return `https://www.walmart.ca/search?q=${q}`;
  };

  // 按超市分組，同超市同品項只留一筆
  const byStore = {};
  matched.forEach(d => {
    const s = d.store || '其他';
    if (!byStore[s]) byStore[s] = [];
    const key = d._rule ? d._rule.match : (d.zh_label || d.name);
    if (!byStore[s].find(x => (x._rule ? x._rule.match : x.zh_label) === key)) {
      byStore[s].push(d);
    }
  });

  let html = '';
  storeOrder.forEach(store => {
    const items = byStore[store];
    if (!items || items.length === 0) return;
    const em = storeEmoji[store] || '🏪';
    html += `<div class="deal-store-label">${em} ${store}</div>`;
    items.forEach(d => {
      const rule = d._rule;
      const label = rule ? rule.match : (d.zh_label || d.name);
      const en = rule ? rule.en : label;
      const link = makeLink(store, en);
      const priceHtml = d.price ? `<span class="deal-item-price">$${d.price.toFixed ? d.price.toFixed(2) : d.price}</span>` : '';
      const origHtml = d.original ? `<span class="deal-item-orig">$${Number(d.original).toFixed(2)}</span>` : '';
      const pctHtml = d.savings_pct ? `<span class="deal-item-pct">-${d.savings_pct}%</span>` : '';
      html += `
        <a class="deal-item" href="${link}" target="_blank" rel="noopener">
          <span class="deal-item-name">${label}</span>
          <span class="deal-item-right">${origHtml}${priceHtml}${pctHtml}</span>
        </a>`;
    });
  });

  body.innerHTML = html || '<div class="deal-empty">本週沒有找到你常買的特價商品</div>';
}

// 把帳本品項名稱轉換成 grocery zh_label 可比對的詞
function expandAliases(items) {
  const expanded = new Set(items);
  items.forEach(item => {
    // 直接對照
    if (ZH_ALIAS[item]) expanded.add(ZH_ALIAS[item]);
    // 部分包含對照
    Object.entries(ZH_ALIAS).forEach(([tw, hk]) => {
      if (item.includes(tw)) expanded.add(hk);
    });
  });
  return [...expanded];
}

function dealMatch(deals, freqItems) {
  const allItems = expandAliases(freqItems);
  return deals.filter(d => {
    const z = (d.zh_label||'').trim();
    if (!z) return false;
    return allItems.some(item => item.includes(z) || z.includes(item));
  });
}

async function initDealBar() {
  const deals = await loadDeals();
  if (!deals.length) return;
  const freqItems = getFrequentItems();
  const matched = dealMatch(deals, freqItems);
  if (matched.length === 0) return;
  // 去重後計算數量
  const seenKeys = new Set();
  matched.forEach(d => seenKeys.add(`${d.store||''}_${d.zh_label||d.name}`));
  const count = seenKeys.size;
  document.getElementById('deal-count').textContent = count;
  document.getElementById('deal-count2').textContent = count;
  document.getElementById('deal-bar').classList.remove('hidden');
}

// ══ 個人購買規則 ══
// 格式：{ zh_label匹配詞, 偏好超市, 價格門檻(低於才顯示), 搜尋詞, 備註 }
const MY_RULES = [
  { match:'可樂',      stores:['Walmart','Real Canadian Superstore'], threshold:2.00,  en:'coca cola',           note:'低於$2才提醒' },
  { match:'雞蛋',      stores:['Walmart'],                            threshold:null,  en:'eggs',                note:'現在都在walmart買' },
  { match:'豬肉水餃',  stores:['Walmart','Real Canadian Superstore'], threshold:6.00,  en:"O'Tasty frozen dumplings", note:'O\'Tasty牌，低於$6才值得買' },
  { match:'大白菜',    stores:['Real Canadian Superstore'],           threshold:null,  en:'napa cabbage',        note:'通常在superstore買，最好$0.99/lb以下' },
  { match:'蔥抓餅',    stores:['Walmart','PriceSmart 佳廉'],          threshold:4.47,  en:'Synear scallion pancake', note:'原價$4.47，低於就提醒' },
  { match:'奇多',      stores:['Walmart','Real Canadian Superstore'], threshold:null,  en:'cheetos',             note:'walmart+superstore都買' },
  { match:'樂事',      stores:['Walmart','Real Canadian Superstore'], threshold:null,  en:"lay's",               note:'superstore打折就去那買' },
  { match:'樂事',      stores:['PriceSmart 佳廉'],                    threshold:null,  en:"lay's",               note:'佳廉有打折也提醒' },
  { match:'Natrel牛奶',    stores:['Walmart','Real Canadian Superstore'], threshold:6.00,  en:'Natrel lactose free',    note:'低於$6才提醒' },
  { match:'Dairyland牛奶', stores:['Walmart','Real Canadian Superstore'], threshold:6.00,  en:'Dairyland lactose free', note:'低於$6才提醒' },
  { match:'培根',      stores:['Walmart'],                            threshold:null,  en:'bacon',               note:'通常walmart便宜' },
  { match:'蟹肉棒',    stores:['Real Canadian Superstore'],           threshold:9.99,  en:'leg style imitation crab', note:'低於$10才值得買' },
  { match:'辛拉麵',    stores:['Walmart'],                            threshold:null,  en:'shin ramen',          note:'walmart' },
  { match:'辛拉麵',    stores:['Real Canadian Superstore'],           threshold:null,  en:'Shin Ramen',          note:'superstore' },
  { match:'泡麵',      stores:['Walmart','Real Canadian Superstore'], threshold:null,  en:'nongshim noodles',    note:'walmart+superstore都買' },
  { match:'馬鈴薯麵',  stores:['Walmart'],                            threshold:4.98,  en:'nongshim potato noodle', note:'正常$4.98，低於才提醒' },
  { match:'馬鈴薯麵',  stores:['Real Canadian Superstore'],           threshold:4.98,  en:'potato noodle',          note:'正常$4.98，低於才提醒' },
  { match:'洋菇',      stores:['Real Canadian Superstore'],           threshold:null,  en:'mushroom',            note:'在superstore買' },
  { match:'金針菇',    stores:['PriceSmart 佳廉'],                    threshold:0.99,  en:'enoki mushroom',      note:'$0.99以下才買' },
  { match:'雞胸肉',    stores:['Real Canadian Superstore'],           threshold:15.00, en:'chicken breast boneless skinless', note:'原價$15，低於才提醒' },
  { match:'馬鈴薯',    stores:['Real Canadian Superstore'],           threshold:null,  en:'potato',              note:'通常在superstore買' },
  { match:'優格',      stores:['Walmart'],                            threshold:3.50,  en:'activia yogurt',      note:'Activia牌，低於$3.50才提醒' },
  { match:'雲吞',      stores:['PriceSmart 佳廉'],                    threshold:null,  en:'Foongs Kitchen wonton', note:'佳廉Foongs Kitchen牌' },
  { match:'爆米花',    stores:['Walmart'],                            threshold:null,  en:'orville redenbacher popcorn', note:'Walmart買' },
  { match:'咖啡',      stores:['Walmart','Real Canadian Superstore'], threshold:20.00, en:'ground coffee',       note:'低於$20才提醒，要是咖啡粉/豆不是咖啡機' },
  { match:'麵包',      stores:['Walmart','Real Canadian Superstore'], threshold:4.00,  en:'bread loaf',          note:'低於$4才提醒' },
];

// 用購買規則比對 deals（zh_label 或英文名都比對）
function matchDealsByRules(deals) {
  const results = [];
  MY_RULES.forEach(rule => {
    deals.forEach(d => {
      const z = (d.zh_label||'').trim();
      const n = (d.name||'').toLowerCase();
      // 英文 en 比對（用 en 裡的每個詞去比對商品英文名）
      const enWords = (rule.en||'').toLowerCase().split(' ').filter(w => w.length >= 3);
      const matchEn = enWords.length > 0 && enWords.every(w => n.includes(w));
      if (!matchEn) return;
      if (!rule.stores.some(s => (d.store||'').includes(s) || s.includes(d.store||''))) return;
      if (rule.threshold && d.price > rule.threshold) return;
      // 去重：同規則同超市只保留最便宜一筆
      const key = `${rule.match}_${d.store}`;
      const existing = results.find(r => r._key === key);
      if (!existing) {
        results.push({...d, _key: key, _rule: rule});
      } else if (d.price < existing.price) {
        Object.assign(existing, {...d, _key: key, _rule: rule});
      }
    });
  });
  return results;
}

async function initDealBar() {
  const deals = await loadDeals();
  if (!deals.length) return;
  const matched = matchDealsByRules(deals);
  if (matched.length === 0) return;
  document.getElementById('deal-count').textContent = matched.length;
  document.getElementById('deal-count2').textContent = matched.length;
  document.getElementById('deal-bar').classList.remove('hidden');
}

// 初始化（等帳本資料載入後執行）
window.addEventListener('load', () => {
  setTimeout(initDealBar, 800);
});
