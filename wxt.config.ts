import {defineConfig} from 'wxt';
import vue from '@vitejs/plugin-vue';
import {resolve} from 'path';
import fs from 'fs';


const packageJson = JSON.parse(fs.readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));


// See https://wxt.dev/api/config.html
export default defineConfig({
    modules: ['@wxt-dev/webextension-polyfill'],
    imports: {
        addons: {
            vueTemplate: true,
        },
    },
    vite: () => ({
        plugins: [vue()],
        define: {
            'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
        }
    }),
    manifest: {
        permissions: ['storage', 'contextMenus', 'offscreen'],
        // 直接在 manifest 中声明 MAIN world 脚本，绕开 WXT entrypoint 命名体系。
        // public/video-subtitle-inject.js 会被 WXT 原样复制到扩展根目录。
        // Chrome 加载 manifest content_scripts 时会绕过页面 CSP，不受 YouTube 等限制。
        content_scripts: [
            {
                matches: ['<all_urls>'],
                js: ['video-subtitle-inject.js'],
                world: 'MAIN',
                run_at: 'document_start',
            } as any,
        ],
    },

});