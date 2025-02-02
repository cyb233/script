// ==UserScript==
// @name         Bilibili 动态筛选
// @namespace    Schwi
// @version      0.3
// @description  Bilibili 动态筛选，快速找出感兴趣的动态
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.bilibili.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// ==/UserScript==

(function () {
    'use strict';

    // 检查脚本是否运行在顶层窗口
    if (window.top !== window) {
        console.log("脚本不应运行于 iframe");
        return;
    }

    // 只写了一部分 https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/dynamic/dynamic_enum.md
    const DYNAMIC_TYPE = {
        DYNAMIC_TYPE_FORWARD: "转发",
        DYNAMIC_TYPE_WORD: "文本",
        DYNAMIC_TYPE_DRAW: "图文",
        DYNAMIC_TYPE_AV: "视频",
        DYNAMIC_TYPE_ARTICLE: "专栏",
        DYNAMIC_TYPE_LIVE_RCMD: "直播",
        DYNAMIC_TYPE_LIVE: "直播", // 被转发
        DYNAMIC_TYPE_UGC_SEASON: "合集",
        DYNAMIC_TYPE_PGC_UNION: "番剧影视",
        DYNAMIC_TYPE_COMMON_SQUARE: "卡片", // 充电专属问答，收藏集等
        DYNAMIC_TYPE_NONE: "源动态已被作者删除",
    }

    const MAJOR_TYPE = {
        MAJOR_TYPE_NONE: "源动态已被作者删除",
        MAJOR_TYPE_OPUS: "动态",
        MAJOR_TYPE_PGC: "番剧影视",
    }

    const RICH_TEXT_NODE_TYPE = {
        RICH_TEXT_NODE_TYPE_LOTTERY: "互动抽奖",
        RICH_TEXT_NODE_TYPE_TEXT: "文本",
    }

    const ADDITIONAL_TYPE = {
        ADDITIONAL_TYPE_RESERVE: "保留附加类型",
    }

    const STYPE = {
        1: "视频更新预告",
        2: "直播预告",
    }

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
        dialog.style.overflow = 'auto';
        dialog.style.display = 'none';

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

        let dialogContent = `<div style='padding:20px; display: flex; flex-direction: column; align-items: center;'>
            <label for='dynamicDate' style='font-size: 16px; margin-bottom: 10px;'>选择时间：</label>
            <input type='date' id='dynamicDate' value='${yesterday.getFullYear()}-${(yesterday.getMonth() + 1) < 10 ? '0' + (yesterday.getMonth() + 1) : (yesterday.getMonth() + 1)}-${yesterday.getDate() < 10 ? '0' + yesterday.getDate() : yesterday.getDate()}' style='margin-bottom: 20px; padding: 10px; font-size: 16px; border: 1px solid #ccc; border-radius: 5px;'>
            <button id='startTask' style='padding: 10px 20px; font-size: 16px; background-color: #00a1d6; color: white; border: none; border-radius: 5px; cursor: pointer; transition: background-color 0.3s;'>开始</button>
        </div>`;

        const { dialog, contentArea } = createDialog('timeSelectorDialog', '选择时间', dialogContent);
        dialog.style.display = 'block';

        contentArea.querySelector('#startTask').onclick = () => {
            const selectedDate = new Date(contentArea.querySelector('#dynamicDate').value).getTime() / 1000;
            dialog.style.display = 'none';
            callback(selectedDate);
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
        const { dialog, titleElement } = createDialog('resultsDialog', `动态结果（${dynamicList.length}/${dynamicList.length}）`, '');

        let gridContainer = document.createElement('div');
        gridContainer.style.display = 'grid';
        gridContainer.style.gridTemplateColumns = 'repeat(auto-fill,minmax(200px,1fr))';
        gridContainer.style.gap = '10px';
        gridContainer.style.padding = '10px';

        // 筛选按钮数据结构
        const filters = {
            // 全部: {type: "checkbox", filter: (item, input) => true },
            排除自己: { type: "checkbox", filter: (item, input) => item.modules.module_author.following !== null },
            转发: { type: "checkbox", filter: (item, input) => item.type === 'DYNAMIC_TYPE_FORWARD' },
            文本: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_WORD' },
            图文: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_DRAW' },
            视频: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_AV' },
            专栏: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_ARTICLE' },
            直播: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_LIVE_RCMD' || item.baseType === 'DYNAMIC_TYPE_LIVE' },
            合集: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_UGC_SEASON' },
            番剧影视: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_PGC_UNION' },
            卡片: { type: "checkbox", filter: (item, input) => item.baseType === 'DYNAMIC_TYPE_COMMON_SQUARE' },
            视频更新预告: { type: "checkbox", filter: (item, input) => (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig : item).modules.module_dynamic.additional?.reserve?.stype === 1 },
            直播预告: { type: "checkbox", filter: (item, input) => (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig : item).modules.module_dynamic.additional?.reserve?.stype === 2 },
            有奖预约: { type: "checkbox", filter: (item, input) => (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig : item).modules.module_dynamic.additional?.reserve?.desc3?.text },
            互动抽奖: {
                type: "checkbox", filter: (item, input) =>
                item.modules.module_dynamic.major?.opus?.summary?.rich_text_nodes?.some(n => n?.type === 'RICH_TEXT_NODE_TYPE_LOTTERY') || item.modules.module_dynamic.desc?.rich_text_nodes?.some(n => n?.type === 'RICH_TEXT_NODE_TYPE_LOTTERY') ||
                item.orig?.modules?.module_dynamic?.major?.opus?.summary?.rich_text_nodes?.some(n => n?.type === 'RICH_TEXT_NODE_TYPE_LOTTERY') || item.orig?.modules?.module_dynamic?.desc?.rich_text_nodes?.some(n => n?.type === 'RICH_TEXT_NODE_TYPE_LOTTERY') },
            搜索: {
                type: "text", filter: (item, input) =>
                (item.modules.module_author.name + item.modules.module_author.mid + (item.modules.module_dynamic.desc?.text || '')
                 +
                 (item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig.modules.module_author.name + item.orig.modules.module_author.mid + (item.orig.modules.module_dynamic.desc?.text || '') : '')).toLocaleUpperCase().includes(input.toLocaleUpperCase())
            },
        };

        // 生成筛选按钮
        let filterButtonsContainer = document.createElement('div');
        filterButtonsContainer.style.marginBottom = '10px';
        filterButtonsContainer.style.display = 'flex'; // 添加 flex 布局
        filterButtonsContainer.style.flexWrap = 'wrap'; // 添加换行
        filterButtonsContainer.style.gap = '10px'; // 添加间距
        filterButtonsContainer.style.padding = '10px';
        filterButtonsContainer.style.alignItems = 'center'; // 添加垂直居中对齐

        const deal = (dynamicList) => {
            let checkedFilters = [];
            for (let key in filters) {
                const f = filters[key];
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
            const filteredList = dynamicList.filter(item => checkedFilters.every(f => f.value ? f.filter(item, f.value) : true));
            const items = gridContainer.children;
            for (let index = 0; index < items.length; index++) {
                const item = items[index];
                item.style.display = filteredList.some(filteredItem => filteredItem.id_str === dynamicList[index].id_str) ? 'flex' : 'none';
            }

            // 更新标题显示筛选后的条数和总条数
            titleElement.textContent = `动态结果（${filteredList.length}/${dynamicList.length}）`;
        };

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

            if (['checkbox', 'radio'].includes(filter.type)) {
                (function(dynamicList, filter, input) {
                    input.addEventListener('change', () => deal(dynamicList));
                })(dynamicList, filter, input);
                filterButtonsContainer.appendChild(input);
                filterButtonsContainer.appendChild(label);
            } else {
                (function(dynamicList, filter, input) {
                    input.addEventListener('input', () => deal(dynamicList));
                })(dynamicList, filter, input);
                filterButtonsContainer.appendChild(label);
                filterButtonsContainer.appendChild(input);
            }
        };

        const getDescText = (dynamic, isForward) => {
            let descText = dynamic.modules.module_dynamic.desc?.text || ''
            if (isForward) {
                const subDescText = getDescText(dynamic.orig)
                descText += `<hr />${subDescText}`
            }

            return descText
        }

        for (let dynamic of dynamicList) {
            const isForward = dynamic.type === 'DYNAMIC_TYPE_FORWARD';
            const baseDynamic = isForward ? dynamic.orig : dynamic;
            const type = baseDynamic.type;
            const authorName = dynamic.modules.module_author.name;
            const authorUid = dynamic.modules.module_author.mid;
            const url = `https://t.bilibili.com/${dynamic.id_str}`;
            const spaceUrl = `https://space.bilibili.com/${authorUid}`;

            let backgroundImage = '';
            if (type === 'DYNAMIC_TYPE_DRAW') {
                backgroundImage = baseDynamic.modules.module_dynamic.major.draw.items[0].src;
            }

            let dynamicItem = document.createElement('div');
            dynamicItem.style.position = "relative";
            dynamicItem.style.border = "1px solid #ddd";
            dynamicItem.style.borderRadius = "10px";
            dynamicItem.style.overflow = "hidden";
            dynamicItem.style.height = "300px";
            dynamicItem.style.backgroundImage = `url(${backgroundImage})`;
            dynamicItem.style.backgroundSize = "cover";
            dynamicItem.style.backgroundPosition = "center";
            dynamicItem.style.display = "flex";
            dynamicItem.style.flexDirection = "column";
            dynamicItem.style.justifyContent = "flex-start"; // 修改为 flex-start 以使内容从顶部开始
            dynamicItem.style.padding = "10px";
            dynamicItem.style.color = "#fff";

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
            authorLink.href = spaceUrl;
            authorLink.target = "_blank";
            authorLink.textContent = authorName;

            let originalAuthorLink
            if (isForward) {
                originalAuthorLink = document.createElement('a');
                originalAuthorLink.href = `https://space.bilibili.com/${dynamic.orig.modules.module_author.mid}`;
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
            typeComment.textContent = `类型: ${DYNAMIC_TYPE[dynamic.type]} ${isForward ? `(${DYNAMIC_TYPE[dynamic.orig.type]})` : ''} ${(filters['有奖预约'].filter(dynamic) || filters['互动抽奖'].filter(dynamic)) ? '🎁' : ''}`;

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
            viewDetailsButton.href = url;
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

            gridContainer.appendChild(dynamicItem);
        }

        dialog.appendChild(filterButtonsContainer);
        dialog.appendChild(gridContainer);
        dialog.style.display = 'block';
    }

    // 主任务函数
    async function collectDynamic(startTime) {
        let offset = '';
        dynamicList = [];
        collectedCount = 0;
        let shouldContinue = true; // 引入标志位

        let { dialog, contentArea } = createDialog('progressDialog', '任务进度', `<p>已收集动态数：<span id='collectedCount'>0</span></p>`);
        dialog.style.display = 'block';

        // 添加样式优化
        dialog.querySelector('p').style.textAlign = 'center';
        dialog.querySelector('p').style.fontSize = '18px';
        dialog.querySelector('p').style.fontWeight = 'bold';
        dialog.querySelector('p').style.marginTop = '20px';

        while (shouldContinue) { // 使用标志位控制循环
            const api = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all&offset=${offset}`;
            const data = await apiRequest(api);
            const items = data.data.items;

            for (let item of items) {
                if (item.modules.module_author.pub_ts > 0 && item.modules.module_author.pub_ts < startTime) {
                    shouldContinue = false; // 设置标志位为 false 以结束循环
                }
                item.baseType = item.type;
                if (item.type === 'DYNAMIC_TYPE_FORWARD') {
                    item.baseType = item.orig.type;
                }

                dynamicList.push(item);
                collectedCount++;
                contentArea.querySelector('#collectedCount').textContent = collectedCount;
            }
            offset = items[items.length - 1].id_str;

            if (shouldContinue) { // 检查标志位
                if (!data.data.has_more) shouldContinue = false; // 没有更多数据时结束循环
            }
        }
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
