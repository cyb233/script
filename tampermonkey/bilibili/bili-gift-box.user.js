// ==UserScript==
// @name         Bilibili 盲盒统计
// @namespace    Schwi
// @version      2.0.0
// @description  统计 Bilibili 盲盒概率，支持本地历史合并、收益筛选与公示概率对照
// @author       Schwi
// @match        *://*.bilibili.com/*
// @match        https://gift.shuvi.moe/gifts/*
// @match        https://legacy-gift.shuvi.moe/box
// @match        https://legacy-gift.shuvi.moe/box.html
// @connect      api.live.bilibili.com
// @connect      api.bilibili.com
// @connect      shuvi.moe
// @grant        GM.xmlHttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        unsafeWindow
// @noframes
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(async function () {
  'use strict';

  const API = {
    blindGiftStream: (nextId = 0, month = '', pageSize = 100) => {
      const params = new URLSearchParams({ nextId, month, pageSize });
      return `https://api.live.bilibili.com/xlive/fuxi-interface/gift/blindGiftStream?${params}`;
    },
    giftInfo: 'https://gift.shuvi.moe/api/blind-gifts'
  };
  const UI_IDS = {
    styles: 'bgb-styles',
    progress: 'bgb-progress-dialog',
    results: 'bgb-results-dialog'
  };
  let collecting = false;
  let cancelRequested = false;

  const FALLBACK_BLIND_GIFTS = [
    {
      id: 32251,
      name: '心动盲盒',
      price: 150,
      level: ['初始倍'],
      gifts: [
        { id: 32125, name: '电影票', price: 20, percentage: [6], subGifts: [] },
        { id: 32126, name: '棉花糖', price: 90, percentage: [42.56], subGifts: [] },
        { id: 32128, name: '爱心抱枕', price: 160, percentage: [47.5], subGifts: [] },
        { id: 32281, name: '绮彩权杖', price: 400, percentage: [3.7], subGifts: [] },
        { id: 34082, name: '时空之站', price: 1000, percentage: [0.12], subGifts: [] },
        { id: 34894, name: '蛇形护符', price: 2000, percentage: [0.08], subGifts: [] },
        { id: 32132, name: '浪漫城堡', price: 22330, percentage: [0.04], subGifts: [] }
      ]
    },
    {
      id: 35206,
      name: '幸运盲盒',
      price: 50,
      level: ['初始倍'],
      gifts: [
        { id: 35207, name: '幸运泡泡', price: 15, percentage: [14.8], subGifts: [] },
        { id: 34704, name: '幸运草', price: 25, percentage: [25], subGifts: [] },
        { id: 35208, name: '星光铃铛', price: 52, percentage: [52.1], subGifts: [] },
        { id: 35209, name: '梦雾纸签', price: 100, percentage: [5], subGifts: [] },
        { id: 35210, name: '福灵小兽', price: 200, percentage: [2.7], subGifts: [] },
        { id: 35211, name: '星愿花园', price: 600, percentage: [0.4], subGifts: [] }
      ]
    },
    {
      id: 35212,
      name: '幸运盲盒S',
      price: 500,
      level: ['初始倍'],
      gifts: [
        { id: 35213, name: '初兆光符', price: 160, percentage: [10], subGifts: [] },
        { id: 33593, name: '幸运之露', price: 300, percentage: [33.8], subGifts: [] },
        { id: 35214, name: '福引转轮', price: 520, percentage: [52.55], subGifts: [] },
        { id: 35215, name: '光羽预言', price: 1000, percentage: [3], subGifts: [] },
        { id: 35216, name: '幽镜之门', price: 5000, percentage: [0.55], subGifts: [] },
        { id: 35217, name: '命契幻境', price: 30000, percentage: [0.1], subGifts: [] }
      ]
    }
  ];

  // API 请求函数
  async function apiRequest(url, retry = 3) {
    function appendTimestamp(u) {
      const ts = `_ts=${Date.now()}`;
      return u.includes('?') ? `${u}&${ts}` : `${u}?${ts}`;
    }
    for (let attempt = 1; attempt <= retry; attempt++) {
      try {
        const response = await GM.xmlHttpRequest({
          method: 'GET',
          url: appendTimestamp(url)
        });
        if (response.status < 200 || response.status >= 300) {
          throw new Error(`HTTP ${response.status}`);
        }
        return JSON.parse(response.responseText);
      } catch (e) {
        console.error(`API ${url} 请求失败，正在重试...`, e);
        if (attempt === retry) {
          throw e;
        }
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }

  // 获取用户UID
  let userDataPromise;
  function getUserData() {
    return userDataPromise ??= apiRequest('https://api.bilibili.com/x/space/v2/myinfo').then(response => {
      if (response.code !== 0 || !response.data?.profile?.mid) {
        throw new Error(response.message || '无法获取当前用户信息');
      }
      return response.data;
    });
  }

  function normalizeGiftInfo(boxes) {
    if (!Array.isArray(boxes) || boxes.length === 0) {
      throw new TypeError('盲盒信息格式无效：缺少盲盒数组');
    }

    const normalizedBoxes = boxes.map(box => {
      if (!Number.isFinite(Number(box?.id)) || typeof box?.name !== 'string' || !Number.isFinite(Number(box?.price)) || !Array.isArray(box?.gifts)) {
        throw new TypeError('盲盒信息格式无效：盲盒字段不完整');
      }

      return {
        ...box,
        id: Number(box.id),
        price: Number(box.price),
        level: Array.isArray(box.level) ? box.level : [],
        gifts: box.gifts.map(gift => {
          const percentage = gift?.percentage?.map(Number);
          if (!Number.isFinite(Number(gift?.id)) || typeof gift?.name !== 'string' || !Number.isFinite(Number(gift?.price)) || !percentage?.every(Number.isFinite) || percentage.length === 0) {
            throw new TypeError(`盲盒信息格式无效：${box.name} 的礼物字段不完整`);
          }

          const subGifts = (Array.isArray(gift.subGifts) ? gift.subGifts : []).map(subGift => {
            const id = Number(subGift?.id);
            if (!Number.isFinite(id)) {
              throw new TypeError(`盲盒信息格式无效：${gift.name} 的子礼物 ID 无效`);
            }
            return { ...subGift, id };
          });

          return {
            ...gift,
            id: Number(gift.id),
            price: Number(gift.price),
            percentage,
            subGifts
          };
        })
      };
    });

    const boxById = new Map();
    const boxOrderById = new Map();
    const giftByBoxAndId = new Map();
    normalizedBoxes.forEach((box, index) => {
      boxById.set(box.id, box);
      boxOrderById.set(box.id, index);
      const giftMap = new Map();
      box.gifts.forEach(gift => {
        giftMap.set(gift.id, gift);
        gift.subGifts.forEach(subGift => giftMap.set(subGift.id, gift));
      });
      giftByBoxAndId.set(box.id, giftMap);
    });

    return {
      boxes: normalizedBoxes,
      boxById,
      boxOrderById,
      resolveGift(boxId, giftId) {
        const box = boxById.get(Number(boxId));
        return { box, gift: giftByBoxAndId.get(Number(boxId))?.get(Number(giftId)) };
      }
    };
  }

  // 盲盒信息，percentage 为官方公示的基础概率（不包含活动倍率）
  let giftInfoPromise;
  function getGiftInfo() {
    return giftInfoPromise ??= apiRequest(API.giftInfo)
      .then(data => {
        const giftInfo = normalizeGiftInfo(data);
        console.log('获取盲盒信息成功:', giftInfo.boxes);
        return giftInfo;
      })
      .catch(error => {
        console.error('获取盲盒信息失败，使用内置数据:', error);
        return normalizeGiftInfo(FALLBACK_BLIND_GIFTS);
      });
  }

  // 去重合并记录并存储
  function saveGiftList(uid, newGifts) {
    const oldKey = 'allGiftList';
    const storedGifts = GM_getValue(uid, []);
    const oldGifts = GM_getValue(oldKey, []);
    const giftById = new Map();

    [oldGifts, storedGifts, newGifts].forEach(gifts => {
      gifts.forEach(gift => {
        const id = Number(gift?.id);
        if (Number.isFinite(id)) {
          giftById.set(id, { ...gift, id });
        }
      });
    });

    const mergedGifts = Array.from(giftById.values()).sort((a, b) => b.id - a.id);
    GM_setValue(uid, mergedGifts);
    if (oldGifts.length > 0) {
      GM_deleteValue(oldKey);
    }
    return mergedGifts;
  }

  function getAllGiftList() {
    return GM_listValues().map(key => ({ key, gifts: GM_getValue(key, []) }));
  }

  // 盲盒数据分组统计函数
  function groupGiftStats(giftList, giftInfo) {
    const groupedGiftStats = new Map();

    giftList.forEach(record => {
      const boxId = Number(record.originalGiftId);
      const giftId = Number(record.giftId);
      const giftNum = Number(record.giftNum);
      if (!Number.isFinite(boxId) || !Number.isFinite(giftId) || !Number.isFinite(giftNum)) return;

      const { gift } = giftInfo.resolveGift(boxId, giftId);
      const mainGiftId = gift?.id ?? giftId;
      if (!groupedGiftStats.has(boxId)) {
        groupedGiftStats.set(boxId, {
          originalGiftName: record.originalGiftName,
          totalCount: 0,
          gifts: new Map()
        });
      }

      const group = groupedGiftStats.get(boxId);
      if (!group.gifts.has(mainGiftId)) {
        group.gifts.set(mainGiftId, {
          giftName: gift?.name || record.giftName,
          count: 0
        });
      }
      group.totalCount += giftNum;
      group.gifts.get(mainGiftId).count += giftNum;
    });
    return groupedGiftStats;
  }

  function getProfitDelta(item, giftInfo) {
    const { box, gift } = giftInfo.resolveGift(item.originalGiftId, item.giftId);
    return box && gift ? gift.price - box.price : null;
  }

  function createUiElement(tagName, options = {}) {
    const node = document.createElement(tagName);
    if (options.className) node.className = options.className;
    if (options.text !== undefined) node.textContent = options.text;
    if (options.attributes) Object.entries(options.attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  }

  function addUiStyles() {
    if (document.getElementById(UI_IDS.styles)) return;
    const style = createUiElement('style', { attributes: { id: UI_IDS.styles } });
    style.textContent = `
      #${UI_IDS.results},#${UI_IDS.progress}{box-sizing:border-box;font-family:Arial,"Microsoft YaHei",sans-serif;color:#202124}#${UI_IDS.results}{position:fixed;z-index:2147483646;inset:3vh 3vw;display:flex;flex-direction:column;overflow:hidden;background:#f6f8fa;border:1px solid #b9c0c9;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.32)}#${UI_IDS.results} *{box-sizing:border-box}#${UI_IDS.results} .bgb-header{display:flex;align-items:center;min-height:62px;padding:12px 18px;background:#fff;border-bottom:1px solid #d8dee4}#${UI_IDS.results} .bgb-title{margin:0;font-size:18px;font-weight:700}#${UI_IDS.results} .bgb-subtitle{margin:3px 0 0;color:#667085;font-size:12px}#${UI_IDS.results} .bgb-header-actions{display:flex;gap:8px;margin-left:auto}#${UI_IDS.results} button,#${UI_IDS.progress} button{height:34px;padding:0 11px;border:1px solid #aeb7c2;border-radius:4px;background:#fff;color:#25364a;cursor:pointer;font-size:13px}#${UI_IDS.results} button:hover,#${UI_IDS.progress} button:hover{background:#f0f5ff;border-color:#6b96d8}#${UI_IDS.results} .bgb-close{width:34px;padding:0;color:#57606a;font-size:24px;line-height:1}
      #${UI_IDS.results} .bgb-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px 10px;background:#fff}#${UI_IDS.results} .bgb-stat{padding:9px 12px;background:#f6f8fa;border:1px solid #e2e6ea;border-radius:5px}#${UI_IDS.results} .bgb-stat-label{color:#667085;font-size:12px}#${UI_IDS.results} .bgb-stat-value{margin-top:3px;color:#1769aa;font-size:19px;font-weight:700}#${UI_IDS.results} .bgb-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:4px 18px 12px;background:#fff;border-bottom:1px solid #e2e6ea}#${UI_IDS.results} .bgb-search,#${UI_IDS.results} .bgb-select{height:34px;padding:0 10px;border:1px solid #b9c0c9;border-radius:4px;background:#fff;color:#25364a;font-size:13px;outline:0}#${UI_IDS.results} .bgb-search{width:min(280px,100%)}#${UI_IDS.results} .bgb-search:focus,#${UI_IDS.results} .bgb-select:focus{border-color:#00a1d6;box-shadow:0 0 0 2px rgba(0,161,214,.18)}#${UI_IDS.results} .bgb-count{margin-left:auto;color:#667085;font-size:12px;white-space:nowrap}#${UI_IDS.results} .bgb-content{flex:1;min-height:0;overflow:auto;padding:16px 18px 24px}#${UI_IDS.results} .bgb-section{margin-bottom:22px}#${UI_IDS.results} .bgb-section-title{display:flex;align-items:baseline;gap:10px;margin:0 0 8px;font-size:15px}#${UI_IDS.results} .bgb-section-title a{color:#1769aa;text-decoration:none}#${UI_IDS.results} .bgb-section-meta{color:#667085;font-size:12px;font-weight:400}#${UI_IDS.results} table{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0;font-size:13px;background:#fff}#${UI_IDS.results} th,#${UI_IDS.results} td{padding:8px 10px;overflow:hidden;border-bottom:1px solid #e3e7eb;text-align:left;text-overflow:ellipsis;white-space:nowrap}#${UI_IDS.results} th{background:#f6f8fa;color:#455468;font-size:12px}#${UI_IDS.results} tbody tr:hover{background:#f4f8ff}#${UI_IDS.results} td:nth-child(n+2),#${UI_IDS.results} th:nth-child(n+2){text-align:right}#${UI_IDS.results} td a{color:#1769aa;text-decoration:none}#${UI_IDS.results} .bgb-positive{color:#137333;font-weight:700}#${UI_IDS.results} .bgb-negative{color:#b42318;font-weight:700}#${UI_IDS.results} .bgb-empty{padding:48px 12px;color:#667085;text-align:center}
      #${UI_IDS.progress}{position:fixed;z-index:2147483647;top:50%;left:50%;width:min(390px,calc(100vw - 32px));padding:20px;transform:translate(-50%,-50%);background:#fff;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28)}#${UI_IDS.progress} h2{margin:0 0 8px;font-size:18px}#${UI_IDS.progress} p{margin:0 0 12px;color:#57606a;font-size:13px;line-height:1.5}#${UI_IDS.progress} progress{width:100%;height:8px;margin-bottom:12px;accent-color:#00a1d6}#${UI_IDS.progress} .bgb-progress-actions{display:flex;justify-content:flex-end}@media(max-width:680px){#${UI_IDS.results}{inset:0;border:0;border-radius:0}#${UI_IDS.results} .bgb-header,#${UI_IDS.results} .bgb-summary,#${UI_IDS.results} .bgb-toolbar{padding-left:12px;padding-right:12px}#${UI_IDS.results} .bgb-search{order:1;width:100%}#${UI_IDS.results} .bgb-count{margin-left:0}#${UI_IDS.results} .bgb-content{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function createCollectionProgress() {
    document.getElementById(UI_IDS.progress)?.remove();
    addUiStyles();
    const dialog = createUiElement('section', { attributes: { id: UI_IDS.progress, role: 'status', 'aria-live': 'polite' } });
    const title = createUiElement('h2', { text: '正在收集盲盒记录' });
    const detail = createUiElement('p', { text: '已读取 0 条新记录' });
    const progress = createUiElement('progress', { attributes: { value: '0', max: '1' } });
    const status = createUiElement('p', { text: '将与本地历史记录自动去重合并。' });
    const cancel = createUiElement('button', { text: '取消', attributes: { type: 'button' } });
    cancel.addEventListener('click', () => { cancelRequested = true; cancel.disabled = true; cancel.textContent = '正在取消'; });
    const actions = createUiElement('div', { className: 'bgb-progress-actions' });
    actions.appendChild(cancel);
    dialog.append(title, detail, progress, status, actions);
    document.body.appendChild(dialog);
    return {
      update(records, page) {
        detail.textContent = `已读取 ${records.toLocaleString()} 条新记录`;
        progress.max = Math.max(page, 1);
        progress.value = page;
        status.textContent = `已完成第 ${page} 页，正在继续读取可用历史记录。`;
      },
      close() { dialog.remove(); }
    };
  }

  function createSelect(label, options) {
    const select = createUiElement('select', { className: 'bgb-select', attributes: { 'aria-label': label } });
    options.forEach(([value, text]) => select.appendChild(createUiElement('option', { text, attributes: { value } })));
    return select;
  }

  async function fetchAllBlindBoxes() {
    if (collecting) return;
    collecting = true;
    cancelRequested = false;
    const progress = createCollectionProgress();
    const records = [];
    let nextId = 0;
    let month = '';
    let isMore = true;
    let page = 0;
    try {
      const [userData, giftInfo] = await Promise.all([getUserData(), getGiftInfo()]);
      while (isMore && !cancelRequested) {
        const response = await apiRequest(API.blindGiftStream(nextId, month));
        if (response.code !== 0 || !response.data) throw new Error(response.message || 'API 返回的数据无效');
        const { list = [], params = {} } = response.data;
        records.push(...list.map(({ giftImg, ...gift }) => ({
          ...gift,
          id: Number(gift.id),
          originalGiftId: Number(gift.originalGiftId),
          giftId: Number(gift.giftId),
          giftNum: Number(gift.giftNum)
        })));
        page++;
        progress.update(records.length, page);
        nextId = params.nextId;
        month = params.month;
        isMore = Boolean(params.isMore);
      }
      const mergedRecords = saveGiftList(userData.profile.mid, records);
      showResultsDialog(mergedRecords, giftInfo, cancelRequested ? '查询已取消，以下为已保存的历史统计结果。' : '已合并本次记录与本地历史记录。');
    } catch (error) {
      console.error('盲盒数据请求失败:', error);
      alert(`盲盒数据收集失败：${error.message || '请检查登录状态和网络。'}`);
    } finally {
      collecting = false;
      progress.close();
    }
  }

  function showResultsDialog(allGiftList, giftInfo, subtitle = '') {
    document.getElementById(UI_IDS.results)?.remove();
    addUiStyles();
    const dialog = createUiElement('section', { attributes: { id: UI_IDS.results, role: 'dialog', 'aria-modal': 'true', 'aria-label': '盲盒统计结果', tabindex: '-1' } });
    const header = createUiElement('header', { className: 'bgb-header' });
    const heading = document.createElement('div');
    heading.append(createUiElement('h1', { className: 'bgb-title', text: '盲盒统计' }), createUiElement('p', { className: 'bgb-subtitle', text: subtitle }));
    const headerActions = createUiElement('div', { className: 'bgb-header-actions' });
    const refresh = createUiElement('button', { text: '重新收集', attributes: { type: 'button' } });
    refresh.addEventListener('click', () => { dialog.remove(); fetchAllBlindBoxes(); });
    const close = createUiElement('button', { className: 'bgb-close', text: '×', attributes: { type: 'button', title: '关闭（Esc）', 'aria-label': '关闭' } });
    close.addEventListener('click', () => dialog.remove());
    headerActions.append(refresh, close);
    header.append(heading, headerActions);
    const totalDraws = allGiftList.reduce((total, item) => total + (Number(item.giftNum) || 0), 0);
    const groups = groupGiftStats(allGiftList, giftInfo);
    const summary = createUiElement('div', { className: 'bgb-summary' });
    [['记录', allGiftList.length], ['总抽数', totalDraws], ['盲盒种类', groups.size]].forEach(([label, value]) => {
      const stat = createUiElement('div', { className: 'bgb-stat' });
      stat.append(createUiElement('div', { className: 'bgb-stat-label', text: label }), createUiElement('div', { className: 'bgb-stat-value', text: Number(value).toLocaleString() }));
      summary.appendChild(stat);
    });
    const toolbar = createUiElement('div', { className: 'bgb-toolbar' });
    const search = createUiElement('input', { className: 'bgb-search', attributes: { type: 'search', placeholder: '搜索主播 UID 或昵称', 'aria-label': '搜索主播 UID 或昵称' } });
    const profit = createSelect('收益状态', [['all', '收益：全部'], ['positive', '正收益'], ['negative', '负收益'], ['unknown', '未知']]);
    const box = createSelect('盲盒类型', [['all', '盲盒：全部'], ...[...groups.entries()].map(([id, group]) => [String(id), group.originalGiftName || `盲盒 ${id}`])]);
    const reset = createUiElement('button', { text: '重置筛选', attributes: { type: 'button' } });
    const count = createUiElement('span', { className: 'bgb-count' });
    toolbar.append(search, profit, box, reset, count);
    const content = createUiElement('main', { className: 'bgb-content' });
    const empty = createUiElement('div', { className: 'bgb-empty', text: '没有符合筛选条件的记录', attributes: { hidden: '' } });
    content.appendChild(empty);
    dialog.append(header, summary, toolbar, content);
    document.body.appendChild(dialog);

    function matches(item) {
      const term = search.value.trim().toLocaleLowerCase();
      if (term && !`${item.ruid || ''} ${item.rname || ''}`.toLocaleLowerCase().includes(term)) return false;
      if (box.value !== 'all' && String(item.originalGiftId) !== box.value) return false;
      const delta = getProfitDelta(item, giftInfo);
      if (profit.value === 'positive' && !(delta !== null && delta >= 0)) return false;
      if (profit.value === 'negative' && !(delta !== null && delta < 0)) return false;
      if (profit.value === 'unknown' && delta !== null) return false;
      return true;
    }
    function render() {
      const filtered = allGiftList.filter(matches);
      const stats = groupGiftStats(filtered, giftInfo);
      const filteredDraws = filtered.reduce((total, item) => total + (Number(item.giftNum) || 0), 0);
      count.textContent = `显示 ${filteredDraws.toLocaleString()} / ${totalDraws.toLocaleString()} 抽 · ${stats.size} 种盲盒`;
      content.replaceChildren(empty);
      empty.hidden = stats.size > 0;
      const sortedGroups = [...stats.entries()].sort(([firstId], [secondId]) => (giftInfo.boxOrderById.get(firstId) ?? Number.MAX_SAFE_INTEGER) - (giftInfo.boxOrderById.get(secondId) ?? Number.MAX_SAFE_INTEGER) || firstId - secondId);
      sortedGroups.forEach(([boxId, group]) => {
        const section = createUiElement('section', { className: 'bgb-section' });
        const title = createUiElement('h2', { className: 'bgb-section-title' });
        const link = createUiElement('a', { text: group.originalGiftName || `盲盒 ${boxId}`, attributes: { href: `https://gift.shuvi.moe/gifts/${boxId}`, target: '_blank', rel: 'noopener noreferrer' } });
        title.append(link, createUiElement('span', { className: 'bgb-section-meta', text: `共 ${group.totalCount.toLocaleString()} 抽` }));
        const table = document.createElement('table');
        const columns = document.createElement('colgroup');
        ['36%', '16%', '16%', '16%', '16%'].forEach(width => {
          columns.appendChild(createUiElement('col', { attributes: { style: `width:${width}` } }));
        });
        table.appendChild(columns);
        const head = table.createTHead().insertRow();
        ['礼物', '数量', '你的概率', '公示概率', '收益'].forEach(label => head.appendChild(createUiElement('th', { text: label })));
        const order = new Map(giftInfo.boxById.get(boxId)?.gifts.map((gift, index) => [gift.id, index]));
        const body = table.createTBody();
        [...group.gifts.entries()].sort(([firstId], [secondId]) => (order.get(firstId) ?? Number.MAX_SAFE_INTEGER) - (order.get(secondId) ?? Number.MAX_SAFE_INTEGER) || firstId - secondId).forEach(([giftId, gift]) => {
          const row = body.insertRow();
          const giftData = giftInfo.resolveGift(boxId, giftId).gift;
          const official = giftData?.percentage?.[0];
          const delta = giftData ? giftData.price - (giftInfo.boxById.get(boxId)?.price || 0) : null;
          const nameCell = row.insertCell();
          nameCell.appendChild(createUiElement('a', { text: gift.giftName, attributes: { href: `https://gift.shuvi.moe/gifts/${giftId}`, target: '_blank', rel: 'noopener noreferrer' } }));
          [gift.count.toLocaleString(), `${(gift.count / group.totalCount * 100).toFixed(2)}%`, Number.isFinite(official) ? `${official}%` : 'N/A'].forEach(value => row.insertCell().textContent = value);
          const profitCell = row.insertCell();
          profitCell.textContent = delta === null ? '未知' : `${delta >= 0 ? '+' : ''}${delta}`;
          profitCell.className = delta === null ? '' : (delta >= 0 ? 'bgb-positive' : 'bgb-negative');
        });
        section.append(title, table);
        content.appendChild(section);
      });
    }
    [search, profit, box].forEach(control => control.addEventListener(control === search ? 'input' : 'change', render));
    reset.addEventListener('click', () => { search.value = ''; profit.value = 'all'; box.value = 'all'; render(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.remove(); });
    render();
    dialog.focus();
  }

  // 注册菜单项
  if (document.location.host.endsWith('shuvi.moe')) {
    unsafeWindow.giftList = getAllGiftList();
  } else {
    GM_registerMenuCommand("检查盲盒数据", fetchAllBlindBoxes);
  }

})();
