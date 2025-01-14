// ==UserScript==
// @name         Bilibili 收藏集奖励筛查脚本
// @namespace    Schwi
// @version      0.2
// @description  调用 API 来收集自己的 Bilibili 收藏集，并筛选未领取的奖励，结果输出到控制台，复制结果中的url字段打开即可，注意，至少存在一张卡牌才能本项目的接口被检测到
// @author       Schwi
// @match        *://*.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

  // 检查脚本是否已经运行
  if (window.hasBiliDigitalCardScriptRun) {
    console.log("脚本已经在当前页面运行过了。");
    return;
  }
  window.hasBiliDigitalCardScriptRuned = true;

  const REDEEM_ITEM_TYPE = {
    Card: 1,
    Emoji: 2,
    Pendant: 3,
    Suit: 4,
    MaterialCombination: 5,
    AudioCard: 6,
    Jump: 7,
    Cdk: 8,
    RealGoods: 9,
    LimitMaterialCombination: 10,
    CustomReward: 11,
    DynamicEmoji: 15,
    DiamondAvatar: 1000,
    CollectorMedal: 1001,
  };

  // 发起 API 请求的函数
  function apiRequest(url, callback) {
    console.log(`正在请求: ${url}`);
    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      onload: function (response) {
        try {
          const data = JSON.parse(response.responseText);
          console.log(`来自 ${url} 的响应:`, data);
          callback(data);
        } catch (error) {
          console.error(`解析来自 ${url} 的响应时出错:`, error);
          callback(null);
        }
      },
      onerror: function (error) {
        console.error(`请求 ${url} 失败:`, error);
        callback(null);
      },
    });
  }

  // 主函数，用于收集收藏集
  function collectDigitalCards() {
    console.log("开始收集收藏集...");
    const collectionUrl =
      "https://api.bilibili.com/x/vas/smelt/my_decompose/info?scene=1";
    let collectList = [];

    apiRequest(collectionUrl, function (collectionData) {
      if (!collectionData || collectionData.code !== 0) {
        console.error(
          "获取收藏列表失败:",
          collectionData ? collectionData.message : "无响应"
        );
        return;
      }

      console.log("成功获取收藏列表:", collectionData.data.list);
      const collections = collectionData.data.list;
      let collectionCount = collections.length;
      let processedCollections = 0;

      collections.forEach((collection) => {
        console.log(
          `处理收藏: ${collection.act_name} (ID: ${collection.act_id})`
        );
        const detailUrl = `https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${collection.act_id}`;

        apiRequest(detailUrl, function (detailData) {
          if (!detailData || detailData.code !== 0) {
            console.error(
              `获取 act_id ${collection.act_id} 的基本信息失败:`,
              detailData ? detailData.message : "无响应"
            );
            processedCollections++;
            checkCompletion();
            return;
          }

          console.log(
            `成功获取 act_id ${collection.act_id} 的基本信息:`,
            detailData.data
          );
          const lotteries = detailData.data.lottery_list;
          let lotteryCount = lotteries.length;
          let processedLotteries = 0;

          lotteries.forEach((lottery) => {
            console.log(
              `处理详情: ${lottery.lottery_name} (ID: ${lottery.lottery_id})`
            );
            const cardDetailUrl = `https://api.bilibili.com/x/vas/dlc_act/lottery_home_detail?act_id=${collection.act_id}&lottery_id=${lottery.lottery_id}`;

            apiRequest(cardDetailUrl, function (cardData) {
              if (!cardData || cardData.code !== 0) {
                console.error(
                  `获取 act_id ${collection.act_id} 和 lottery_id ${lottery.lottery_id} 的详情失败:`,
                  cardData ? cardData.message : "无响应"
                );
                processedLotteries++;
                checkLotteryCompletion();
                return;
              }

              console.log(
                `成功获取 act_id ${collection.act_id} 和 lottery_id ${lottery.lottery_id} 的详情:`,
                cardData.data
              );
              // 根据需要处理卡牌数据
              collectList.push({ url: `https://www.bilibili.com/blackboard/activity-Mz9T5bO5Q3.html?id=${collection.act_id}&type=dlc`, ...cardData.data });
              processedLotteries++;
              checkLotteryCompletion();
            });

            function checkLotteryCompletion() {
              if (processedLotteries === lotteryCount) {
                processedCollections++;
                checkCompletion();
              }
            }
          });
        });
      });

      function checkCompletion() {
        if (processedCollections === collectionCount) {
          console.log("所有收藏已处理。最终收集列表:", collectList);

          // 筛选出符合条件的收藏集
          const filteredCollectList = collectList.filter((collectItem) => {
            return (
              collectItem.collect_list.collect_infos?.some(
                (lottery) =>
                  canGetReward(lottery)
              ) ||
              collectItem.collect_list.collect_chain?.some(
                (lottery) =>
                  canGetReward(lottery)
              )
            );
          });

          console.log("筛选后的收集列表:", filteredCollectList);
        }
      }

      /**
       * 别问我为啥这么写，B站前端JS就是这么判断的
       * 
       * @param {object} reward 每条奖励的信息
       * @param {string} scene 不知道是啥，还没研究明白，先这么写着
       * @returns boolean 这个奖励是否能被领取
       */
      function canGetReward(reward, scene = "milestone") {
        const curTime = new Date().getTime();
        const has_redeemed_cnt = reward.has_redeemed_cnt;
        const redeem_item_type = reward.redeem_item_type;
        const total_stock = reward.total_stock;
        const remain_stock = reward.remain_stock;
        const redeem_cond_type = reward.redeem_cond_type;
        const owned_item_amount = reward.owned_item_amount;
        const require_item_amount = reward.require_item_amount;
        const unlock_condition = reward.unlock_condition;
        const redeem_count = reward.redeem_count;
        const end_time = reward.end_time;
        const unlock_condition_1 = unlock_condition || {};
        const unlocked = unlock_condition_1.unlocked;
        const lock_type = unlock_condition_1.lock_type;
        const unlock_threshold = unlock_condition_1.unlock_threshold;
        const expire_at = unlock_condition_1.expire_at;
        let exceedReceiveTime = false;
        if ([REDEEM_ITEM_TYPE.CollectorMedal, REDEEM_ITEM_TYPE.DiamondAvatar].includes(redeem_item_type)) {
          exceedReceiveTime = curTime > end_time;
        } else {
          if (!(curTime > end_time)) {
            exceedReceiveTime = true;
          }
          if (!reward.effective_forever) {
            exceedReceiveTime = true;
          }
        }
        if (unlocked || "milestone" === scene) {
          if (!(has_redeemed_cnt && [REDEEM_ITEM_TYPE.CustomReward].includes(redeem_item_type))) {
            if (!(has_redeemed_cnt && "card_number" !== redeem_cond_type)) {
              if (!((+total_stock > -1 && +remain_stock <= 0) || exceedReceiveTime)) {
                if (!("custom" === redeem_cond_type || [REDEEM_ITEM_TYPE.DiamondAvatar].includes(redeem_item_type))) {
                  if (!((owned_item_amount || 0) < require_item_amount)) {
                    return true
                  }
                }
              }
            }
          }
        }
        return false
      }

    })
  }

  // 在 Tampermonkey 菜单中添加一个按钮
  GM_registerMenuCommand("检查收藏集", collectDigitalCards);
})();
