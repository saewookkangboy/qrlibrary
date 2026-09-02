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
