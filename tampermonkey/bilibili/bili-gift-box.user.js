// ==UserScript==
// @name         Bilibili 盲盒统计
// @namespace    Schwi
// @version      1.8.2
// @description  调用 API 来收集自己的 Bilibili 盲盒概率，公示概率和你的概率一致吗？（受API限制，获取的记录大约只有最近2个自然月，本脚本会本地持久化储存记录）
// @author       Schwi
// @match        *://*.bilibili.com/*
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

  // 工具函数：创建 dialog
  function createDialog(id, title, content = '') {
    document.getElementById(id)?.remove();
    const dialog = document.createElement('div');
    dialog.id = id;
    dialog.style.position = 'fixed';
    dialog.style.top = '5%';
    dialog.style.left = '5%';
    dialog.style.width = '90%';
    dialog.style.height = '90%';
    dialog.style.backgroundColor = '#fff';
    dialog.style.border = '1px solid #ccc';
    dialog.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
    dialog.style.zIndex = '9999';
    dialog.style.display = 'none';
    dialog.style.overflow = 'hidden';

    let header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.padding = '10px';
    header.style.borderBottom = '1px solid #ccc';
    header.style.backgroundColor = '#f9f9f9';

    let titleElement = document.createElement('span');
    titleElement.textContent = title;
    header.appendChild(titleElement);

    let closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style.backgroundColor = '#ff4d4f';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '5px 10px';
    closeButton.style.transition = 'background-color 0.3s';
    closeButton.onmouseover = () => { closeButton.style.backgroundColor = '#d93637'; }
    closeButton.onmouseout = () => { closeButton.style.backgroundColor = '#ff4d4f'; }
    closeButton.onclick = () => dialog.remove();
    header.appendChild(closeButton);

    dialog.appendChild(header);

    const contentArea = document.createElement('div');
    if (content instanceof Node) {
      contentArea.appendChild(content);
    } else {
      contentArea.textContent = content;
    }
    contentArea.style.padding = '10px';
    contentArea.style.overflowY = 'auto'; // 允许垂直滚动
    contentArea.style.height = 'calc(100% - 40px)'; // 减去 header 的高度
    dialog.appendChild(contentArea);

    document.body.appendChild(dialog);

    return { dialog, contentArea };
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

  // 礼物筛选条件
  const defaultFilters = {
    '正收益礼物': {
      type: 'checkbox', filter: (item, input, giftInfo) => {
        const profitDelta = getProfitDelta(item, giftInfo);
        return profitDelta !== null && profitDelta >= 0;
      }
    },
    '负收益礼物': {
      type: 'checkbox', filter: (item, input, giftInfo) => {
        const profitDelta = getProfitDelta(item, giftInfo);
        return profitDelta !== null && profitDelta < 0;
      }
    },
    '搜索': {
      type: 'text',
      attribute: { placeholder: '输入主播的完整uid或昵称', list: 'box-search-list', autocomplete: 'off' },
      filter: (item, searchTerms) => {
        if (searchTerms.size === 0) return true;
        const uid = String(item.ruid || '').toUpperCase();
        const name = String(item.rname || '').toUpperCase();
        return searchTerms.has(uid) || searchTerms.has(name);
      }
    }
  };

  // 循环请求盲盒数据
  async function fetchAllBlindBoxes() {
    let nextId = 0;
    let month = '';
    let isMore = 1;

    const allGiftList = [];

    const progressContent = document.createElement('p');
    progressContent.append('已收集盲盒数：');
    const collectedCount = document.createElement('span');
    collectedCount.textContent = '0';
    progressContent.appendChild(collectedCount);
    const { dialog: progressDialog } = createDialog('progressDialog', '盲盒数据收集进度', progressContent);
    progressDialog.style.display = 'block';
    const userDataRequest = getUserData();
    const giftInfoRequest = getGiftInfo();

    try {
      while (isMore) {
        const response = await apiRequest(API.blindGiftStream(nextId, month));
        if (response.code !== 0 || !response.data) {
          throw new Error(response.message || 'API 返回的数据无效');
        }

        const { list = [], params = {} } = response.data;
        const normalizedList = list.map(({ giftImg, ...gift }) => ({
          ...gift,
          id: Number(gift.id),
          originalGiftId: Number(gift.originalGiftId),
          giftId: Number(gift.giftId),
          giftNum: Number(gift.giftNum)
        }));
        allGiftList.push(...normalizedList);
        console.log('当前盲盒数据:', normalizedList, params);
        nextId = params.nextId;
        month = params.month;
        isMore = Boolean(params.isMore);
        collectedCount.textContent = allGiftList.length;
      }
    } catch (error) {
      console.error('盲盒数据请求失败:', error);
    } finally {
      progressDialog.remove();
    }

    // 去重并存储
    const mergedGiftList = saveGiftList((await userDataRequest).profile.mid, allGiftList);
    console.log('合并后的盲盒数据:', mergedGiftList);

    // 相关主播列表去重输出
    const anchorSet = new Map();
    mergedGiftList.forEach(gift => {
      if (gift.ruid && gift.rname) {
        anchorSet.set(gift.ruid, gift.rname);
      }
    });
    console.log('相关主播列表', Array.from(anchorSet, ([uid, name]) => ({ uid, name })));

    document.getElementById('box-search-list')?.remove();
    const datalist = document.createElement('datalist');
    datalist.id = 'box-search-list';
    const fragment = document.createDocumentFragment();
    for (const [uid, name] of anchorSet.entries()) {
      const option = document.createElement('option');
      option.value = `${name} ${uid}`;
      fragment.appendChild(option);
    }
    datalist.appendChild(fragment);
    document.body.appendChild(datalist);

    const giftInfo = await giftInfoRequest;
    showResultsDialog(mergedGiftList, giftInfo);
  }

  // 显示结果 dialog，支持筛选
  function showResultsDialog(allGiftList, giftInfo) {
    const { dialog, contentArea } = createDialog('resultsDialog', '盲盒统计结果');

    // 筛选按钮区域
    let filterButtonsContainer = document.createElement('div');
    filterButtonsContainer.style.marginBottom = '10px';
    filterButtonsContainer.style.display = 'flex';
    filterButtonsContainer.style.flexWrap = 'wrap';
    filterButtonsContainer.style.gap = '10px';
    filterButtonsContainer.style.padding = '10px';
    filterButtonsContainer.style.alignItems = 'center';

    // 生成筛选按钮
    function createFilterButtons(filters) {
      let mainContainer = document.createElement('div');
      mainContainer.style.display = 'flex';
      mainContainer.style.flexWrap = 'wrap';
      mainContainer.style.width = '100%';
      for (let key in filters) {
        let filter = filters[key];
        let input = document.createElement('input');
        input.type = filter.type;
        input.id = key;
        input.style.marginRight = '5px';
        if (filter.type === 'text') {
          input.style.border = '1px solid #ccc';
          input.style.padding = '5px';
          input.style.borderRadius = '5px';
        }
        Object.entries(filter.attribute || {}).forEach(([attr, value]) => {
          input.setAttribute(attr, value);
        });
        let label = document.createElement('label');
        label.htmlFor = key;
        label.textContent = key;
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.marginRight = '5px';
        let container = document.createElement('div');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.marginRight = '10px';
        if (['checkbox', 'radio'].includes(filter.type)) {
          input.addEventListener('change', () => deal());
          container.appendChild(input);
          container.appendChild(label);
        } else {
          let timeout;
          input.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => deal(), 500);
          });
          container.appendChild(label);
          container.appendChild(input);
        }
        mainContainer.appendChild(container);
      }
      return mainContainer;
    }

    filterButtonsContainer.appendChild(createFilterButtons(defaultFilters));
    contentArea.appendChild(filterButtonsContainer);

    // 结果区域
    let resultArea = document.createElement('div');
    contentArea.appendChild(resultArea);

    // 筛选和重算逻辑
    function deal() {
      const enabledFilters = Object.entries(defaultFilters).flatMap(([key, filter]) => {
        const input = filterButtonsContainer.querySelector(`#${CSS.escape(key)}`);
        if (filter.type === 'checkbox') {
          return input.checked ? [{ ...filter, value: true }] : [];
        }
        const searchTerms = new Set(input.value.trim().toUpperCase().split(/\s+/).filter(Boolean));
        return [{ ...filter, value: searchTerms }];
      });
      const filteredGiftList = allGiftList.filter(item =>
        enabledFilters.every(filter => filter.filter(item, filter.value, giftInfo))
      );
      renderResult(groupGiftStats(filteredGiftList, giftInfo));
    }

    // 渲染统计结果
    function renderResult(groupedGiftStats) {
      resultArea.replaceChildren();
      const sortedGroups = Array.from(groupedGiftStats.entries()).sort(([boxIdA], [boxIdB]) => {
        const indexA = giftInfo.boxOrderById.get(boxIdA) ?? Number.MAX_SAFE_INTEGER;
        const indexB = giftInfo.boxOrderById.get(boxIdB) ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB || boxIdA - boxIdB;
      });

      sortedGroups.forEach(([originalGiftId, group]) => {
        const title = document.createElement('h2');
        const titleLink = document.createElement('a');
        titleLink.href = `https://gift.shuvi.moe/gifts/${originalGiftId}`;
        titleLink.textContent = `${group.originalGiftName} (总抽数: ${group.totalCount})`;
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        title.appendChild(titleLink);
        title.style.marginTop = '20px';
        resultArea.appendChild(title);

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.margin = '10px 0';

        const headerRow = table.createTHead().insertRow();
        ['礼物名称', '数量', '你的概率', null].forEach((headerText, index) => {
          const th = document.createElement('th');
          if (index === 3) {
            const link = document.createElement('a');
            link.href = `https://gift.shuvi.moe/gifts/${originalGiftId}`;
            link.textContent = '公示概率 (取基础概率，点击查看完整概率)';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            th.appendChild(link);
          } else {
            th.textContent = headerText;
          }
          th.style.padding = '8px';
          th.style.border = '1px solid #ddd';
          th.style.textAlign = 'left';
          headerRow.appendChild(th);
        });

        const boxInfo = giftInfo.boxById.get(originalGiftId);
        const giftOrderById = new Map(boxInfo?.gifts.map((gift, index) => [gift.id, index]));
        const sortedGifts = Array.from(group.gifts.entries()).sort(([giftIdA], [giftIdB]) => {
          const indexA = giftOrderById.get(giftIdA) ?? Number.MAX_SAFE_INTEGER;
          const indexB = giftOrderById.get(giftIdB) ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB || giftIdA - giftIdB;
        });
        const tbody = table.createTBody();

        sortedGifts.forEach(([giftId, gift]) => {
          const row = tbody.insertRow();
          const cells = Array.from({ length: 4 }, () => row.insertCell());
          const giftLink = document.createElement('a');
          giftLink.href = `https://gift.shuvi.moe/gifts/${giftId}`;
          giftLink.textContent = gift.giftName;
          giftLink.target = '_blank';
          giftLink.rel = 'noopener noreferrer';
          cells[0].appendChild(giftLink);
          cells[1].textContent = gift.count;
          cells[2].textContent = group.totalCount > 0
            ? `${(gift.count / group.totalCount * 100).toFixed(2)}%`
            : '0%';

          const officialPercentage = giftInfo.resolveGift(originalGiftId, giftId).gift?.percentage?.[0];
          cells[3].textContent = Number.isFinite(officialPercentage) ? `${officialPercentage}%` : 'N/A';
          cells.forEach(cell => {
            cell.style.padding = '8px';
            cell.style.border = '1px solid #ddd';
            cell.style.textAlign = 'left';
          });
        });

        resultArea.appendChild(table);
      });
    }

    deal();

    dialog.style.display = 'block';
  }

  // 注册菜单项
  if (document.location.host.endsWith('shuvi.moe')) {
    unsafeWindow.giftList = getAllGiftList();
  } else {
    GM_registerMenuCommand("检查盲盒数据", fetchAllBlindBoxes);
  }

})();