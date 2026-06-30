import { describe, it, expect } from 'vitest';
import { getContentFilterDecision } from '@/entrypoints/utils/contentFilter';

/**
 * 回归：短文档的内容区（如 docs.devin.ai/changelog）夹带一个社交链接 + 大量版本徽章/下载按钮、
 * 且没有长段落（longParagraphCount=0）时，曾被 isShareBlock 整体误判为分享控件 skip-self，
 * 导致内容区下所有非 p/li 文本（例如直接放在 div 里的概述句）被大面积漏翻。
 * 含有可读段落/列表正文的容器不应被当成分享控件。
 */
function buildContentArea(): HTMLElement {
  const area = document.createElement('div');
  area.className = 'content-area';

  // 一个夹带的社交链接（触发 share signal），以及若干下载按钮 + 短版本徽章（短交互）
  const social = document.createElement('a');
  social.setAttribute('href', 'https://youtube.com/@devin');
  social.textContent = 'YouTube';
  area.appendChild(social);

  for (let i = 0; i < 6; i++) {
    const badge = document.createElement('a');
    badge.setAttribute('href', `#v3-2-${i}`);
    badge.textContent = `v3.2.${i}`;
    area.appendChild(badge);
    const btn = document.createElement('button');
    btn.textContent = `Download 3.2.${i}`;
    area.appendChild(btn);
  }

  // 直接放在 div 里的概述句（无 p/li 包裹）——这正是之前被漏翻的形态
  const summaryWrap = document.createElement('div');
  summaryWrap.className = 'prose-sm';
  const summary = document.createElement('span');
  summary.textContent = 'Various bug fixes and improvements.';
  summaryWrap.appendChild(summary);
  area.appendChild(summaryWrap);

  // 真正的列表正文（可读段落后代）
  const ul = document.createElement('ul');
  for (let i = 0; i < 4; i++) {
    const li = document.createElement('li');
    li.textContent = 'Made MCP registry parsing more tolerant of old and inconsistent schemas, improving overall stability.';
    ul.appendChild(li);
  }
  area.appendChild(ul);

  document.body.appendChild(area);
  return area;
}

describe('content filter: large content area must not be treated as a share block', () => {
  it('keeps a content container that has readable list/paragraph descendants', () => {
    document.body.innerHTML = '';
    const area = buildContentArea();
    expect(getContentFilterDecision(area)).toBe('keep');
  });

  it('still skips a compact share bar with no readable paragraphs', () => {
    document.body.innerHTML = '';
    const bar = document.createElement('div');
    bar.className = 'share-bar';
    ['Twitter', 'Facebook', 'LinkedIn'].forEach(label => {
      const a = document.createElement('a');
      a.setAttribute('href', `https://${label.toLowerCase()}.com/share`);
      a.textContent = label;
      bar.appendChild(a);
    });
    document.body.appendChild(bar);
    expect(getContentFilterDecision(bar)).toBe('skip-self');
  });
});
