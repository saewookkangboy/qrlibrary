import {
  buildComposedPrompt,
  buildTemplatePrompt,
  emptyFieldCount,
  applyExamples,
  nextRelatedId
} from './compose.js';

var db = JSON.parse(document.getElementById('library-data').textContent);
var all = [];
db.sections.forEach(function (s) {
  s.resources.forEach(function (r) { all.push(r); });
});

var active = (location.hash || '').replace(/^#/, '') || '00-route';
if (!all.some(function (r) { return r.id === active; })) active = '00-route';

var key = 'command-marketing-library-html';
var saved = {};
var baseTitle = '커맨드 마케팅 QR 라이브러리 | ' + db.total + '개 AI 마케팅 Agent 실습 부록';
try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}

var SCENARIOS = [
  { id: '00-brief6', label: '6칸 브리프' },
  { id: '02-rgctor', label: 'R-G-C-T-O-R' },
  { id: '03-voc', label: '오늘 VOC' },
  { id: '04-calendar', label: '콘텐츠 캘린더' },
  { id: '05-adtest', label: '광고 실험' },
  { id: '05-report', label: '주간 리포트' }
];

var sidebar = document.getElementById('sidebar');
var scrim = document.getElementById('scrim');
var mobileBtn = document.getElementById('mobile');

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function state() {
  return saved[active] || { values: {}, checked: [], complete: false };
}
function store(next) {
  saved[active] = Object.assign({ values: {}, checked: [], complete: false }, saved[active] || {}, next);
  localStorage.setItem(key, JSON.stringify(saved));
  render();
}
function setMeta(name, content, attr) {
  attr = attr || 'name';
  var el = document.querySelector('meta[' + attr + '="' + name + '"]');
  if (el) el.setAttribute('content', content);
}
function syncSeo(r) {
  var title = r.id === '00-route' ? baseTitle : (r.title + ' | 커맨드 마케팅 QR 라이브러리');
  var desc = r.outcome + ' · ' + r.part + ' ' + r.chapter + ' · 『커맨드 마케팅』 실습 부록';
  document.title = title;
  setMeta('description', desc);
  setMeta('og:title', title, 'property');
  setMeta('og:description', desc, 'property');
  setMeta('og:url', 'https://qr.allrounder.im/#' + r.id, 'property');
  setMeta('twitter:title', title);
  setMeta('twitter:description', desc);
  var canon = document.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute('href', 'https://qr.allrounder.im/');
}
function closeMenu() {
  sidebar.classList.remove('open');
  scrim.classList.remove('on');
  scrim.hidden = true;
  mobileBtn.setAttribute('aria-expanded', 'false');
}
function openMenu() {
  sidebar.classList.add('open');
  scrim.classList.add('on');
  scrim.hidden = false;
  mobileBtn.setAttribute('aria-expanded', 'true');
}
function goTo(id) {
  active = id;
  if (location.hash !== '#' + active) history.replaceState(null, '', '#' + active);
  render();
  closeMenu();
}
function flashCopy(btn, label) {
  var prev = btn.textContent;
  btn.textContent = label || '복사됨';
  setTimeout(function () { btn.textContent = prev; }, 1400);
}
function title(n, t, s) {
  return '<div class="title"><span aria-hidden="true">' + n + '</span><div><h2>' + t + '</h2><p>' + s + '</p></div></div>';
}
function current() {
  return all.filter(function (r) { return r.id === active; })[0] || all[0];
}
function findById(id) {
  return all.filter(function (x) { return x.id === id; })[0];
}
function relatedHtml(r) {
  var ids = r.related || [];
  if (!ids.length) return '';
  var links = ids.map(function (id) {
    var item = findById(id);
    if (!item) return '';
    return '<button type="button" class="related-link" data-id="' + id + '">' + esc(item.title) + '</button>';
  }).join('');
  return '<div class="related"><span>이어서 보면 좋은 카드</span><div class="related-list">' + links + '</div></div>';
}
function renderShortcuts() {
  var el = document.getElementById('shortcuts');
  if (!el) return;
  el.innerHTML =
    '<div class="shortcuts-label">지금 할 일</div>' +
    SCENARIOS.map(function (s) {
      return '<button type="button" data-id="' + s.id + '" class="shortcut' +
        (s.id === active ? ' active' : '') + '">' + esc(s.label) + '</button>';
    }).join('');
  el.querySelectorAll('button').forEach(function (b) {
    b.onclick = function () { goTo(this.dataset.id); };
  });
}
function download(r, st) {
  var text = buildComposedPrompt(r, st);
  var u = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = u;
  a.download = r.title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_') + '.md';
  a.click();
  URL.revokeObjectURL(u);
}
function downloadAllDone() {
  var parts = all.filter(function (r) { return saved[r.id] && saved[r.id].complete; })
    .map(function (r) { return buildComposedPrompt(r, saved[r.id]); });
  if (!parts.length) {
    alert('완료한 카드가 없습니다.');
    return;
  }
  var text = parts.join('\n\n---\n\n');
  var u = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = u;
  a.download = 'command-marketing-completed.md';
  a.click();
  URL.revokeObjectURL(u);
}

function nav(q) {
  q = (q || '').toLowerCase();
  var out = '';
  db.sections.forEach(function (s) {
    var items = s.resources.filter(function (r) {
      return !q || (r.title + ' ' + r.part + ' ' + r.chapter).toLowerCase().indexOf(q) > -1;
    });
    if (!items.length) return;
    out += '<div class="group-title"><b>' + s.id + '</b>' + esc(s.label) + '</div>';
    items.forEach(function (r) {
      var done = saved[r.id] && saved[r.id].complete;
      out += '<button type="button" data-id="' + r.id + '" class="' + (r.id === active ? 'active' : '') + '"' +
        (r.id === active ? ' aria-current="page"' : '') +
        '><span class="dot' + (done ? ' done' : '') + '" aria-hidden="true">' + (done ? '✓' : '') +
        '</span><span>' + esc(r.title) + '</span></button>';
    });
  });
  document.getElementById('nav').innerHTML = out || '<div class="empty">검색 결과가 없습니다.</div>';
  document.querySelectorAll('#nav button').forEach(function (b) {
    b.onclick = function () { goTo(this.dataset.id); };
  });
  var done = Object.keys(saved).filter(function (k) { return saved[k].complete; }).length;
  var p = Math.round(done / db.total * 100);
  document.getElementById('progress').innerHTML =
    '<div><span>내 실습 진도</span><strong>' + done + '/' + db.total + '</strong></div>' +
    '<div class="bar" role="progressbar" aria-valuenow="' + p + '" aria-valuemin="0" aria-valuemax="100" aria-label="실습 진도"><i style="width:' + p + '%"></i></div>' +
    '<small>작성 내용은 이 기기에만 자동 저장됩니다.</small>' +
    '<button type="button" class="action" id="download-all-done">완료 카드 MD 일괄 받기</button>';
  var bulk = document.getElementById('download-all-done');
  if (bulk) bulk.onclick = downloadAllDone;
  renderShortcuts();
}

function render() {
  var r = current();
  var st = state();
  syncSeo(r);
  document.getElementById('crumb').innerHTML =
    '온라인 부록 / ' + esc(r.part) + ' / <em>' + esc(r.title) + '</em>';

  var fields = r.fields.map(function (f) {
    return '<label><span>' + esc(f.label) + '</span><textarea data-field="' + esc(f.label) +
      '" placeholder="' + esc(f.placeholder) + '" rows="4">' + esc(st.values[f.label] || '') +
      '</textarea></label>';
  }).join('');

  var checks = r.checks.map(function (x, i) {
    return '<label class="' + (st.checked[i] ? 'on' : '') + '"><input type="checkbox" data-check="' + i + '" ' +
      (st.checked[i] ? 'checked' : '') + '><span class="box" aria-hidden="true">' +
      (st.checked[i] ? '✓' : '') + '</span><span>' + esc(x) + '</span></label>';
  }).join('');

  var ok = r.checks.every(function (_, i) { return st.checked[i]; });
  var emptyN = emptyFieldCount(r.fields, st.values);
  var composed = buildComposedPrompt(r, st);
  var hasExamples = !!(r.examples && Object.keys(r.examples).length);
  var nid = nextRelatedId(r.related, saved, null);
  var nItem = nid && findById(nid);

  var practice = r.bookPractice || r.outcome;
  document.getElementById('content').innerHTML =
    '<article class="hero"><div class="hero-copy"><div class="eyebrow"><b>' + esc(r.part) + '</b><span>' +
    esc(r.chapter) + '</span></div><h1>' + esc(r.title) + '</h1><p>' + esc(r.outcome) + '</p>' +
    '<p class="book-practice"><strong>책 단계별 실습</strong> ' + esc(practice) + '</p></div>' +
    '<div class="meta" aria-label="자료 정보"><div><span>예상 시간</span><strong>' + esc(r.time) +
    '</strong></div><div><span>제공 형식</span><strong>' + esc(r.format) +
    '</strong></div><div><span>저장 방식</span><strong>자동 저장</strong></div></div></article>' +
    '<div class="grid"><div class="main">' +
    '<section class="panel">' + title('01', '책 실습 따라하기', '본문 「단계별 실습 과제」와 같은 순서입니다. 채운 뒤 역할·목표·맥락 지시문으로 실행합니다.') +
    '<ol class="steps">' + r.steps.map(function (x, i) {
      return '<li><b>0' + (i + 1) + '</b><span>' + esc(x) + '</span></li>';
    }).join('') + '</ol>' + relatedHtml(r) + '</section>' +
    '<section class="panel">' + title('02', '실습 빈칸 채우기', '책에서 적은 ①②③④를 그대로 옮기거나, 예시로 먼저 연습하세요.') +
    '<div class="field-toolbar">' +
    '<button type="button" class="action" id="fill-examples"' + (hasExamples ? '' : ' disabled') + '>예시 채우기</button>' +
    '<button type="button" class="action" id="overwrite-examples"' + (hasExamples ? '' : ' disabled') + '>예시로 덮어쓰기</button>' +
    '<button type="button" class="action" id="clear-values">작성 초기화</button>' +
    '<span class="field-hint">예시는 가상 B2B SaaS 「플로우보드」 시나리오입니다. 본문 실습과 같은 칸을 채운 뒤 AI에 붙여 넣으세요.</span>' +
    '</div><div class="fields">' + fields + '</div></section>' +
    '<section class="panel">' + title('03', '본문과 같은 방식으로 Agent에게 실행', '역할 / 목표 / 맥락 / 출력 / 검수 기준으로 합성된 지시문을 복사해 붙여 넣으세요.') +
    '<div class="prompt"><div class="prompt-actions">' +
    '<button type="button" id="copy-composed" class="prompt-btn primary">완성본 복사</button>' +
    '<button type="button" id="copy-template" class="prompt-btn">템플릿만</button>' +
    '</div>' +
    (emptyN ? '<p class="warn">' + emptyN + '개 칸이 비어 있음 · 그래도 복사 가능</p>' : '') +
    '<details class="preview" open><summary>역할·목표·맥락 지시문 미리보기</summary><pre id="preview-composed">' +
    esc(composed) + '</pre></details></div>' +
    '<div class="note">고객·직원·계정 정보는 제거하거나 익명화한 뒤 입력하세요. 책의 「프롬프트 예시」와 같은 형식으로 복사됩니다.</div></section>' +
    '</div><aside class="side"><section class="panel">' + title('04', '책 핵심 포인트 검수', '본문 완료 체크와 맞춰 확인하면 실습을 완료할 수 있습니다.') +
    '<div class="checks">' + checks + '</div>' +
    '<button type="button" class="action" id="download">작성본 내려받기</button>' +
    '<button type="button" class="action primary ' + (st.complete ? 'done' : '') + '" id="complete" ' +
    (ok ? '' : 'disabled') + '>' + (st.complete ? '완료됨 · 다시 열기' : '이 실습 완료하기') + '</button>' +
    (nItem ? '<button type="button" class="action" id="next-card">다음 추천 · ' + esc(nItem.title) + '</button>' : '') +
    '<p class="help">완료 전에도 Markdown 파일로 내려받을 수 있습니다.</p></section>' +
    '<section class="book"><div class="book-icon" aria-hidden="true">CM</div><div><span>책에서 다시 보기</span><strong>' +
    esc(r.part) + '</strong><p>' + esc(r.chapter) + '</p><p class="book-practice-side">' + esc(practice) +
    '</p></div></section></aside></div>';

  document.querySelectorAll('textarea[data-field]').forEach(function (t) {
    t.oninput = function () {
      var n = Object.assign({}, state().values);
      n[this.dataset.field] = this.value;
      saved[active] = Object.assign({}, state(), { values: n });
      localStorage.setItem(key, JSON.stringify(saved));
      var empty = emptyFieldCount(r.fields, n);
      var warn = document.querySelector('.warn');
      var preview = document.getElementById('preview-composed');
      if (preview) preview.textContent = buildComposedPrompt(r, { values: n, checked: state().checked });
      if (empty) {
        if (!warn) {
          var actions = document.querySelector('.prompt-actions');
          if (actions) {
            warn = document.createElement('p');
            warn.className = 'warn';
            actions.insertAdjacentElement('afterend', warn);
          }
        }
        if (warn) warn.textContent = empty + '개 칸이 비어 있음 · 그래도 복사 가능';
      } else if (warn) {
        warn.remove();
      }
    };
  });

  document.querySelectorAll('input[data-check]').forEach(function (c) {
    c.onchange = function () {
      var n = state().checked.slice();
      n[+this.dataset.check] = this.checked;
      store({ checked: n });
    };
  });

  document.getElementById('copy-composed').onclick = function () {
    var btn = this;
    navigator.clipboard.writeText(buildComposedPrompt(r, state())).then(function () {
      flashCopy(btn);
    });
  };
  document.getElementById('copy-template').onclick = function () {
    var btn = this;
    navigator.clipboard.writeText(buildTemplatePrompt(r)).then(function () {
      flashCopy(btn);
    });
  };
  document.getElementById('fill-examples').onclick = function () {
    if (!r.examples) return;
    store({ values: applyExamples(state().values, r.examples, 'fill-empty') });
  };
  document.getElementById('overwrite-examples').onclick = function () {
    if (!r.examples) return;
    if (!confirm('현재 작성을 예시로 덮어쓸까요?')) return;
    store({ values: applyExamples(state().values, r.examples, 'overwrite') });
  };
  document.getElementById('clear-values').onclick = function () {
    store({ values: {} });
  };
  document.getElementById('download').onclick = function () { download(r, state()); };
  document.getElementById('complete').onclick = function () {
    store({ complete: !state().complete });
  };
  document.querySelectorAll('.related-link').forEach(function (b) {
    b.onclick = function () { goTo(this.dataset.id); };
  });
  var nextEl = document.getElementById('next-card');
  if (nextEl) {
    nextEl.onclick = function () { goTo(nid); };
  }

  nav(document.getElementById('search').value);
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  });
}

document.getElementById('search').oninput = function () { nav(this.value); };
mobileBtn.onclick = function () {
  if (sidebar.classList.contains('open')) closeMenu();
  else openMenu();
};
scrim.onclick = closeMenu;
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeMenu();
});
window.addEventListener('hashchange', function () {
  var id = (location.hash || '').replace(/^#/, '');
  if (id && all.some(function (r) { return r.id === id; }) && id !== active) {
    active = id;
    render();
  }
});
if (location.hash !== '#' + active) history.replaceState(null, '', '#' + active);
render();
