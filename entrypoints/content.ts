import './style.css';
import { config, configReady } from "@/entrypoints/utils/config";

export default defineContentScript({
    matches: ['<all_urls>'],  // 匹配所有页面
    runAt: 'document_end',  // DOM 解析完成后注册页面能力，扩展 UI 会等待 window.load
    async main(ctx) {
        await configReady // 等待配置加载完成
        if (config.on === false) return; // 如果配置关闭，则不执行任何操作
        const { startContentRuntime } = await import('@/entrypoints/content/runtime');
        startContentRuntime(ctx);
    }
})
