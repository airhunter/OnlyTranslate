import { describe, expect, it } from 'vitest';
import { beautyHTML } from '@/entrypoints/main/dom';

describe('beautyHTML', () => {
  it('preserves inline phrasing while formatting block elements', () => {
    expect(beautyHTML(
      '<article><h2>Hello</h2><p>Text <strong>bold</strong> and <a href="/x">link</a>.</p></article>'
    )).toBe([
      '<article>',
      '    <h2>Hello</h2>',
      '    <p>Text <strong>bold</strong> and <a href="/x">link</a>.</p>',
      '</article>',
    ].join('\n'));
  });

  it('restores case-sensitive SVG names before formatting', () => {
    expect(beautyHTML(
      '<svg viewbox="0 0 10 10"><lineargradient id="g"><stop offset="0%"></stop></lineargradient><clippath clippathunits="objectBoundingBox"><path d="M0 0"></path></clippath></svg>'
    )).toBe([
      '<svg viewBox="0 0 10 10">',
      '    <linearGradient id="g">',
      '        <stop offset="0%"></stop>',
      '    </linearGradient>',
      '    <clipPath clipPathUnits="objectBoundingBox">',
      '        <path d="M0 0"></path>',
      '    </clipPath>',
      '</svg>',
    ].join('\n'));
  });

  it('keeps code and translation placeholders on the original line', () => {
    expect(beautyHTML(
      '<p>Use <code>const x = 1;</code> then <span data-onlytranslate="keep">continue</span>.</p>'
    )).toBe('<p>Use <code>const x = 1;</code> then <span data-onlytranslate="keep">continue</span>.</p>');
  });
});
