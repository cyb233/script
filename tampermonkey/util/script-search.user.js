// ==UserScript==
// @name         Userscript Search
// @name:en      Userscript Search
// @name:zh-CN   用户脚本搜索
// @name:zh-TW   使用者腳本搜尋
// @name:ja      ユーザースクリプト検索
// @namespace    Schwi
// @version      1.3.2
// @description        Search userscripts for the current site from a floating action button.
// @description:en     Search userscripts for the current site from a floating action button.
// @description:zh-CN  从浮动按钮搜索当前网站可用的用户脚本。
// @description:zh-TW  從浮動按鈕搜尋目前網站可用的使用者腳本。
// @description:ja     フローティングボタンから現在のサイトで利用できるユーザースクリプトを検索します。
// @match        *://*/*
// @require      https://update.greasyfork.org/scripts/597988/2001408/Shadow%20DOM%20Dialog%20Utility.js
// @connect      api.greasyfork.org
// @connect      api.sleazyfork.org
// @connect      gist.github.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_unregisterMenuCommand
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(async function () {
  'use strict';

  // The control belongs to the top-level page; avoid one FAB per embedded frame.
  if (window.top !== window.self) return;

  // Add providers here. `result` converts each provider's API item to the
  // fields used by the common result list below.
  const SHARED_PROVIDER_CONFIG = {
    pathParams: {
      lang: '{lang}',
      host: '{host}'
    },
    queryParams: {
      sort: '{sort}',
      page: '{page}',
      q: '{q}'
    },
    apiPath: '/{lang}/scripts/by-site/{host}.json',
    sort: [
      { labelKey: 'dailyInstalls', key: '' },
      { labelKey: 'totalInstalls', key: 'total_installs' },
      { labelKey: 'rating', key: 'ratings' },
      { labelKey: 'created', key: 'created' },
      { labelKey: 'updated', key: 'updated' },
      { labelKey: 'name', key: 'name' }
    ],
    metadata: [
      { labelKey: 'score', valueKey: 'rating', format: 'rating' },
      { labelKey: 'dailyInstalls', valueKey: 'dailyInstalls', format: 'number' },
      { labelKey: 'totalInstalls', valueKey: 'totalInstalls', format: 'number' },
      { labelKey: 'created', valueKey: 'createdAt', format: 'date' },
      { labelKey: 'updated', valueKey: 'updatedAt', format: 'date' }
    ],
    result: item => {
      const authors = Array.isArray(item.users)
        ? item.users.map(user => ({
          name: user.name || t('unknownAuthor'),
          url: user.url
        }))
        : [];
      return {
        name: item.name || t('unnamedScript'),
        url: item.url,
        description: item.description || '',
        authors,
        metadata: {
          rating: item.fan_score == null ? null : Number(item.fan_score),
          dailyInstalls: item.daily_installs || 0,
          totalInstalls: item.total_installs || 0,
          createdAt: item.created_at,
          updatedAt: item.code_updated_at
        }
      };
    },
    enable: true
  };

  const SITE_PROVIDERS = [
    {
      name: 'Greasy Fork',
      apiHost: 'https://api.greasyfork.org',
      ...SHARED_PROVIDER_CONFIG
    },
    {
      name: 'Sleazy Fork',
      apiHost: 'https://api.sleazyfork.org',
      ...SHARED_PROVIDER_CONFIG
    },
    {
      name: 'GitHub Gist',
      apiHost: 'https://gist.github.com',
      urlBuilder: ({ host, query, page, sort }) => {
        const url = new URL('/search', 'https://gist.github.com');
        const terms = ['"==UserScript=="', `"${host}"`, 'extension:js', 'anon:true'];
        if (query) terms.push(query);
        url.searchParams.set('q', terms.join(' '));
        Object.entries(sort?.params || {}).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
        if (page > 1) url.searchParams.set('p', String(page));
        return url.href;
      },
      parseResponse: parseGistSearchHtml,
      serverSearchOnly: true,
      sort: [
        { labelKey: 'relevance', key: '', params: { s: '', o: 'desc' } },
        { labelKey: 'mostStars', key: 'stars-desc', params: { s: 'stars', o: 'desc' } },
        { labelKey: 'fewestStars', key: 'stars-asc', params: { s: 'stars', o: 'asc' } },
        { labelKey: 'mostForks', key: 'forks-desc', params: { s: 'forks', o: 'desc' } },
        { labelKey: 'fewestForks', key: 'forks-asc', params: { s: 'forks', o: 'asc' } },
        { labelKey: 'recentlyUpdated', key: 'updated-desc', params: { s: 'updated', o: 'desc' } },
        { labelKey: 'leastRecentlyUpdated', key: 'updated-asc', params: { s: 'updated', o: 'asc' } }
      ],
      metadata: [
        { labelKey: 'stars', valueKey: 'stars', format: 'optionalNumber' },
        { labelKey: 'forks', valueKey: 'forks', format: 'optionalNumber' },
        { labelKey: 'comments', valueKey: 'comments', format: 'optionalNumber' },
        { labelKey: 'updated', valueKey: 'updatedAt', format: 'date' }
      ],
      enable: true
    }
  ];

  const CORNERS = [
    { key: 'top-left', labelKey: 'topLeft' },
    { key: 'top-right', labelKey: 'topRight' },
    { key: 'bottom-left', labelKey: 'bottomLeft' },
    { key: 'bottom-right', labelKey: 'bottomRight' }
  ];
  const STORAGE_KEY = 'script-search-fab-corner';
  const OFFSET_STORAGE_KEY = 'script-search-fab-offset';
  const ENABLED_STORAGE_KEY = 'script-search-fab-enabled';
  const LANGUAGE_STORAGE_KEY = 'script-search-language';
  const LANGUAGES = [
    { key: 'zh-CN', labelKey: 'languageChinese' },
    { key: 'zh-TW', labelKey: 'languageTraditional' },
    { key: 'en', labelKey: 'languageEnglish' },
    { key: 'ja', labelKey: 'languageJapanese' }
  ];
  const I18N = {
    en: {
      languageChinese: 'Simplified Chinese', languageTraditional: 'Traditional Chinese', languageEnglish: 'English', languageJapanese: 'Japanese',
      topLeft: 'Top left', topRight: 'Top right', bottomLeft: 'Bottom left', bottomRight: 'Bottom right',
      position: 'Button position', searchDomain: 'Search domain', xOffset: 'X offset', yOffset: 'Y offset', relevance: 'Best match',
      mostStars: 'Most stars', fewestStars: 'Fewest stars', mostForks: 'Most forks', fewestForks: 'Fewest forks',
      recentlyUpdated: 'Recently updated', leastRecentlyUpdated: 'Least recently updated',
      tempHideFab: 'Temporarily hide FAB (shown)', tempShowFab: 'Temporarily show FAB (hidden)',
      contextHideFab: 'Temporarily hide FAB', contextDisableFab: 'Disable FAB display',
      tempTitle: 'Affects this page only; this visibility state is not saved',
      disableFab: 'Disable FAB (enabled)', enableFab: 'Enable FAB (disabled)',
      persistentTitle: 'Save whether the FAB is displayed', searchCurrentSite: 'Search userscripts for this site',
      dialogTitle: 'Userscript search: {{host}}', currentSite: 'Current site', searchAria: 'Userscript search', apiLanguage: 'API language',
      searchPlaceholder: 'Search by name, author, or description', sort: 'Sort', author: 'Author', authorPrefix: 'Author: ', unknown: 'Unknown',
      noDescription: 'No description', score: 'Rating', dailyInstalls: 'Daily installs', totalInstalls: 'Total installs',
      stars: 'Stars', forks: 'Forks', comments: 'Comments',
      created: 'Created', updated: 'Updated', name: 'Name', rating: 'Rating',
      notAvailable: '—',
      authorSeparator: ', ',
      noMatches: 'No matching scripts', noScripts: 'No scripts found for this site', loading: 'Loading scripts…',
      loadingMore: 'Loading more…', loadMore: 'Load more', noMore: 'No more results', backTop: 'Back to top', refresh: 'Refresh', pageError: 'Failed to load more: {{message}}',
      httpError: 'Request failed (HTTP {{status}})', invalidJson: 'The server returned invalid JSON',
      networkError: 'Network request failed', timeout: 'Request timed out', invalidPayload: 'The API returned an invalid data format',
      loadFailed: 'Loading failed', siteNotePrefix: 'Site: {{host}} · Language: {{language}} · Source: ', siteNoteSuffix: ' · Results: {{count}}',
      unnamedScript: 'Unnamed script', unknownAuthor: 'Unknown author', openDialog: 'Open userscript search'
    },
    'zh-CN': {
      languageChinese: '简体中文', languageTraditional: '繁體中文', languageEnglish: 'English', languageJapanese: '日本語',
      topLeft: '左上角', topRight: '右上角', bottomLeft: '左下角', bottomRight: '右下角', relevance: '最佳匹配',
      mostStars: '最多 Stars', fewestStars: '最少 Stars', mostForks: '最多 Forks', fewestForks: '最少 Forks',
      recentlyUpdated: '最近更新', leastRecentlyUpdated: '最久未更新',
      position: '按钮位置', searchDomain: '搜索域名', xOffset: 'X 偏移量', yOffset: 'Y 偏移量',
      tempHideFab: '临时隐藏 FAB（当前：显示）', tempShowFab: '临时显示 FAB（当前：隐藏）',
      contextHideFab: '临时隐藏', contextDisableFab: '关闭显示',
      tempTitle: '仅影响当前页面，不保存此显示状态',
      disableFab: '关闭 FAB 显示（当前：开启）', enableFab: '开启 FAB 显示（当前：关闭）',
      persistentTitle: '保存 FAB 是否显示的设置', searchCurrentSite: '搜索当前网站的用户脚本',
      dialogTitle: '用户脚本搜索：{{host}}', currentSite: '当前网站', searchAria: '用户脚本搜索', apiLanguage: '接口语言',
      searchPlaceholder: '搜索名称、作者或简介', sort: '排序方式', author: '作者', authorPrefix: '作者：', unknown: '未知',
      noDescription: '暂无简介', score: '评分', dailyInstalls: '日安装量', totalInstalls: '总安装量',
      stars: 'Stars', forks: 'Forks', comments: '评论',
      created: '创建', updated: '更新', name: '名称', rating: '得分',
      notAvailable: '—',
      authorSeparator: '、',
      noMatches: '没有匹配的脚本', noScripts: '该网站暂无可用脚本', loading: '正在加载脚本列表…',
      loadingMore: '正在加载更多…', loadMore: '加载更多', noMore: '没有更多结果', backTop: '回到顶部', refresh: '刷新', pageError: '加载更多失败：{{message}}',
      httpError: '请求失败（HTTP {{status}}）', invalidJson: '服务器返回的内容不是有效 JSON',
      networkError: '网络请求失败', timeout: '请求超时', invalidPayload: '接口返回的数据格式不正确',
      loadFailed: '加载失败', siteNotePrefix: '站点：{{host}} · 语言：{{language}} · 数据源：', siteNoteSuffix: ' · 结果数：{{count}}',
      unnamedScript: '未命名脚本', unknownAuthor: '未知作者', openDialog: '打开脚本搜索弹窗'
    },
    ja: {
      languageChinese: '簡体字中国語', languageTraditional: '繁体字中国語', languageEnglish: 'English', languageJapanese: '日本語',
      topLeft: '左上', topRight: '右上', bottomLeft: '左下', bottomRight: '右下', relevance: '最適な一致',
      mostStars: 'スター数が多い順', fewestStars: 'スター数が少ない順', mostForks: 'フォーク数が多い順', fewestForks: 'フォーク数が少ない順',
      recentlyUpdated: '最近更新', leastRecentlyUpdated: '最終更新が古い順',
      position: 'ボタンの位置', searchDomain: '検索ドメイン', xOffset: 'X オフセット', yOffset: 'Y オフセット',
      tempHideFab: '一時的に FAB を非表示（現在：表示）', tempShowFab: '一時的に FAB を表示（現在：非表示）',
      contextHideFab: '一時的に非表示', contextDisableFab: '表示を無効化',
      tempTitle: '現在のページだけに適用され、表示状態は保存されません',
      disableFab: 'FAB を無効化（現在：有効）', enableFab: 'FAB を有効化（現在：無効）',
      persistentTitle: 'FAB の表示設定を保存', searchCurrentSite: 'このサイトのユーザースクリプトを検索',
      dialogTitle: 'ユーザースクリプト検索：{{host}}', currentSite: '現在のサイト', searchAria: 'ユーザースクリプト検索', apiLanguage: 'API 言語',
      searchPlaceholder: '名前、作者、説明を検索', sort: '並び順', author: '作者', authorPrefix: '作者：', unknown: '不明',
      noDescription: '説明なし', score: '評価', dailyInstalls: '1日インストール数', totalInstalls: '累計インストール数',
      stars: 'スター', forks: 'フォーク', comments: 'コメント',
      created: '作成', updated: '更新', name: '名前', rating: '評価',
      notAvailable: '—',
      authorSeparator: '、',
      noMatches: '一致するスクリプトはありません', noScripts: 'このサイトのスクリプトは見つかりません', loading: 'スクリプトを読み込み中…',
      loadingMore: 'さらに読み込み中…', loadMore: 'さらに読み込む', noMore: 'これ以上の結果はありません', backTop: 'トップへ戻る', refresh: '更新', pageError: '追加読み込みに失敗しました：{{message}}',
      httpError: 'リクエストに失敗しました（HTTP {{status}}）', invalidJson: 'サーバーが無効な JSON を返しました',
      networkError: 'ネットワークエラー', timeout: 'リクエストがタイムアウトしました', invalidPayload: 'API のデータ形式が正しくありません',
      loadFailed: '読み込みに失敗しました', siteNotePrefix: 'サイト：{{host}} · 言語：{{language}} · データソース：', siteNoteSuffix: ' · 結果数：{{count}}',
      unnamedScript: '無題のスクリプト', unknownAuthor: '不明な作者', openDialog: 'ユーザースクリプト検索を開く'
    },
    'zh-TW': {
      languageChinese: '簡體中文', languageTraditional: '繁體中文', languageEnglish: 'English', languageJapanese: '日本語',
      topLeft: '左上角', topRight: '右上角', bottomLeft: '左下角', bottomRight: '右下角', relevance: '最佳比對',
      mostStars: '最多 Stars', fewestStars: '最少 Stars', mostForks: '最多 Forks', fewestForks: '最少 Forks',
      recentlyUpdated: '最近更新', leastRecentlyUpdated: '最久未更新',
      position: '按鈕位置', searchDomain: '搜尋網域', xOffset: 'X 偏移量', yOffset: 'Y 偏移量',
      tempHideFab: '暫時隱藏 FAB（目前：顯示）', tempShowFab: '暫時顯示 FAB（目前：隱藏）',
      contextHideFab: '暫時隱藏', contextDisableFab: '關閉顯示',
      tempTitle: '僅影響目前頁面，不會儲存此顯示狀態',
      disableFab: '關閉 FAB 顯示（目前：開啟）', enableFab: '開啟 FAB 顯示（目前：關閉）',
      persistentTitle: '儲存 FAB 是否顯示的設定', searchCurrentSite: '搜尋目前網站的使用者腳本',
      dialogTitle: '使用者腳本搜尋：{{host}}', currentSite: '目前網站', searchAria: '使用者腳本搜尋', apiLanguage: '介面語言',
      searchPlaceholder: '搜尋名稱、作者或簡介', sort: '排序方式', author: '作者', authorPrefix: '作者：', unknown: '未知',
      noDescription: '暫無簡介', score: '評分', dailyInstalls: '每日安裝量', totalInstalls: '總安裝量',
      stars: 'Stars', forks: 'Forks', comments: '評論',
      created: '建立', updated: '更新', name: '名稱', rating: '評分',
      notAvailable: '—', authorSeparator: '、',
      noMatches: '沒有符合的腳本', noScripts: '此網站沒有可用腳本', loading: '正在載入腳本清單…',
      loadingMore: '正在載入更多…', loadMore: '載入更多', noMore: '沒有更多結果', backTop: '回到頂部', refresh: '重新整理', pageError: '載入更多失敗：{{message}}',
      httpError: '請求失敗（HTTP {{status}}）', invalidJson: '伺服器回傳的內容不是有效 JSON',
      networkError: '網路請求失敗', timeout: '請求逾時', invalidPayload: '介面回傳的資料格式不正確',
      loadFailed: '載入失敗', siteNotePrefix: '網站：{{host}} · 語言：{{language}} · 資料來源：', siteNoteSuffix: ' · 結果數：{{count}}',
      unnamedScript: '未命名腳本', unknownAuthor: '未知作者', openDialog: '開啟使用者腳本搜尋'
    }
  };

  function t(key, values = {}) {
    const text = I18N[selectedLanguage]?.[key] || I18N.en[key] || key;
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
  }

  function logInfo(event, details = {}) {
    console.info('[Userscript Search]', event, details);
  }

  function logWarn(event, details = {}) {
    console.warn('[Userscript Search]', event, details);
  }

  function logError(event, error, details = {}) {
    console.error('[Userscript Search]', event, error, details);
  }

  const styleSupport = SchwiDialog.getStyleSupport();

  function resolveLanguage(value) {
    if (LANGUAGES.some(language => language.key === value)) return value;
    const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
      if (/^zh(?:-TW|-HK|-MO|-Hant)(?:-|$)/i.test(candidate)) return 'zh-TW';
      if (/^zh(?:-|$)/i.test(candidate)) return 'zh-CN';
      if (/^ja(?:-|$)/i.test(candidate)) return 'ja';
      if (/^en(?:-|$)/i.test(candidate)) return 'en';
    }
    return 'en';
  }

  const currentHost = location.hostname;
  const domainCandidates = getDomainCandidates(currentHost);
  let selectedHost = domainCandidates[0] || currentHost;
  let selectedLanguage = resolveLanguage(GM_getValue(LANGUAGE_STORAGE_KEY, ''));
  let persistentEnabled = GM_getValue(ENABLED_STORAGE_KEY, true) !== false;
  let fabVisible = persistentEnabled;
  const savedOffset = GM_getValue(OFFSET_STORAGE_KEY, { x: 0, y: 0 });
  let fabOffset = {
    x: Number.isFinite(Number(savedOffset?.x)) ? Number(savedOffset.x) : 0,
    y: Number.isFinite(Number(savedOffset?.y)) ? Number(savedOffset.y) : 0
  };
  const enabledProviders = SITE_PROVIDERS.filter(provider => provider.enable);

  function getDomainCandidates(hostname) {
    if (!hostname || hostname === 'localhost' || /^[\d.:]+$/.test(hostname)) return hostname ? [hostname] : [];
    const labels = hostname.split('.').filter(Boolean);
    return labels.length < 2
      ? [hostname]
      : labels
        .map((_, index) => labels.slice(index).join('.'))
        .filter(domain => domain.split('.').length >= 2)
        .reverse();
  }

  // Provider parameters can reference the current search values by name.
  function buildSearchUrl(provider, sortKey, page) {
    const sortOption = provider.sort.find(option => option.key === sortKey) || provider.sort[0];
    if (provider.urlBuilder) {
      return provider.urlBuilder({
        lang: selectedLanguage,
        host: selectedHost,
        query: searchInput.value.trim(),
        sort: sortOption,
        page
      });
    }
    const values = {
      lang: selectedLanguage,
      host: selectedHost,
      q: searchInput.value.trim(),
      sort: sortOption?.value ?? sortOption?.key ?? '',
      page
    };
    const resolveParam = value => String(value ?? '').replace(/\{(lang|host|q|sort|page)\}/g, (_, key) => String(values[key] ?? ''));
    const path = provider.apiPath.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(resolveParam(provider.pathParams[key])));
    const url = new URL(path, provider.apiHost);
    Object.entries(provider.queryParams).forEach(([key, value]) => {
      const resolved = resolveParam(value);
      if (resolved) url.searchParams.set(key, resolved);
    });
    return url.href;
  }

  function parseGistSearchHtml(html) {
    const document = new DOMParser().parseFromString(html, 'text/html');
    const cards = Array.from(document.querySelectorAll('.gist-snippet'));
    if (!cards.length) {
      const emptyHeading = document.querySelector('#gist-pjax-container .blankslate-heading');
      if (/find any gists matching/i.test(emptyHeading?.textContent || '')) {
        return { items: [], hasMore: false };
      }
      throw new Error(t('invalidPayload'));
    }

    const items = cards.map(card => {
      const scriptFile = Array.from(card.querySelectorAll('[data-tagsearch-path]'))
        .find(element => element.getAttribute('data-tagsearch-path')?.endsWith('.js'));
      if (!scriptFile) return null;

      const fileName = scriptFile.getAttribute('data-tagsearch-path');
      const titleElement = card.querySelector('strong.css-truncate-target');
      const gistLink = titleElement?.closest('a');
      const gistUrl = gistLink?.getAttribute('href');
      const lines = Array.from(scriptFile.querySelectorAll('td.js-file-line'), line => line.textContent.trim());
      const headerValue = key => {
        const expression = new RegExp(`^\\s*//\\s*@${key}(?::[\\w-]+)?\\s+(.+)$`, 'i');
        return lines.map(line => line.match(expression)?.[1]?.trim()).find(Boolean) || '';
      };
      const authorElement = card.querySelector('.gist-snippet-meta [data-hovercard-type="user"][href]');
      const authorName = authorElement?.textContent.trim() || authorElement?.querySelector('img')?.alt.replace(/^@/, '') || '';
      const authorUrl = authorElement?.getAttribute('href');
      const descriptionElement = card.querySelector('.gist-snippet-meta .px-lg-2 > span.f6.color-fg-muted');
      const dateElement = card.querySelector('.gist-snippet-meta relative-time[datetime]');
      const countFor = suffix => {
        const label = card.querySelector(`.gist-snippet-meta a[href$="${suffix}"]`)?.textContent.trim();
        const digits = label?.match(/^([\d,]+)(?=\s|$)/)?.[1];
        return digits ? Number(digits.replace(/,/g, '')) : null;
      };

      return {
        name: headerValue('name') || fileName || titleElement?.textContent.trim() || t('unnamedScript'),
        url: gistUrl ? new URL(gistUrl, 'https://gist.github.com').href : '',
        description: headerValue('description') || descriptionElement?.textContent.trim() || '',
        authors: authorName ? [{
          name: authorName,
          url: authorUrl ? new URL(authorUrl, 'https://gist.github.com').href : ''
        }] : [],
        metadata: {
          stars: countFor('/stargazers'),
          forks: countFor('/forks'),
          comments: countFor('#comments'),
          updatedAt: dateElement?.getAttribute('datetime') || null
        }
      };
    }).filter(item => item?.url);

    const hasMore = Boolean(document.querySelector('.pagination a[rel="next"], a[rel="next"][href*="/search"]'));
    return { items, hasMore };
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function createRequestError(message, details = {}) {
    const error = new Error(message);
    Object.assign(error, details);
    return error;
  }

  function requestJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'text',
        onload: response => {
          const responseDetails = {
            requestUrl: url,
            status: response.status,
            statusText: response.statusText,
            responseHeaders: response.responseHeaders,
            responseText: response.responseText,
            finalUrl: response.finalUrl
          };
          if (response.status < 200 || response.status >= 300) {
            reject(createRequestError(t('httpError', { status: response.status }), responseDetails));
            return;
          }
          try {
            resolve(JSON.parse(response.responseText));
          } catch (parseError) {
            reject(createRequestError(t('invalidJson'), { ...responseDetails, cause: parseError }));
          }
        },
        onerror: response => reject(createRequestError(t('networkError'), { requestUrl: url, response })),
        ontimeout: response => reject(createRequestError(t('timeout'), { requestUrl: url, response }))
      });
    });
  }

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'text',
        onload: response => {
          if (response.status < 200 || response.status >= 300) {
            reject(createRequestError(t('httpError', { status: response.status }), {
              requestUrl: url,
              status: response.status,
              statusText: response.statusText,
              finalUrl: response.finalUrl
            }));
            return;
          }
          resolve(response.responseText);
        },
        onerror: response => reject(createRequestError(t('networkError'), { requestUrl: url, response })),
        ontimeout: response => reject(createRequestError(t('timeout'), { requestUrl: url, response }))
      });
    });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(selectedLanguage);
  }

  function formatOptionalNumber(value) {
    return value == null ? t('notAvailable') : formatNumber(value);
  }

  function formatDate(value) {
    if (!value) return t('notAvailable');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('notAvailable') : date.toLocaleString(selectedLanguage, {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  }

  function formatMetadataValue(value, format) {
    if (format === 'date') return formatDate(value);
    if (format === 'number') return formatNumber(value);
    if (format === 'optionalNumber') return formatOptionalNumber(value);
    if (format === 'rating') return value == null || Number.isNaN(value) ? t('notAvailable') : value.toFixed(1);
    return value == null ? t('notAvailable') : String(value);
  }

  function addText(parent, label, value) {
    const item = document.createElement('span');
    item.className = 'meta-item';
    item.textContent = `${label} ${value}`;
    parent.append(item);
  }

  function addLink(parent, text, url, className) {
    const link = document.createElement('a');
    const targetUrl = safeUrl(url);
    link.textContent = text || t('unknown');
    link.className = className || '';
    if (!targetUrl) {
      link.removeAttribute('href');
    } else {
      link.href = targetUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.addEventListener('click', () => logInfo('result link opened', { text: link.textContent, url: link.href }));
    }
    parent.append(link);
  }

  function createStyle() {
    return `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .search-app { color: #202124; font: 14px/1.5 Arial, "Microsoft YaHei", sans-serif; }
      .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
      .toolbar input { flex: 1 1 220px; min-width: 160px; height: 36px; padding: 0 10px; border: 1px solid #c7cbd1; border-radius: 4px; color: inherit; font: inherit; }
      .toolbar select, .toolbar button { height: 36px; padding: 0 10px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: inherit; font: inherit; }
      .language-select { height: 30px; max-width: 130px; margin-left: 10px; padding: 0 6px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: #202124; font: 13px Arial, "Microsoft YaHei", sans-serif; }
      .toolbar button { width: 36px; padding: 0; cursor: pointer; font-size: 20px; line-height: 1; }
      .toolbar button:hover { background: #f1f3f4; }
      .corner-settings, .domain-settings { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin: 0 0 10px; padding: 0; border: 0; }
      .corner-settings legend, .domain-settings legend { margin-bottom: 4px; color: #5f6368; font-size: 12px; }
      .corner-settings label, .domain-settings label { display: inline-flex; align-items: center; gap: 4px; color: #3c4043; cursor: pointer; }
      .offset-controls { display: inline-flex; align-items: center; gap: 6px; margin-left: 2px; color: #5f6368; font-size: 12px; }
      .offset-controls label { gap: 3px; }
      .offset-controls input { width: 64px; height: 30px; padding: 0 6px; border: 1px solid #c7cbd1; border-radius: 4px; color: #202124; font: inherit; }
      .corner-actions { display: flex; flex-basis: 100%; flex-wrap: wrap; gap: 8px; }
      .corner-action { height: 30px; padding: 0 9px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: #3c4043; cursor: pointer; font: inherit; white-space: nowrap; }
      .corner-action:hover { background: #f1f3f4; }
      .tab:hover { background: #f1f3f4; }
      .tabs { display: flex; gap: 4px; overflow-x: auto; border-bottom: 1px solid #d9dce1; margin-bottom: 12px; }
      .tab { flex: 0 0 auto; padding: 8px 12px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #5f6368; cursor: pointer; font: inherit; }
      .tab.active { border-bottom-color: #1a73e8; color: #1967d2; font-weight: 600; }
      .status { padding: 24px 8px; color: #5f6368; text-align: center; }
      .status.error { color: #b3261e; }
      .result-list { display: grid; gap: 10px; }
      .result-footer { display: flex; justify-content: center; gap: 8px; padding: 12px 0 4px; }
      .result-footer button { min-height: 34px; padding: 0 12px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: #3c4043; cursor: pointer; font: inherit; }
      .result-footer button:hover:not(:disabled) { background: #f1f3f4; }
      .result-footer button:disabled { cursor: default; opacity: 0.65; }
      .result-footer .error { align-self: center; color: #b3261e; font-size: 12px; }
      .result { padding: 12px; border: 1px solid #e0e3e7; border-radius: 5px; background: #fff; }
      .result-title { margin: 0 0 4px; font-size: 16px; line-height: 1.35; }
      .result-title a, .author a { color: #1967d2; text-decoration: none; }
      .result-title a:hover, .author a:hover { text-decoration: underline; }
      .author { margin-bottom: 7px; color: #5f6368; font-size: 13px; }
      .description { margin: 0 0 8px; color: #3c4043; white-space: pre-wrap; overflow-wrap: anywhere; }
      .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; color: #5f6368; font-size: 12px; }
      .note { margin: 0 0 10px; color: #5f6368; font-size: 12px; }
      .note a { color: #1967d2; text-decoration: none; }
      .note a:hover { text-decoration: underline; }
      @media (max-width: 560px) { .result { padding: 10px; } .toolbar input { flex-basis: 100%; } }
    `;
  }

  function applyCorner(host, corner) {
    const valid = CORNERS.some(item => item.key === corner) ? corner : 'bottom-left';
    host.dataset.corner = valid;
    host.style.top = valid.startsWith('top') ? '16px' : '';
    host.style.bottom = valid.startsWith('bottom') ? '16px' : '';
    host.style.left = valid.endsWith('left') ? '16px' : '';
    host.style.right = valid.endsWith('right') ? '16px' : '';
    GM_setValue(STORAGE_KEY, valid);
  }

  function applyFabOffset() {
    host.style.transform = `translate(${fabOffset.x}px, ${fabOffset.y}px)`;
  }

  function clampFabOffset() {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const x = Math.round(fabOffset.x + Math.max(0, Math.min(rect.left, window.innerWidth - rect.width)) - rect.left);
    const y = Math.round(fabOffset.y + Math.max(0, Math.min(rect.top, window.innerHeight - rect.height)) - rect.top);
    if (x === fabOffset.x && y === fabOffset.y) return false;
    fabOffset = { x, y };
    applyFabOffset();
    return true;
  }

  const host = document.createElement('iframe');
  host.title = t('searchCurrentSite');
  Object.assign(host.style, {
    all: 'initial', position: 'fixed', zIndex: '2147483646',
    width: '52px', height: '52px', border: '0', background: 'transparent'
  });
  document.body.append(host);
  const fabDocument = host.contentDocument;
  fabDocument.documentElement.style.margin = '0';
  fabDocument.documentElement.style.overflow = 'hidden';
  fabDocument.body.style.margin = '0';
  fabDocument.body.style.overflow = 'hidden';
  const fabButton = fabDocument.createElement('button');
  fabButton.type = 'button';
  fabButton.textContent = 'JS';
  fabButton.title = t('searchCurrentSite');
  fabButton.setAttribute('aria-label', t('searchCurrentSite'));
  Object.assign(fabButton.style, {
    width: '52px', height: '52px', padding: '0', border: '0', borderRadius: '50%',
    background: '#1967d2', boxShadow: 'none',
    color: '#fff', cursor: 'pointer', touchAction: 'none', userSelect: 'none',
    font: '700 15px Arial, sans-serif'
  });
  fabDocument.body.append(fabButton);
  fabButton.addEventListener('pointerenter', () => { fabButton.style.background = '#1557b0'; });
  fabButton.addEventListener('pointerleave', () => { fabButton.style.background = '#1967d2'; });
  fabButton.addEventListener('focus', () => {
    if (!fabButton.matches(':focus-visible')) return;
    fabButton.style.outline = '3px solid #8ab4f8';
    fabButton.style.outlineOffset = '-3px';
  });
  fabButton.addEventListener('blur', () => { fabButton.style.outline = ''; });
  fabButton.addEventListener('dragstart', event => event.preventDefault());
  fabButton.addEventListener('selectstart', event => event.preventDefault());
  const savedCorner = GM_getValue(STORAGE_KEY, 'bottom-left');
  applyCorner(host, savedCorner);
  applyFabOffset();
  host.hidden = !fabVisible;
  host.style.display = fabVisible ? 'block' : 'none';
  if (clampFabOffset()) GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
  logInfo('initialized', {
    host: currentHost,
    selectedHost,
    language: selectedLanguage,
    corner: host.dataset.corner,
    offset: { ...fabOffset },
    fabVisible,
    providers: enabledProviders.map(provider => provider.name)
  });

  if (!enabledProviders.length) {
    logWarn('No enabled providers; FAB is disabled');
    fabButton.disabled = true;
    return;
  }

  logInfo('dialog initialization started');
  const dialog = await SchwiDialog.createDialog('min(94vw, 980px)', '86vh', {
    title: t('dialogTitle', { host: currentHost || t('currentSite') }),
    ariaLabel: t('searchAria'),
    closeOnBackdropClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    draggable: true,
    onshow: () => logInfo('dialog shown'),
    onclose: () => logInfo('dialog closed')
  });
  logInfo('dialog initialized');
  const languageSelect = document.createElement('select');
  languageSelect.className = 'language-select';
  languageSelect.setAttribute('aria-label', t('apiLanguage'));
  languageSelect.title = t('apiLanguage');
  LANGUAGES.forEach(language => {
    const option = document.createElement('option');
    option.value = language.key;
    option.textContent = t(language.labelKey);
    option.selected = language.key === selectedLanguage;
    languageSelect.append(option);
  });
  languageSelect.addEventListener('change', () => {
    selectedLanguage = languageSelect.value;
    GM_setValue(LANGUAGE_STORAGE_KEY, selectedLanguage);
    logInfo('language changed', { language: selectedLanguage });
    refreshTexts();
    loadResults();
  });
  const dialogHeader = dialog.element.querySelector('header');
  const closeButton = dialogHeader?.querySelector('.close');
  if (dialogHeader) dialogHeader.insertBefore(languageSelect, closeButton || null);
  const app = document.createElement('div');
  app.className = 'search-app';
  dialog.content.append(app);
  SchwiDialog.installStyles(app, createStyle(), styleSupport);

  const cornerSettings = document.createElement('fieldset');
  cornerSettings.className = 'corner-settings';
  const cornerLegend = document.createElement('legend');
  cornerLegend.textContent = t('position');
  cornerSettings.append(cornerLegend);
  const cornerLabels = [];
  CORNERS.forEach(corner => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'script-search-corner';
    radio.value = corner.key;
    radio.checked = host.dataset.corner === corner.key;
    radio.addEventListener('change', () => {
      applyCorner(host, radio.value);
      if (clampFabOffset()) {
        offsetLabels.forEach(({ axis, input }) => { input.value = String(fabOffset[axis]); });
        GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
      }
      logInfo('FAB corner changed', { corner: radio.value });
    });
    const text = document.createTextNode(t(corner.labelKey));
    label.append(radio, text);
    cornerLabels.push({ label, text, corner });
    cornerSettings.append(label);
  });

  const offsetControls = document.createElement('span');
  offsetControls.className = 'offset-controls';
  const offsetLabels = [];
  ['x', 'y'].forEach(axis => {
    const label = document.createElement('label');
    const text = document.createTextNode('');
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = String(fabOffset[axis]);
    input.setAttribute('aria-label', t(`${axis}Offset`));
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!Number.isFinite(value)) return;
      fabOffset[axis] = value;
      applyFabOffset();
      GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
    });
    input.addEventListener('change', () => {
      if (!Number.isFinite(Number(input.value))) input.value = String(fabOffset[axis]);
      logInfo('FAB offset changed', { axis, value: fabOffset[axis], offset: { ...fabOffset } });
    });
    label.append(text, input);
    offsetLabels.push({ axis, label, text, input });
    offsetControls.append(label);
  });
  cornerSettings.append(offsetControls);

  let drag = null;
  let suppressDragClick = false;
  let offsetSyncFrame = 0;
  function syncFabOffset(immediate = false) {
    if (immediate) {
      if (offsetSyncFrame) cancelAnimationFrame(offsetSyncFrame);
      offsetSyncFrame = 0;
      GM_setValue(OFFSET_STORAGE_KEY, { ...fabOffset });
    } else if (!offsetSyncFrame) offsetSyncFrame = requestAnimationFrame(() => {
      offsetSyncFrame = 0;
      GM_setValue(OFFSET_STORAGE_KEY, { ...fabOffset });
    });
  }

  GM_addValueChangeListener(OFFSET_STORAGE_KEY, (_key, _oldValue, value, remote) => {
    if (!remote || drag || !value || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) return;
    fabOffset = { x: Number(value.x), y: Number(value.y) };
    applyFabOffset();
    clampFabOffset();
    offsetLabels.forEach(({ axis, input }) => { input.value = String(fabOffset[axis]); });
  });
  fabButton.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    suppressDragClick = false;
    drag = { id: event.pointerId, x: event.screenX, y: event.screenY, offset: { ...fabOffset }, moved: false };
    fabButton.setPointerCapture(event.pointerId);
  });
  fabButton.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.screenX - drag.x;
    const dy = event.screenY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    suppressDragClick = true;
    fabOffset = { x: Math.round(drag.offset.x + dx), y: Math.round(drag.offset.y + dy) };
    applyFabOffset();
    clampFabOffset();
    syncFabOffset();
    event.preventDefault();
  });
  fabButton.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved) {
      offsetLabels.forEach(({ axis, input }) => { input.value = String(fabOffset[axis]); });
      syncFabOffset(true);
      logInfo('FAB dragged', { offset: { ...fabOffset } });
    }
    drag = null;
  });
  fabButton.addEventListener('pointercancel', event => {
    if (!drag || event.pointerId !== drag.id) return;
    fabOffset = drag.offset;
    applyFabOffset();
    if (drag.moved) syncFabOffset(true);
    drag = null;
    suppressDragClick = false;
  });
  window.addEventListener('resize', () => {
    if (!clampFabOffset()) return;
    offsetLabels.forEach(({ axis, input }) => { input.value = String(fabOffset[axis]); });
    GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
  });

  const temporaryButton = document.createElement('button');
  temporaryButton.type = 'button';
  temporaryButton.className = 'corner-action';
  temporaryButton.addEventListener('click', () => setTemporaryFabVisibility(!fabVisible));
  const persistentButton = document.createElement('button');
  persistentButton.type = 'button';
  persistentButton.className = 'corner-action';
  persistentButton.addEventListener('click', () => setPersistentFabEnabled(!persistentEnabled, 'dialog'));
  const cornerActions = document.createElement('span');
  cornerActions.className = 'corner-actions';
  cornerActions.append(temporaryButton, persistentButton);
  cornerSettings.append(cornerActions);

  const domainSettings = document.createElement('fieldset');
  domainSettings.className = 'domain-settings';
  const domainLegend = document.createElement('legend');
  domainLegend.textContent = t('searchDomain');
  domainSettings.append(domainLegend);
  const domainLabels = [];
  domainCandidates.forEach(domain => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'script-search-domain';
    radio.value = domain;
    radio.checked = domain === selectedHost;
    radio.addEventListener('change', () => {
      selectedHost = radio.value;
      logInfo('search domain changed', { host: selectedHost });
      loadResults();
    });
    const text = document.createTextNode(domain);
    label.append(radio, text);
    domainLabels.push({ text, domain });
    domainSettings.append(label);
  });

  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.placeholder = t('searchPlaceholder');
  searchInput.setAttribute('aria-label', t('searchPlaceholder'));
  const sortSelect = document.createElement('select');
  sortSelect.setAttribute('aria-label', t('sort'));
  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.textContent = '↻';
  refreshButton.setAttribute('aria-label', t('refresh'));
  refreshButton.title = t('refresh');
  toolbar.append(searchInput, sortSelect, refreshButton);
  const note = document.createElement('p');
  note.className = 'note';
  const results = document.createElement('div');
  results.className = 'result-list';
  app.append(cornerSettings);
  if (domainCandidates.length > 1) app.append(domainSettings);
  app.append(tabs, toolbar, note, results);

  let activeProvider = enabledProviders[0];
  let activeSortKey = '';
  let allItems = [];
  let activePage = 0;
  let hasMore = true;
  let isLoading = false;
  let pageError = '';
  let lastStatusKey = '';
  let requestId = 0;
  const cache = new Map();
  let searchTimer;

  let persistentMenuId;
  let openMenuId;

  const contextHost = document.createElement('div');
  contextHost.hidden = true;
  Object.assign(contextHost.style, { position: 'fixed', zIndex: '2147483647' });
  const contextRoot = contextHost.attachShadow({ mode: 'closed' });
  const contextStyle = document.createElement('style');
  contextStyle.textContent = `
    :host([hidden]) { display: none; }
    .menu { min-width: min(176px, 100vw); max-width: 100vw; box-sizing: border-box;
      padding: 4px; border: 1px solid #dadce0; border-radius: 6px;
      background: #fff; box-shadow: 0 4px 14px #0003; font: 14px Arial, sans-serif; }
    button { display: block; width: 100%; min-height: 36px; padding: 7px 12px; border: 0;
      border-radius: 4px; background: transparent; color: #202124; cursor: pointer;
      font: inherit; text-align: start; }
    button:hover, button:focus-visible { background: #e8f0fe; outline: none; }
  `;
  const contextMenu = document.createElement('div');
  contextMenu.className = 'menu';
  contextMenu.setAttribute('role', 'menu');
  const contextItems = [
    { labelKey: 'openDialog', action: () => openDialog('FAB context menu') },
    { labelKey: 'contextHideFab', action: () => setTemporaryFabVisibility(false) },
    { labelKey: 'contextDisableFab', action: () => setPersistentFabEnabled(false, 'FAB context menu') }
  ].map(({ labelKey, action }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.addEventListener('click', () => {
      closeContextMenu();
      action();
    });
    contextMenu.append(button);
    return { button, labelKey };
  });
  contextMenu.addEventListener('keydown', event => {
    const currentIndex = contextItems.findIndex(({ button }) => button === event.target);
    if (currentIndex < 0) return;
    let nextIndex;
    if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % contextItems.length;
    else if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + contextItems.length) % contextItems.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = contextItems.length - 1;
    else return;
    event.preventDefault();
    contextItems[nextIndex].button.focus();
  });
  contextRoot.append(contextStyle, contextMenu);
  document.body.append(contextHost);

  function closeContextMenu() {
    contextHost.hidden = true;
  }

  fabButton.addEventListener('contextmenu', event => {
    event.preventDefault();
    contextItems.forEach(({ button, labelKey }) => { button.textContent = t(labelKey); });
    contextHost.hidden = false;
    const fabRect = host.getBoundingClientRect();
    const x = fabRect.left + (event.clientX || fabRect.width / 2);
    const y = fabRect.top + (event.clientY || fabRect.height / 2);
    const menuRect = contextHost.getBoundingClientRect();
    contextHost.style.left = `${Math.max(0, Math.min(x, window.innerWidth - menuRect.width))}px`;
    contextHost.style.top = `${Math.max(0, Math.min(y, window.innerHeight - menuRect.height))}px`;
    contextItems[0].button.focus();
  });
  document.addEventListener('pointerdown', event => {
    if (!contextHost.hidden && !event.composedPath().includes(contextHost)) closeContextMenu();
  });
  fabDocument.addEventListener('pointerdown', () => closeContextMenu());
  document.addEventListener('keydown', event => {
    if (contextHost.hidden || event.key !== 'Escape') return;
    closeContextMenu();
    fabButton.focus();
  });
  window.addEventListener('resize', closeContextMenu);
  window.addEventListener('scroll', closeContextMenu, true);

  function refreshTexts() {
    dialog.setTitle(t('dialogTitle', { host: currentHost || t('currentSite') }));
    host.title = fabButton.title = t('searchCurrentSite');
    fabButton.setAttribute('aria-label', t('searchCurrentSite'));
    languageSelect.setAttribute('aria-label', t('apiLanguage'));
    languageSelect.title = t('apiLanguage');
    Array.from(languageSelect.options).forEach((option, index) => {
      option.textContent = t(LANGUAGES[index].labelKey);
      option.selected = LANGUAGES[index].key === selectedLanguage;
    });
    cornerLegend.textContent = t('position');
    cornerLabels.forEach(({ text, corner }) => { text.nodeValue = t(corner.labelKey); });
    offsetLabels.forEach(({ axis, text, input }) => {
      text.nodeValue = `${t(`${axis}Offset`)}:`;
      input.setAttribute('aria-label', t(`${axis}Offset`));
    });
    domainLegend.textContent = t('searchDomain');
    searchInput.placeholder = t('searchPlaceholder');
    searchInput.setAttribute('aria-label', t('searchPlaceholder'));
    sortSelect.setAttribute('aria-label', t('sort'));
    refreshButton.setAttribute('aria-label', t('refresh'));
    refreshButton.title = t('refresh');
    contextItems.forEach(({ button, labelKey }) => { button.textContent = t(labelKey); });
    renderSortOptions();
    updateFabState();
    if (allItems.length) renderItems();
  }

  function setTemporaryFabVisibility(visible) {
    fabVisible = visible;
    logInfo('FAB visibility changed temporarily', { visible: fabVisible });
    updateFabState();
  }

  function setPersistentFabEnabled(enabled, source) {
    persistentEnabled = enabled;
    fabVisible = enabled;
    GM_setValue(ENABLED_STORAGE_KEY, enabled);
    logInfo('persistent FAB setting changed', { enabled, source });
    updateFabState();
  }

  function updateFabState() {
    if (!fabVisible) closeContextMenu();
    host.hidden = !fabVisible;
    host.style.display = fabVisible ? 'block' : 'none';
    if (fabVisible && clampFabOffset()) {
      offsetLabels.forEach(({ axis, input }) => { input.value = String(fabOffset[axis]); });
      GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
    }
    temporaryButton.textContent = fabVisible ? t('tempHideFab') : t('tempShowFab');
    temporaryButton.title = t('tempTitle');
    persistentButton.textContent = persistentEnabled ? t('disableFab') : t('enableFab');
    persistentButton.title = t('persistentTitle');
    updateMenuCommands();
  }

  function updateMenuCommands() {
    if (typeof GM_unregisterMenuCommand === 'function') {
      if (persistentMenuId != null) GM_unregisterMenuCommand(persistentMenuId);
      if (openMenuId != null) GM_unregisterMenuCommand(openMenuId);
    }
    persistentMenuId = GM_registerMenuCommand(
      persistentEnabled ? t('disableFab') : t('enableFab'),
      () => setPersistentFabEnabled(!persistentEnabled, 'userscript menu')
    );
    openMenuId = GM_registerMenuCommand(
      t('openDialog'),
      () => openDialog('userscript menu')
    );
  }

  function setStatus(message, error = false, count = allItems.length) {
    const statusKey = JSON.stringify([message, error, count]);
    if (statusKey !== lastStatusKey) {
      lastStatusKey = statusKey;
      logInfo('status changed', { message, error, count });
    }
    updateNote(count);
    results.replaceChildren();
    const status = document.createElement('div');
    status.className = `status${error ? ' error' : ''}`;
    status.textContent = message;
    results.append(status);
  }

  function renderItems() {
    const query = activeProvider.serverSearchOnly ? '' : searchInput.value.trim().toLocaleLowerCase();
    const filtered = allItems.filter(item => {
      const authorNames = (item.authors || []).map(author => author.name).join(' ');
      const text = [item.name, item.description, authorNames].join(' ').toLocaleLowerCase();
      return !query || text.includes(query);
    });
    results.replaceChildren();
    updateNote(filtered.length);
    if (!filtered.length) {
      setStatus(query ? t('noMatches') : t('noScripts'), false, filtered.length);
      if (hasMore || pageError) renderResultFooter();
      return;
    }
    const fragment = document.createDocumentFragment();
    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = 'result';
      const title = document.createElement('h3');
      title.className = 'result-title';
      addLink(title, item.name, item.url);
      const author = document.createElement('div');
      author.className = 'author';
      author.append(t('authorPrefix'));
      if (item.authors?.length) {
        item.authors.forEach((entry, index) => {
          if (index > 0) author.append(t('authorSeparator'));
          addLink(author, entry.name, entry.url);
        });
      } else {
        author.append(t('unknown'));
      }
      const description = document.createElement('p');
      description.className = 'description';
      description.textContent = item.description || t('noDescription');
      const meta = document.createElement('div');
      meta.className = 'meta';
      activeProvider.metadata.forEach(({ labelKey, valueKey, format }) => {
        addText(meta, t(labelKey), formatMetadataValue(item.metadata?.[valueKey], format));
      });
      card.append(title, author, description, meta);
      fragment.append(card);
    });
    results.append(fragment);
    renderResultFooter();
  }

  function updateNote(count = allItems.length) {
    const values = {
      host: selectedHost || t('currentSite'),
      language: t(LANGUAGES.find(language => language.key === selectedLanguage)?.labelKey || 'languageEnglish'),
      count: formatNumber(count)
    };
    note.replaceChildren(document.createTextNode(t('siteNotePrefix', values)));
    addLink(note, activeProvider.name, buildSearchUrl(activeProvider, activeSortKey, 1));
    note.append(t('siteNoteSuffix', values));
  }

  function renderResultFooter() {
    const footer = document.createElement('div');
    footer.className = 'result-footer';
    if (pageError) {
      const error = document.createElement('span');
      error.className = 'error';
      error.textContent = t('pageError', { message: pageError });
      footer.append(error);
    }
    const loadMoreButton = document.createElement('button');
    loadMoreButton.type = 'button';
    loadMoreButton.textContent = isLoading ? t('loadingMore') : hasMore ? t('loadMore') : t('noMore');
    loadMoreButton.disabled = isLoading || !hasMore;
    loadMoreButton.addEventListener('click', () => {
      logInfo('load more clicked', { provider: activeProvider.name, nextPage: activePage + 1 });
      loadResults(false);
    });
    const backTopButton = document.createElement('button');
    backTopButton.type = 'button';
    backTopButton.textContent = '↑';
    backTopButton.title = t('backTop');
    backTopButton.setAttribute('aria-label', t('backTop'));
    backTopButton.addEventListener('click', () => {
      logInfo('back to top clicked');
      dialog.content.scrollTo({ top: 0, behavior: 'smooth' });
    });
    footer.append(loadMoreButton, backTopButton);
    results.append(footer);
  }

  function renderTabs() {
    tabs.replaceChildren();
    enabledProviders.forEach(provider => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = `tab${provider === activeProvider ? ' active' : ''}`;
      tab.textContent = provider.name;
      tab.setAttribute('aria-selected', String(provider === activeProvider));
      tab.addEventListener('click', () => {
        if (provider === activeProvider) return;
        activeProvider = provider;
        activeSortKey = provider.sort[0]?.key || '';
        logInfo('provider changed', { provider: provider.name });
        renderTabs();
        renderSortOptions();
        loadResults();
      });
      tabs.append(tab);
    });
  }

  function renderSortOptions() {
    sortSelect.replaceChildren();
    activeProvider.sort.forEach(option => {
      const element = document.createElement('option');
      element.value = option.key;
      element.textContent = t(option.labelKey);
      element.selected = option.key === activeSortKey;
      sortSelect.append(element);
    });
  }

  async function loadResults(reset = true) {
    return loadPage(reset);
  }

  async function loadPage(reset) {
    if (!reset && (isLoading || !hasMore)) {
      logInfo('load more skipped', { isLoading, hasMore, provider: activeProvider.name });
      return;
    }
    const currentRequest = ++requestId;
    const cacheKey = getCacheKey();
    if (reset) {
      activePage = 0;
      hasMore = true;
      allItems = [];
      pageError = '';
      const cached = cache.get(cacheKey);
      if (cached) {
        allItems = cached.items;
        activePage = cached.page;
        hasMore = cached.hasMore;
        isLoading = false;
        refreshButton.disabled = false;
        logInfo('results loaded from cache', {
          provider: activeProvider.name,
          host: selectedHost,
          query: searchInput.value.trim(),
          count: allItems.length,
          page: activePage,
          hasMore
        });
        renderItems();
        return;
      }
      setStatus(t('loading'));
    } else {
      pageError = '';
      isLoading = true;
      renderItems();
    }
    isLoading = true;
    refreshButton.disabled = true;
    const page = activePage + 1;
    const requestProvider = activeProvider;
    const providerName = requestProvider.name;
    const requestUrl = buildSearchUrl(requestProvider, activeSortKey, page);
    logInfo('loading started', { provider: providerName, page, reset, host: selectedHost, query: searchInput.value.trim(), url: requestUrl });
    try {
      const response = requestProvider.parseResponse
        ? await requestText(requestUrl)
        : await requestJson(requestUrl);
      const parsed = requestProvider.parseResponse
        ? requestProvider.parseResponse(response)
        : { items: response, hasMore: response.length > 0 };
      if (currentRequest !== requestId) {
        logInfo('stale loading result ignored', { provider: providerName, page, requestId: currentRequest, activeRequestId: requestId });
        return;
      }
      if (!Array.isArray(parsed?.items)) throw new Error(t('invalidPayload'));
      const pageItems = requestProvider.result
        ? parsed.items.map(requestProvider.result).filter(Boolean)
        : parsed.items.filter(Boolean);
      allItems = reset ? pageItems : allItems.concat(pageItems);
      activePage = page;
      hasMore = typeof parsed.hasMore === 'boolean' ? parsed.hasMore : pageItems.length > 0;
      pageError = '';
      cache.set(cacheKey, { items: allItems, page: activePage, hasMore });
      isLoading = false;
      refreshButton.disabled = false;
      logInfo('loading completed', {
        provider: providerName,
        page,
        received: pageItems.length,
        total: allItems.length,
        hasMore
      });
      renderItems();
    } catch (error) {
      logError('loading failed', error, {
        provider: providerName,
        page,
        reset,
        url: requestUrl
      });
      if (currentRequest !== requestId) {
        logInfo('stale loading error ignored', { provider: providerName, page, requestId: currentRequest, activeRequestId: requestId });
        return;
      }
      isLoading = false;
      refreshButton.disabled = false;
      if (reset) {
        allItems = [];
        hasMore = false;
        setStatus(error.message || t('loadFailed'), true);
      } else {
        pageError = error.message || t('loadFailed');
        renderItems();
      }
    }
  }

  function getCacheKey() {
    return `${selectedLanguage}:${selectedHost}:${activeProvider.name}:${activeSortKey}:${searchInput.value.trim()}`;
  }

  searchInput.addEventListener('input', () => {
    renderItems();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      logInfo('search submitted', { query: searchInput.value.trim() });
      loadResults();
    }, 300);
  });
  sortSelect.addEventListener('change', () => {
    activeSortKey = sortSelect.value;
    logInfo('sort changed', { sort: activeSortKey });
    loadResults();
  });
  refreshButton.addEventListener('click', () => {
    cache.delete(getCacheKey());
    logInfo('refresh clicked', { provider: activeProvider.name, host: selectedHost, query: searchInput.value.trim() });
    loadResults();
  });
  function openDialog(source = 'FAB button') {
    logInfo('open dialog requested', { source });
    dialog.show();
    loadResults();
  }

  fabButton.addEventListener('click', event => {
    if (suppressDragClick && event.detail !== 0) {
      suppressDragClick = false;
      return;
    }
    openDialog();
  });
  activeSortKey = activeProvider.sort[0]?.key || '';
  renderTabs();
  refreshTexts();
})();
