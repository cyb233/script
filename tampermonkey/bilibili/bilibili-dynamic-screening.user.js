// ==UserScript==
// @name         Bilibili 动态筛选
// @namespace    Schwi
// @version      1.3
// @description  Bilibili 动态筛选，快速找出感兴趣的动态
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.bilibili.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    // 检查脚本是否运行在顶层窗口
    if (window.top !== window.self) {
        console.log("脚本不应运行于 iframe");
        return;
    }

    // 初始化 自定义筛选规则
    // 示例值：{全部: {type: "checkbox", filter: (item, input) => true }, ...}
    GM_setValue('customFilters', GM_getValue('customFilters', null))

    // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/dynamic/dynamic_enum.md
    const DYNAMIC_TYPE = {
        DYNAMIC_TYPE_NONE: { key: "DYNAMIC_TYPE_NONE", name: "动态失效", filter: false },
        DYNAMIC_TYPE_FORWARD: { key: "DYNAMIC_TYPE_FORWARD", name: "转发", filter: false },
        DYNAMIC_TYPE_AV: { key: "DYNAMIC_TYPE_AV", name: "视频", filter: true },
        DYNAMIC_TYPE_PGC: { key: "DYNAMIC_TYPE_PGC", name: "剧集", filter: true },
        DYNAMIC_TYPE_COURSES: { key: "DYNAMIC_TYPE_COURSES", name: "课程", filter: true },
        DYNAMIC_TYPE_WORD: { key: "DYNAMIC_TYPE_WORD", name: "文本", filter: true },
        DYNAMIC_TYPE_DRAW: { key: "DYNAMIC_TYPE_DRAW", name: "图文", filter: true },
        DYNAMIC_TYPE_ARTICLE: { key: "DYNAMIC_TYPE_ARTICLE", name: "专栏", filter: true },
        DYNAMIC_TYPE_MUSIC: { key: "DYNAMIC_TYPE_MUSIC", name: "音乐", filter: true },
        DYNAMIC_TYPE_COMMON_SQUARE: { key: "DYNAMIC_TYPE_COMMON_SQUARE", name: "卡片", filter: true }, // 充电专属问答，收藏集等
        DYNAMIC_TYPE_COMMON_VERTICAL: { key: "DYNAMIC_TYPE_COMMON_VERTICAL", name: "竖屏", filter: true },
        DYNAMIC_TYPE_LIVE: { key: "DYNAMIC_TYPE_LIVE", name: "直播", filter: true },
        DYNAMIC_TYPE_MEDIALIST: { key: "DYNAMIC_TYPE_MEDIALIST", name: "收藏夹", filter: true },
        DYNAMIC_TYPE_COURSES_SEASON: { key: "DYNAMIC_TYPE_COURSES_SEASON", name: "课程合集", filter: true },
        DYNAMIC_TYPE_COURSES_BATCH: { key: "DYNAMIC_TYPE_COURSES_BATCH", name: "课程批次", filter: true },
        DYNAMIC_TYPE_AD: { key: "DYNAMIC_TYPE_AD", name: "广告", filter: true },
        DYNAMIC_TYPE_APPLET: { key: "DYNAMIC_TYPE_APPLET", name: "小程序", filter: true },
        DYNAMIC_TYPE_SUBSCRIPTION: { key: "DYNAMIC_TYPE_SUBSCRIPTION", name: "订阅", filter: true },
        DYNAMIC_TYPE_LIVE_RCMD: { key: "DYNAMIC_TYPE_LIVE_RCMD", name: "直播", filter: true }, // 被转发
        DYNAMIC_TYPE_BANNER: { key: "DYNAMIC_TYPE_BANNER", name: "横幅", filter: true },
        DYNAMIC_TYPE_UGC_SEASON: { key: "DYNAMIC_TYPE_UGC_SEASON", name: "合集", filter: true },
        DYNAMIC_TYPE_PGC_UNION: { key: "DYNAMIC_TYPE_PGC_UNION", name: "番剧影视", filter: true },
        DYNAMIC_TYPE_SUBSCRIPTION_NEW: { key: "DYNAMIC_TYPE_SUBSCRIPTION_NEW", name: "新订阅", filter: true },
    };

    const MAJOR_TYPE = {
        MAJOR_TYPE_NONE: { key: "MAJOR_TYPE_NONE", name: "动态失效" },
        MAJOR_TYPE_OPUS: { key: "MAJOR_TYPE_OPUS", name: "动态" },
        MAJOR_TYPE_ARCHIVE: { key: "MAJOR_TYPE_ARCHIVE", name: "视频" },
        MAJOR_TYPE_PGC: { key: "MAJOR_TYPE_PGC", name: "番剧影视" },
        MAJOR_TYPE_COURSES: { key: "MAJOR_TYPE_COURSES", name: "课程" },
        MAJOR_TYPE_DRAW: { key: "MAJOR_TYPE_DRAW", name: "图文" },
        MAJOR_TYPE_ARTICLE: { key: "MAJOR_TYPE_ARTICLE", name: "专栏" },
        MAJOR_TYPE_MUSIC: { key: "MAJOR_TYPE_MUSIC", name: "音乐" },
        MAJOR_TYPE_COMMON: { key: "MAJOR_TYPE_COMMON", name: "卡片" },
        MAJOR_TYPE_LIVE: { key: "MAJOR_TYPE_LIVE", name: "直播" },
        MAJOR_TYPE_MEDIALIST: { key: "MAJOR_TYPE_MEDIALIST", name: "收藏夹" },
        MAJOR_TYPE_APPLET: { key: "MAJOR_TYPE_APPLET", name: "小程序" },
        MAJOR_TYPE_SUBSCRIPTION: { key: "MAJOR_TYPE_SUBSCRIPTION", name: "订阅" },
        MAJOR_TYPE_LIVE_RCMD: { key: "MAJOR_TYPE_LIVE_RCMD", name: "直播推荐" },
        MAJOR_TYPE_UGC_SEASON: { key: "MAJOR_TYPE_UGC_SEASON", name: "合集" },
        MAJOR_TYPE_SUBSCRIPTION_NEW: { key: "MAJOR_TYPE_SUBSCRIPTION_NEW", name: "新订阅" },
    };

    const RICH_TEXT_NODE_TYPE = {
        RICH_TEXT_NODE_TYPE_NONE: { key: "RICH_TEXT_NODE_TYPE_NONE", name: "无效节点" },
        RICH_TEXT_NODE_TYPE_TEXT: { key: "RICH_TEXT_NODE_TYPE_TEXT", name: "文本" },
        RICH_TEXT_NODE_TYPE_AT: { key: "RICH_TEXT_NODE_TYPE_AT", name: "@用户" },
        RICH_TEXT_NODE_TYPE_LOTTERY: { key: "RICH_TEXT_NODE_TYPE_LOTTERY", name: "互动抽奖" },
        RICH_TEXT_NODE_TYPE_VOTE: { key: "RICH_TEXT_NODE_TYPE_VOTE", name: "投票" },
        RICH_TEXT_NODE_TYPE_TOPIC: { key: "RICH_TEXT_NODE_TYPE_TOPIC", name: "话题" },
        RICH_TEXT_NODE_TYPE_GOODS: { key: "RICH_TEXT_NODE_TYPE_GOODS", name: "商品链接" },
        RICH_TEXT_NODE_TYPE_BV: { key: "RICH_TEXT_NODE_TYPE_BV", name: "视频链接" },
        RICH_TEXT_NODE_TYPE_AV: { key: "RICH_TEXT_NODE_TYPE_AV", name: "视频" },
        RICH_TEXT_NODE_TYPE_EMOJI: { key: "RICH_TEXT_NODE_TYPE_EMOJI", name: "表情" },
        RICH_TEXT_NODE_TYPE_USER: { key: "RICH_TEXT_NODE_TYPE_USER", name: "用户" },
        RICH_TEXT_NODE_TYPE_CV: { key: "RICH_TEXT_NODE_TYPE_CV", name: "专栏" },
        RICH_TEXT_NODE_TYPE_VC: { key: "RICH_TEXT_NODE_TYPE_VC", name: "音频" },
        RICH_TEXT_NODE_TYPE_WEB: { key: "RICH_TEXT_NODE_TYPE_WEB", name: "网页链接" },
        RICH_TEXT_NODE_TYPE_TAOBAO: { key: "RICH_TEXT_NODE_TYPE_TAOBAO", name: "淘宝链接" },
        RICH_TEXT_NODE_TYPE_MAIL: { key: "RICH_TEXT_NODE_TYPE_MAIL", name: "邮箱地址" },
        RICH_TEXT_NODE_TYPE_OGV_SEASON: { key: "RICH_TEXT_NODE_TYPE_OGV_SEASON", name: "剧集信息" },
        RICH_TEXT_NODE_TYPE_OGV_EP: { key: "RICH_TEXT_NODE_TYPE_OGV_EP", name: "剧集" },
        RICH_TEXT_NODE_TYPE_SEARCH_WORD: { key: "RICH_TEXT_NODE_TYPE_SEARCH_WORD", name: "搜索词" },
    };

    const ADDITIONAL_TYPE = {
        ADDITIONAL_TYPE_NONE: { key: "ADDITIONAL_TYPE_NONE", name: "无附加类型" },
        ADDITIONAL_TYPE_PGC: { key: "ADDITIONAL_TYPE_PGC", name: "番剧影视" },
        ADDITIONAL_TYPE_GOODS: { key: "ADDITIONAL_TYPE_GOODS", name: "商品信息" },
        ADDITIONAL_TYPE_VOTE: { key: "ADDITIONAL_TYPE_VOTE", name: "投票" },
        ADDITIONAL_TYPE_COMMON: { key: "ADDITIONAL_TYPE_COMMON", name: "一般类型" },
        ADDITIONAL_TYPE_MATCH: { key: "ADDITIONAL_TYPE_MATCH", name: "比赛" },
        ADDITIONAL_TYPE_UP_RCMD: { key: "ADDITIONAL_TYPE_UP_RCMD", name: "UP主推荐" },
        ADDITIONAL_TYPE_UGC: { key: "ADDITIONAL_TYPE_UGC", name: "视频跳转" },
        ADDITIONAL_TYPE_RESERVE: { key: "ADDITIONAL_TYPE_RESERVE", name: "直播预约" },
    };

    const STYPE = {
        1: { key: 1, name: "视频更新预告" },
        2: { key: 2, name: "直播预告" },
    };

    // 添加全局变量
    let dynamicList = [];
    let collectedCount = 0;

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
        dialog.style.overflow = 'hidden'; // 添加 overflow: hidden

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
        closeButton.style.backgroundColor = '#ff4d4f'; // 修改背景颜色为红色
        closeButton.style.color = '#fff'; // 修改文字颜色为白色
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '5px 10px';
        closeButton.style.transition = 'background-color 0.3s'; // 添加过渡效果
        closeButton.onmouseover = () => { closeButton.style.backgroundColor = '#d93637'; } // 添加悬停效果
        closeButton.onmouseout = () => { closeButton.style.backgroundColor = '#ff4d4f'; } // 恢复背景颜色
        closeButton.onclick = () => dialog.remove();
        header.appendChild(closeButton);

        dialog.appendChild(header);

        let contentArea = document.createElement('div');
        contentArea.innerHTML = content;
        contentArea.style.padding = '10px';
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

    // 创建并显示时间选择器 dialog
    function showTimeSelector(callback) {
        let yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        let today = new Date();

        let dialogContent = `<div style='padding:20px; display: flex; flex-direction: column; align-items: center;'>
            <label for='startDate' style='font-size: 16px; margin-bottom: 10px;'>开始时间：</label>
            <input type='date' id='startDate' value='${yesterday.getFullYear()}-${(yesterday.getMonth() + 1) < 10 ? '0' + (yesterday.getMonth() + 1) : (yesterday.getMonth() + 1)}-${yesterday.getDate() < 10 ? '0' + yesterday.getDate() : yesterday.getDate()}' style='margin-bottom: 20px; padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 5px;'>
            <label for='endDate' style='font-size: 16px; margin-bottom: 10px;'>结束时间：</label>
            <input type='date' id='endDate' value='${today.getFullYear()}-${(today.getMonth() + 1) < 10 ? '0' + (today.getMonth() + 1) : (today.getMonth() + 1)}-${today.getDate() < 10 ? '0' + today.getDate() : today.getDate()}' style='margin-bottom: 20px; padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 5px;'>
            <button id='startTask' style='padding: 10px 20px; font-size: 16px; background-color: #00a1d6; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s;'>开始</button>
        </div>`;

        const { dialog, contentArea } = createDialog('timeSelectorDialog', '选择时间', dialogContent);
        dialog.style.display = 'block';

        contentArea.querySelector('#startTask').onclick = () => {
            const startDate = new Date(contentArea.querySelector('#startDate').value + ' 00:00:00').getTime() / 1000;
            const endDate = new Date(contentArea.querySelector('#endDate').value + ' 00:00:00').getTime() / 1000;
            dialog.style.display = 'none';
            callback(startDate, endDate);
        };
    }

    // API 请求函数
    function apiRequest(url) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: response => {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: reject
            });
        });
    }

    // 显示结果 dialog
    function showResultsDialog() {
        const { dialog, titleElement } = createDialog('resultsDialog', `动态结果（${dynamicList.length}/${dynamicList.length}） ${new Date(dynamicList[dynamicList.length - 1].modules.module_author.pub_ts * 1000).toLocaleString()} ~ ${new Date(dynamicList[0].modules.module_author.pub_ts * 1000).toLocaleString()}`, '');

        let gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fill,minmax(200px,1fr))';
        gridContainer.style.gap = '10px';
        gridContainer.style.padding = '10px';
        gridContainer.style.height = 'calc(90% - 50px)'; // 设置高度以启用滚动
        gridContainer.style.overflowY = 'auto'; // 启用垂直滚动

        // 筛选按钮数据结构
        const filters1 = {
            // 全部: {type: "checkbox", filter: (item, input) => true },
            只看自己: { type: "checkbox", filter: (item, input) => item.modules.module_author.following === null },
            排除自己: { type: "checkbox", filter: (item, input) => !filters1['只看自己'].filter(item, input) },
            只看转发: { type: "checkbox", filter: (item, input) => item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key },
            排除转发: { type: "checkbox", filter: (item, input) => !filters1['只看转发'].filter(item, input) },
            视频更新预告: { type: "checkbox", filter: (item, input) => (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig : item).modules.module_dynamic.additional?.reserve?.stype === 1 },
            直播预告: { type: "checkbox", filter: (item, input) => (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig : item).modules.module_dynamic.additional?.reserve?.stype === 2 },
            有奖预约: { type: "checkbox", filter: (item, input) => filters1['直播预告'].filter(item, input) && (item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key ? item.orig : item).modules.module_dynamic.additional?.reserve?.desc3?.text },
            互动抽奖: {
                type: "checkbox", filter: (item, input) =>
                    item.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes?.some(n => n?.type === RICH_TEXT_NODE_TYPE.RICH_TEXT_NODE_TYPE_LOTTERY.key) || item.modules.module_dynamic.desc?.rich_text_nodes?.some(n => n?.type === RICH_TEXT_NODE_TYPE.RICH_TEXT_NODE_TYPE_LOTTERY.key)
                    ||
                    item.orig?.modules?.module_dynamic?.major?.opus?.summary?.rich_text_nodes?.some(n => n?.type === RICH_TEXT_NODE_TYPE.RICH_TEXT_NODE_TYPE_LOTTERY.key) || item.orig?.modules?.module_dynamic?.desc?.rich_text_nodes?.some(n => n?.type === RICH_TEXT_NODE_TYPE.RICH_TEXT_NODE_TYPE_LOTTERY.key)
            },
            只看已开奖: {
                type: "checkbox", filter: (item, input) =>
                    // 直播有奖预约开奖 或 互动抽奖开奖
                    // 如果是直播有奖预约，则判断预约按钮是否为"预约"
                    (
                        filters1['有奖预约'].filter(item, input)
                        &&
                        (item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key ? item.orig : item).modules.module_dynamic.additional?.reserve?.button?.uncheck?.text !== "预约"
                    )
                    ||
                    // 如果是互动抽奖，排除已开奖的互动抽奖动态
                    (
                        filters1['互动抽奖'].filter(item, input)
                        &&
                        // 如果是转发自己的动态，判断是否为开奖动态(匹配"恭喜xxx中奖，已私信通知，详情请点击抽奖查看。"格式)
                        item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key
                        &&
                        item.orig.modules.module_author.mid === item.modules.module_author.mid
                        &&
                        /^恭喜.*中奖，已私信通知，详情请点击抽奖查看。$/.test(item.modules.module_dynamic.desc?.text)
                    )
            },
            排除已开奖: { type: "checkbox", filter: (item, input) => !filters1['只看已开奖'].filter(item, input) },
            搜索: {
                type: "text",
                filter: (item, input) => {
                    const searchText = input.toLocaleUpperCase();
                    const authorName = item.modules.module_author.name.toLocaleUpperCase();
                    const authorMid = item.modules.module_author.mid.toString();
                    const descText = (item.modules.module_dynamic.desc?.text || '').toLocaleUpperCase();
                    const forwardAuthorName = item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key ? item.orig.modules.module_author.name.toLocaleUpperCase() : '';
                    const forwardAuthorMid = item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key ? item.orig.modules.module_author.mid.toString() : '';
                    const forwardDescText = item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key ? (item.orig.modules.module_dynamic.desc?.text || '').toLocaleUpperCase() : '';

                    return authorName.includes(searchText) || authorMid.includes(searchText) || descText.includes(searchText) ||
                        forwardAuthorName.includes(searchText) || forwardAuthorMid.includes(searchText) || forwardDescText.includes(searchText);
                }
            },
        };

        const filters2 = {};
        // 遍历 DYNAMIC_TYPE 生成 filters
        Object.values(DYNAMIC_TYPE).forEach(type => {
            if (type.filter) { // 根据 filter 判断是否纳入过滤条件
                if (!filters2[type.name]) {
                    filters2[type.name] = { type: "checkbox", filter: (item, input) => item.baseType === type.key };
                } else {
                    const existingFilter = filters2[type.name].filter;
                    filters2[type.name].filter = (item, input) => existingFilter(item, input) || item.baseType === type.key;
                }
            }
        });
        // 用户自定义筛选条件
        const customFilters = GM_getValue('customFilters', null);

        const deal = (dynamicList) => {
            let checkedFilters = [];
            for (let key in filters1) {
                const f = filters1[key];
                const filter = filterButtonsContainer.querySelector(`#${key}`);
                let checkedFilter;
                switch (f.type) {
                    case 'checkbox':
                        checkedFilter = { ...f, value: filter.checked };
                        break;
                    case 'text':
                        checkedFilter = { ...f, value: filter.value };
                        break;
                }
                checkedFilters.push(checkedFilter);
            }
            for (let key in filters2) {
                const f = filters2[key];
                const filter = filterButtonsContainer.querySelector(`#${key}`);
                let checkedFilter;
                switch (f.type) {
                    case 'checkbox':
                        checkedFilter = { ...f, value: filter.checked };
                        break;
                    case 'text':
                        checkedFilter = { ...f, value: filter.value };
                        break;
                }
                checkedFilters.push(checkedFilter);
            }
            // 添加自定义筛选条件
            if (customFilters && Object.keys(customFilters).length > 0) {
                for (let key in customFilters) {
                    const f = customFilters[key];
                    const filter = filterButtonsContainer.querySelector(`#${key}`);
                    let checkedFilter;
                    switch (f.type) {
                        case 'checkbox':
                            checkedFilter = { ...f, value: filter.checked };
                            break;
                        case 'text':
                            checkedFilter = { ...f, value: filter.value };
                            break;
                    }
                    checkedFilters.push(checkedFilter);
                }
            }
            dynamicList.forEach(item => {
                item.display = checkedFilters.every(f => f.value ? f.filter(item, f.value) : true);
            });

            // 更新标题显示筛选后的条数和总条数
            titleElement.textContent = `动态结果（${dynamicList.filter(item => item.display).length}/${dynamicList.length}）`;

            // 重新初始化 IntersectionObserver
            observer.disconnect();
            renderedCount = 0;
            renderBatch();
        };

        // 封装生成筛选按钮的函数
        const createFilterButtons = (filters, dynamicList) => {
            let mainContainer = document.createElement('div');
            mainContainer.style.display = 'flex';
            mainContainer.style.flexWrap = 'wrap'; // 修改为换行布局
            mainContainer.style.width = '100%';

            for (let key in filters) {
                let filter = filters[key];
                let input = document.createElement('input');
                input.type = filter.type;
                input.id = key;
                input.style.marginRight = '5px';
                // 添加边框样式
                if (filter.type === 'text') {
                    input.style.border = '1px solid #ccc';
                    input.style.padding = '5px';
                    input.style.borderRadius = '5px';
                }

                let label = document.createElement('label');
                label.htmlFor = key;
                label.textContent = key;
                label.style.display = 'flex'; // 确保 label 和 input 在同一行
                label.style.alignItems = 'center'; // 垂直居中对齐
                label.style.marginRight = '5px';

                let container = document.createElement('div');
                container.style.display = 'flex';
                container.style.alignItems = 'center';
                container.style.marginRight = '10px';

                if (['checkbox', 'radio'].includes(filter.type)) {
                    (function (dynamicList, filter, input) {
                        input.addEventListener('change', () => deal(dynamicList));
                    })(dynamicList, filter, input);
                    container.appendChild(input);
                    container.appendChild(label);
                } else {
                    let timeout;
                    (function (dynamicList, filter, input) {
                        input.addEventListener('input', () => {
                            clearTimeout(timeout);
                            timeout = setTimeout(() => deal(dynamicList), 1000); // 增加延迟处理
                        });
                    })(dynamicList, filter, input);
                    container.appendChild(label);
                    container.appendChild(input);
                }

                mainContainer.appendChild(container);
            }

            return mainContainer;
        };

        // 生成筛选按钮
        let filterButtonsContainer = document.createElement('div');
        filterButtonsContainer.style.marginBottom = '10px';
        filterButtonsContainer.style.display = 'flex'; // 添加 flex 布局
        filterButtonsContainer.style.flexWrap = 'wrap'; // 添加换行
        filterButtonsContainer.style.gap = '10px'; // 添加间距
        filterButtonsContainer.style.padding = '10px';
        filterButtonsContainer.style.alignItems = 'center'; // 添加垂直居中对齐

        filterButtonsContainer.appendChild(createFilterButtons(filters1, dynamicList));
        filterButtonsContainer.appendChild(createFilterButtons(filters2, dynamicList));

        // 添加自定义筛选按钮
        if (customFilters && Object.keys(customFilters).length > 0) {
            filterButtonsContainer.appendChild(createFilterButtons(customFilters, dynamicList));
        }

        const getDescText = (dynamic, isForward) => {
            let descText = dynamic.modules.module_dynamic.desc?.text || ''
            if (isForward) {
                const subDescText = getDescText(dynamic.orig)
                descText += `<hr />${subDescText}`
            }

            return descText
        }

        const createDynamicItem = (dynamic) => {
            const isForward = dynamic.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key;
            const baseDynamic = isForward ? dynamic.orig : dynamic;
            const type = baseDynamic.type;
            const authorName = dynamic.modules.module_author.name;
            const mid = dynamic.modules.module_author.mid;
            const dynamicUrl = `https://t.bilibili.com/${dynamic.id_str}`;
            const jumpUrl = (mid, dynamicType) => {
                if (dynamicType === DYNAMIC_TYPE.DYNAMIC_TYPE_UGC_SEASON.key) {
                    return `https://www.bilibili.com/video/av${mid}/`
                }
                if (dynamicType === DYNAMIC_TYPE.DYNAMIC_TYPE_PGC_UNION.key) {
                    return `https://bangumi.bilibili.com/anime/${mid}`
                }
                return `https://space.bilibili.com/${mid}`
            }

            let backgroundImage = '';
            if (type === DYNAMIC_TYPE.DYNAMIC_TYPE_DRAW.key) {
                backgroundImage = baseDynamic.modules.module_dynamic.major.draw.items[0].src;
            }

            let dynamicItem = document.createElement('div');
            dynamicItem.style.position = "relative";
            dynamicItem.style.border = "1px solid #ddd";
            dynamicItem.style.borderRadius = "10px";
            dynamicItem.style.overflow = "hidden";
            dynamicItem.style.height = "300px";
            dynamicItem.style.display = "flex";
            dynamicItem.style.flexDirection = "column";
            dynamicItem.style.justifyContent = "flex-start"; // 修改为 flex-start 以使内容从顶部开始
            dynamicItem.style.padding = "10px";
            dynamicItem.style.color = "#fff";
            dynamicItem.style.transition = "transform 0.3s, background-color 0.3s"; // 添加过渡效果

            dynamicItem.onmouseover = () => {
                dynamicItem.style.transform = "scale(1.05)"; // 略微放大
                cardTitle.style.background = "rgba(0, 0, 0, 0.3)";
                publishTime.style.background = "rgba(0, 0, 0, 0.3)";
                typeComment.style.background = "rgba(0, 0, 0, 0.3)";
                describe.style.background = "rgba(0, 0, 0, 0.3)";
                viewDetailsButton.style.backgroundColor = "rgba(0, 0, 0, 0.3)";
            };

            dynamicItem.onmouseout = () => {
                dynamicItem.style.transform = "scale(1)"; // 恢复原始大小
                cardTitle.style.background = "rgba(0, 0, 0, 0.5)";
                publishTime.style.background = "rgba(0, 0, 0, 0.5)";
                typeComment.style.background = "rgba(0, 0, 0, 0.5)";
                describe.style.background = "rgba(0, 0, 0, 0.5)";
                viewDetailsButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
            };

            // 背景图片
            if (backgroundImage) {
                const img = document.createElement('img');
                img.src = backgroundImage;
                img.loading = "lazy";
                img.style.position = "absolute";
                img.style.top = "0";
                img.style.left = "0";
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.objectFit = "cover";
                img.style.zIndex = "-1";
                dynamicItem.appendChild(img);
            }

            // 标题
            const cardTitle = document.createElement("div");
            cardTitle.style.fontWeight = "bold";
            cardTitle.style.textShadow = "0 2px 4px rgba(0, 0, 0, 0.8)";
            cardTitle.style.background = "rgba(0, 0, 0, 0.5)";
            cardTitle.style.backdropFilter = "blur(5px)";
            cardTitle.style.borderRadius = "5px";
            cardTitle.style.padding = "5px";
            cardTitle.style.marginBottom = "5px";
            cardTitle.style.textAlign = "center";

            // 创建 authorName 和原作者的 a 标签
            const authorLink = document.createElement('a');
            authorLink.href = jumpUrl(mid, type);
            authorLink.target = "_blank";
            authorLink.textContent = authorName;

            let originalAuthorLink
            if (isForward) {
                originalAuthorLink = document.createElement('a');
                const originalMid = dynamic.orig.modules.module_author.mid;
                const originalType = dynamic.orig.type;
                originalAuthorLink.href = jumpUrl(originalMid, originalType);
                originalAuthorLink.target = "_blank";
                originalAuthorLink.textContent = dynamic.orig.modules.module_author.name;
            }

            // 设置 cardTitle 的内容
            cardTitle.innerHTML = isForward ? `${authorLink.outerHTML} 转发了 ${originalAuthorLink.outerHTML} 的动态` : `${authorLink.outerHTML} 发布了动态`;

            // 显示发布时间
            const publishTime = document.createElement("div");
            publishTime.style.fontSize = "12px";
            publishTime.style.marginTop = "2px";
            publishTime.style.background = "rgba(0, 0, 0, 0.5)";
            publishTime.style.backdropFilter = "blur(5px)";
            publishTime.style.borderRadius = "5px";
            publishTime.style.padding = "5px";
            publishTime.style.marginBottom = "5px";
            publishTime.style.textAlign = "center";
            publishTime.textContent = `发布时间: ${new Date(dynamic.modules.module_author.pub_ts * 1000).toLocaleString()}`;

            // 显示 DYNAMIC_TYPE 对应的注释
            const typeComment = document.createElement("div");
            typeComment.style.fontSize = "12px";
            typeComment.style.marginTop = "2px";
            typeComment.style.background = "rgba(0, 0, 0, 0.5)";
            typeComment.style.backdropFilter = "blur(5px)";
            typeComment.style.borderRadius = "5px";
            typeComment.style.padding = "5px";
            typeComment.style.marginBottom = "5px";
            typeComment.style.textAlign = "center";
            typeComment.textContent = `类型: ${DYNAMIC_TYPE[dynamic.type]?.name || dynamic.type} ${isForward ? `(${DYNAMIC_TYPE[dynamic.orig.type]?.name || dynamic.orig.type})` : ''} ${(filters1['有奖预约'].filter(dynamic) || filters1['互动抽奖'].filter(dynamic)) ? '🎁' : ''}`;

            // 正文
            const describe = document.createElement("div");
            describe.style.fontSize = "14px";
            describe.style.marginTop = "2px";
            describe.style.background = "rgba(0, 0, 0, 0.5)";
            describe.style.backdropFilter = "blur(5px)";
            describe.style.borderRadius = "5px";
            describe.style.padding = "5px";
            describe.style.marginBottom = "5px";
            describe.style.textAlign = "center";
            describe.style.flexGrow = "1"; // 添加 flexGrow 以使描述占据剩余空间
            describe.style.overflowY = "auto";
            describe.style.textOverflow = "ellipsis";
            describe.innerHTML = getDescText(dynamic, isForward); // 修改为 innerHTML 以支持 HTML 标签

            const viewDetailsButton = document.createElement("a");
            viewDetailsButton.href = dynamicUrl;
            viewDetailsButton.target = "_blank";
            viewDetailsButton.textContent = "查看详情";
            viewDetailsButton.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
            viewDetailsButton.style.color = "#fff";
            viewDetailsButton.style.padding = "5px 10px";
            viewDetailsButton.style.borderRadius = "5px";
            viewDetailsButton.style.textDecoration = "none";
            viewDetailsButton.style.textAlign = "center";

            dynamicItem.appendChild(cardTitle);
            dynamicItem.appendChild(typeComment);
            dynamicItem.appendChild(describe);
            dynamicItem.appendChild(publishTime); // 添加发布时间
            dynamicItem.appendChild(viewDetailsButton);

            return dynamicItem;
        };

        // 分批渲染
        const batchSize = 50; // 每次渲染的动态数量
        let renderedCount = 0;

        const renderBatch = () => {
            // 清空 gridContainer 的内容
            gridContainer.innerHTML = '';

            for (let i = 0; i < batchSize && renderedCount < dynamicList.length; i++, renderedCount++) {
                const dynamicItem = createDynamicItem(dynamicList[renderedCount]);
                dynamicItem.style.display = dynamicList[renderedCount].display ? 'flex' : 'none'; // 根据 display 属性显示或隐藏
                gridContainer.appendChild(dynamicItem);
            }
            // 检查是否还需要继续渲染
            if (renderedCount < dynamicList.length) {
                observer.observe(gridContainer.lastElementChild); // 观察最后一个 dynamicItem
            } else {
                observer.disconnect(); // 如果所有动态都已渲染，停止观察
            }
        };

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                observer.unobserve(entries[0].target); // 取消对当前目标的观察
                renderBatch();
            }
        });

        renderBatch(); // 初始渲染一批

        dialog.appendChild(filterButtonsContainer);
        dialog.appendChild(gridContainer);
        dialog.style.display = 'block';
    }

    // 主任务函数
    async function collectDynamic(startTime, endTime) {
        let offset = '';
        dynamicList = [];
        collectedCount = 0;
        let shouldContinue = true; // 引入标志位

        let { dialog, contentArea } = createDialog('progressDialog', '任务进度', `<p>已收集动态数：<span id='collectedCount'>0</span>/<span id='totalCount'>0</span></p>`);
        dialog.style.display = 'block';

        // 添加样式优化
        dialog.querySelector('p').style.textAlign = 'center';
        dialog.querySelector('p').style.fontSize = '18px';
        dialog.querySelector('p').style.fontWeight = 'bold';
        dialog.querySelector('p').style.marginTop = '20px';

        let shouldInclude = false;
        while (shouldContinue) { // 使用标志位控制循环
            const api = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all&offset=${offset}`;
            const data = await apiRequest(api);
            const items = data.data.items;

            if (!shouldInclude) {
                shouldInclude = items.some(item => item.modules.module_author.pub_ts > 0 && item.modules.module_author.pub_ts < (endTime + 24 * 60 * 60));
            }
            for (let item of items) {
                if (item.type !== DYNAMIC_TYPE.DYNAMIC_TYPE_LIVE_RCMD.key) {
                    // 直播动态可能不按时间顺序出现，不能用来判断时间要求
                    if (item.modules.module_author.pub_ts > 0 && item.modules.module_author.pub_ts < startTime) {
                        shouldContinue = false; // 设置标志位为 false 以结束循环
                    }
                }
                item.baseType = item.type;
                if (item.type === DYNAMIC_TYPE.DYNAMIC_TYPE_FORWARD.key) {
                    item.baseType = item.orig.type;
                }
                item.display = true;
                if (shouldInclude) {
                    dynamicList.push(item);
                }
                collectedCount++;
                contentArea.querySelector('#collectedCount').textContent = dynamicList.length;
                contentArea.querySelector('#totalCount').textContent = collectedCount;
            }
            offset = items[items.length - 1].id_str;

            if (shouldContinue) { // 检查标志位
                if (!data.data.has_more) shouldContinue = false; // 没有更多数据时结束循环
            }
        }
        console.log(`${dynamicList.length}/${collectedCount}`);
        console.log(`${new Date(dynamicList[dynamicList.length - 1].modules.module_author.pub_ts * 1000).toLocaleString()} ~ ${new Date(dynamicList[0].modules.module_author.pub_ts * 1000).toLocaleString()}`);
        console.log(dynamicList);
        console.log(new Set(dynamicList.map(item => item.type).filter(item => item)));
        console.log(new Set(dynamicList.map(item => item.orig?.type).filter(item => item)));

        dialog.style.display = 'none';
        showResultsDialog();
    }

    // 注册菜单项
    GM_registerMenuCommand("检查动态", () => {
        showTimeSelector(collectDynamic);
    });
})();
