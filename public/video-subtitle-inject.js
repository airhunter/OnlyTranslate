(function () {
  const EVENT_TYPE = 'fr-subtitle-inject';
  const PLAYER_WAIT_INTERVAL_MS = 100;
  const PLAYER_WAIT_TIMEOUT_MS = 8000;
  const CAPTURE_WAIT_TIMEOUT_MS = 3500;
  const RETRY_PLAYBACK_DELAY_MS = 1200;
  const MAX_AUTO_FETCH_ATTEMPTS = 2;
  const YOUTUBE_FIXED_PARAMS = {
    fmt: 'json3',
    xorb: '2',
    xobt: '3',
    xovt: '3',
    c: 'WEB',
    cplayer: 'UNIPLAYER',
  };
  const DEVICE_PARAM_KEYS = ['cbrand', 'cbr', 'cbrver', 'cos', 'cosver', 'cplatform'];

  let subtitlePatterns = ['/api/timedtext', '\\.vtt(\\?|#|$)', 'subtitles?.*\\.vtt', '/captions/'];
  let lastCapture = null;
  let captureSequence = 0;
  let autoRequestVersion = 0;
  let autoRequestController = null;

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
    if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
    return String(input);
  }

  function sendToContent(payload) {
    window.postMessage(Object.assign({ eventType: EVENT_TYPE }, payload), '*');
  }

  function getVideoIdFromUrl(url) {
    try {
      return new URL(url, window.location.href).searchParams.get('v') || '';
    } catch (_) {
      return '';
    }
  }

  function isCaptureForCurrentVideo(capture) {
    if (!capture || !window.location.hostname.includes('youtube')) return true;
    const currentVideoId = new URL(window.location.href).searchParams.get('v');
    const capturedVideoId = getVideoIdFromUrl(capture.url);
    return !currentVideoId || !capturedVideoId || currentVideoId === capturedVideoId;
  }

  function publishCapture(url, data) {
    if (!url || !data) return;
    lastCapture = { url: url, data: data };
    captureSequence += 1;
    sendToContent({ type: 'subtitle-captured', url: url, data: data });
  }

  function sendYoutubeStatus(status, videoId, reason) {
    sendToContent({
      type: 'youtube-subtitle-status',
      status: status,
      videoId: videoId || '',
      reason: reason || '',
    });
  }

  function findYoutubePlayer() {
    return document.querySelector('.html5-video-player.playing-mode, .html5-video-player.paused-mode')
      || document.querySelector('.html5-video-player');
  }

  function waitForYoutubePlayer(version) {
    const startedAt = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (version !== autoRequestVersion) {
          resolve(null);
          return;
        }

        const player = findYoutubePlayer();
        const response = player && player.getPlayerResponse && player.getPlayerResponse();
        if (player && response && response.videoDetails && response.videoDetails.videoId) {
          resolve({ player: player, response: response });
          return;
        }

        if (Date.now() - startedAt >= PLAYER_WAIT_TIMEOUT_MS) {
          resolve(null);
          return;
        }
        window.setTimeout(check, PLAYER_WAIT_INTERVAL_MS);
      }
      check();
    });
  }

  function getTrackName(track) {
    return (track && track.name && (track.name.simpleText || (track.name.runs && track.name.runs[0] && track.name.runs[0].text))) || '';
  }

  function getTrackVssId(track) {
    if (!track) return '';
    if (track.vssId || track.vss_id) return track.vssId || track.vss_id;
    try {
      const url = new URL(track.baseUrl, window.location.origin);
      return url.searchParams.get('vssId') || url.searchParams.get('vss_id') || '';
    } catch (_) {
      return '';
    }
  }

  function selectCaptionTrack(player, tracks) {
    if (!tracks || !tracks.length) return null;
    const selected = player.getOption && player.getOption('captions', 'track');
    if (selected) {
      const selectedVssId = getTrackVssId(selected);
      if (selectedVssId) {
        const vssMatch = tracks.find(function (track) { return getTrackVssId(track) === selectedVssId; });
        if (vssMatch) return vssMatch;
      }

      const selectedLanguage = selected.languageCode;
      const selectedKind = selected.kind || selected.trackKind || null;
      const exactMatch = tracks.find(function (track) {
        return track.languageCode === selectedLanguage && (track.kind || null) === selectedKind;
      });
      if (exactMatch) return exactMatch;

      const languageMatch = tracks.find(function (track) { return track.languageCode === selectedLanguage; });
      if (languageMatch) return languageMatch;
    }

    return tracks.find(function (track) { return track.kind !== 'asr' && !getTrackName(track); })
      || tracks.find(function (track) { return track.kind !== 'asr'; })
      || tracks.find(function (track) { return track.kind === 'asr'; })
      || tracks[0];
  }

  function getMatchingPotUrl(player, track, videoId) {
    const candidates = [];
    const audioTrack = player.getAudioTrack && player.getAudioTrack();
    if (audioTrack && Array.isArray(audioTrack.captionTracks)) {
      const selectedVssId = getTrackVssId(track);
      const matching = audioTrack.captionTracks.find(function (item) {
        return selectedVssId && getTrackVssId(item) === selectedVssId;
      }) || audioTrack.captionTracks.find(function (item) {
        try {
          const url = new URL(item.url, window.location.origin);
          return url.searchParams.get('lang') === track.languageCode && (item.kind || null) === (track.kind || null);
        } catch (_) {
          return false;
        }
      }) || audioTrack.captionTracks[0];
      if (matching && matching.url) candidates.push(matching.url);
    }

    if (lastCapture && getVideoIdFromUrl(lastCapture.url) === videoId) {
      candidates.push(lastCapture.url);
    }

    return candidates.find(function (url) {
      try { return new URL(url, window.location.origin).searchParams.has('pot'); } catch (_) { return false; }
    }) || '';
  }

  function buildYoutubeSubtitleUrl(track, player, potSourceUrl) {
    const url = new URL(track.baseUrl, window.location.origin);
    Object.keys(YOUTUBE_FIXED_PARAMS).forEach(function (key) {
      url.searchParams.set(key, YOUTUBE_FIXED_PARAMS[key]);
    });

    const device = window.ytcfg && window.ytcfg.get && window.ytcfg.get('DEVICE');
    if (device) {
      const deviceParams = new URLSearchParams(device);
      DEVICE_PARAM_KEYS.forEach(function (key) {
        const value = deviceParams.get(key);
        if (value) url.searchParams.set(key, value);
      });
    }

    const context = player.getWebPlayerContextConfig && player.getWebPlayerContextConfig();
    const clientVersion = context && context.innertubeContextClientVersion;
    if (clientVersion) url.searchParams.set('cver', clientVersion);

    if (potSourceUrl) {
      const potSource = new URL(potSourceUrl, window.location.origin);
      const pot = potSource.searchParams.get('pot');
      const potc = potSource.searchParams.get('potc');
      if (pot) url.searchParams.set('pot', pot);
      if (potc) url.searchParams.set('potc', potc);
    }
    return url.href;
  }

  function isValidJson3(text) {
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed.events) && parsed.events.length > 0;
    } catch (_) {
      return false;
    }
  }

  async function fetchYoutubeTrack(url, version, signal) {
    try {
      const response = await originalFetch.call(window, url, { credentials: 'include', signal: signal });
      if (version !== autoRequestVersion || !response.ok) return null;
      const text = await response.text();
      return isValidJson3(text) ? text : null;
    } catch (_) {
      return null;
    }
  }

  function ensureYoutubeSubtitlesEnabled(player) {
    const button = document.querySelector('.ytp-subtitles-button');
    if (button && button.getAttribute('aria-pressed') === 'true') return true;
    if (typeof player.toggleSubtitles === 'function') {
      player.toggleSubtitles();
      return true;
    } else if (button && typeof button.click === 'function') {
      button.click();
      return true;
    }
    return false;
  }

  function waitForNewCapture(videoId, afterSequence, version) {
    const startedAt = Date.now();
    return new Promise(function (resolve) {
      function check() {
        if (version !== autoRequestVersion) {
          resolve(false);
          return;
        }
        if (
          captureSequence > afterSequence
          && lastCapture
          && getVideoIdFromUrl(lastCapture.url) === videoId
        ) {
          resolve(true);
          return;
        }
        if (Date.now() - startedAt >= CAPTURE_WAIT_TIMEOUT_MS) {
          resolve(false);
          return;
        }
        window.setTimeout(check, PLAYER_WAIT_INTERVAL_MS);
      }
      check();
    });
  }

  function waitForPlaybackOrDelay(version) {
    const video = document.querySelector('.html5-video-player video') || document.querySelector('video');
    if (!video || !video.paused) {
      return new Promise(function (resolve) {
        window.setTimeout(function () { resolve(version === autoRequestVersion); }, RETRY_PLAYBACK_DELAY_MS);
      });
    }

    return new Promise(function (resolve) {
      let settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        video.removeEventListener('playing', finish);
        resolve(version === autoRequestVersion);
      }
      video.addEventListener('playing', finish, { once: true });
      window.setTimeout(finish, RETRY_PLAYBACK_DELAY_MS);
    });
  }

  async function autoFetchYoutubeSubtitle() {
    const version = ++autoRequestVersion;
    if (autoRequestController) autoRequestController.abort();
    autoRequestController = typeof AbortController !== 'undefined' ? new AbortController() : null;

    sendYoutubeStatus('loading', '', 'player');
    const state = await waitForYoutubePlayer(version);
    if (!state || version !== autoRequestVersion) {
      if (version === autoRequestVersion) sendYoutubeStatus('failed', '', 'player-unavailable');
      return;
    }

    const videoId = state.response.videoDetails.videoId;
    const tracks = state.response.captions
      && state.response.captions.playerCaptionsTracklistRenderer
      && state.response.captions.playerCaptionsTracklistRenderer.captionTracks;
    const track = selectCaptionTrack(state.player, tracks || []);
    if (!track || !track.baseUrl) {
      sendYoutubeStatus('no-track', videoId, 'no-caption-track');
      return;
    }

    const signal = autoRequestController && autoRequestController.signal;
    for (let attempt = 0; attempt < MAX_AUTO_FETCH_ATTEMPTS; attempt += 1) {
      if (version !== autoRequestVersion) return;
      sendYoutubeStatus('fetching', videoId, attempt === 0 ? 'direct' : 'retry');

      const fastUrl = buildYoutubeSubtitleUrl(track, state.player, '');
      let text = await fetchYoutubeTrack(fastUrl, version, signal);
      let resolvedUrl = fastUrl;

      if (!text && version === autoRequestVersion) {
        const potSource = getMatchingPotUrl(state.player, track, videoId);
        if (potSource) {
          resolvedUrl = buildYoutubeSubtitleUrl(track, state.player, potSource);
          text = await fetchYoutubeTrack(resolvedUrl, version, signal);
        }
      }

      if (text && version === autoRequestVersion) {
        publishCapture(resolvedUrl, text);
        return;
      }

      if (version !== autoRequestVersion) return;
      sendYoutubeStatus('waiting-cc', videoId, 'timedtext');
      const beforeCapture = captureSequence;
      ensureYoutubeSubtitlesEnabled(state.player);
      if (await waitForNewCapture(videoId, beforeCapture, version)) return;
      if (attempt < MAX_AUTO_FETCH_ATTEMPTS - 1) {
        await waitForPlaybackOrDelay(version);
      }
    }

    if (version === autoRequestVersion) {
      sendYoutubeStatus('failed', videoId, 'timedtext-timeout');
    }
  }

  function cancelAutoFetch() {
    autoRequestVersion += 1;
    if (autoRequestController) autoRequestController.abort();
    autoRequestController = null;
  }

  window.addEventListener('message', function (event) {
    if (event.origin && event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.eventType !== EVENT_TYPE) return;
    if (data.type === 'config') {
      subtitlePatterns = data.patterns || [];
      if (lastCapture && isCaptureForCurrentVideo(lastCapture)) {
        sendToContent({ type: 'subtitle-captured', url: lastCapture.url, data: lastCapture.data });
      }
    } else if (data.type === 'youtube-auto-fetch') {
      void autoFetchYoutubeSubtitle();
    } else if (data.type === 'youtube-auto-cancel') {
      cancelAutoFetch();
    }
  });

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function () {
    this._fr_url = typeof arguments[1] === 'string'
      ? arguments[1]
      : (arguments[1] && arguments[1].href) || '';
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    const url = this._fr_url;
    if (url && isSubtitleUrl(url)) {
      const self = this;
      self.addEventListener('load', function () {
        try {
          if (self.status === 200 && self.responseText) {
            publishCapture(self.responseURL || url, self.responseText);
          }
        } catch (_) {}
      });
    }
    return originalSend.apply(this, arguments);
  };

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function (input, init) {
      const url = getUrl(input);
      if (url && isSubtitleUrl(url)) {
        return originalFetch.call(this, input, init).then(function (response) {
          if (response.ok) {
            response.clone().text().then(function (text) {
              if (text) publishCapture(response.url || url, text);
            }).catch(function () {});
          }
          return response;
        });
      }
      return originalFetch.apply(this, arguments);
    };
  }

  sendToContent({ type: 'ready' });
})();
