/** @typedef {{ label: string, placeholder?: string }} Field */
/** @typedef {{ role?: string, goal?: string, output?: string, review?: string }} AgentParts */
/** @typedef {{ title: string, part: string, chapter: string, outcome: string, bookPractice?: string, fields: Field[], prompt: string, agent?: AgentParts, checks: string[] }} Resource */
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

function contextBlock(fields, values) {
  values = values || {};
  return (fields || []).map(function (f) {
    var v = String(values[f.label] || '').trim() || '[작성 필요]';
    return '【' + f.label + '】\n' + v;
  }).join('\n\n');
}

/**
 * Build a book-aligned Role/Goal/Context prompt that readers can paste into AI.
 * Prefers resource.agent parts when present; falls back to prompt + field context.
 */
export function buildComposedPrompt(resource, state) {
  state = state || {};
  var values = state.values || {};
  var checked = state.checked || [];
  var agent = resource.agent || {};
  var lines = [];

  lines.push('[책 실습] ' + resource.title);
  lines.push('[연결] ' + resource.part + ' · ' + resource.chapter);
  if (resource.bookPractice) {
    lines.push('[실습 목표] ' + resource.bookPractice);
  } else if (resource.outcome) {
    lines.push('[실습 목표] ' + resource.outcome);
  }
  lines.push('');

  if (agent.role || agent.goal || agent.output || agent.review) {
    lines.push('• 역할 : ' + (agent.role || '[작성 필요]'));
    lines.push('• 목표 : ' + (agent.goal || '[작성 필요]'));
    lines.push('• 맥락 :');
    lines.push(contextBlock(resource.fields, values));
    lines.push('• 출력 : ' + (agent.output || '[작성 필요]'));
    lines.push('• 검수 기준 : ' + (agent.review || '[작성 필요]'));
  } else {
    lines.push('• 역할 / 목표 / 맥락 / 출력 / 검수 기준');
    lines.push(applyPlaceholders(resource.prompt, values));
    lines.push('');
    lines.push('• 추가 맥락 (독자 입력)');
    lines.push(contextBlock(resource.fields, values));
  }

  lines.push('');
  lines.push('• 최종 사람 검수 체크');
  (resource.checks || []).forEach(function (c, i) {
    lines.push('- ' + c + (checked[i] ? ' (확인됨)' : ''));
  });

  return lines.join('\n').trim() + '\n';
}

/** Template-only copy: book-style skeleton without filled field values. */
export function buildTemplatePrompt(resource) {
  var agent = resource.agent || {};
  if (agent.role || agent.goal || agent.output || agent.review) {
    var lines = [];
    lines.push('• 역할 : ' + (agent.role || ''));
    lines.push('• 목표 : ' + (agent.goal || ''));
    lines.push('• 맥락 :');
    (resource.fields || []).forEach(function (f) {
      lines.push('【' + f.label + '】');
      lines.push('(' + (f.placeholder || '여기에 입력') + ')');
      lines.push('');
    });
    lines.push('• 출력 : ' + (agent.output || ''));
    lines.push('• 검수 기준 : ' + (agent.review || ''));
    return lines.join('\n').trim() + '\n';
  }
  return String(resource.prompt || '').trim() + '\n';
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
