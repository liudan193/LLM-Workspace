const TOOLS = [
  {
    id: 'json-parser',
    name: 'JSON 解析器',
    desc: '支持折叠高亮、Markdown 渲染的 JSON / JSON List / JSONL 可视化工具。',
    icon: '{ }',
    category: 'data',
    url: 'tools/json-parser/',
    tag: 'New',
  },
  // 继续添加工具，Tab 自动更新
];

const CAT_LABELS = {
  all:    '全部',
  data:   '数据处理',
  prompt: 'Prompt',
  token:  'Token',
  api:    'API 工具',
  other:  '其他',
};

/* ── 收藏持久化 ──────────────────────────────────────────── */
const FAV_KEY = 'llm-workspace:favorites';

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); }
  catch { return []; }
}
function setFavorites(arr) {
  localStorage.setItem(FAV_KEY, JSON.stringify(arr));
}
function toggleFavorite(id) {
  const favs = getFavorites();
  const idx = favs.indexOf(id);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(id);
  setFavorites(favs);
  render();
}

/* ── 分类 Tab（自动汇总） ────────────────────────────────── */
function buildCategoryTabs() {
  const tabsEl = document.getElementById('categoryTabs');
  const cats = ['all', ...new Set(TOOLS.map(t => t.category))];

  tabsEl.innerHTML = cats.map(cat => {
    const label = CAT_LABELS[cat] || cat;
    const count = cat === 'all' ? TOOLS.length : TOOLS.filter(t => t.category === cat).length;
    return `<button class="cat-tab${cat === 'all' ? ' active' : ''}" data-cat="${cat}">
      ${label} <span style="opacity:.45;font-weight:400">${count}</span>
    </button>`;
  }).join('');

  tabsEl.addEventListener('click', e => {
    const btn = e.target.closest('.cat-tab');
    if (!btn) return;
    tabsEl.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
}

/* ── 卡片 HTML ───────────────────────────────────────────── */
function cardHTML(tool) {
  const isFav = getFavorites().includes(tool.id);
  const catLabel = CAT_LABELS[tool.category] || tool.category;
  return `
    <div class="tool-card" data-id="${tool.id}">
      <button class="fav-btn ${isFav ? 'active' : ''}" data-fav="${tool.id}"
              title="${isFav ? '取消收藏' : '加入常用'}">
        ${isFav ? '★' : '☆'}
      </button>
      <div class="tool-card-icon">${tool.icon}</div>
      <h3>${tool.name}</h3>
      <p>${tool.desc}</p>
      <span class="tool-card-cat">${catLabel}</span>
      ${tool.tag ? `<span class="tool-card-tag">${tool.tag}</span>` : ''}
    </div>`;
}

/* ── 主渲染 ──────────────────────────────────────────────── */
function render() {
  const activeCat = (document.querySelector('.cat-tab.active') || {}).dataset?.cat || 'all';

  // 常用工具区
  const favIds  = getFavorites();
  const freqEl  = document.getElementById('frequentGrid');
  const favTools = TOOLS.filter(t => favIds.includes(t.id));
  freqEl.innerHTML = favTools.length
    ? favTools.map(cardHTML).join('')
    : `<p class="empty-tip">点击工具卡片右上角的 ☆ 可收藏到这里</p>`;

  // 全部工具区（分类过滤）
  const allEl  = document.getElementById('allGrid');
  const visible = TOOLS.filter(t =>
    activeCat === 'all' || t.category === activeCat
  );
  allEl.innerHTML = visible.length
    ? visible.map(cardHTML).join('')
    : `<p class="empty-tip">该分类暂无工具</p>`;
}

/* ── 全局事件代理 ─────────────────────────────────────────── */
document.addEventListener('click', e => {
  const favBtn = e.target.closest('[data-fav]');
  if (favBtn) { e.stopPropagation(); toggleFavorite(favBtn.dataset.fav); return; }

  const card = e.target.closest('.tool-card');
  if (card) {
    const tool = TOOLS.find(t => t.id === card.dataset.id);
    if (tool) window.location.href = tool.url;
  }
});

/* ── 初始化 ───────────────────────────────────────────────── */
buildCategoryTabs();
render();