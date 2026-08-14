import { defineConfig } from 'wxt';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
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
        plugins: [vue() as any],
        define: {
            'process.env.VUE_APP_VERSION': JSON.stringify(packageJson.version),
        }
    }),
    zip: {
        name: 'OnlyTranslate',
        artifactTemplate: '{{name}}-v{{version}}-{{browser}}.zip',
    },
    manifest: ({ browser }) => ({
        name: '__MSG_extName__',
        description: '__MSG_extDescription__',
        homepage_url: 'https://onlytranslate.top/',
        default_locale: 'zh_CN',
        permissions: [
            'storage',
            'contextMenus',
            'offscreen',
            'alarms',
            'unlimitedStorage',
            ...(browser === 'firefox' ? [] : ['tts']),
        ],
        host_permissions: ['<all_urls>'],
        action: {
            default_title: '__MSG_extName__',
        },
        // 直接在 manifest 中声明 MAIN world 脚本，绕开 WXT entrypoint 命名体系。
        // public/video-subtitle-inject.js 会被 WXT 原样复制到扩展根目录。
        // Chrome 加载 manifest content_scripts 时会绕过页面 CSP，不受 YouTube 等限制。
        content_scripts: [
            {
                // 仅注入已支持的视频平台，避免在无关站点执行 XHR/fetch hook。
                // 如需新增平台，在此同步添加对应域名。
                matches: [
                    '*://*.youtube.com/*',
                    '*://*.youtubekids.com/*',
                    '*://*.udemy.com/*',
                    '*://*.coursera.org/*',
                    '*://*.khanacademy.org/*',
                ],
                js: ['video-subtitle-inject.js'],
                world: 'MAIN',
                run_at: 'document_start',
            } as any,
        ],
    }),

});
