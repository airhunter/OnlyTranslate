import {services} from "../utils/option";
import microsoft from "./microsoft";
import deepl from "./deepl";
import custom from "./custom";
import zhipu from "./zhipu";
import gemini from "./gemini";
import google from "./google";
import claude from "./claude";
import minimax from "@/entrypoints/service/minimax";
import common from "@/entrypoints/service/common";
import deepseek from "./deepseek";
import newapi from "./newapi";
import chromeTranslator from "./chrome-translator";

type ServiceFunction = (message: any) => Promise<any>;
type ServiceMap = {[key: string]: ServiceFunction;};

export const _service: ServiceMap = {
    [services.microsoft]: microsoft,
    [services.deepL]: deepl,
    [services.google]: google,
    [services.chromeTranslator]: chromeTranslator,

    [services.custom]: custom,
    [services.zhipu]: zhipu,
    [services.gemini]: gemini,
    [services.claude]: claude,
    [services.minimax]: minimax,
    [services.deepseek]: deepseek,
    [services.newapi]: newapi,

    [services.openai]: common,
    [services.moonshot]: common,
    [services.jieyue]: common,
    [services.siliconCloud]: common,
    [services.openrouter]: common,
    [services.grok]: common,
}
