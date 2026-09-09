import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyFieldCount,
  applyPlaceholders,
  buildComposedPrompt,
  buildTemplatePrompt,
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
  it('emits book-style role/goal/context blocks', () => {
    const resource = {
      title: 'VOC 분석',
      part: 'Part 4',
      chapter: 'Ch.02',
      outcome: '6렌즈 분류',
      bookPractice: 'VOC에서 카피 소재를 뽑는다',
      fields: [{ label: 'VOC 원문' }],
      agent: {
        role: '당신은 고객 인사이트 Agent예요.',
        goal: '6가지 렌즈로 분류해 주세요.',
        output: '렌즈별 표',
        review: '추정 금지'
      },
      prompt: '',
      checks: ['6가지 렌즈 분류 결과']
    };
    const text = buildComposedPrompt(resource, {
      values: { 'VOC 원문': '도입이 복잡할까 봐' },
      checked: [true]
    });
    assert.match(text, /\[책 실습\] VOC 분석/);
    assert.match(text, /\[실습 목표\] VOC에서 카피 소재를 뽑는다/);
    assert.match(text, /• 역할 : 당신은 고객 인사이트 Agent예요\./);
    assert.match(text, /• 목표 :/);
    assert.match(text, /• 맥락 :/);
    assert.match(text, /도입이 복잡할까 봐/);
    assert.match(text, /• 출력 :/);
    assert.match(text, /• 검수 기준 :/);
    assert.match(text, /6가지 렌즈 분류 결과 \(확인됨\)/);
  });

  it('shows [작성 필요] for empty fields', () => {
    const resource = {
      title: 'T', part: 'P', chapter: 'C', outcome: 'O',
      fields: [{ label: 'X' }],
      agent: { role: 'R', goal: 'G', output: 'O', review: 'V' },
      prompt: 'p', checks: []
    };
    const text = buildComposedPrompt(resource, { values: {}, checked: [] });
    assert.match(text, /\[작성 필요\]/);
  });
});

describe('buildTemplatePrompt', () => {
  it('keeps placeholders instead of values', () => {
    const text = buildTemplatePrompt({
      fields: [{ label: '목표', placeholder: '예: 전환' }],
      agent: { role: '역할', goal: '목표', output: '출력', review: '검수' },
      prompt: ''
    });
    assert.match(text, /• 역할 : 역할/);
    assert.match(text, /【목표】/);
    assert.match(text, /예: 전환/);
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
