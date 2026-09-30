// ==UserScript==
// @name         Bilibili 庆会广场
// @namespace    Schwi
// @version      1.0.1
// @description  查询、筛选和浏览 Bilibili 庆会广场活动
// @author       Schwi
// @match        *://*.bilibili.com/*
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @connect      api.live.bilibili.com
// @connect      api.vc.bilibili.com
// @grant        GM.xmlHttpRequest
// @grant        GM_registerMenuCommand
// @noframes
// @supportURL   https://github.com/cyb233/script
// @icon         https://www.bilibili.com/favicon.ico
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    const IDS = {
        results: 'bps-results-dialog',
        progress: 'bps-progress-dialog'
    };
    const windows = { progress: null, results: null, message: null };
    const PAGE_SIZE = 50;
    const LOTTERY_CONCURRENCY = 6;
    const state = {
        parties: [],
        collecting: false,
        cancelRequested: false
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
            #${IDS.results}, #${IDS.progress} { box-sizing: border-box; font-family: Arial, "Microsoft YaHei", sans-serif; color: #202124; }
            #${IDS.results} { position: fixed; z-index: 2147483646; inset: 3vh 3vw; display: flex; flex-direction: column; overflow: hidden; background: #f6f8fa; border: 1px solid #b9c0c9; border-radius: 8px; box-shadow: 0 18px 50px rgba(0, 0, 0, .32); }
            #${IDS.results} * { box-sizing: border-box; }
            #${IDS.results} .bps-header { display: flex; align-items: center; min-height: 62px; padding: 12px 18px; background: #fff; border-bottom: 1px solid #d8dee4; }
            #${IDS.results} .bps-title { margin: 0; font-size: 18px; font-weight: 700; }
            #${IDS.results} .bps-subtitle { margin: 3px 0 0; color: #667085; font-size: 12px; }
            #${IDS.results} .bps-header-actions { display: flex; gap: 8px; margin-left: auto; }
            #${IDS.results} button, #${IDS.progress} button { height: 34px; padding: 0 11px; border: 1px solid #aeb7c2; border-radius: 4px; background: #fff; color: #25364a; cursor: pointer; font-size: 13px; }
            #${IDS.results} button:hover, #${IDS.progress} button:hover { background: #f0f5ff; border-color: #6b96d8; }
            #${IDS.results} .bps-close { width: 34px; padding: 0; color: #57606a; font-size: 24px; line-height: 1; }
            #${IDS.results} .bps-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 18px; background: #fff; border-bottom: 1px solid #e2e6ea; }
            #${IDS.results} .bps-search, #${IDS.results} .bps-select { height: 34px; padding: 0 10px; border: 1px solid #b9c0c9; border-radius: 4px; background: #fff; color: #25364a; font-size: 13px; outline: none; }
            #${IDS.results} .bps-search { width: min(260px, 100%); }
            #${IDS.results} .bps-search:focus, #${IDS.results} .bps-select:focus { border-color: #00a1d6; box-shadow: 0 0 0 2px rgba(0, 161, 214, .18); }
            #${IDS.results} .bps-poster-toggle { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 4px; color: #57606a; font-size: 13px; white-space: nowrap; }
            #${IDS.results} .bps-count { margin-left: auto; color: #667085; font-size: 12px; white-space: nowrap; }
            #${IDS.results} .bps-list { flex: 1; min-height: 0; overflow: auto; padding: 16px 18px 24px; }
            #${IDS.results} .bps-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; align-content: start; }
            #${IDS.results} .bps-card { position: relative; min-width: 0; height: 300px; overflow: hidden; border: 1px solid #d8dee4; border-radius: 6px; background: #252b36; color: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, .08); }
            #${IDS.results} .bps-card:hover { border-color: #50b7e2; box-shadow: 0 6px 18px rgba(0, 54, 93, .2); }
            #${IDS.results} .bps-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
            #${IDS.results} .bps-card-body { position: relative; display: flex; flex-direction: column; height: 100%; padding: 12px; background: linear-gradient(180deg, rgba(0, 0, 0, .18) 0%, rgba(0, 0, 0, .82) 100%); }
            #${IDS.results}.bps-poster-only .bps-card-body { display: none; }
            #${IDS.results} .bps-badges { display: flex; flex-wrap: wrap; gap: 5px; min-height: 20px; }
            #${IDS.results} .bps-badge { padding: 2px 6px; border-radius: 3px; background: rgba(0, 0, 0, .58); color: #fff; font-size: 11px; }
            #${IDS.results} .bps-badge-live { background: #e84d5b; }
            #${IDS.results} .bps-card-title { display: -webkit-box; margin: 8px 0 4px; overflow: hidden; font-size: 16px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
            #${IDS.results} .bps-author, #${IDS.results} .bps-time { color: #e8edf2; font-size: 12px; }
            #${IDS.results} .bps-author a { color: #fff; text-decoration: none; }
            #${IDS.results} .bps-desc { display: -webkit-box; flex: 1; margin: 8px 0; overflow: hidden; color: #edf1f5; font-size: 13px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
            #${IDS.results} .bps-card-actions { display: flex; gap: 8px; }
            #${IDS.results} .bps-card-actions a { flex: 1; height: 30px; padding: 7px 8px; border: 1px solid rgba(255, 255, 255, .55); border-radius: 4px; color: #fff; text-align: center; text-decoration: none; font-size: 12px; }
            #${IDS.results} .bps-card-actions a:hover { background: rgba(255, 255, 255, .18); }
            #${IDS.results} .bps-load-more { display: block; min-width: 140px; margin: 18px auto 0; }
            #${IDS.results} .bps-empty { padding: 48px 12px; color: #667085; text-align: center; }
            #${IDS.progress} { position: fixed; z-index: 2147483647; top: 50%; left: 50%; width: min(390px, calc(100vw - 32px)); padding: 20px; transform: translate(-50%, -50%); background: #fff; border: 1px solid #d0d7de; border-radius: 8px; box-shadow: 0 18px 50px rgba(0, 0, 0, .28); }
            #${IDS.progress} h2 { margin: 0 0 8px; font-size: 18px; }
            #${IDS.progress} p { margin: 0 0 12px; color: #57606a; font-size: 13px; line-height: 1.5; }
            #${IDS.progress} progress { width: 100%; height: 8px; margin-bottom: 12px; accent-color: #00a1d6; }
            #${IDS.progress} .bps-progress-actions { display: flex; justify-content: flex-end; }
            @media (max-width: 680px) { #${IDS.results} { inset: 0; border: 0; border-radius: 0; } #${IDS.results} .bps-header, #${IDS.results} .bps-toolbar { padding-left: 12px; padding-right: 12px; } #${IDS.results} .bps-search { order: 1; width: 100%; } #${IDS.results} .bps-count { margin-left: 0; } #${IDS.results} .bps-list { padding: 12px; } } #${IDS.results}, #${IDS.progress} { position: static; inset: auto; z-index: auto; transform: none; width: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
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

    async function apiRequest(url, retry = 3) {
        const requestUrl = `${url}${url.includes('?') ? '&' : '?'}_ts=${Date.now()}`;
        for (let attempt = 1; attempt <= retry; attempt++) {
            if (state.cancelRequested) throw abortError();
            try {
                const response = await GM.xmlHttpRequest({ method: 'GET', url: requestUrl });
                if (state.cancelRequested) throw abortError();
                const data = JSON.parse(response.responseText);
                if (data.code && data.code !== 0) throw new Error(data.message || `接口返回错误 ${data.code}`);
                return data;
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                if (attempt === retry) throw error;
                console.warn(`接口请求失败，第 ${attempt}/${retry} 次重试：${url}`, error);
                await sleep(800 * attempt);
            }
        }
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

    function getReserveInfo(party) {
        return party.reserveInfo && typeof party.reserveInfo === 'object' ? party.reserveInfo : {};
    }

    function hasReward(party) {
        return Object.keys(getReserveInfo(party)).length > 0;
    }

    function isLive(party) {
        return party.room_info?.live_status === 1;
    }

    function formatDate(timestamp) {
        const date = new Date(Number(timestamp) * 1000);
        return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString();
    }

    async function createProgressDialog() {
        windows.progress?.close();
        const window = await SchwiDialog.createDialog(410, 240, { ariaLabel: '正在查询庆会广场', showHeader: false, closeOnBackdropClick: false, closeOnEscape: false });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        addStyles(window.content);
        const dialog = createElement('section', { attributes: { id: IDS.progress, role: 'status', 'aria-live': 'polite' } });
        const title = createElement('h2', { text: '正在查询庆会广场' });
        const detail = createElement('p', { text: '正在读取活动列表...' });
        const progress = createElement('progress', { attributes: { value: '0', max: '1' } });
        const latest = createElement('p', { text: '' });
        const cancel = createElement('button', { text: '取消', attributes: { type: 'button' } });
        cancel.addEventListener('click', () => { state.cancelRequested = true; cancel.disabled = true; cancel.textContent = '正在取消'; });
        const actions = createElement('div', { className: 'bps-progress-actions' });
        actions.appendChild(cancel);
        dialog.append(title, detail, progress, latest, actions);
        window.content.appendChild(dialog);
        window.show();
        windows.progress = window;
        return {
            update(collected, total, earliestDate, latestDate) {
                detail.textContent = `已收集 ${collected.toLocaleString()} / ${total ? total.toLocaleString() : '未知'} 个庆会`;
                progress.max = Math.max(total || 1, 1);
                progress.value = Math.min(collected, progress.max);
                latest.textContent = earliestDate && latestDate
                    ? `活动时间范围：${formatDate(earliestDate)} 至 ${formatDate(latestDate)}`
                    : '';
            },
            close() {
                window.close();
                if (windows.progress === window) windows.progress = null;
            }
        };
    }

    function createSelect(label, options) {
        const select = createElement('select', { className: 'bps-select', attributes: { 'aria-label': label } });
        options.forEach(([value, text]) => select.appendChild(createElement('option', { text, attributes: { value } })));
        return select;
    }

    function createPartyCard(party) {
        const room = party.room_info || {};
        const reserve = getReserveInfo(party);
        const roomId = room.room_id;
        const card = createElement('article', { className: 'bps-card' });
        if (party.party_poster) {
            const poster = createElement('img', { className: 'bps-poster', attributes: { src: party.party_poster, alt: '', loading: 'lazy' } });
            card.appendChild(poster);
        }
        const body = createElement('div', { className: 'bps-card-body' });
        const badges = createElement('div', { className: 'bps-badges' });
        if (hasReward(party)) badges.appendChild(createElement('span', { className: 'bps-badge', text: reserve.lottery_result ? '已开奖' : '有奖预约' }));
        if (party.is_subscribed === 1) badges.appendChild(createElement('span', { className: 'bps-badge', text: '已预约' }));
        if (isLive(party)) badges.appendChild(createElement('span', { className: 'bps-badge bps-badge-live', text: '直播中' }));
        const title = createElement('h2', { className: 'bps-card-title', text: party.party_title || '未命名庆会' });
        const author = createElement('div', { className: 'bps-author' });
        const authorLink = createElement('a', { text: room.name || '未知主播', attributes: { href: `https://space.bilibili.com/${room.uid || ''}`, target: '_blank', rel: 'noopener noreferrer' } });
        author.append(authorLink, document.createTextNode(` · ${party.party_name || '庆会'}`));
        const description = createElement('div', { className: 'bps-desc', text: party.party_text || '暂无活动说明' });
        const time = createElement('div', { className: 'bps-time', text: `预约时间：${formatDate(party.party_date)}` });
        const actions = createElement('div', { className: 'bps-card-actions' });
        if (reserve.lottery_detail_url) actions.appendChild(createElement('a', { text: '查看预约', attributes: { href: reserve.lottery_detail_url, target: '_blank', rel: 'noopener noreferrer' } }));
        if (roomId) actions.appendChild(createElement('a', { text: '打开直播间', attributes: { href: `https://live.bilibili.com/${roomId}`, target: '_blank', rel: 'noopener noreferrer' } }));
        body.append(badges, title, author, description, time, actions);
        card.appendChild(body);
        return card;
    }

    async function showResultsDialog() {
        windows.results?.close();
        const window = await SchwiDialog.createDialog('94vw', '94vh', { ariaLabel: '庆会广场结果', showHeader: false });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        addStyles(window.content);
        const dialog = createElement('section', { attributes: { id: IDS.results, role: 'dialog', 'aria-modal': 'true', 'aria-label': '庆会广场结果', tabindex: '-1' } });
        const header = createElement('header', { className: 'bps-header' });
        const heading = document.createElement('div');
        const title = createElement('h1', { className: 'bps-title', text: '庆会广场' });
        const subtitle = createElement('p', { className: 'bps-subtitle' });
        heading.append(title, subtitle);
        const headerActions = createElement('div', { className: 'bps-header-actions' });
        const refresh = createElement('button', { text: '重新查询', attributes: { type: 'button' } });
        refresh.addEventListener('click', () => { window.close(); collectParties(); });
        const close = createElement('button', { className: 'bps-close', text: '×', attributes: { type: 'button', title: '关闭（Esc）', 'aria-label': '关闭' } });
        close.addEventListener('click', window.close);
        headerActions.append(refresh, close);
        header.append(heading, headerActions);

        const toolbar = createElement('div', { className: 'bps-toolbar' });
        const search = createElement('input', { className: 'bps-search', attributes: { type: 'search', placeholder: '搜索标题、主播、UID 或说明', 'aria-label': '搜索庆会' } });
        const reward = createSelect('奖励状态', [['all', '奖励：全部'], ['reward', '有奖预约'], ['normal', '普通预约']]);
        const lottery = createSelect('开奖状态', [['all', '开奖：全部'], ['drawn', '已开奖'], ['pending', '未开奖']]);
        const subscription = createSelect('预约状态', [['all', '预约：全部'], ['subscribed', '已预约'], ['unsubscribed', '未预约']]);
        const live = createSelect('直播状态', [['all', '直播：全部'], ['live', '直播中'], ['offline', '未开播']]);
        const posterLabel = createElement('label', { className: 'bps-poster-toggle', text: '仅显示海报' });
        const posterOnly = createElement('input', { attributes: { type: 'checkbox' } });
        posterLabel.prepend(posterOnly);
        const reset = createElement('button', { text: '重置筛选', attributes: { type: 'button' } });
        const count = createElement('span', { className: 'bps-count' });
        toolbar.append(search, reward, lottery, subscription, live, posterLabel, reset, count);

        const list = createElement('main', { className: 'bps-list' });
        const grid = createElement('div', { className: 'bps-grid' });
        const empty = createElement('div', { className: 'bps-empty', text: '没有符合筛选条件的庆会', attributes: { hidden: '' } });
        const loadMore = createElement('button', { className: 'bps-load-more', text: '加载更多', attributes: { type: 'button' } });
        list.append(grid, empty, loadMore);
        dialog.append(header, toolbar, list);
        window.content.appendChild(dialog);
        windows.results = window;

        let filtered = [];
        let rendered = 0;
        const batchSize = 36;
        function matches(party) {
            const term = search.value.trim().toLocaleLowerCase();
            const room = party.room_info || {};
            const reserveInfo = getReserveInfo(party);
            const rewarded = hasReward(party);
            if (term) {
                const searchable = `${party.party_title || ''} ${party.party_text || ''} ${room.name || ''} ${room.uid || ''}`.toLocaleLowerCase();
                if (!searchable.includes(term)) return false;
            }
            if (reward.value === 'reward' && !rewarded) return false;
            if (reward.value === 'normal' && rewarded) return false;
            if (lottery.value === 'drawn' && !reserveInfo.lottery_result) return false;
            if (lottery.value === 'pending' && (!rewarded || reserveInfo.lottery_result)) return false;
            if (subscription.value === 'subscribed' && party.is_subscribed !== 1) return false;
            if (subscription.value === 'unsubscribed' && party.is_subscribed !== 0) return false;
            if (live.value === 'live' && !isLive(party)) return false;
            if (live.value === 'offline' && isLive(party)) return false;
            return true;
        }
        function renderNext() {
            const fragment = document.createDocumentFragment();
            const end = Math.min(rendered + batchSize, filtered.length);
            for (; rendered < end; rendered++) fragment.appendChild(createPartyCard(filtered[rendered]));
            grid.appendChild(fragment);
            loadMore.hidden = rendered >= filtered.length;
        }
        function applyFilters() {
            filtered = state.parties.filter(matches);
            rendered = 0;
            grid.replaceChildren();
            empty.hidden = filtered.length > 0;
            count.textContent = `显示 ${filtered.length.toLocaleString()} / ${state.parties.length.toLocaleString()} 项`;
            subtitle.textContent = `已收集 ${state.parties.length.toLocaleString()} 个庆会，可使用筛选快速定位`;
            renderNext();
        }
        [search, reward, lottery, subscription, live].forEach(control => control.addEventListener(control === search ? 'input' : 'change', applyFilters));
        posterOnly.addEventListener('change', () => dialog.classList.toggle('bps-poster-only', posterOnly.checked));
        reset.addEventListener('click', () => {
            search.value = '';
            [reward, lottery, subscription, live].forEach(select => { select.value = 'all'; });
            posterOnly.checked = false;
            dialog.classList.remove('bps-poster-only');
            applyFilters();
        });
        loadMore.addEventListener('click', renderNext);
        applyFilters();
        window.show();
    }

    async function collectParties() {
        if (state.collecting) return;
        state.collecting = true;
        state.cancelRequested = false;
        state.parties = [];
        const progress = await createProgressDialog();
        const partyIds = new Set();
        let page = 1;
        let total = 0;
        let earliestDate = null;
        let latestDate = null;
        try {
            while (!state.cancelRequested) {
                const square = await apiRequest(`https://api.live.bilibili.com/xlive/general-interface/v2/party/square?page=${page}&page_size=${PAGE_SIZE}`);
                const items = square?.data?.list;
                total = Number(square?.data?.total) || total;
                if (!Array.isArray(items) || items.length === 0) break;
                const uniqueItems = items.filter(item => {
                    if (!item?.party_id || partyIds.has(item.party_id)) return false;
                    partyIds.add(item.party_id);
                    return true;
                });
                let resolvedInPage = 0;
                const resolvedItems = await mapWithConcurrency(uniqueItems, LOTTERY_CONCURRENCY, async item => {
                    try {
                        const lottery = item.sid
                            ? await apiRequest(`https://api.vc.bilibili.com/lottery_svr/v1/lottery_svr/lottery_notice?business_id=${item.sid}&business_type=10`)
                            : null;
                        return { ...item, reserveInfo: lottery?.data || {} };
                    } catch (error) {
                        if (error.name === 'AbortError') throw error;
                        console.warn(`无法获取庆会 ${item.party_id} 的预约信息`, error);
                        return { ...item, reserveInfo: {} };
                    } finally {
                        const partyDate = Number(item.party_date);
                        if (Number.isFinite(partyDate)) {
                            earliestDate = earliestDate === null ? partyDate : Math.min(earliestDate, partyDate);
                            latestDate = latestDate === null ? partyDate : Math.max(latestDate, partyDate);
                        }
                        resolvedInPage++;
                        progress.update(state.parties.length + resolvedInPage, total, earliestDate, latestDate);
                    }
                });
                state.parties.push(...resolvedItems);
                progress.update(state.parties.length, total, earliestDate, latestDate);
                if (items.length < PAGE_SIZE || (total && state.parties.length >= total)) break;
                page++;
            }
            if (state.parties.length > 0) await showResultsDialog();
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('庆会广场查询失败：', error);
                await showMessage('庆会广场查询失败', error.message || '请检查网络后重试。');
            }
        } finally {
            state.collecting = false;
            progress.close();
        }
    }

    GM_registerMenuCommand('检查庆会广场', collectParties);
})();
