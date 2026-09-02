# QR Library Practical UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 필드를 합성한 완성 지시문 복사, 상황별 바로가기, 예시 채우기, 관련·다음 카드로 QR 라이브러리를 실무 실행 도구로 만든다.

**Architecture:** 순수 로직은 `js/compose.js`(ES module)에 두고 Node 테스트로 검증한다. `index.html`은 데이터·UI·이벤트만 담당하며 compose를 import한다. localStorage 키 `command-marketing-library-html`과 해시 `#카드id`는 변경하지 않는다.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), Node.js built-in test runner (`node --test`)

## Global Constraints

- 대상: `index.html` + 신규 `js/compose.js` + `tests/compose.test.mjs` (빌드 도구·프레임워크 금지)
- localStorage 키: `command-marketing-library-html` (스키마 `values`/`checked`/`complete` 호환)
- 해시·SEO·32개 카드 id 유지
- 예시 톤: 가상 B2B SaaS 「플로우보드」(프로젝트 관리 툴), UI에 “예시” 명시
- 비범위: AI 딥링크, 서버 저장, 프롬프트 문장 대량 재작성, 전면 리브랜드
- Spec: `docs/superpowers/specs/2026-09-03-qrlibrary-practical-ux-design.md`

## File Structure

| File | Responsibility |
|------|----------------|
| `js/compose.js` | 합성 지시문, 플레이스홀더 치환, 빈 칸 카운트, 예시 적용, 다음 related |
| `tests/compose.test.mjs` | compose 순수 함수 단위 테스트 |
| `index.html` | library-data(`examples`/`related`), 사이드바 바로가기, render UI, 이벤트 |
| `js/` 로드 | `<script type="module">`로 앱 부트스트랩 (기존 IIFE를 module로 이전) |

---

### Task 1: compose 순수 함수 + 테스트

**Files:**
- Create: `js/compose.js`
- Create: `tests/compose.test.mjs`

**Interfaces:**
- Produces:
  - `emptyFieldCount(fields, values) → number`
  - `applyPlaceholders(prompt, values) → string`
  - `buildComposedPrompt(resource, state) → string`
  - `applyExamples(values, examples, mode) → object` (`mode`: `'fill-empty' | 'overwrite'`)
  - `nextRelatedId(relatedIds, saved, fallbackId) → string | null`
  - `RGCTOR_PLACEHOLDER_MAP` (상수)

- [ ] **Step 1: Write failing tests**

Create `tests/compose.test.mjs`:

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyFieldCount,
  applyPlaceholders,
  buildComposedPrompt,
  applyExamples,
  nextRelatedId
} from '../js/compose.js';

describe('emptyFieldCount', () => {
  it('counts missing or blank values', () => {
    const fields = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    assert.equal(emptyFieldCount(fields, { A: 'x', B: '  ' }), 2);
  });
});

describe('applyPlaceholders', () => {
  it('replaces RGCTOR tokens from Role/Goal fields', () => {
    const prompt = '[Role] 당신은 {{역할}}입니다.\n[Goal] {{목표}}를 지원하세요.';
    const out = applyPlaceholders(prompt, {
      Role: '퍼포먼스 마케터',
      Goal: 'CPA 개선'
    });
    assert.match(out, /퍼포먼스 마케터/);
    assert.match(out, /CPA 개선/);
    assert.equal(out.includes('{{'), false);
  });

  it('leaves unknown tokens as [작성 필요]', () => {
    const out = applyPlaceholders('안녕 {{역할}}', {});
    assert.equal(out, '안녕 [작성 필요]');
  });
});

describe('buildComposedPrompt', () => {
  it('includes header, inputs, prompt, checks', () => {
    const resource = {
      title: '테스트',
      part: 'Part 1',
      chapter: 'Ch.01',
      outcome: '결과',
      fields: [{ label: '현재 역할' }],
      prompt: '지시문',
      checks: ['검수1']
    };
    const text = buildComposedPrompt(resource, {
      values: { '현재 역할': '1인 마케터' },
      checked: [true]
    });
    assert.match(text, /\[실습\] 테스트/);
    assert.match(text, /## 내 입력/);
    assert.match(text, /1인 마케터/);
    assert.match(text, /## 실행 지시/);
    assert.match(text, /## 검수 기준/);
    assert.match(text, /- 검수1/);
  });

  it('shows [작성 필요] for empty fields', () => {
    const resource = {
      title: 'T', part: 'P', chapter: 'C', outcome: 'O',
      fields: [{ label: 'X' }], prompt: 'p', checks: []
    };
    const text = buildComposedPrompt(resource, { values: {}, checked: [] });
    assert.match(text, /\[작성 필요\]/);
  });
});

describe('applyExamples', () => {
  it('fill-empty only fills blanks', () => {
    const next = applyExamples(
      { A: 'keep' },
      { A: 'exA', B: 'exB' },
      'fill-empty'
    );
    assert.deepEqual(next, { A: 'keep', B: 'exB' });
  });

  it('overwrite replaces all example keys', () => {
    const next = applyExamples(
      { A: 'keep' },
      { A: 'exA', B: 'exB' },
      'overwrite'
    );
    assert.deepEqual(next, { A: 'exA', B: 'exB' });
  });
});

describe('nextRelatedId', () => {
  it('returns first incomplete related id', () => {
    const id = nextRelatedId(
      ['a', 'b', 'c'],
      { a: { complete: true }, b: { complete: false } },
      null
    );
    assert.equal(id, 'b');
  });

  it('falls back to first related when all complete', () => {
    const id = nextRelatedId(
      ['a', 'b'],
      { a: { complete: true }, b: { complete: true } },
      'fallback'
    );
    assert.equal(id, 'a');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
node --test tests/compose.test.mjs
```

Expected: FAIL (module not found or exports missing)

- [ ] **Step 3: Implement `js/compose.js`**

```js
/** @typedef {{ label: string }} Field */
/** @typedef {{ title: string, part: string, chapter: string, outcome: string, fields: Field[], prompt: string, checks: string[] }} Resource */
/** @typedef {{ values?: Record<string,string>, checked?: boolean[] }} CardState */

export const RGCTOR_PLACEHOLDER_MAP = {
  '역할': 'Role',
  '목표': 'Goal',
  '맥락과 입력 자료': 'Context',
  '자료와 도구': 'Tool',
  '산출물 형식': 'Output',
  '검수 기준': 'Review'
};

export function emptyFieldCount(fields, values) {
  values = values || {};
  return fields.filter(function (f) {
    return !String(values[f.label] || '').trim();
  }).length;
}

export function applyPlaceholders(prompt, values) {
  values = values || {};
  return String(prompt || '').replace(/\{\{([^}]+)\}\}/g, function (_, key) {
    var label = RGCTOR_PLACEHOLDER_MAP[key] || key;
    var v = String(values[label] || '').trim();
    return v || '[작성 필요]';
  });
}

export function buildComposedPrompt(resource, state) {
  state = state || {};
  var values = state.values || {};
  var checked = state.checked || [];
  var lines = [];
  lines.push('[실습] ' + resource.title);
  lines.push('[연결] ' + resource.part + ' · ' + resource.chapter);
  lines.push('[목표] ' + resource.outcome);
  lines.push('');
  lines.push('## 내 입력');
  (resource.fields || []).forEach(function (f) {
    lines.push('### ' + f.label);
    lines.push(String(values[f.label] || '').trim() || '[작성 필요]');
    lines.push('');
  });
  lines.push('## 실행 지시');
  lines.push(applyPlaceholders(resource.prompt, values));
  lines.push('');
  lines.push('## 검수 기준');
  (resource.checks || []).forEach(function (c, i) {
    lines.push('- ' + c + (checked[i] ? ' (확인됨)' : ''));
  });
  return lines.join('\n').trim() + '\n';
}

export function applyExamples(values, examples, mode) {
  var next = Object.assign({}, values || {});
  examples = examples || {};
  Object.keys(examples).forEach(function (k) {
    if (mode === 'overwrite') {
      next[k] = examples[k];
    } else if (!String(next[k] || '').trim()) {
      next[k] = examples[k];
    }
  });
  return next;
}

export function nextRelatedId(relatedIds, saved, fallbackId) {
  relatedIds = relatedIds || [];
  saved = saved || {};
  for (var i = 0; i < relatedIds.length; i++) {
    var id = relatedIds[i];
    if (!(saved[id] && saved[id].complete)) return id;
  }
  if (relatedIds.length) return relatedIds[0];
  return fallbackId || null;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
node --test tests/compose.test.mjs
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add js/compose.js tests/compose.test.mjs
git commit -m "$(cat <<'EOF'
feat: add compose helpers for QR library prompts

Pure functions for composed copy, placeholders, examples, and related cards.

EOF
)"
```

---

### Task 2: index.html을 module로 이전하고 합성 복사·미리보기·MD 연결

**Files:**
- Modify: `index.html` (하단 `<script>` IIFE → `type="module"`, compose import)
- Modify: CSS in `index.html` (`.prompt` 버튼 그룹, `.warn`, `.preview` details)

**Interfaces:**
- Consumes: `buildComposedPrompt`, `emptyFieldCount`, `applyPlaceholders` from `js/compose.js`
- Produces: UI `#copy-composed`, `#copy-template`, `#preview-composed`, empty warning

- [ ] **Step 1: Convert boot script to module and import compose**

Replace the trailing `<script>(function(){ ... })();</script>` with:

```html
<script type="module">
import {
  buildComposedPrompt,
  emptyFieldCount,
  applyPlaceholders
} from './js/compose.js';
// ... existing app code (no IIFE wrapper needed; top-level is fine)
</script>
```

Keep parsing `#library-data`, `saved`, `render`, `nav` as today. Ensure relative path `./js/compose.js` works when served from project root (and Vercel static).

- [ ] **Step 2: Wire composed download + copy in `download` / render**

Replace `download` body to use compose:

```js
function download(r, st) {
  var text = buildComposedPrompt(r, st);
  var u = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = u;
  a.download = r.title.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '_') + '.md';
  a.click();
  URL.revokeObjectURL(u);
}
```

In panel 03 HTML, replace single copy button with:

```js
var emptyN = emptyFieldCount(r.fields, st.values);
var composed = buildComposedPrompt(r, st);
// panel 03 fragment:
'<div class="prompt">' +
  '<div class="prompt-actions">' +
    '<button type="button" id="copy-composed" class="prompt-btn primary">완성본 복사</button>' +
    '<button type="button" id="copy-template" class="prompt-btn">템플릿만</button>' +
  '</div>' +
  (emptyN ? '<p class="warn" id="empty-warn">' + emptyN + '개 칸이 비어 있음 · 그래도 복사 가능</p>' : '') +
  '<details class="preview"><summary>완성 지시문 미리보기</summary><pre id="preview-composed">' + esc(composed) + '</pre></details>' +
  '<pre class="template-only" hidden>' + esc(r.prompt) + '</pre>' +
'</div>' +
'<div class="note">고객·직원·계정 정보는 제거하거나 익명화한 뒤 입력하세요.</div>'
```

Event handlers:

```js
function flashCopy(btn, label) {
  var prev = btn.textContent;
  btn.textContent = label || '복사됨';
  setTimeout(function () { btn.textContent = prev; }, 1400);
}
document.getElementById('copy-composed').onclick = function () {
  var btn = this;
  navigator.clipboard.writeText(buildComposedPrompt(r, state())).then(function () {
    flashCopy(btn);
  });
};
document.getElementById('copy-template').onclick = function () {
  var btn = this;
  navigator.clipboard.writeText(r.prompt).then(function () {
    flashCopy(btn);
  });
};
```

- [ ] **Step 3: Add minimal CSS**

Inside existing `<style>`, add:

```css
.prompt-actions{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.prompt-btn{border:1px solid #829277;background:transparent;color:#fff;padding:8px 12px;cursor:pointer;font-size:12px}
.prompt-btn.primary{background:var(--coral);border-color:var(--coral);font-weight:600}
.warn{margin:0 0 10px;color:#ffd0c4;font-size:12px}
.preview{margin-top:8px}
.preview summary{cursor:pointer;color:#cfe0c0;font-size:13px}
.preview pre{margin:10px 0 0;white-space:pre-wrap;font:400 13px/1.7 var(--font);color:var(--prompt-text)}
.prompt{position:relative}
/* remove absolute single-button positioning if it conflicts */
.prompt > .prompt-actions button{position:static}
```

Adjust/remove old `.prompt button{position:absolute;...}` rules so the new button group lays out correctly on mobile.

- [ ] **Step 4: Manual smoke test**

```bash
# from repo root
npx --yes serve -l 5173 .
```

Open `http://localhost:5173/#02-rgctor`, fill Role/Goal, open preview, copy composed, paste into a text editor. Confirm placeholders replaced and sections present. Check `#00-route` MD download matches compose format.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: compose and copy full agent prompts from card fields

Replace template-only copy with composed preview, dual copy actions, and aligned MD export.

EOF
)"
```

---

### Task 3: 예시 채우기 · 초기화 · 미작성 경고 연동

**Files:**
- Modify: `index.html` (panel 02 toolbar + handlers)
- Modify: `#library-data` — add `examples` to **all 32** resources (can batch in this task or Task 5; minimum for this task: 3 cards used in smoke — `00-route`, `02-rgctor`, `03-voc`)

**Interfaces:**
- Consumes: `applyExamples`, `emptyFieldCount`
- Produces: `#fill-examples`, `#overwrite-examples`, `#clear-values`

- [ ] **Step 1: Add toolbar HTML in panel 02**

After `title('02',...)` and before `.fields`:

```js
'<div class="field-toolbar">' +
  '<button type="button" class="action" id="fill-examples"' + (!(r.examples) ? ' disabled' : '') + '>예시 채우기</button>' +
  '<button type="button" class="action" id="overwrite-examples"' + (!(r.examples) ? ' disabled' : '') + '>예시로 덮어쓰기</button>' +
  '<button type="button" class="action" id="clear-values">작성 초기화</button>' +
  '<span class="field-hint">예시는 가상 B2B SaaS 「플로우보드」 시나리오입니다.</span>' +
'</div>'
```

CSS:

```css
.field-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}
.field-toolbar .action{width:auto;min-height:36px;margin:0;padding:0 12px;font-size:12px}
.field-hint{flex:1 1 100%;color:var(--muted-2);font-size:11px}
```

- [ ] **Step 2: Handlers**

```js
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
```

Import `applyExamples` in the module import list.

- [ ] **Step 3: Seed examples on three cards in library-data**

For `00-route` add:

```json
"examples": {
  "현재 역할": "콘텐츠·퍼포먼스·CRM을 함께 맡는 1인 마케터 (플로우보드)",
  "반복 업무": "매주 광고·콘텐츠 성과를 요약해 슬랙에 보고한다",
  "AI 활용 수준": "3단계 — 초안은 AI, 수치·승인만 사람이 한다",
  "21일 뒤 목표": "검수 가능한 주간 리포트 Agent와 승인 체크리스트 완성"
}
```

For `02-rgctor`:

```json
"examples": {
  "Role": "B2B SaaS 퍼포먼스 마케터",
  "Goal": "무료 체험 신청 CPA를 4주 안에 20% 낮춘다",
  "Context": "플로우보드 / ICP: 50–200명 팀 리드 / 예산 월 800만",
  "Tool": "지난 4주 Meta·구글 성과 CSV, 랜딩 카피, 보이스 카드",
  "Output": "실험 설계표 (가설·변수·예산·중단 기준) 1페이지",
  "Review": "없는 수치는 만들지 말 것, 과장 표현 금지, 마케팅 리드 승인"
}
```

For `03-voc`:

```json
"examples": {
  "분석 대상": "플로우보드 무료 체험 사용자 (팀 리드)",
  "VOC 원문": "\"온보딩이 길어서 팀원 초대 전에 이탈했어요\" / \"노션이랑 뭐가 다른지 한눈에 안 보여요\"",
  "분류 기준": "상황, 문제, 감정, 욕망, 장벽, 신뢰",
  "활용처": "랜딩 상단 메시지, 온보딩 메일, 비교 콘텐츠"
}
```

(Full 32-card examples land in Task 5 if deferred.)

- [ ] **Step 4: Smoke test**

Open `#00-route` → 예시 채우기 → fields filled → 완성본 복사 includes example text → 작성 초기화 clears values but keeps checks/complete.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add example fill and clear actions on practice cards

Let marketers load Flowboard sample inputs without wiping existing work by default.

EOF
)"
```

---

### Task 4: 상황별 바로가기 + related + 다음 추천

**Files:**
- Modify: `index.html` (sidebar HTML + `nav`/`render`)
- Modify: `#library-data` — add `related` arrays (minimum for shortcuts’ chains; full 32 in Task 5)

**Interfaces:**
- Consumes: `nextRelatedId`
- Produces: `#shortcuts` buttons, related links in panel 01, `#next-card` in panel 04

- [ ] **Step 1: Add SCENARIOS constant and shortcuts UI**

In module script:

```js
var SCENARIOS = [
  { id: '03-voc', label: '오늘 VOC' },
  { id: '02-rgctor', label: 'R-G-C-T-O-R' },
  { id: '04-calendar', label: '콘텐츠 캘린더' },
  { id: '05-adtest', label: '광고 실험' },
  { id: '05-crm', label: 'CRM' },
  { id: '05-report', label: '주간 리포트' }
];
```

In sidebar HTML, after `.search`, before `#nav`:

```html
<div class="shortcuts" id="shortcuts" aria-label="상황별 바로가기"></div>
```

Render shortcuts once (or inside `nav`):

```js
function renderShortcuts() {
  document.getElementById('shortcuts').innerHTML =
    '<div class="shortcuts-label">지금 할 일</div>' +
    SCENARIOS.map(function (s) {
      return '<button type="button" data-id="' + s.id + '" class="shortcut' +
        (s.id === active ? ' active' : '') + '">' + esc(s.label) + '</button>';
    }).join('');
  document.querySelectorAll('#shortcuts button').forEach(function (b) {
    b.onclick = function () {
      active = this.dataset.id;
      if (location.hash !== '#' + active) history.replaceState(null, '', '#' + active);
      render();
      closeMenu();
    };
  });
}
```

Call `renderShortcuts()` from `render()` / `nav()`.

CSS:

```css
.shortcuts{padding:8px 12px 4px;display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--sidebar-edge)}
.shortcuts-label{flex:1 1 100%;font-size:11px;color:var(--muted);font-weight:600;letter-spacing:.04em;padding:4px 2px}
.shortcut{border:1px solid var(--line);background:var(--surface);color:var(--ink-soft);padding:6px 10px;font-size:12px;cursor:pointer;border-radius:999px}
.shortcut:hover{border-color:var(--green);background:var(--green-soft)}
.shortcut.active{background:var(--green);border-color:var(--green);color:#fff;font-weight:600}
```

- [ ] **Step 2: Related links + next recommendation in render**

```js
function relatedHtml(r) {
  var ids = r.related || [];
  if (!ids.length) return '';
  var links = ids.map(function (id) {
    var item = all.filter(function (x) { return x.id === id; })[0];
    if (!item) return '';
    return '<button type="button" class="related-link" data-id="' + id + '">' + esc(item.title) + '</button>';
  }).join('');
  return '<div class="related"><span>이어서 보면 좋은 카드</span><div class="related-list">' + links + '</div></div>';
}
```

Append `relatedHtml(r)` after steps in panel 01.

Panel 04 after complete button:

```js
var nid = nextRelatedId(r.related, saved, null);
var nItem = nid && all.filter(function (x) { return x.id === nid; })[0];
var nextBtn = nItem
  ? '<button type="button" class="action" id="next-card">다음 추천 · ' + esc(nItem.title) + '</button>'
  : '';
```

Bind:

```js
document.querySelectorAll('.related-link').forEach(function (b) {
  b.onclick = function () {
    active = this.dataset.id;
    history.replaceState(null, '', '#' + active);
    render();
  };
});
var nextEl = document.getElementById('next-card');
if (nextEl) nextEl.onclick = function () {
  active = nid;
  history.replaceState(null, '', '#' + active);
  render();
};
```

- [ ] **Step 3: Add `related` for scenario chain cards**

```json
"03-voc": ["03-campaign", "04-copy"]
"03-campaign": ["04-calendar", "04-copy"]
"04-copy": ["04-qa", "01-voice"]
"02-rgctor": ["02-canvas", "06-cards"]
"02-canvas": ["02-workflow", "02-rgctor"]
"06-cards": ["02-rgctor", "06-audit"]
"04-calendar": ["04-copy", "04-qa"]
"04-qa": ["01-risk", "05-log"]
"05-adtest": ["05-creative", "05-log"]
"05-creative": ["05-adtest", "05-log"]
"05-log": ["05-meeting", "05-report"]
"05-crm": ["01-hitl", "05-report"]
"01-hitl": ["05-crm", "01-risk"]
"05-report": ["05-meeting", "05-log"]
"05-meeting": ["05-report", "05-log"]
```

(Insert as `"related":[...]` on each matching resource object in JSON.)

- [ ] **Step 4: Smoke test**

Click each of 6 shortcuts → correct hash and title. From `#03-voc`, related shows campaign/copy; complete voc → next recommends incomplete related.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: add task shortcuts and related card navigation

Surface six work scenarios and chain practice cards for the next action.

EOF
)"
```

---

### Task 5: 32개 카드 `examples` + `related` 완비 + 일괄 MD 다운로드

**Files:**
- Modify: `index.html` `#library-data` (all resources)
- Modify: `index.html` progress area (bulk download button)

**Interfaces:**
- Produces: every resource has `examples` (all field labels) and `related` (2–3 ids); `#download-all-done`

- [ ] **Step 1: Complete related for remaining cards**

Suggested pairs (use unless a better chain exists):

| id | related |
|----|---------|
| 00-route | 00-split, 06-21day |
| 00-split | 02-rgctor, 01-hitl |
| 01-data | 01-hitl, 01-risk |
| 01-voice | 04-copy, 04-qa |
| 01-risk | 04-qa, 01-hitl |
| 03-market | 03-competitor, 03-campaign |
| 03-competitor | 03-campaign, 04-copy |
| 03-journey | 03-campaign, 04-calendar |
| 04-seo | 04-landing, 04-qa |
| 04-landing | 04-copy, 04-qa |
| 04-creative | 04-qa, 05-creative |
| 06-team | 06-21day, 02-canvas |
| 06-21day | 00-route, 06-cards |
| 06-audit | 06-cards, 99-change |
| 99-meta | 99-change, 06-audit |
| 99-change | 99-meta, 06-audit |

- [ ] **Step 2: Add Flowboard examples for every remaining card**

Rules:
- Keys must equal `fields[].label` exactly
- 1–3 short Korean sentences; no real PII
- Prefer concrete numbers/dates over adjectives

Example pattern for `05-report`:

```json
"examples": {
  "목표·기간": "무료 체험 CPA / 이번 주 vs 지난 주",
  "성과 데이터": "지출 200만, CTR 1.8%, CPA 42,000 (지난 주 48,000)",
  "변경 이력": "화요일 후킹 문구 A/B, 목요일 랜딩 CTA 위치 변경",
  "의사결정": "승자 소재 예산 +30% / 패자 중단 / 랜딩은 추가 3일 관찰"
}
```

Repeat for all 32 (can script generation with node one-off, but commit the resulting JSON inside `index.html`).

- [ ] **Step 3: Bulk download completed cards**

In `progress` HTML (extend `nav` progress render):

```js
'<button type="button" class="action" id="download-all-done">완료 카드 MD 일괄 받기</button>'
```

Handler:

```js
var btn = document.getElementById('download-all-done');
if (btn) btn.onclick = function () {
  var parts = all.filter(function (r) { return saved[r.id] && saved[r.id].complete; })
    .map(function (r) { return buildComposedPrompt(r, saved[r.id]); });
  if (!parts.length) { alert('완료한 카드가 없습니다.'); return; }
  var text = parts.join('\n\n---\n\n');
  var u = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
  var a = document.createElement('a');
  a.href = u; a.download = 'command-marketing-completed.md'; a.click();
  URL.revokeObjectURL(u);
};
```

- [ ] **Step 4: Validate JSON + tests**

```bash
node -e "JSON.parse(require('fs').readFileSync('index.html','utf8').match(/<script id=\"library-data\"[^>]*>([\\s\\S]*?)<\\/script>/)[1]); console.log('ok')"
node --test tests/compose.test.mjs
```

Also assert every resource has examples keys matching fields (optional quick script):

```bash
node --input-type=module -e "
import fs from 'fs';
const html = fs.readFileSync('index.html','utf8');
const db = JSON.parse(html.match(/<script id=\"library-data\"[^>]*>([\\s\\S]*?)<\\/script>/)[1]);
let n=0;
for (const s of db.sections) for (const r of s.resources) {
  if (!r.examples) throw new Error('missing examples '+r.id);
  for (const f of r.fields) if (!(f.label in r.examples)) throw new Error(r.id+' missing '+f.label);
  if (!r.related || r.related.length < 2) throw new Error('related '+r.id);
  n++;
}
console.log('validated', n);
"
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "$(cat <<'EOF'
feat: complete card examples, related links, and bulk MD export

Fill all 32 practice cards with Flowboard samples and enable completed-card download.

EOF
)"
```

---

### Task 6: 회귀 확인 (모바일·해시·SEO·localStorage)

**Files:**
- Test only (no production change unless bugs found)
- Fix: `index.html` only if regressions appear

- [ ] **Step 1: Automated checks**

```bash
node --test tests/compose.test.mjs
# JSON + examples/related validation script from Task 5 Step 4
```

- [ ] **Step 2: Manual checklist (browser)**

- [ ] `/#02-rgctor` deep link opens correct card; title meta updates
- [ ] Search still filters nav
- [ ] Mobile menu open/close + scrim + Escape
- [ ] Existing localStorage: pre-filled values still show after refresh
- [ ] Complete toggle + progress count
- [ ] Dark mode (`prefers-color-scheme`) buttons readable on prompt panel
- [ ] `file://` note: ES modules may need http server — document in commit if needed; Vercel serves over https so OK

- [ ] **Step 3: Commit fixes if any**

```bash
git add index.html
git commit -m "fix: practical UX regressions after compose workflow"
```

(Skip commit if nothing to fix.)

---

## Spec Coverage Self-Review

| Spec requirement | Task |
|------------------|------|
| 완성 지시문 합성·복사·미리보기 | Task 1–2 |
| 템플릿만 복사 보조 | Task 2 |
| MD 형식 정렬 | Task 2 |
| 미작성 경고 | Task 2–3 |
| 예시 채우기/덮어쓰기/초기화 | Task 3, 5 |
| 상황별 바로가기 6개 | Task 4 |
| related + 다음 추천 | Task 4–5 |
| localStorage 호환 | Global + Task 2/6 |
| 일괄 MD (여유) | Task 5 |
| 모바일·해시·SEO 회귀 | Task 6 |

No TBD placeholders. Function names consistent across tasks: `buildComposedPrompt`, `applyExamples`, `nextRelatedId`, `emptyFieldCount`, `applyPlaceholders`.
