declare module 'entrypoints/utils/declare';
declare module 'js-beautify';
declare module '*?raw' {
  const content: string;
  export default content;
}

type ChromeMessageListener = (
  message: any,
  sender: any,
  sendResponse: (response?: any) => void
) => boolean | void;

declare const chrome: {
  runtime: {
    onMessage: {
      addListener(listener: ChromeMessageListener): void;
      removeListener(listener: ChromeMessageListener): void;
    };
    sendMessage(message: any, responseCallback?: (response: any) => void): void;
    lastError?: {
      message?: string;
    };
    getContexts(details: { contextTypes: string[] }): Promise<unknown[]>;
  };
  offscreen: {
    createDocument(options: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
  };
};
