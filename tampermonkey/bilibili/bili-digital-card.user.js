// ==UserScript==
// @name         Bilibili 收藏集奖励筛查脚本
// @namespace    Schwi
// @version      1.2
// @description  调用 API 来收集自己的 Bilibili 收藏集，并筛选未领取的奖励。注意，一套收藏集中至少存在一张卡牌才能本项目的接口被检测到!
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.bilibili.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @noframes
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
    "use strict";

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

    // 创建进度条容器
    function createProgressBar(totalTasks) {
        const progressContainer = document.createElement("div");
        progressContainer.style.position = "fixed";
        progressContainer.style.top = "50%";
        progressContainer.style.left = "50%";
        progressContainer.style.transform = "translate(-50%, -50%)";
        progressContainer.style.width = "80%";
        progressContainer.style.padding = "10px";
        progressContainer.style.backgroundColor = "#fff";
        progressContainer.style.borderRadius = "10px";
        progressContainer.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        progressContainer.style.zIndex = "10000";
        progressContainer.style.textAlign = "center";

        const progressTitle = document.createElement("h3");
        progressTitle.textContent = "任务进行中...";
        progressContainer.appendChild(progressTitle);

        const progressBar = document.createElement("progress");
        progressBar.style.width = "100%";
        progressBar.max = totalTasks;
        progressBar.value = 0;
        progressContainer.appendChild(progressBar);

        const progressText = document.createElement("p");
        progressText.style.marginTop = "10px";
        progressText.textContent = `0/${totalTasks} 完成`;
        progressContainer.appendChild(progressText);

        document.body.appendChild(progressContainer);

        return {
            update: function (currentTask) {
                progressBar.value = currentTask;
                progressText.textContent = `${currentTask}/${totalTasks} 完成`;
            },
            hide: function () {
                document.body.removeChild(progressContainer);
            }
        };
    }

    // 发起 API 请求的函数
    function apiRequest(url, callback) {
        console.debug(`正在请求: ${url}`);
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function (response) {
                try {
                    const data = JSON.parse(response.responseText);
                    console.debug(`来自 ${url} 的响应:`, data);
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
                const errorMsg = `获取收藏列表失败: ${collectionData ? collectionData.message : "无响应"}`
                console.error(errorMsg);
                alert(errorMsg)
                return;
            }
            if (!collectionData.data.list) {
                const errorMsg = `获取收藏列表失败: 您没有收藏集`
                console.error(errorMsg);
                alert(errorMsg)
                return;
            }

            console.log("成功获取收藏列表:", collectionData.data.list);
            console.log("卡片总数:", collectionData.data.list.reduce((acc, item) => acc + item.card_num, 0));
            const collections = collectionData.data.list;
            const collectionCount = collections.length;
            let processedCollections = 0;

            const progressBar = createProgressBar(collectionCount); // 创建进度条

            collections.forEach((collection, index) => {
                console.debug(`处理收藏: ${collection.act_name}(ID: ${collection.act_id})`);
                const detailUrl = `https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${collection.act_id}`;

                apiRequest(detailUrl, function (detailData) {
                    if (!detailData || detailData.code !== 0) {
                        console.error(
                            `获取 ${collection.act_name}(act_id:${collection.act_id}) 的基本信息失败:`,
                            detailData ? detailData.message : "无响应"
                        );
                        processedCollections++;
                        progressBar.update(processedCollections); // 更新进度条
                        checkCompletion();
                        return;
                    }

                    console.debug(
                        `成功获取 ${collection.act_name}(act_id:${collection.act_id}) 的基本信息:`,
                        detailData.data
                    );
                    const lotteries = detailData.data.lottery_list;
                    let processedLotteries = 0;

                    lotteries.forEach((lottery) => {
                        console.debug(
                            `处理详情: ${lottery.lottery_name} (ID: ${lottery.lottery_id})`
                        );
                        // 当前已收集
                        const item_owned_cnt = lottery.item_owned_cnt
                        // 总数
                        const item_total_cnt = lottery.item_total_cnt
                        // 总销量
                        const total_sale_amount = lottery.total_sale_amount

                        const cardDetailUrl = `https://api.bilibili.com/x/vas/dlc_act/lottery_home_detail?act_id=${collection.act_id}&lottery_id=${lottery.lottery_id}`;

                        apiRequest(cardDetailUrl, function (cardData) {
                            if (!cardData || cardData.code !== 0) {
                                console.error(
                                    `获取 ${collection.act_name}(act_id:${collection.act_id}&lottery_id:${lottery.lottery_id}) 的详情失败:`,
                                    cardData ? cardData.message : "无响应"
                                );
                                processedLotteries++;
                                progressBar.update(processedCollections); // 更新进度条
                                checkLotteryCompletion();
                                return;
                            }

                            console.debug(
                                `成功获取 ${collection.act_name}[${cardData.data.name}](act_id:${collection.act_id}&lottery_id:${lottery.lottery_id}) 的详情:`,
                                cardData.data
                            );
                            // 根据需要处理卡牌数据
                            collectList.push({
                                title: detailData.data.act_title,
                                name: cardData.data.name,
                                num: collection.card_num,
                                owned: item_owned_cnt,
                                total: item_total_cnt,
                                sale: total_sale_amount,
                                url: `https://www.bilibili.com/blackboard/activity-Mz9T5bO5Q3.html?id=${collection.act_id}&type=dlc`,
                                act: detailData.data,
                                lottery: cardData.data
                            });
                            processedLotteries++;
                            progressBar.update(processedCollections); // 更新进度条
                            checkLotteryCompletion();
                        });

                        function checkLotteryCompletion() {
                            if (processedLotteries === lotteries.length) {
                                processedCollections++;
                                progressBar.update(processedCollections); // 更新进度条
                                checkCompletion();
                            }
                        }
                    });
                });

            });

            function checkCompletion() {
                if (processedCollections === collectionCount) {
                    console.log("所有收藏已处理。");
                    console.log("最终收集列表:", collectList);

                    // 筛选出真正有卡的收藏集
                    collectList = collectList.filter((collectItem) => collectItem.owned);

                    progressBar.hide(); // 隐藏进度条
                    showResultDialog(collectList, filterCollectList(collectList))
                }
            }

            function filterCollectList(collectList) {
                // 筛选出符合条件的收藏集
                return collectList.filter((collectItem) => {
                    return (
                        collectItem.lottery.collect_list.collect_infos?.some(
                            (lottery) =>
                                canGetReward(lottery)
                        ) ||
                        collectItem.lottery.collect_list.collect_chain?.some(
                            (lottery) =>
                                canGetReward(lottery)
                        )
                    );
                });
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

            function showResultDialog(collectList, filteredCollectList) {
                // 创建弹窗
                const dialog = document.createElement("div");
                dialog.style.position = "fixed";
                dialog.style.top = "50%";
                dialog.style.left = "50%";
                dialog.style.transform = "translate(-50%, -50%)";
                dialog.style.backgroundColor = "#fff";
                dialog.style.border = "1px solid #ccc";
                dialog.style.padding = "20px";
                dialog.style.zIndex = "10000";
                dialog.style.width = "90%";
                dialog.style.height = "90%";
                dialog.style.overflowY = "auto";
                dialog.style.overflowX = "hidden";
                dialog.style.fontFamily = "Arial, sans-serif";
                dialog.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
                dialog.style.display = "flex";
                dialog.style.flexDirection = "column";

                // 标题和按钮容器
                const header = document.createElement("div");
                header.style.display = "flex";
                header.style.justifyContent = "space-between";
                header.style.alignItems = "center";
                header.style.marginBottom = "20px";

                // 左侧标题和 Debug 按钮容器
                const titleContainer = document.createElement("div");
                titleContainer.style.display = "flex";
                titleContainer.style.alignItems = "center";
                titleContainer.style.gap = "10px"; // 间距

                // 标题
                const title = document.createElement("h2");
                title.textContent = "筛选结果";
                title.style.margin = "0"; // 去掉默认边距
                titleContainer.appendChild(title);

                // Debug 按钮
                const debugButton = document.createElement("button");
                debugButton.textContent = "Debug";
                debugButton.style.padding = "5px 10px";
                debugButton.style.backgroundColor = "#4caf50";
                debugButton.style.color = "#fff";
                debugButton.style.border = "none";
                debugButton.style.borderRadius = "5px";
                debugButton.style.cursor = "pointer";
                titleContainer.appendChild(debugButton);

                // Debug 按钮的点击事件
                debugButton.addEventListener("click", () => {
                    const groupedByType = {};

                    collectList.forEach((item) => {
                        // 从奖励数据中获取类型并分组
                        const rewardList = item.lottery.collect_list?.collect_infos || [];
                        rewardList.forEach((reward) => {
                            const type = Object.keys(REDEEM_ITEM_TYPE).find(
                                (key) => REDEEM_ITEM_TYPE[key] === reward.redeem_item_type
                            ) || `未知类型(${reward.redeem_item_type})`;

                            if (!groupedByType[type]) {
                                groupedByType[type] = [];
                            }
                            groupedByType[type].push(item);
                        });
                    });

                    console.log("按类型分组的收藏集:", groupedByType);
                });

                // 关闭按钮
                const closeButton = document.createElement("button");
                closeButton.textContent = "关闭";
                closeButton.style.padding = "5px 10px";
                closeButton.style.backgroundColor = "#ff4d4d";
                closeButton.style.color = "#fff";
                closeButton.style.border = "none";
                closeButton.style.borderRadius = "5px";
                closeButton.style.cursor = "pointer";

                closeButton.addEventListener("click", () => {
                    document.body.removeChild(dialog);
                });

                // 将标题和按钮容器添加到标题栏
                header.appendChild(titleContainer);
                header.appendChild(closeButton);
                dialog.appendChild(header);

                // 复选框控制区域
                const filterBox = document.createElement("div");
                filterBox.style.marginBottom = "20px";

                const filterLabel = document.createElement("label");
                filterLabel.textContent = "筛选";
                filterLabel.style.marginRight = "10px";

                const filterCheckbox = document.createElement("input");
                filterCheckbox.type = "checkbox";
                filterBox.appendChild(filterLabel);
                filterBox.appendChild(filterCheckbox);
                dialog.appendChild(filterBox);

                // 网格容器
                const gridContainer = document.createElement("div");
                gridContainer.style.display = "grid";
                gridContainer.style.gridTemplateColumns = "repeat(auto-fill, minmax(200px, 1fr))";
                gridContainer.style.gap = "15px";
                gridContainer.style.flex = "1"; // 占满剩余高度
                dialog.appendChild(gridContainer);

                // 渲染列表函数
                function renderList(showFiltered) {
                    filterCheckbox.checked = showFiltered; // 更新复选框的初始状态

                    gridContainer.innerHTML = ""; // 清空之前的内容
                    const list = showFiltered ? filteredCollectList : collectList;
                    if (list.length === 0) {
                        const emptyMessage = document.createElement("p");
                        emptyMessage.textContent = showFiltered
                            ? "没有符合筛选条件的收藏集。"
                            : "没有收藏集数据。";
                        gridContainer.appendChild(emptyMessage);
                        return;
                    }

                    list.forEach((item) => {
                        const card = document.createElement("div");
                        card.style.position = "relative";
                        card.style.border = "1px solid #ddd";
                        card.style.borderRadius = "10px";
                        card.style.overflow = "hidden";
                        card.style.height = "200px";
                        card.style.backgroundImage = `url(${item.act.act_square_img})`;
                        card.style.backgroundSize = "cover";
                        card.style.backgroundPosition = "center";
                        card.style.display = "flex";
                        card.style.flexDirection = "column";
                        card.style.justifyContent = "flex-end";
                        card.style.padding = "10px";
                        card.style.color = "#fff";

                        // 显示 num 的元素
                        const numBadge = document.createElement("div");
                        numBadge.textContent = item.num;
                        numBadge.style.position = "absolute";
                        numBadge.style.top = "10px";
                        numBadge.style.right = "10px";
                        numBadge.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
                        numBadge.style.color = "#fff";
                        numBadge.style.padding = "5px 10px";
                        numBadge.style.borderRadius = "10px";
                        numBadge.style.fontSize = "14px";
                        numBadge.style.fontWeight = "bold";
                        card.appendChild(numBadge);

                        // 显示 owned / total 的元素
                        const ownedTotalBadge = document.createElement("div");
                        ownedTotalBadge.textContent = `${item.owned} / ${item.total}${item.owned === item.total ? ' 👑' : ''}`;
                        ownedTotalBadge.style.position = "absolute";
                        ownedTotalBadge.style.top = "10px";
                        ownedTotalBadge.style.left = "10px";
                        ownedTotalBadge.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
                        ownedTotalBadge.style.color = "#fff";
                        ownedTotalBadge.style.padding = "5px 10px";
                        ownedTotalBadge.style.borderRadius = "10px";
                        ownedTotalBadge.style.fontSize = "14px";
                        ownedTotalBadge.style.fontWeight = "bold";
                        card.appendChild(ownedTotalBadge);

                        // 标题容器
                        const titleContainer = document.createElement("div");
                        titleContainer.style.background = "rgba(0, 0, 0, 0.5)";
                        titleContainer.style.backdropFilter = "blur(5px)";
                        titleContainer.style.borderRadius = "5px";
                        titleContainer.style.padding = "5px";
                        titleContainer.style.marginBottom = "5px";

                        // 标题
                        const cardTitle = document.createElement("div");
                        cardTitle.style.fontWeight = "bold";
                        cardTitle.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.8)";
                        cardTitle.textContent = item.title;

                        // 副标题容器
                        const subtitleContainer = document.createElement("div");
                        subtitleContainer.style.display = "flex";
                        subtitleContainer.style.justifyContent = "space-between";
                        subtitleContainer.style.fontSize = "14px";
                        subtitleContainer.style.marginTop = "2px";

                        // 副标题
                        const cardSubtitle = document.createElement("span");
                        cardSubtitle.textContent = item.name;

                        // 销量
                        const cardSale = document.createElement("span");
                        cardSale.textContent = `销量: ${item.sale}`;

                        subtitleContainer.appendChild(cardSubtitle);
                        subtitleContainer.appendChild(cardSale);

                        titleContainer.appendChild(cardTitle);
                        titleContainer.appendChild(subtitleContainer);

                        const link = document.createElement("a");
                        link.href = item.url;
                        link.target = "_blank";
                        link.textContent = "查看详情";
                        link.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
                        link.style.color = "#fff";
                        link.style.padding = "5px 10px";
                        link.style.borderRadius = "5px";
                        link.style.textDecoration = "none";
                        link.style.textAlign = "center";

                        card.appendChild(titleContainer);
                        card.appendChild(link);

                        gridContainer.appendChild(card);
                    });
                }

                // 初始渲染为筛选后的列表
                renderList(true);

                // 添加复选框事件
                filterCheckbox.addEventListener("change", () => {
                    renderList(filterCheckbox.checked);
                });

                // 将弹窗添加到页面
                document.body.appendChild(dialog);
            }

        })
    }

    // 在 Tampermonkey 菜单中添加一个按钮
    GM_registerMenuCommand("检查收藏集", collectDigitalCards);
})();
