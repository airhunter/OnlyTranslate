import {ElMessage} from "element-plus";
import {throttle} from "@/entrypoints/utils/common";

// deprecated
const prefix = "";

function _sendErrorMessage(message: string) {
    ElMessage({message: prefix + message, type: 'error', customClass: 'notranslate'});
}

function _sendSuccessMessage(message: string) {
    ElMessage({message: prefix + message, type: 'success', customClass: 'notranslate'});
}

function _sendWarningMessage(message: string) {
    ElMessage({message: prefix + message, type: 'warning', customClass: 'notranslate'});
}

// 使用防抖函数包装，1s 内只能发送一次消息
export const sendErrorMessage = throttle(_sendErrorMessage, 1000);
export const sendSuccessMessage = throttle(_sendSuccessMessage, 1000);
export const sendWarningMessage = throttle(_sendWarningMessage, 1000);
