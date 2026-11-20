// @vitest-environment node
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../wxt.config';

const root = resolve(import.meta.dirname, '../..');
const ignored = config.watchOptions?.ignored;

if (typeof ignored !== 'function') throw new Error('Expected a development watch filter');

describe('development file watch exclusions', () => {
    it.each(['.pnpm-store', 'output', '.playwright-cli', 'coverage', 'benchmark-results'])(
        'ignores the root %s directory and its contents',
        (directory) => {
            expect(ignored(resolve(root, directory))).toBe(true);
            expect(ignored(resolve(root, directory, 'nested', 'artifact.html'))).toBe(true);
        },
    );

    it.each(['entrypoints/popup/App.vue', 'components/Main.vue', 'public/output/logo.png', 'output-preview/index.html'])(
        'keeps watching %s',
        (file) => expect(ignored(resolve(root, file))).toBe(false),
    );
});
