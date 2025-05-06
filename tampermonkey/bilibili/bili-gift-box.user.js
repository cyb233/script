// ==UserScript==
// @name         Bilibili 盲盒统计
// @namespace    Schwi
// @version      0.6
// @description  调用 API 来收集自己的 Bilibili 盲盒概率，公示概率真的准确吗？（受API限制，获取的记录大约只有最近2个自然月，本脚本会本地持久化储存记录）
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.live.bilibili.com
// @connect      shuvi.moe
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(async function () {
  'use strict';

  const api = {
    getBlindBox: (nextId = 0, month = '', pageSize = 100) => `https://api.live.bilibili.com/xlive/fuxi-interface/gift/blindGiftStream?nextId=${nextId}&month=${month}&pageSize=${pageSize}`,
    getBlindBoxByIds: (ids = [], nextId = 0, month = '', size = 100) => `https://api.live.bilibili.com/xlive/fuxi-interface/BlindBoxController/getRecordsByIds?_ts_rpc_args_=[${ids},${nextId},"${month}",${size}]`
  }

  const boxOrder = ['星月盲盒', '心动盲盒', '奇遇盲盒', '闪耀盲盒', '至尊盲盒']

  // API 请求函数
  async function apiRequest(url, retry = 3) {
    for (let attempt = 1; attempt <= retry; attempt++) {
      try {
        const response = await GM.xmlHttpRequest({
          method: 'GET',
          url: url,
        });
        const data = JSON.parse(response.responseText);
        return data;
      } catch (e) {
        if (attempt === retry) {
          throw e;
        }
      }
    }
  }


  // 盲盒信息，percentage为官方公示概率（不包含活动倍率）
  const getGiftInfo = (() => {
    let giftInfo = null;
    return async function () {
      if (giftInfo) {
        return giftInfo;
      }

      try {
        giftInfo = await apiRequest('https://gift.shuvi.moe/bili-gift-box.json');
        return giftInfo;
      } catch (error) {
        console.error('获取盲盒信息失败:', error);
        // 如果获取失败，使用本地存储的最基本的盲盒信息
        return {
          "32649": {
            "id": 32649,
            "name": "星月盲盒",
            "price": 50,
            "gifts": [
              { "id": 32698, "name": "小蛋糕", "price": 15, "percentage": 20, "subGifts": {} },
              { "id": 32694, "name": "星与月", "price": 25, "percentage": 24.3, "subGifts": {} },
              { "id": 32075, "name": "情书", "price": 52, "percentage": 23.15, "subGifts": {} },
              { "id": 34188, "name": "少女祈祷", "price": 66, "percentage": 20, "subGifts": {} },
              { "id": 32695, "name": "冲鸭", "price": 99, "percentage": 10.3, "subGifts": {} },
              { "id": 32700, "name": "星河入梦", "price": 199, "percentage": 2, "subGifts": {} },
              { "id": 32692, "name": "落樱缤纷", "price": 600, "percentage": 0.25, "subGifts": {} }
            ]
          },
          "32251": {
            "id": 32251,
            "name": "心动盲盒",
            "price": 150,
            "gifts": [
              { "id": 32125, "name": "电影票", "price": 20, "percentage": 6, "subGifts": {} },
              { "id": 32126, "name": "棉花糖", "price": 90, "percentage": 44.5, "subGifts": {} },
              { "id": 32128, "name": "爱心抱枕", "price": 160, "percentage": 45.56, "subGifts": {} },
              { "id": 32281, "name": "绮彩权杖", "price": 400, "percentage": 3.7, "subGifts": {} },
              { "id": 34082, "name": "时空之站", "price": 1000, "percentage": 0.12, "subGifts": {} },
              { "id": 34894, "name": "蛇形护符", "price": 2000, "percentage": 0.08, "subGifts": {} },
              { "id": 32132, "name": "浪漫城堡", "price": 22330, "percentage": 0.04, "subGifts": {} }
            ]
          },
          "34052": {
            "id": 34052,
            "name": "奇遇盲盒",
            "price": 330,
            "gifts": [
              { "id": 34059, "name": "魔力球", "price": 50, "percentage": 5, "subGifts": {} },
              { "id": 34058, "name": "精灵兔", "price": 100, "percentage": 41.67, "subGifts": {} },
              { "id": 34057, "name": "许愿神灯", "price": 400, "percentage": 49, "subGifts": {} },
              { "id": 34530, "name": "梦幻花车", "price": 1000, "percentage": 4, "subGifts": {} },
              { "id": 34055, "name": "奇遇巴士", "price": 2000, "percentage": 0.13, "subGifts": {} },
              { "id": 34054, "name": "星愿飞船", "price": 8000, "percentage": 0.1, "subGifts": {} },
              { "id": 32683, "name": "奇幻古堡", "price": 28880, "percentage": 0.1, "subGifts": {} }
            ]
          },
          "32368": {
            "id": 32368,
            "name": "闪耀盲盒",
            "price": 500,
            "gifts": [
              { "id": 32360, "name": "璀璨钻石", "price": 200, "percentage": 9.96, "subGifts": {} },
              { "id": 32359, "name": "旅行日记", "price": 300, "percentage": 36, "subGifts": {} },
              { "id": 34000, "name": "机械幻想", "price": 510, "percentage": 50.1, "subGifts": {} },
              { "id": 34082, "name": "时空之站", "price": 1000, "percentage": 3.4, "subGifts": {} },
              { "id": 34894, "name": "蛇形护符", "price": 2000, "percentage": 0.28, "subGifts": {} },
              { "id": 34895, "name": "金蛇献福", "price": 5000, "percentage": 0.16, "subGifts": {} },
              { "id": 32356, "name": "幻影飞船", "price": 30000, "percentage": 0.1, "subGifts": {} }
            ]
          },
          "32369": {
            "id": 32369,
            "name": "至尊盲盒",
            "price": 1000,
            "gifts": [
              { "id": 32360, "name": "璀璨钻石", "price": 200, "percentage": 0.1, "subGifts": {} },
              { "id": 32281, "name": "绮彩权杖", "price": 400, "percentage": 22.75, "subGifts": {} },
              { "id": 32363, "name": "许愿精灵", "price": 888, "percentage": 35, "subGifts": {} },
              { "id": 33999, "name": "星际启航", "price": 1010, "percentage": 40.14, "subGifts": {} },
              { "id": 34894, "name": "蛇形护符", "price": 2000, "percentage": 1.45, "subGifts": {} },
              { "id": 34895, "name": "金蛇献福", "price": 5000, "percentage": 0.32, "subGifts": {} },
              { "id": 32361, "name": "奇幻之城", "price": 32000, "percentage": 0.24, "subGifts": {} }
            ]
          }
        }
      }
    };
  })();

  // 去重合并记录并存储
  function saveGiftList(newGifts) {
    const storedGifts = GM_getValue('allGiftList', []);
    const mergedGifts = [...storedGifts, ...newGifts].reduce((acc, gift) => {
      if (!acc.some(existingGift => existingGift.id === gift.id)) {
        acc.push(gift);
      }
      return acc;
    }, []);
    GM_setValue('allGiftList', mergedGifts);
    return mergedGifts;
  }

  // 工具函数：创建 dialog
  function createDialog(id, title, content) {
    let dialog = document.createElement('div');
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

    let contentArea = document.createElement('div');
    contentArea.innerHTML = content;
    contentArea.style.padding = '10px';
    contentArea.style.overflowY = 'auto'; // 允许垂直滚动
    contentArea.style.height = 'calc(100% - 40px)'; // 减去 header 的高度
    dialog.appendChild(contentArea);

    document.body.appendChild(dialog);

    return {
      dialog: dialog,
      header: header,
      titleElement: titleElement,
      closeButton: closeButton,
      contentArea: contentArea
    };
  }

  // 循环请求盲盒数据
  async function fetchAllBlindBoxes() {
    let nextId = 0;
    let month = '';
    let isMore = 1;

    const allGiftList = [];

    // 创建进度弹窗
    let { dialog: progressDialog, contentArea: progressContentArea } = createDialog('progressDialog', '盲盒数据收集进度', `<p>已收集盲盒数：<span id='collectedCount'>0</span></p>`);
    progressDialog.style.display = 'block';

    while (isMore) {
      try {
        const response = await apiRequest(api.getBlindBox(nextId, month));
        if (response.code === 0 && response.data) {
          const { list, params } = response.data;
          list.forEach(gift => {
            gift.id = parseInt(gift.id, 10);
            gift.originalGiftId = parseInt(gift.originalGiftId, 10);
            gift.giftId = parseInt(gift.giftId, 10);
            gift.giftNum = parseInt(gift.giftNum, 10);
            delete gift.giftImg;
          })
          allGiftList.push(...list);
          console.log('当前盲盒数据:', list, params);
          nextId = params.nextId;
          month = params.month;
          isMore = params.isMore;

          // 更新进度弹窗
          progressContentArea.querySelector('#collectedCount').textContent = allGiftList.length;

        } else {
          console.error('API 返回错误:', response.message);
          break;
        }
      } catch (error) {
        console.error('请求失败:', error);
        break;
      }
    }

    // 关闭进度弹窗
    progressDialog.remove();

    // 去重并存储
    const mergedGiftList = saveGiftList(allGiftList);
    console.log('合并后的盲盒数据:', mergedGiftList);

    // {originalGiftId: {giftId: giftName}} 格式化，仅保存giftInfo中gifts及subGifts中不存在的礼物
    const giftMap = {};
    mergedGiftList.forEach(async gift => {
      const { originalGiftId, originalGiftName, giftId, giftName } = gift;
      if (!giftMap[originalGiftId]) {
        giftMap[originalGiftId] = { name: originalGiftName };
      }
      const giftInfoEntry = (await getGiftInfo())[originalGiftId]?.gifts.find(g => g.id === giftId || Object.values(g.subGifts).some(gift => gift.id === giftId));
      if (!giftInfoEntry) {
        giftMap[originalGiftId][giftId] = giftName;
      }
    });
    console.log('礼物 ID 映射（按 originalGiftId 分组）:', giftMap);

    // 根据 originalGiftId 分组统计 giftId 数量
    const groupedGiftStats = {};
    mergedGiftList.forEach(async gift => {
      const { originalGiftId, originalGiftName, giftId, giftName, giftNum } = gift;
      if (!groupedGiftStats[originalGiftId]) {
        groupedGiftStats[originalGiftId] = {
          originalGiftName,
          totalCount: 0,
          gifts: {}
        };
      }

      // 检查 giftId 是否属于 subGifts
      let mainGiftId = giftId;
      const giftInfoEntry = (await getGiftInfo())[originalGiftId]?.gifts.find(g => g.id === giftId || Object.values(g.subGifts).some(gift => gift.id === giftId));
      if (giftInfoEntry) {
        mainGiftId = giftInfoEntry.id;
      }

      if (!groupedGiftStats[originalGiftId].gifts[mainGiftId]) {
        groupedGiftStats[originalGiftId].gifts[mainGiftId] = {
          giftName: giftInfoEntry?.name || giftName,
          count: 0,
          percentage: 0
        };
      }

      groupedGiftStats[originalGiftId].totalCount += giftNum;
      groupedGiftStats[originalGiftId].gifts[mainGiftId].count += giftNum;
    });

    // 计算每个 giftId 的百分比概率
    Object.values(groupedGiftStats).forEach(group => {
      Object.values(group.gifts).forEach(gift => {
        gift.percentage = ((gift.count / group.totalCount) * 100).toFixed(2) + '%';
      });
    });

    console.log('按 originalGiftId 分组的盲盒统计:', groupedGiftStats);

    // 显示结果弹窗
    showResultsDialog(groupedGiftStats);
  }

  // 显示结果 dialog
  function showResultsDialog(groupedGiftStats) {
    const { dialog, titleElement, closeButton, contentArea } = createDialog('resultsDialog', '盲盒统计结果', '');

    // 获取排序后的 originalGiftId 数组
    const sortedOriginalGiftIds = Object.entries(groupedGiftStats)
      .sort(([originalGiftIdA, groupA], [originalGiftIdB, groupB]) => {
        const nameA = groupA.originalGiftName;
        const nameB = groupB.originalGiftName;

        const indexA = boxOrder.indexOf(nameA);
        const indexB = boxOrder.indexOf(nameB);

        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;

        return indexA - indexB;
      })
      .map(([originalGiftId]) => originalGiftId);

    // 循环创建每个盲盒的表格
    sortedOriginalGiftIds.forEach(originalGiftId => {
      const group = groupedGiftStats[originalGiftId];

      // 创建标题
      let title = document.createElement('h2');
      title.textContent = `${group.originalGiftName} (总抽数: ${group.totalCount})`;
      title.style.marginTop = '20px';
      contentArea.appendChild(title);

      // 创建表格
      let table = document.createElement('table');
      table.style.width = '100%';
      table.style.borderCollapse = 'collapse';
      table.style.margin = '10px 0';

      // 创建表头
      let thead = table.createTHead();
      let headerRow = thead.insertRow();
      let headers = ['礼物名称', '数量', '你的概率', '公示概率'];
      headers.forEach(headerText => {
        let th = document.createElement('th');
        th.textContent = headerText;
        th.style.padding = '8px';
        th.style.border = '1px solid #ddd';
        th.style.textAlign = 'left';
        headerRow.appendChild(th);
      });

      // 创建表体
      let tbody = table.createTBody();

      // 获取排序后的 gifts 数组
      const sortedGifts = Object.entries(group.gifts).sort(async ([giftIdA, giftA], [giftIdB, giftB]) => {
        const giftInfoA = (await getGiftInfo())[originalGiftId]?.gifts.find(g => g.id === parseInt(giftIdA));
        const giftInfoB = (await getGiftInfo())[originalGiftId]?.gifts.find(g => g.id === parseInt(giftIdB));

        if (!giftInfoA && !giftInfoB) return 0;
        if (!giftInfoA) return 1;
        if (!giftInfoB) return -1;

        const indexA = (await getGiftInfo())[originalGiftId].gifts.indexOf(giftInfoA);
        const indexB = (await getGiftInfo())[originalGiftId].gifts.indexOf(giftInfoB);
        return indexA - indexB;
      });

      sortedGifts.forEach(async ([giftId, gift]) => {
        let row = tbody.insertRow();
        let cell1 = row.insertCell();
        let cell2 = row.insertCell();
        let cell3 = row.insertCell();
        let cell4 = row.insertCell();

        let giftLink = document.createElement('a');
        giftLink.href = `https://shuvi.moe/sync-bilibili-gifts/#${giftId}`;
        giftLink.textContent = gift.giftName;
        giftLink.target = '_blank'; // 在新标签页中打开
        cell1.appendChild(giftLink);

        cell2.textContent = gift.count;
        cell3.textContent = gift.percentage;

        // 获取公示概率
        const officialPercentage = (await getGiftInfo())[originalGiftId]?.gifts.find(g => g.id === parseInt(giftId))?.percentage;
        cell4.textContent = officialPercentage ? officialPercentage + '%' : 'N/A';

        [cell1, cell2, cell3, cell4].forEach(cell => {
          cell.style.padding = '8px';
          cell.style.border = '1px solid #ddd';
          cell.style.textAlign = 'left';
        });
      });

      // 将表格添加到弹窗内容区域
      contentArea.appendChild(table);
    });

    dialog.style.display = 'block';
  }

  // 注册菜单项
  GM_registerMenuCommand("检查盲盒数据", fetchAllBlindBoxes);

})();