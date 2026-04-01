(function () {
  const EVENT_TYPE = 'fr-subtitle-inject';
  // 默认 patterns，在 content script 发送配置前就能拦截常见字幕请求
  let subtitlePatterns = ['/api/timedtext', '\\.vtt(\\?|#|$)', 'subtitles?.*\\.vtt', '/captions/'];

  // 缓存最近一次捕获，用于内容脚本晚于字幕请求就绪时补发
  var lastCapture = null;

  // ── 工具函数 ──────────────────────────────────────────────
  function isSubtitleUrl(url) {
    if (!url || !subtitlePatterns.length) return false;
    return subtitlePatterns.some(function (pattern) {
      try { return new RegExp(pattern).test(url); } catch (_) { return false; }
    });
  }

  function getUrl(input) {
    if (!input) return '';
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return String(input);
  }

  function sendToContent(payload) {
    window.postMessage(Object.assign({ eventType: EVENT_TYPE }, payload), '*');
  }

  // ── 接收 Content Script 发来的配置 ───────────────────────
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    var data = event.data;
    if (!data || data.eventType !== EVENT_TYPE) return;
    if (data.type === 'config') {
      subtitlePatterns = data.patterns || [];
      // 内容脚本刚就绪，把已缓存的字幕补发过去
      if (lastCapture) {
        sendToContent({ type: 'subtitle-captured', url: lastCapture.url, data: lastCapture.data });
      }
    }
  });

  // ── Hook XMLHttpRequest ───────────────────────────────────
  var originalOpen = XMLHttpRequest.prototype.open;
  var originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function () {
    this._fr_url = typeof arguments[1] === 'string'
      ? arguments[1]
      : (arguments[1] && arguments[1].href) || '';
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var url = this._fr_url;
    if (url && isSubtitleUrl(url)) {
      var self = this;
      self.addEventListener('load', function () {
        if (self.status === 200 && self.responseText) {
          lastCapture = { url: url, data: self.responseText };
          sendToContent({ type: 'subtitle-captured', url: url, data: self.responseText });
        }
      });
    }
    return originalSend.apply(this, arguments);
  };

  // ── Hook fetch ────────────────────────────────────────────
  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function (input, init) {
      var url = getUrl(input);
      if (url && isSubtitleUrl(url)) {
        return originalFetch.call(this, input, init).then(function (response) {
          if (response.ok) {
            response.clone().text().then(function (text) {
              if (text) {
                lastCapture = { url: url, data: text };
                sendToContent({ type: 'subtitle-captured', url: url, data: text });
              }
            }).catch(function () {});
          }
          return response;
        });
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // ── 通知 Content Script 注入脚本已就绪 ────────────────────
  sendToContent({ type: 'ready' });
})();
