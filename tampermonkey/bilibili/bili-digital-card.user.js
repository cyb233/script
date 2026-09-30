// ==UserScript==
// @name         Bilibili 收藏集奖励筛查脚本
// @namespace    Schwi
// @version      2.0.1
// @description  查询 Bilibili 收藏集卡池，并筛选可领取奖励
// @author       Schwi
// @match        *://*.bilibili.com/*
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @connect      api.bilibili.com
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @noframes
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    const REDEEM_ITEM_TYPE = Object.freeze({
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
        CollectorMedal: 1001
    });
    const IDS = {
        results: 'bdc-results-dialog',
        progress: 'bdc-progress-dialog'
    };
    const windows = { progress: null, results: null, message: null };
    const COLLECTION_CONCURRENCY = 3;
    const LOTTERY_CONCURRENCY = 4;
    const state = {
        collecting: false,
        cancelRequested: false,
        items: [],
        collectionCount: 0,
        totalCardNum: 0
    };

    function createElement(tagName, options = {}) {
        const node = document.createElement(tagName);
        if (options.className) node.className = options.className;
        if (options.text !== undefined) node.textContent = options.text;
        if (options.attributes) Object.entries(options.attributes).forEach(([name, value]) => node.setAttribute(name, value));
        if (options.styles) Object.assign(node.style, options.styles);
        return node;
    }

    function addStyles(content) {
        const style = createElement('style');
        style.textContent = `
            #${IDS.results},#${IDS.progress}{box-sizing:border-box;font-family:Arial,"Microsoft YaHei",sans-serif;color:#202124}#${IDS.results}{position:fixed;z-index:2147483646;inset:3vh 3vw;display:flex;flex-direction:column;overflow:hidden;background:#f6f8fa;border:1px solid #b9c0c9;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.32)}#${IDS.results} *{box-sizing:border-box}#${IDS.results} .bdc-header{display:flex;align-items:center;min-height:62px;padding:12px 18px;background:#fff;border-bottom:1px solid #d8dee4}#${IDS.results} .bdc-title{margin:0;font-size:18px;font-weight:700}#${IDS.results} .bdc-subtitle{margin:3px 0 0;color:#667085;font-size:12px}#${IDS.results} .bdc-header-actions{display:flex;gap:8px;margin-left:auto}#${IDS.results} button,#${IDS.progress} button{height:34px;padding:0 11px;border:1px solid #aeb7c2;border-radius:4px;background:#fff;color:#25364a;cursor:pointer;font-size:13px}#${IDS.results} button:hover,#${IDS.progress} button:hover{background:#f0f5ff;border-color:#6b96d8}#${IDS.results} .bdc-close{width:34px;padding:0;color:#57606a;font-size:24px;line-height:1}
            #${IDS.results} .bdc-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px 10px;background:#fff}#${IDS.results} .bdc-stat{padding:9px 12px;background:#f6f8fa;border:1px solid #e2e6ea;border-radius:5px}#${IDS.results} .bdc-stat-label{color:#667085;font-size:12px}#${IDS.results} .bdc-stat-value{margin-top:3px;color:#1769aa;font-size:19px;font-weight:700}#${IDS.results} .bdc-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:4px 18px 12px;background:#fff;border-bottom:1px solid #e2e6ea}#${IDS.results} .bdc-search,#${IDS.results} .bdc-select{height:34px;padding:0 10px;border:1px solid #b9c0c9;border-radius:4px;background:#fff;color:#25364a;font-size:13px;outline:0}#${IDS.results} .bdc-search{width:min(270px,100%)}#${IDS.results} .bdc-search:focus,#${IDS.results} .bdc-select:focus{border-color:#00a1d6;box-shadow:0 0 0 2px rgba(0,161,214,.18)}#${IDS.results} .bdc-count{margin-left:auto;color:#667085;font-size:12px;white-space:nowrap}#${IDS.results} .bdc-list{flex:1;min-height:0;overflow:auto;padding:16px 18px 24px}#${IDS.results} .bdc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:12px;align-content:start}#${IDS.results} .bdc-card{position:relative;display:flex;flex-direction:column;min-width:0;height:230px;overflow:hidden;border:1px solid #d8dee4;border-radius:6px;background:#252b36;color:#fff;box-shadow:0 1px 2px rgba(0,0,0,.08)}#${IDS.results} .bdc-card:hover{border-color:#50b7e2;box-shadow:0 6px 18px rgba(0,54,93,.2)}#${IDS.results} .bdc-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}#${IDS.results} .bdc-card-body{position:relative;display:flex;flex:1;flex-direction:column;padding:12px;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.86))}#${IDS.results} .bdc-badges{display:flex;flex-wrap:wrap;gap:5px;min-height:20px}#${IDS.results} .bdc-badge{padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.58);font-size:11px}#${IDS.results} .bdc-badge-reward{background:#d56b16}#${IDS.results} .bdc-card-title{display:-webkit-box;margin:8px 0 4px;overflow:hidden;font-size:16px;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2}#${IDS.results} .bdc-card-meta{color:#e6ebf0;font-size:12px}#${IDS.results} .bdc-card-actions{display:flex;gap:8px;margin-top:auto}#${IDS.results} .bdc-card-actions a{flex:1;height:30px;padding:7px 8px;border:1px solid rgba(255,255,255,.55);border-radius:4px;color:#fff;text-align:center;text-decoration:none;font-size:12px}#${IDS.results} .bdc-card-actions a:hover{background:rgba(255,255,255,.18)}#${IDS.results} .bdc-load-more{display:block;min-width:140px;margin:18px auto 0}#${IDS.results} .bdc-empty{padding:48px 12px;color:#667085;text-align:center}
            #${IDS.progress}{position:fixed;z-index:2147483647;top:50%;left:50%;width:min(400px,calc(100vw - 32px));padding:20px;transform:translate(-50%,-50%);background:#fff;border:1px solid #d0d7de;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28)}#${IDS.progress} h2{margin:0 0 8px;font-size:18px}#${IDS.progress} p{margin:0 0 12px;color:#57606a;font-size:13px;line-height:1.5}#${IDS.progress} progress{width:100%;height:8px;margin-bottom:12px;accent-color:#00a1d6}#${IDS.progress} .bdc-progress-actions{display:flex;justify-content:flex-end}@media(max-width:680px){#${IDS.results}{inset:0;border:0;border-radius:0}#${IDS.results} .bdc-header,#${IDS.results} .bdc-summary,#${IDS.results} .bdc-toolbar{padding-left:12px;padding-right:12px}#${IDS.results} .bdc-search{order:1;width:100%}#${IDS.results} .bdc-count{margin-left:0}#${IDS.results} .bdc-list{padding:12px}}#${IDS.results},#${IDS.progress}{position:static;inset:auto;z-index:auto;transform:none;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}
        `;
        content.appendChild(style);
    }

    async function showMessage(title, message) {
        windows.message?.close();
        const window = await SchwiDialog.createDialog(420, 190, { title, showCloseButton: true });
        const text = createElement('p', { text: message, styles: { margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' } });
        const close = createElement('button', { text: '确定', attributes: { type: 'button' }, styles: { float: 'right', marginTop: '16px' } });
        close.addEventListener('click', window.close);
        window.content.append(text, close);
        windows.message = window;
        window.onclose = () => { if (windows.message === window) windows.message = null; };
        window.show();
    }

    const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const abortError = () => Object.assign(new Error('查询已取消'), { name: 'AbortError' });

    function canGetReward(reward, scene = 'milestone') {
        const currentTime = Date.now();
        const unlock = reward.unlock_condition || {};
        let unavailableByTime = false;
        if ([REDEEM_ITEM_TYPE.CollectorMedal, REDEEM_ITEM_TYPE.DiamondAvatar].includes(reward.redeem_item_type)) {
            unavailableByTime = currentTime > reward.end_time;
        } else {
            unavailableByTime = !(currentTime > reward.end_time) || !reward.effective_forever;
        }
        if (!(unlock.unlocked || scene === 'milestone')) return false;
        if (reward.has_redeemed_cnt && [REDEEM_ITEM_TYPE.CustomReward].includes(reward.redeem_item_type)) return false;
        if (reward.has_redeemed_cnt && reward.redeem_cond_type !== 'card_number') return false;
        if ((+reward.total_stock > -1 && +reward.remain_stock <= 0) || unavailableByTime) return false;
        if (reward.redeem_cond_type === 'custom' || [REDEEM_ITEM_TYPE.DiamondAvatar].includes(reward.redeem_item_type)) return false;
        return (reward.owned_item_amount || 0) >= reward.require_item_amount;
    }

    function hasUnclaimedReward(item) {
        const list = item.lottery?.collect_list || {};
        return [...(list.collect_infos || []), ...(list.collect_chain || [])].some(reward => canGetReward(reward));
    }

    function apiRequest(url, retry = 3) {
        const requestUrl = new URL(url, location.origin);
        requestUrl.searchParams.set('_ts', Date.now().toString());
        return new Promise((resolve, reject) => {
            let attempt = 0;
            const request = () => {
                if (state.cancelRequested) return reject(abortError());
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: requestUrl.toString(),
                    onload(response) {
                        if (state.cancelRequested) return reject(abortError());
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.code !== 0) throw new Error(data.message || `接口返回错误 ${data.code}`);
                            resolve(data);
                        } catch (error) {
                            retryRequest(error);
                        }
                    },
                    onerror(error) { retryRequest(error); }
                });
            };
            const retryRequest = error => {
                attempt++;
                if (attempt >= retry) return reject(error instanceof Error ? error : new Error('请求失败'));
                setTimeout(request, 800 * attempt);
            };
            request();
        });
    }

    async function mapWithConcurrency(items, concurrency, mapper) {
        const result = new Array(items.length);
        let nextIndex = 0;
        async function worker() {
            while (nextIndex < items.length) {
                if (state.cancelRequested) throw abortError();
                const index = nextIndex++;
                result[index] = await mapper(items[index]);
            }
        }
        await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
        return result;
    }

    async function createProgressDialog(total) {
        windows.progress?.close();
        const window = await SchwiDialog.createDialog(420, 240, { ariaLabel: '正在检查收藏集', showHeader: false, closeOnBackdropClick: false, closeOnEscape: false });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        addStyles(window.content);
        const dialog = createElement('section', { attributes: { id: IDS.progress, role: 'status', 'aria-live': 'polite' } });
        const title = createElement('h2', { text: '正在检查收藏集' });
        const detail = createElement('p', { text: `已完成 0 / ${total} 个收藏集` });
        const progress = createElement('progress', { attributes: { value: '0', max: Math.max(total, 1) } });
        const found = createElement('p', { text: '已发现 0 个卡池' });
        const cancel = createElement('button', { text: '取消', attributes: { type: 'button' } });
        cancel.addEventListener('click', () => { state.cancelRequested = true; cancel.disabled = true; cancel.textContent = '正在取消'; });
        const actions = createElement('div', { className: 'bdc-progress-actions' });
        actions.appendChild(cancel);
        dialog.append(title, detail, progress, found, actions);
        window.content.appendChild(dialog);
        window.show();
        windows.progress = window;
        return {
            update(completed, discovered) {
                progress.value = completed;
                detail.textContent = `已完成 ${completed} / ${total} 个收藏集`;
                found.textContent = `已发现 ${discovered} 个拥有卡片的卡池`;
            },
            close() {
                window.close();
                if (windows.progress === window) windows.progress = null;
            }
        };
    }

    function createSelect(label, options) {
        const select = createElement('select', { className: 'bdc-select', attributes: { 'aria-label': label } });
        options.forEach(([value, text]) => select.appendChild(createElement('option', { text, attributes: { value } })));
        return select;
    }

    function createCardItem(item) {
        const card = createElement('article', { className: 'bdc-card' });
        const coverUrl = item.act?.act_square_img;
        if (coverUrl) card.appendChild(createElement('img', { className: 'bdc-cover', attributes: { src: coverUrl, alt: '', loading: 'lazy' } }));
        const body = createElement('div', { className: 'bdc-card-body' });
        const badges = createElement('div', { className: 'bdc-badges' });
        badges.appendChild(createElement('span', { className: 'bdc-badge', text: `持有 ${item.num} 张` }));
        badges.appendChild(createElement('span', { className: 'bdc-badge', text: `${item.owned} / ${item.total}${item.owned >= item.total ? ' 已集齐' : ''}` }));
        if (hasUnclaimedReward(item)) badges.appendChild(createElement('span', { className: 'bdc-badge bdc-badge-reward', text: '可领奖励' }));
        const title = createElement('h2', { className: 'bdc-card-title', text: item.title || '未命名收藏集' });
        const meta = createElement('div', { className: 'bdc-card-meta', text: `${item.name || '未命名卡池'} · 销量 ${item.sale || 0}` });
        const actions = createElement('div', { className: 'bdc-card-actions' });
        actions.appendChild(createElement('a', { text: '查看活动详情', attributes: { href: item.url, target: '_blank', rel: 'noopener noreferrer' } }));
        body.append(badges, title, meta, actions);
        card.appendChild(body);
        return card;
    }

    async function showResultsDialog() {
        windows.results?.close();
        const window = await SchwiDialog.createDialog('94vw', '94vh', { ariaLabel: '收藏集奖励筛查结果', showHeader: false });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        addStyles(window.content);
        const dialog = createElement('section', { attributes: { id: IDS.results, role: 'dialog', 'aria-modal': 'true', 'aria-label': '收藏集奖励筛查结果', tabindex: '-1' } });
        const header = createElement('header', { className: 'bdc-header' });
        const heading = document.createElement('div');
        heading.append(createElement('h1', { className: 'bdc-title', text: '收藏集奖励筛查' }), createElement('p', { className: 'bdc-subtitle', text: `已检查 ${state.collectionCount} 个收藏集` }));
        const headerActions = createElement('div', { className: 'bdc-header-actions' });
        const refresh = createElement('button', { text: '重新检查', attributes: { type: 'button' } });
        refresh.addEventListener('click', () => { window.close(); collectDigitalCards(); });
        const close = createElement('button', { className: 'bdc-close', text: '×', attributes: { type: 'button', title: '关闭（Esc）', 'aria-label': '关闭' } });
        close.addEventListener('click', window.close);
        headerActions.append(refresh, close);
        header.append(heading, headerActions);
        const summary = createElement('div', { className: 'bdc-summary' });
        const rewardCount = state.items.filter(hasUnclaimedReward).length;
        [['收藏集', state.collectionCount], ['拥有卡片', state.totalCardNum], ['可领奖励', rewardCount]].forEach(([label, value]) => {
            const stat = createElement('div', { className: 'bdc-stat' });
            stat.append(createElement('div', { className: 'bdc-stat-label', text: label }), createElement('div', { className: 'bdc-stat-value', text: Number(value).toLocaleString() }));
            summary.appendChild(stat);
        });
        const toolbar = createElement('div', { className: 'bdc-toolbar' });
        const search = createElement('input', { className: 'bdc-search', attributes: { type: 'search', placeholder: '搜索收藏集、卡池、UP 主或 UID', 'aria-label': '搜索收藏集' } });
        const completeness = createSelect('集齐状态', [['all', '集齐：全部'], ['complete', '已集齐'], ['incomplete', '未集齐']]);
        const rewards = createSelect('奖励状态', [['all', '奖励：全部'], ['claimable', '可领奖励'], ['none', '无可领奖励']]);
        const sort = createSelect('排序方式', [['owned', '按持有卡片数'], ['completion', '按集齐进度'], ['pool', '按卡池大小'], ['sales', '按销量'], ['name', '按名称']]);
        const reset = createElement('button', { text: '重置筛选', attributes: { type: 'button' } });
        const count = createElement('span', { className: 'bdc-count' });
        toolbar.append(search, completeness, rewards, sort, reset, count);
        const list = createElement('main', { className: 'bdc-list' });
        const grid = createElement('div', { className: 'bdc-grid' });
        const empty = createElement('div', { className: 'bdc-empty', text: '没有符合筛选条件的卡池', attributes: { hidden: '' } });
        const loadMore = createElement('button', { className: 'bdc-load-more', text: '加载更多', attributes: { type: 'button' } });
        list.append(grid, empty, loadMore);
        dialog.append(header, summary, toolbar, list);
        window.content.appendChild(dialog);
        windows.results = window;

        let filtered = [];
        let rendered = 0;
        const batchSize = 36;
        function matches(item) {
            const term = search.value.trim().toLocaleLowerCase();
            if (term) {
                const users = Object.values(item.act?.related_user_infos || {}).map(user => `${user.nickname || ''} ${user.uid || ''}`).join(' ');
                if (!`${item.title || ''} ${item.name || ''} ${users}`.toLocaleLowerCase().includes(term)) return false;
            }
            const complete = item.owned >= item.total;
            const claimable = hasUnclaimedReward(item);
            if (completeness.value === 'complete' && !complete) return false;
            if (completeness.value === 'incomplete' && complete) return false;
            if (rewards.value === 'claimable' && !claimable) return false;
            if (rewards.value === 'none' && claimable) return false;
            return true;
        }
        function sortItems(items) {
            const sorted = [...items];
            const sorters = {
                owned: (a, b) => b.num - a.num,
                completion: (a, b) => (b.owned / Math.max(b.total, 1)) - (a.owned / Math.max(a.total, 1)),
                pool: (a, b) => b.total - a.total,
                sales: (a, b) => b.sale - a.sale,
                name: (a, b) => (a.title || '').localeCompare(b.title || '')
            };
            return sorted.sort(sorters[sort.value]);
        }
        function renderNext() {
            const fragment = document.createDocumentFragment();
            const end = Math.min(rendered + batchSize, filtered.length);
            for (; rendered < end; rendered++) fragment.appendChild(createCardItem(filtered[rendered]));
            grid.appendChild(fragment);
            loadMore.hidden = rendered >= filtered.length;
        }
        function applyFilters() {
            filtered = sortItems(state.items.filter(matches));
            rendered = 0;
            grid.replaceChildren();
            empty.hidden = filtered.length > 0;
            count.textContent = `显示 ${filtered.length.toLocaleString()} / ${state.items.length.toLocaleString()} 个卡池`;
            renderNext();
        }
        [search, completeness, rewards, sort].forEach(control => control.addEventListener(control === search ? 'input' : 'change', applyFilters));
        reset.addEventListener('click', () => {
            search.value = '';
            completeness.value = 'all';
            rewards.value = 'all';
            sort.value = 'owned';
            applyFilters();
        });
        loadMore.addEventListener('click', renderNext);
        applyFilters();
        window.show();
    }

    async function getCollectionItems(collection) {
        try {
            const detail = await apiRequest(`https://api.bilibili.com/x/vas/dlc_act/act/basic?act_id=${collection.act_id}`);
            const lotteries = detail.data?.lottery_list || [];
            const items = await mapWithConcurrency(lotteries, LOTTERY_CONCURRENCY, async lottery => {
                try {
                    const card = await apiRequest(`https://api.bilibili.com/x/vas/dlc_act/lottery_home_detail?act_id=${collection.act_id}&lottery_id=${lottery.lottery_id}`);
                    return {
                        title: detail.data.act_title,
                        name: card.data?.name || lottery.lottery_name,
                        num: collection.card_num || 0,
                        owned: lottery.item_owned_cnt || 0,
                        total: lottery.item_total_cnt || 0,
                        sale: lottery.total_sale_amount || 0,
                        url: `https://www.bilibili.com/blackboard/activity-Mz9T5bO5Q3.html?id=${collection.act_id}&type=dlc`,
                        act: detail.data,
                        lottery: card.data || {}
                    };
                } catch (error) {
                    if (error.name === 'AbortError') throw error;
                    console.warn(`无法获取 ${collection.act_name} 的卡池 ${lottery.lottery_id}`, error);
                    return null;
                }
            });
            return items.filter(item => item?.owned > 0);
        } catch (error) {
            if (error.name === 'AbortError') throw error;
            console.warn(`无法获取收藏集 ${collection.act_name}（${collection.act_id}）`, error);
            return [];
        }
    }

    async function collectDigitalCards() {
        if (state.collecting) return;
        state.collecting = true;
        state.cancelRequested = false;
        state.items = [];
        try {
            const response = await apiRequest('https://api.bilibili.com/x/vas/smelt/my_decompose/info?scene=1');
            const collections = response.data?.list || [];
            if (collections.length === 0) {
                await showMessage('收藏集奖励筛查', '未找到拥有卡片的收藏集。');
                return;
            }
            state.collectionCount = collections.length;
            state.totalCardNum = collections.reduce((total, item) => total + (item.card_num || 0), 0);
            const progress = await createProgressDialog(collections.length);
            let completed = 0;
            let discovered = 0;
            try {
                const groups = await mapWithConcurrency(collections, COLLECTION_CONCURRENCY, async collection => {
                    try {
                        const items = await getCollectionItems(collection);
                        discovered += items.length;
                        return items;
                    } finally {
                        completed++;
                        progress.update(completed, discovered);
                    }
                });
                state.items = groups.flat();
                progress.update(completed, discovered);
            } finally {
                progress.close();
            }
            if (state.items.length === 0) {
                await showMessage('收藏集奖励筛查', '未找到拥有卡片的卡池，或详情接口暂不可用。');
                return;
            }
            await showResultsDialog();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('收藏集检查失败：', error);
                await showMessage('收藏集检查失败', error.message || '请检查网络后重试。');
            }
        } finally {
            state.collecting = false;
        }
    }

    GM_registerMenuCommand('检查收藏集', collectDigitalCards);
})();
