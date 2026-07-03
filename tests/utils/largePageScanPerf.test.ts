import { describe, it, expect } from 'vitest';
import { resolveAutoTranslationTarget } from '@/entrypoints/main/translationTarget/collect';

/**
 * 回归测试：长文档（如 docs.devin.ai/changelog）整页翻译时，grabAllNode 会为每个候选节点一路回溯到根，
 * 逐个祖先触发 getContentFilterDecision -> getBlockMetrics。getBlockMetrics 之前未做记忆化，单次就是
 * O(子树)~O(子树²)，叠加祖先回溯后整体退化为超线性，曾把页面主线程冻死数分钟。
 *
 * 这里构造一个深层嵌套、含大量段落的大型 DOM；若 getBlockMetrics / getProseEvidence 的按元素记忆化被破坏，
 * 该用例会从数百毫秒退化到数十秒，从而触发超时 / 断言失败。
 */
function buildLargePage(): void {
  const outerNesting = 10;   // body 到内容区的包裹层数，拉长祖先链
  const sections = 40;       // 释出条目数
  const paragraphsPerSection = 12;
  const wrapperDepthPerParagraph = 3;

  let host = document.body;
  for (let i = 0; i < outerNesting; i++) {
    const wrap = document.createElement('div');
    wrap.className = `layout-wrap-${i}`;
    host.appendChild(wrap);
    host = wrap;
  }

  const main = document.createElement('main');
  host.appendChild(main);

  for (let s = 0; s < sections; s++) {
    const section = document.createElement('section');
    section.className = 'release-entry content';
    main.appendChild(section);

    const heading = document.createElement('h2');
    heading.textContent = `Release v3.${s}.0 — notable changes and improvements`;
    section.appendChild(heading);

    for (let p = 0; p < paragraphsPerSection; p++) {
      let pHost: HTMLElement = section;
      for (let d = 0; d < wrapperDepthPerParagraph; d++) {
        const wrap = document.createElement('div');
        wrap.className = `prose-wrap-${d}`;
        pHost.appendChild(wrap);
        pHost = wrap;
      }
      const para = document.createElement('p');
      para.innerHTML =
        `This release improves performance and fixes several bugs in the desktop client. ` +
        `See the <a href="https://example.com/docs/${s}/${p}">documentation</a> for full details ` +
        `and migration notes that apply to version 3.${s}.0 of the product.`;
      pHost.appendChild(para);
    }
  }
}

describe('large page scan performance', () => {
  it('resolves a deeply nested large document without super-linear blowup', () => {
    document.body.innerHTML = '';
    buildLargePage();
    const totalElements = document.querySelectorAll('*').length;
    expect(totalElements).toBeGreaterThan(2000);

    const t0 = performance.now();
    const result = resolveAutoTranslationTarget('smart');
    const elapsed = performance.now() - t0;

    // 修复后（按元素记忆化）单独运行约数百毫秒；与整套测试并行时 happy-dom 的 getComputedStyle 受 CPU 争用
    // 影响可达数秒。预算放宽到 15s 以消除抖动，同时仍能稳定捕获超线性回归——彼时同等规模需数十秒以上，
    // 会直接撞上 40s 用例超时。
    expect(elapsed).toBeLessThan(15000);
    expect(result.nodes.length).toBeGreaterThan(0);
  }, 40000);
});
