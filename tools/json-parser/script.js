/* ============================================================
   工具函数
   ============================================================ */
const $  = id => document.getElementById(id);
const escapeHtml = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ============================================================
   MD 判断：多条件评分机制
   ============================================================
   每条命中加分，总分 ≥ 2 才认为"像 Markdown"。
   这样避免了普通带换行的文本、带 * 的普通句子误判。

   规则解释：
   - 必须含有换行（单行字符串几乎不可能是 md）
   - 含有 ## 标题语法          +2（强信号）
   - 含有 **加粗** 或 *斜体*   +1
   - 含有 ``` 代码块            +2（强信号）
   - 含有 `行内代码`            +1
   - 含有 Markdown 链接 [x](y) +1
   - 含有 > 引用               +1
   - 含有有序/无序列表行        +1
   - 字符串长度 > 80            +1（短字符串不值得渲染）
   ============================================================ */
function looksLikeMarkdown(str) {
  if (typeof str !== 'string') return false;
  if (!str.includes('\n')) return false; // 无换行，直接排除

  let score = 0;
  if (/^#{1,6}\s/m.test(str))              score += 2; // ATX 标题
  if (/\*\*.+?\*\*|__.+?__/.test(str))     score += 1; // 加粗
  if (/\*.+?\*|_.+?_/.test(str))           score += 1; // 斜体
  if (/```/.test(str))                     score += 2; // 代码块
  if (/`[^`]+`/.test(str))                 score += 1; // 行内代码
  if (/\[.+?\]\(.+?\)/.test(str))          score += 1; // 链接
  if (/^>\s/m.test(str))                   score += 1; // 引用
  if (/^(\s*[-*+]|\s*\d+\.)\s/m.test(str)) score += 1; // 列表
  if (str.length > 80)                     score += 1; // 长度加分

  return score >= 2;
}

/* ============================================================
   智能解析：JSON / JSON数组 / JSONL
   ============================================================ */
function smartParse(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('输入为空');

  // 1. 标准 JSON
  try { return { data: JSON.parse(trimmed), mode: 'json' }; } catch { /* next */ }

  // 2. JSONL（多行，每行一个 JSON 对象）
  const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const arr = [];
    for (let i = 0; i < lines.length; i++) {
      try { arr.push(JSON.parse(lines[i])); }
      catch (e) { throw new Error(`第 ${i + 1} 行解析失败：${e.message}`); }
    }
    return { data: arr, mode: 'jsonl' };
  }

  // 3. 抛出原始错误
  JSON.parse(trimmed);
}

/* ============================================================
   值类型
   ============================================================ */
function getType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/* ============================================================
   折叠预览文本
   ============================================================ */
function buildPreview(v) {
  if (Array.isArray(v)) return `… ${v.length} items`;
  const keys = Object.keys(v);
  return keys.slice(0, 3).map(k => `"${k}"`).join(', ') + (keys.length > 3 ? ', …' : '');
}

/* ============================================================
   长字符串阈值
   ============================================================ */
const LONG_STR = 120;
const truncate = (s, n) => s.length > n ? s.slice(0, n) + '…' : s;

/* ============================================================
   渲染单个节点（递归）
   ============================================================ */
function renderNode(value, key, isLast = true) {
  const row = document.createElement('div');
  row.className = 'json-row';

  const toggle = document.createElement('span');
  toggle.className = 'json-toggle';
  row.appendChild(toggle);

  const content = document.createElement('span');
  content.className = 'json-content';
  row.appendChild(content);

  const type = getType(value);
  const keyHTML = key !== null
    ? `<span class="json-key">"${escapeHtml(key)}"</span><span class="json-colon">:</span>`
    : '';
  const comma = isLast ? '' : '<span class="json-comma">,</span>';

  if (type === 'object' || type === 'array') {
    const isArr = type === 'array';
    const open  = isArr ? '[' : '{';
    const close = isArr ? ']' : '}';
    const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
    const count = entries.length;

    if (count === 0) {
      toggle.classList.add('leaf');
      content.innerHTML = `${keyHTML}<span class="json-bracket">${open}${close}</span>${comma}`;
      return row;
    }

    /* 头行：key + 开括号 + meta */
    const head = document.createElement('span');
    head.className = 'json-head';
    head.innerHTML = `${keyHTML}<span class="json-bracket">${open}</span>`
      + `<span class="json-meta"> ${count} ${isArr ? 'items' : 'keys'}</span>`;
    content.appendChild(head);

    /* 折叠预览（仅折叠时可见） */
    const preview = document.createElement('span');
    preview.className = 'json-preview';
    preview.textContent = ` ${buildPreview(value)} `;
    preview.style.display = 'none';
    content.appendChild(preview);

    /* 子节点容器 */
    const children = document.createElement('div');
    children.className = 'json-children';
    entries.forEach(([k, v], idx) => {
      children.appendChild(renderNode(v, isArr ? null : k, idx === entries.length - 1));
    });
    content.appendChild(children);

    /* 尾括号 */
    const tail = document.createElement('div');
    tail.innerHTML = `<span class="json-bracket">${close}</span>${comma}`;
    content.appendChild(tail);

    /* 交互 */
    toggle.textContent = '▾';
    const collapse = () => {
      const isNowCollapsed = toggle.classList.toggle('collapsed');
      children.classList.toggle('hidden', isNowCollapsed);
      tail.style.display = isNowCollapsed ? 'none' : '';
      preview.style.display = isNowCollapsed ? 'inline' : 'none';
    };
    toggle.addEventListener('click', e => { e.stopPropagation(); collapse(); });
    head.style.cursor = 'pointer';
    head.addEventListener('click', () => collapse());

  } else {
    /* 叶子节点 */
    toggle.classList.add('leaf');

    if (type === 'string') {
      renderStringNode(content, value, keyHTML, comma);
    } else {
      content.innerHTML = `${keyHTML}${renderPrimitive(value, type)}${comma}`;
    }
  }

  return row;
}

/* ============================================================
   字符串节点渲染
   - Markdown  →  md 渲染块 + 复制按钮
   - 长文本    →  折叠展开
   - 普通短串  →  正常显示
   ============================================================ */
function renderStringNode(container, rawValue, keyHTML, comma) {
  const isMD = $('mdToggle').checked && looksLikeMarkdown(rawValue);
  const isLong = !isMD && rawValue.length > LONG_STR;

  if (isMD) {
    /* ── Markdown 模式 ── */
    // 行首：key + 引号开始（折叠用）
    const headLine = document.createElement('span');
    headLine.innerHTML = `${keyHTML}<span class="json-string">"</span>`;
    container.appendChild(headLine);

    /* MD 渲染块 */
    const mdWrap = document.createElement('div');
    mdWrap.className = 'md-wrap';

    /* 复制按钮 —— 复制原始 Markdown 文本 */
    const copyBtn = document.createElement('button');
    copyBtn.className = 'md-copy-btn';
    copyBtn.title = '复制 Markdown 原文';
    copyBtn.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4zm0 1h5a1 1 0 0 1 1 1v1H5a2 2 0 0 0-2 2v4H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>
    </svg>`;
    copyBtn.addEventListener('click', async e => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(rawValue);
        copyBtn.classList.add('copied');
        copyBtn.title = '已复制！';
        setTimeout(() => {
          copyBtn.classList.remove('copied');
          copyBtn.title = '复制 Markdown 原文';
        }, 1800);
      } catch {
        // 降级方案
        const ta = document.createElement('textarea');
        ta.value = rawValue;
        document.body.appendChild(ta);
        ta.select(); document.execCommand('copy');
        document.body.removeChild(ta);
        copyBtn.classList.add('copied');
        setTimeout(() => copyBtn.classList.remove('copied'), 1800);
      }
    });

    /* MD 渲染内容 */
    const mdContent = document.createElement('div');
    mdContent.className = 'md-block';
    try {
      mdContent.innerHTML = DOMPurify.sanitize(
        marked.parse(rawValue, { breaks: true, gfm: true })
      );
    } catch { mdContent.textContent = rawValue; }

    mdWrap.appendChild(copyBtn);
    mdWrap.appendChild(mdContent);
    container.appendChild(mdWrap);

    /* "隐藏/显示 MD" 切换 */
    const switchBtn = document.createElement('span');
    switchBtn.className = 'string-toggle-inline';
    switchBtn.textContent = '[隐藏 MD]';
    switchBtn.addEventListener('click', e => {
      e.stopPropagation();
      const hidden = mdWrap.style.display === 'none';
      mdWrap.style.display = hidden ? '' : 'none';
      switchBtn.textContent = hidden ? '[隐藏 MD]' : '[显示 MD]';
    });
    container.appendChild(switchBtn);

    // 结尾引号 + 逗号
    const tail = document.createElement('span');
    tail.innerHTML = `<span class="json-string">"</span>${comma}`;
    container.appendChild(tail);

  } else if (isLong) {
    /* ── 长文本折叠模式 ── */
    const span = document.createElement('span');
    span.className = 'json-string';
    span.textContent = `"${truncate(rawValue, LONG_STR)}"`;
    container.innerHTML = keyHTML;
    container.appendChild(span);

    let expanded = false;
    const btn = document.createElement('span');
    btn.className = 'string-toggle-inline';
    btn.textContent = '[展开]';
    btn.addEventListener('click', e => {
      e.stopPropagation();
      expanded = !expanded;
      span.textContent = `"${expanded ? rawValue : truncate(rawValue, LONG_STR)}"`;
      btn.textContent = expanded ? '[折叠]' : '[展开]';
    });

    if (comma) {
      const commaSpan = document.createElement('span');
      commaSpan.innerHTML = comma;
      container.appendChild(commaSpan);
    }
    container.appendChild(span);
    container.appendChild(btn);
  } else {
    /* ── 普通短字符串 ── */
    container.innerHTML = `${keyHTML}<span class="json-string">"${escapeHtml(rawValue)}"</span>${comma}`;
  }
}

/* ============================================================
   基本类型 HTML
   ============================================================ */
function renderPrimitive(v, type) {
  switch (type) {
    case 'number':  return `<span class="json-number">${v}</span>`;
    case 'boolean': return `<span class="json-boolean">${v}</span>`;
    case 'null':    return `<span class="json-null">null</span>`;
    default:        return `<span>${escapeHtml(String(v))}</span>`;
  }
}

/* ============================================================
   树根渲染
   ============================================================ */
function renderTree(data) {
  const wrap = document.createElement('div');
  wrap.className = 'json-tree';
  wrap.appendChild(renderNode(data, null, true));
  return wrap;
}

/* ============================================================
   主解析流程
   ============================================================ */
function parseAndRender() {
  const text   = $('jsonInput').value;
  const output = $('jsonOutput');
  const status = $('statusBar');
  const meta   = $('paneMeta');

  if (!text.trim()) {
    output.innerHTML = `<div class="placeholder">👈 在左侧粘贴 JSON 后即可在这里查看树形结构</div>`;
    status.textContent = '就绪'; status.className = 'status-bar'; meta.textContent = ''; return;
  }

  try {
    const { data, mode } = smartParse(text);
    output.innerHTML = '';
    output.appendChild(renderTree(data));

    const type  = getType(data);
    const count = type === 'array' ? data.length : (type === 'object' ? Object.keys(data).length : 1);
    meta.textContent = `${type} · ${count} ${type === 'array' ? 'items' : (type === 'object' ? 'keys' : '')}`;
    status.textContent = `✓ 解析成功（${mode === 'jsonl' ? 'JSONL' : 'JSON'}）`;
    status.className = 'status-bar ok';
  } catch (e) {
    output.innerHTML = `<div class="error-msg">❌ 解析失败：${escapeHtml(e.message)}</div>`;
    status.textContent = `✗ ${e.message}`;
    status.className = 'status-bar err';
    meta.textContent = '';
  }
}

/* ============================================================
   展开 / 折叠全部
   ============================================================ */
function setAllCollapsed(collapsed) {
  document.querySelectorAll('.json-toggle:not(.leaf)').forEach(t => {
    const isCollapsed = t.classList.contains('collapsed');
    if (isCollapsed !== collapsed) t.click();
  });
}

/* ============================================================
   事件绑定
   ============================================================ */
let debounceTimer;
$('jsonInput').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(parseAndRender, 280);
});

$('btnFormat').addEventListener('click', () => {
  try {
    const { data } = smartParse($('jsonInput').value);
    $('jsonInput').value = JSON.stringify(data, null, 2);
    parseAndRender();
  } catch (e) { alert('格式化失败：' + e.message); }
});

$('btnMinify').addEventListener('click', () => {
  try {
    const { data } = smartParse($('jsonInput').value);
    $('jsonInput').value = JSON.stringify(data);
    parseAndRender();
  } catch (e) { alert('压缩失败：' + e.message); }
});

$('btnClear').addEventListener('click', () => {
  $('jsonInput').value = ''; parseAndRender();
});

$('btnExpandAll').addEventListener('click',   () => setAllCollapsed(false));
$('btnCollapseAll').addEventListener('click', () => setAllCollapsed(true));
$('mdToggle').addEventListener('change', parseAndRender);

$('btnSample').addEventListener('click', () => {
  $('jsonInput').value = JSON.stringify({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      {
        role: "assistant",
        content: "## 分析报告\n\n本次任务目标：\n\n- **模型**：GPT-4o\n- **场景**：代码生成\n\n### 示例代码\n\n```python\ndef greet(name: str) -> str:\n    return f'Hello, {name}!'\n```\n\n> 注意：以上为演示内容，仅供参考。\n\n更多信息请参考 [OpenAI 文档](https://platform.openai.com)。"
      }
    ],
    temperature: 0.7,
    metadata: { tokens: 256, finish_reason: "stop", tags: ["demo", "llm"] },
    nullField: null,
    longText: "This is a very long string that exceeds one hundred and twenty characters and should show a collapse button so that the user can expand or fold it at will without cluttering the view unnecessarily."
  }, null, 2);
  parseAndRender();
});

$('btnPaste').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    $('jsonInput').value = t;
    parseAndRender();
  } catch (e) { alert('无法读取剪贴板：' + e.message); }
});

/* 左侧折叠 */
$('toggleLeft').addEventListener('click', e => {
  e.stopPropagation();
  const ws = document.querySelector('.workspace');
  const c  = ws.classList.toggle('left-collapsed');
  $('toggleLeft').textContent = c ? '▶' : '◀';
});
$('divider').addEventListener('click', () => {
  const ws = document.querySelector('.workspace');
  if (ws.classList.contains('left-collapsed')) {
    ws.classList.remove('left-collapsed');
    $('toggleLeft').textContent = '◀';
  }
});

parseAndRender();