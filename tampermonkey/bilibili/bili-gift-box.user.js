// ==UserScript==
// @name         Bilibili 盲盒统计
// @namespace    Schwi
// @version      0.1
// @description  调用 API 来收集自己的 Bilibili 盲盒概率，公示概率真的准确吗？（受API限制，获取的记录大约只有最近2个自然月）
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.live.bilibili.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  const api = {
    getBlindBox: (nextId = 0, month = '', pageSize = 100) => `https://api.live.bilibili.com/xlive/fuxi-interface/gift/blindGiftStream?nextId=${nextId}&month=${month}&pageSize=${pageSize}`,
    getBlindBoxByIds: (ids = [], nextId = 0, month = '', size = 100) => `https://api.live.bilibili.com/xlive/fuxi-interface/BlindBoxController/getRecordsByIds?_ts_rpc_args_=[${ids},${nextId},"${month}",${size}]`
  }

  // 盲盒信息，percentage为官方公示概率（不包含活动倍率）
  const giftInfo = {
    32649: {
      id: '32649',
      name: '星月盲盒',
      price: 50,
      gifts: [
        { id: '32698', name: '小蛋糕', price: 15, percentage: 20, subGifts: {} },
        { id: '32694', name: '星与月', price: 25, percentage: 24.3, subGifts: {} },
        { id: '32075', name: '情书', price: 52, percentage: 23.15, subGifts: {} },
        { id: '34188', name: '少女祈祷', price: 66, percentage: 20, subGifts: {} },
        { id: '32695', name: '冲鸭', price: 99, percentage: 10.3, subGifts: {} },
        { id: '32700', name: '星河入梦', price: 199, percentage: 2, subGifts: {} },
        { id: '0', name: '落樱缤纷', price: 600, percentage: 0.25, subGifts: {} }
      ]
    },
    32251: {
      id: '32251',
      name: '心动盲盒',
      price: 150,
      gifts: [
        {
          id: '32125', name: '电影票', price: 20, percentage: 6, subGifts: {
            34614: { id: '34614', name: '梦幻气球' },
            34620: { id: '34620', name: '冰晶雪花' },
            34626: { id: '34626', name: '盛典礼花' }
          }
        },
        {
          id: '32126', name: '棉花糖', price: 90, percentage: 44.5, subGifts: {
            34615: { id: '34615', name: '星星糖' },
            34621: { id: '34621', name: '水晶星星' },
            34627: { id: '34627', name: '星际徽章' }
          }
        },
        {
          id: '32128', name: '爱心抱枕', price: 160, percentage: 45.56, subGifts: {
            34616: { id: '34616', name: '梦境玫瑰' },
            34622: { id: '34622', name: '冰晶之球' },
            34628: { id: '34628', name: '荣耀皇冠' }
          }
        },
        {
          id: '0', name: '绮彩权杖', price: 400, percentage: 3.7, subGifts: {
            34617: { id: '34617', name: '' },
            34623: { id: '34623', name: '' },
            34629: { id: '34629', name: '光辉之星' }
          }
        },
        {
          id: '0', name: '时空之站', price: 1000, percentage: 0.12, subGifts: {
            34618: { id: '34618', name: '' },
            34624: { id: '34624', name: '' },
            34630: { id: '34630', name: '' }
          }
        },
        {
          id: '0', name: '蛇形护符', price: 2000, percentage: 0.08, subGifts: {
            34619: { id: '34619', name: '' },
            34625: { id: '34625', name: '' },
            34631: { id: '34631', name: '' }
          }
        },
        {
          id: '0', name: '浪漫城堡', price: 22330, percentage: 0.04, subGifts: {
            34620: { id: '34620', name: '' },
            34626: { id: '34626', name: '' },
            34632: { id: '34632', name: '' }
          }
        }
      ]
    },
    34052: {
      id: '34052',
      name: '奇遇盲盒',
      price: 330,
      gifts: [
        { id: '34059', name: '魔力球', price: 50, percentage: 5, subGifts: {} },
        { id: '34058', name: '精灵兔', price: 100, percentage: 41.67, subGifts: {} },
        { id: '34057', name: '许愿神灯', price: 400, percentage: 49, subGifts: {} },
        { id: '0', name: '梦幻花车', price: 1000, percentage: 4, subGifts: {} },
        { id: '0', name: '奇遇巴士', price: 2000, percentage: 0.13, subGifts: {} },
        { id: '0', name: '星愿飞船', price: 8000, percentage: 0.1, subGifts: {} },
        { id: '0', name: '奇幻古堡', price: 28880, percentage: 0.1, subGifts: {} }
      ]
    },
    34052: {
      id: '32368',
      name: '闪耀盲盒',
      price: 500,
      gifts: [
        { id: '0', name: '璀璨钻石', price: 200, percentage: 9.96, subGifts: {} },
        { id: '0', name: '旅行日记', price: 300, percentage: 36, subGifts: {} },
        { id: '0', name: '机械幻想', price: 510, percentage: 50.1, subGifts: {} },
        { id: '0', name: '时空之站', price: 1000, percentage: 3.4, subGifts: {} },
        { id: '0', name: '蛇形护符', price: 2000, percentage: 0.28, subGifts: {} },
        { id: '0', name: '金蛇献福', price: 5000, percentage: 0.16, subGifts: {} },
        { id: '0', name: '幻影飞船', price: 30000, percentage: 0.1, subGifts: {} }
      ]
    },
    34052: {
      id: '32369',
      name: '至尊盲盒',
      price: 1000,
      gifts: [
        { id: '0', name: '璀璨钻石', price: 200, percentage: 0.1, subGifts: {} },
        { id: '0', name: '绮彩权杖', price: 400, percentage: 22.75, subGifts: {} },
        { id: '0', name: '许愿精灵', price: 888, percentage: 35, subGifts: {} },
        { id: '0', name: '星际启航', price: 1010, percentage: 40.14, subGifts: {} },
        { id: '0', name: '蛇形护符', price: 2000, percentage: 1.45, subGifts: {} },
        { id: '0', name: '金蛇献福', price: 5000, percentage: 0.32, subGifts: {} },
        { id: '0', name: '奇幻之城', price: 32000, percentage: 0.24, subGifts: {} }
      ]
    }
  };

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

  // 循环请求盲盒数据
  async function fetchAllBlindBoxes() {
    let nextId = 0;
    let month = '';
    let isMore = 1;

    const allGiftList = [];
    while (isMore) {
      try {
        const response = await apiRequest(api.getBlindBox(nextId, month));
        if (response.code === 0 && response.data) {
          const { list, params } = response.data;
          allGiftList.push(...list);
          console.log('当前盲盒数据:', list, params);
          nextId = params.nextId;
          month = params.month;
          isMore = params.isMore;
        } else {
          console.error('API 返回错误:', response.message);
          break;
        }
      } catch (error) {
        console.error('请求失败:', error);
        break;
      }
    }

    // 去重并存储
    const mergedGiftList = saveGiftList(allGiftList);
    console.log('合并后的盲盒数据:', mergedGiftList);

    // {originalGiftId: {giftId: giftName}} 格式化
    const giftIdMap = mergedGiftList.reduce((acc, gift) => {
      const { originalGiftId, giftId, giftName } = gift;
      if (!acc[originalGiftId]) {
        acc[originalGiftId] = {};
      }
      acc[originalGiftId][giftId] = giftName;
      return acc;
    }, {});
    console.log('礼物 ID 映射（按 originalGiftId 分组）:', giftIdMap);

    // 根据 originalGiftId 分组统计 giftId 数量
    const groupedGiftStats = {};
    mergedGiftList.forEach(gift => {
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
      const giftInfoEntry = giftInfo[originalGiftId]?.gifts.find(g => g.id === giftId || Object.keys(g.subGifts).includes(giftId));
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

      const num = parseInt(giftNum, 10);
      groupedGiftStats[originalGiftId].totalCount += num;
      groupedGiftStats[originalGiftId].gifts[mainGiftId].count += num;
    });

    // 计算每个 giftId 的百分比概率
    Object.values(groupedGiftStats).forEach(group => {
      Object.values(group.gifts).forEach(gift => {
        gift.percentage = ((gift.count / group.totalCount) * 100).toFixed(2) + '%';
      });
    });

    console.log('按 originalGiftId 分组的盲盒统计:', groupedGiftStats);
  }

  // 注册菜单项
  GM_registerMenuCommand("检查盲盒数据", fetchAllBlindBoxes);

})();