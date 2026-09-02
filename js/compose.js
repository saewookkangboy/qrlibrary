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
