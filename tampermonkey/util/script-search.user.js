// ==UserScript==
// @name         Userscript Search
// @name:en      Userscript Search
// @name:zh-CN   用户脚本搜索
// @name:ja      ユーザースクリプト検索
// @namespace    Schwi
// @version      1.0.0
// @description  Search userscripts for the current site from a floating action button.
// @description:en      Search userscripts for the current site from a floating action button.
// @description:zh-CN  从浮动按钮搜索当前网站可用的用户脚本。
// @description:ja     フローティングボタンから現在のサイトで利用できるユーザースクリプトを検索します。
// @match        *://*/*
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @connect      api.greasyfork.org
// @connect      api.sleazyfork.org
// @grant        GM_getValue
// @grant        GM_setValue
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
    sort: [
      { labelKey: 'dailyInstalls', key: '' },
      { labelKey: 'totalInstalls', key: 'total_installs' },
      { labelKey: 'rating', key: 'ratings' },
      { labelKey: 'created', key: 'created' },
      { labelKey: 'updated', key: 'updated' },
      { labelKey: 'name', key: 'name' }
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
        rating: item.fan_score == null ? null : Number(item.fan_score),
        ratingCounts: {
          good: item.good_ratings || 0,
          ok: item.ok_ratings || 0,
          bad: item.bad_ratings || 0
        },
        dailyInstalls: item.daily_installs || 0,
        totalInstalls: item.total_installs || 0,
        createdAt: item.created_at,
        updatedAt: item.code_updated_at
      };
    },
    enable: true
  };

  const SITE_PROVIDERS = [
    {
      name: 'Greasy Fork',
      search: 'https://api.greasyfork.org/{lang}/scripts/by-site/{q}.json?sort={sort}&page={page}',
      ...SHARED_PROVIDER_CONFIG
    },
    {
      name: 'Sleazy Fork',
      search: 'https://api.sleazyfork.org/{lang}/scripts/by-site/{q}.json?sort={sort}&page={page}',
      ...SHARED_PROVIDER_CONFIG
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
    { key: 'en', labelKey: 'languageEnglish' },
    { key: 'ja', labelKey: 'languageJapanese' }
  ];
  const I18N = {
    en: {
      languageChinese: 'Simplified Chinese', languageEnglish: 'English', languageJapanese: 'Japanese',
      topLeft: 'Top left', topRight: 'Top right', bottomLeft: 'Bottom left', bottomRight: 'Bottom right',
      position: 'Button position', searchDomain: 'Search domain', xOffset: 'X offset', yOffset: 'Y offset',
      tempHideFab: 'Temporarily hide FAB (shown)', tempShowFab: 'Temporarily show FAB (hidden)',
      tempTitle: 'Affects this page only; this visibility state is not saved',
      disableFab: 'Disable FAB (enabled)', enableFab: 'Enable FAB (disabled)',
      persistentTitle: 'Save whether the FAB is displayed', searchCurrentSite: 'Search userscripts for this site',
      dialogTitle: 'Userscript search: {{host}}', currentSite: 'Current site', searchAria: 'Userscript search', apiLanguage: 'API language',
      searchPlaceholder: 'Search by name, author, or description', sort: 'Sort', author: 'Author', authorPrefix: 'Author: ', unknown: 'Unknown',
      noDescription: 'No description', score: 'Rating', dailyInstalls: 'Daily installs', totalInstalls: 'Total installs',
      created: 'Created', updated: 'Updated', name: 'Name', rating: 'Rating',
      notAvailable: '—',
      authorSeparator: ', ',
      noMatches: 'No matching scripts', noScripts: 'No scripts found for this site', loading: 'Loading scripts…',
      loadingMore: 'Loading more…', loadMore: 'Load more', noMore: 'No more results', backTop: 'Back to top', refresh: 'Refresh', pageError: 'Failed to load more: {{message}}',
      httpError: 'Request failed (HTTP {{status}})', invalidJson: 'The server returned invalid JSON',
      networkError: 'Network request failed', timeout: 'Request timed out', invalidPayload: 'The API returned an invalid data format',
      loadFailed: 'Loading failed', siteNote: 'Site: {{host}} · Language: {{language}} · Source: {{provider}} · Results: {{count}}',
      unnamedScript: 'Unnamed script', unknownAuthor: 'Unknown author', openDialog: 'Open userscript search'
    },
    'zh-CN': {
      languageChinese: '简体中文', languageEnglish: 'English', languageJapanese: '日本語',
      topLeft: '左上角', topRight: '右上角', bottomLeft: '左下角', bottomRight: '右下角',
      position: '按钮位置', searchDomain: '搜索域名', xOffset: 'X 偏移量', yOffset: 'Y 偏移量',
      tempHideFab: '临时隐藏 FAB（当前：显示）', tempShowFab: '临时显示 FAB（当前：隐藏）',
      tempTitle: '仅影响当前页面，不保存此显示状态',
      disableFab: '关闭 FAB 显示（当前：开启）', enableFab: '开启 FAB 显示（当前：关闭）',
      persistentTitle: '保存 FAB 是否显示的设置', searchCurrentSite: '搜索当前网站的用户脚本',
      dialogTitle: '用户脚本搜索：{{host}}', currentSite: '当前网站', searchAria: '用户脚本搜索', apiLanguage: '接口语言',
      searchPlaceholder: '搜索名称、作者或简介', sort: '排序方式', author: '作者', authorPrefix: '作者：', unknown: '未知',
      noDescription: '暂无简介', score: '评分', dailyInstalls: '日安装量', totalInstalls: '总安装量',
      created: '创建', updated: '更新', name: '名称', rating: '得分',
      notAvailable: '—',
      authorSeparator: '、',
      noMatches: '没有匹配的脚本', noScripts: '该网站暂无可用脚本', loading: '正在加载脚本列表…',
      loadingMore: '正在加载更多…', loadMore: '加载更多', noMore: '没有更多结果', backTop: '回到顶部', refresh: '刷新', pageError: '加载更多失败：{{message}}',
      httpError: '请求失败（HTTP {{status}}）', invalidJson: '服务器返回的内容不是有效 JSON',
      networkError: '网络请求失败', timeout: '请求超时', invalidPayload: '接口返回的数据格式不正确',
      loadFailed: '加载失败', siteNote: '站点：{{host}} · 语言：{{language}} · 数据源：{{provider}} · 结果数：{{count}}',
      unnamedScript: '未命名脚本', unknownAuthor: '未知作者', openDialog: '打开脚本搜索弹窗'
    },
    ja: {
      languageChinese: '簡体字中国語', languageEnglish: 'English', languageJapanese: '日本語',
      topLeft: '左上', topRight: '右上', bottomLeft: '左下', bottomRight: '右下',
      position: 'ボタンの位置', searchDomain: '検索ドメイン', xOffset: 'X オフセット', yOffset: 'Y オフセット',
      tempHideFab: '一時的に FAB を非表示（現在：表示）', tempShowFab: '一時的に FAB を表示（現在：非表示）',
      tempTitle: '現在のページだけに適用され、表示状態は保存されません',
      disableFab: 'FAB を無効化（現在：有効）', enableFab: 'FAB を有効化（現在：無効）',
      persistentTitle: 'FAB の表示設定を保存', searchCurrentSite: 'このサイトのユーザースクリプトを検索',
      dialogTitle: 'ユーザースクリプト検索：{{host}}', currentSite: '現在のサイト', searchAria: 'ユーザースクリプト検索', apiLanguage: 'API 言語',
      searchPlaceholder: '名前、作者、説明を検索', sort: '並び順', author: '作者', authorPrefix: '作者：', unknown: '不明',
      noDescription: '説明なし', score: '評価', dailyInstalls: '1日インストール数', totalInstalls: '累計インストール数',
      created: '作成', updated: '更新', name: '名前', rating: '評価',
      notAvailable: '—',
      authorSeparator: '、',
      noMatches: '一致するスクリプトはありません', noScripts: 'このサイトのスクリプトは見つかりません', loading: 'スクリプトを読み込み中…',
      loadingMore: 'さらに読み込み中…', loadMore: 'さらに読み込む', noMore: 'これ以上の結果はありません', backTop: 'トップへ戻る', refresh: '更新', pageError: '追加読み込みに失敗しました：{{message}}',
      httpError: 'リクエストに失敗しました（HTTP {{status}}）', invalidJson: 'サーバーが無効な JSON を返しました',
      networkError: 'ネットワークエラー', timeout: 'リクエストがタイムアウトしました', invalidPayload: 'API のデータ形式が正しくありません',
      loadFailed: '読み込みに失敗しました', siteNote: 'サイト：{{host}} · 言語：{{language}} · データソース：{{provider}} · 結果数：{{count}}',
      unnamedScript: '無題のスクリプト', unknownAuthor: '不明な作者', openDialog: 'ユーザースクリプト検索を開く'
    }
  };

  function t(key, values = {}) {
    const text = I18N[selectedLanguage]?.[key] || I18N.en[key] || key;
    return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(values[name] ?? ''));
  }

  function resolveLanguage(value) {
    if (LANGUAGES.some(language => language.key === value)) return value;
    const candidates = Array.isArray(navigator.languages) ? navigator.languages : [navigator.language];
    for (const candidate of candidates) {
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

  // Provider templates use named placeholders so each source can define its
  // own URL layout without relying on placeholder order.
  function buildSearchUrl(provider, sortKey, page) {
    const values = {
      lang: selectedLanguage,
      q: selectedHost,
      sort: sortKey || '',
      page
    };
    return provider.search.replace(/\{(lang|q|sort|page)\}/g, (_, key) => encodeURIComponent(values[key]));
  }

  function safeUrl(value) {
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function requestJson(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType: 'text',
        onload: response => {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(t('httpError', { status: response.status })));
            return;
          }
          try {
            resolve(JSON.parse(response.responseText));
          } catch {
            reject(new Error(t('invalidJson')));
          }
        },
        onerror: () => reject(new Error(t('networkError'))),
        ontimeout: () => reject(new Error(t('timeout')))
      });
    });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString(selectedLanguage);
  }

  function formatDate(value) {
    if (!value) return t('notAvailable');
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? t('notAvailable') : date.toLocaleString(selectedLanguage, {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
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
    }
    parent.append(link);
  }

  function createStyle() {
    const style = document.createElement('style');
    style.textContent = `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; }
      .search-app { color: #202124; font: 14px/1.5 Arial, "Microsoft YaHei", sans-serif; }
      .toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
      .toolbar input { flex: 1 1 220px; min-width: 160px; height: 36px; padding: 0 10px; border: 1px solid #c7cbd1; border-radius: 4px; color: inherit; font: inherit; }
      .toolbar select, .toolbar button { height: 36px; padding: 0 10px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: inherit; font: inherit; }
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
      @media (max-width: 560px) { .result { padding: 10px; } .toolbar input { flex-basis: 100%; } }
    `;
    return style;
  }

  function applyCorner(host, corner) {
    const valid = CORNERS.some(item => item.key === corner) ? corner : 'bottom-left';
    host.dataset.corner = valid;
    GM_setValue(STORAGE_KEY, valid);
  }

  function applyFabOffset(host) {
    host.style.setProperty('--fab-offset-x', `${fabOffset.x}px`);
    host.style.setProperty('--fab-offset-y', `${fabOffset.y}px`);
  }

  const host = document.createElement('div');
  const fabShadow = host.attachShadow({ mode: 'closed' });
  const fabStyle = document.createElement('style');
  fabStyle.textContent = `
    :host { all: initial; position: fixed; z-index: 2147483646; transform: translate(var(--fab-offset-x, 0px), var(--fab-offset-y, 0px)); }
    :host([data-corner="top-left"]) { top: 16px; left: 16px; }
    :host([data-corner="top-right"]) { top: 16px; right: 16px; }
    :host([data-corner="bottom-left"]) { bottom: 16px; left: 16px; }
    :host([data-corner="bottom-right"]) { right: 16px; bottom: 16px; }
    button { width: 52px; height: 52px; padding: 0; border: 0; border-radius: 50%; background: #1967d2; box-shadow: 0 3px 10px rgb(0 0 0 / 28%); color: #fff; cursor: pointer; font: 700 15px Arial, sans-serif; }
    button:hover { background: #1557b0; }
    button:focus-visible { outline: 3px solid #8ab4f8; outline-offset: 2px; }
  `;
  const fabButton = document.createElement('button');
  fabButton.type = 'button';
  fabButton.textContent = 'JS';
  fabButton.title = t('searchCurrentSite');
  fabButton.setAttribute('aria-label', t('searchCurrentSite'));
  fabShadow.append(fabStyle, fabButton);
  const savedCorner = GM_getValue(STORAGE_KEY, 'bottom-left');
  applyCorner(host, savedCorner);
  applyFabOffset(host);
  host.style.display = fabVisible ? '' : 'none';
  document.body.append(host);

  if (!enabledProviders.length) {
    fabButton.disabled = true;
    return;
  }

  const dialog = await SchwiDialog.createDialog('min(94vw, 980px)', '86vh', {
    title: t('dialogTitle', { host: currentHost || t('currentSite') }),
    ariaLabel: t('searchAria'),
    closeOnBackdropClick: true,
    closeOnEscape: true,
    showCloseButton: true
  });
  const languageSelect = document.createElement('select');
  languageSelect.setAttribute('aria-label', t('apiLanguage'));
  languageSelect.title = t('apiLanguage');
  languageSelect.style.cssText = 'height: 30px; max-width: 130px; margin-left: 10px; padding: 0 6px; border: 1px solid #c7cbd1; border-radius: 4px; background: #fff; color: #202124; font: 13px Arial, "Microsoft YaHei", sans-serif;';
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
    refreshTexts();
    loadResults();
  });
  const dialogHeader = dialog.element.querySelector('header');
  const closeButton = dialogHeader?.querySelector('.close');
  if (dialogHeader) dialogHeader.insertBefore(languageSelect, closeButton || null);
  const app = document.createElement('div');
  app.className = 'search-app';
  app.append(createStyle());
  dialog.content.append(app);

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
    radio.addEventListener('change', () => applyCorner(host, radio.value));
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
      applyFabOffset(host);
      GM_setValue(OFFSET_STORAGE_KEY, fabOffset);
    });
    input.addEventListener('change', () => {
      if (!Number.isFinite(Number(input.value))) input.value = String(fabOffset[axis]);
    });
    label.append(text, input);
    offsetLabels.push({ axis, label, text, input });
    offsetControls.append(label);
  });
  cornerSettings.append(offsetControls);

  const temporaryButton = document.createElement('button');
  temporaryButton.type = 'button';
  temporaryButton.className = 'corner-action';
  temporaryButton.addEventListener('click', () => {
    fabVisible = !fabVisible;
    updateFabState();
  });
  const persistentButton = document.createElement('button');
  persistentButton.type = 'button';
  persistentButton.className = 'corner-action';
  persistentButton.addEventListener('click', () => {
    persistentEnabled = !persistentEnabled;
    fabVisible = persistentEnabled;
    GM_setValue(ENABLED_STORAGE_KEY, persistentEnabled);
    updateFabState();
  });
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
  let requestId = 0;
  const cache = new Map();

  let persistentMenuId;
  let openMenuId;

  function refreshTexts() {
    dialog.setTitle(t('dialogTitle', { host: currentHost || t('currentSite') }));
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
    renderSortOptions();
    updateFabState();
    if (allItems.length) renderItems();
  }

  function updateFabState() {
    host.style.display = fabVisible ? '' : 'none';
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
      () => {
        persistentEnabled = !persistentEnabled;
        fabVisible = persistentEnabled;
        GM_setValue(ENABLED_STORAGE_KEY, persistentEnabled);
        updateFabState();
      }
    );
    openMenuId = GM_registerMenuCommand(
      t('openDialog'),
      openDialog
    );
  }

  function setStatus(message, error = false, count = allItems.length) {
    updateNote(count);
    results.replaceChildren();
    const status = document.createElement('div');
    status.className = `status${error ? ' error' : ''}`;
    status.textContent = message;
    results.append(status);
  }

  function renderItems() {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const filtered = allItems.filter(item => {
      const authorNames = (item.authors || []).map(author => author.name).join(' ');
      const text = [item.name, item.description, authorNames].join(' ').toLocaleLowerCase();
      return !query || text.includes(query);
    });
    results.replaceChildren();
    updateNote(filtered.length);
    if (!filtered.length) {
      setStatus(query ? t('noMatches') : t('noScripts'), false, filtered.length);
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
      addText(meta, t('score'), item.rating == null || Number.isNaN(item.rating) ? t('notAvailable') : item.rating.toFixed(1));
      addText(meta, t('dailyInstalls'), formatNumber(item.dailyInstalls));
      addText(meta, t('totalInstalls'), formatNumber(item.totalInstalls));
      addText(meta, t('created'), formatDate(item.createdAt));
      addText(meta, t('updated'), formatDate(item.updatedAt));
      card.append(title, author, description, meta);
      fragment.append(card);
    });
    results.append(fragment);
    renderResultFooter();
  }

  function updateNote(count = allItems.length) {
    note.textContent = t('siteNote', {
      host: selectedHost || t('currentSite'),
      language: t(LANGUAGES.find(language => language.key === selectedLanguage)?.labelKey || 'languageEnglish'),
      provider: activeProvider.name,
      count: formatNumber(count)
    });
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
    loadMoreButton.addEventListener('click', () => loadResults(false));
    const backTopButton = document.createElement('button');
    backTopButton.type = 'button';
    backTopButton.textContent = '↑';
    backTopButton.title = t('backTop');
    backTopButton.setAttribute('aria-label', t('backTop'));
    backTopButton.addEventListener('click', () => dialog.content.scrollTo({ top: 0, behavior: 'smooth' }));
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
    if (!reset && (isLoading || !hasMore)) return;
    const currentRequest = ++requestId;
    const cacheKey = `${selectedLanguage}:${selectedHost}:${activeProvider.name}:${activeSortKey}`;
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
    try {
      const payload = await requestJson(buildSearchUrl(activeProvider, activeSortKey, page));
      if (currentRequest !== requestId) return;
      if (!Array.isArray(payload)) throw new Error(t('invalidPayload'));
      const pageItems = payload.map(activeProvider.result).filter(Boolean);
      allItems = reset ? pageItems : allItems.concat(pageItems);
      activePage = page;
      hasMore = pageItems.length > 0;
      pageError = '';
      cache.set(cacheKey, { items: allItems, page: activePage, hasMore });
      isLoading = false;
      refreshButton.disabled = false;
      renderItems();
    } catch (error) {
      if (currentRequest !== requestId) return;
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

  searchInput.addEventListener('input', renderItems);
  sortSelect.addEventListener('change', () => {
    activeSortKey = sortSelect.value;
    loadResults();
  });
  refreshButton.addEventListener('click', () => {
    cache.delete(`${selectedLanguage}:${selectedHost}:${activeProvider.name}:${activeSortKey}`);
    loadResults();
  });
  function openDialog() {
    dialog.show();
    loadResults();
  }

  fabButton.addEventListener('click', openDialog);
  activeSortKey = activeProvider.sort[0]?.key || '';
  renderTabs();
  refreshTexts();
})();
