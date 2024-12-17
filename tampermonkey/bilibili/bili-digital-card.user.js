// ==UserScript==
// @name         Bilibili 收藏集奖励筛查脚本
// @namespace    Schwi
// @version      0.1
// @description  使用 API 调用来收集 Bilibili 收藏集，筛选未领取的奖励
// @author       Schwi
// @match        *://*.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

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
              collectList.push(cardData.data);
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
                  lottery.owned_item_amount >= lottery.require_item_amount && // 可领取
                  lottery.has_redeemed_cnt === 0 && // 未领取
                  lottery.endtime * 1000 >= new Date().getTime() // 未过期
              ) ||
              collectItem.collect_list.collect_chain?.some(
                (lottery) =>
                  lottery.owned_item_amount >= lottery.require_item_amount &&
                  lottery.has_redeemed_cnt === 0 &&
                  lottery.endtime * 1000 >= new Date().getTime()
              )
            );
          });

          console.log("筛选后的收集列表:", filteredCollectList);
        }
      }
    });
  }

  // 在 Tampermonkey 菜单中添加一个按钮
  GM_registerMenuCommand("检查收藏集", collectDigitalCards);
})();
