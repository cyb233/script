// ==UserScript==
// @name         Bilibili 动态筛选
// @namespace    Schwi
// @version      4.1.0
// @description  按时间收集、筛选和浏览 Bilibili 动态
// @author       Schwi
// @match        *://*.bilibili.com/*
// @connect      api.bilibili.com
// @connect      api.vc.bilibili.com
// @grant        GM.xmlHttpRequest
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
    const IDS = { styles: 'bds-styles', task: 'bds-task', progress: 'bds-progress', results: 'bds-results', rules: 'bds-rules' };
    const TYPE_NAMES = {
        DYNAMIC_TYPE_NONE: '动态失效', DYNAMIC_TYPE_AV: '视频', DYNAMIC_TYPE_PGC: '剧集', DYNAMIC_TYPE_COURSES: '课程', DYNAMIC_TYPE_WORD: '文本', DYNAMIC_TYPE_DRAW: '图文', DYNAMIC_TYPE_ARTICLE: '专栏', DYNAMIC_TYPE_MUSIC: '音乐', DYNAMIC_TYPE_COMMON_SQUARE: '卡片', DYNAMIC_TYPE_COMMON_VERTICAL: '竖屏', DYNAMIC_TYPE_LIVE: '直播', DYNAMIC_TYPE_MEDIALIST: '收藏夹', DYNAMIC_TYPE_COURSES_SEASON: '课程合集', DYNAMIC_TYPE_COURSES_BATCH: '课程批次', DYNAMIC_TYPE_AD: '广告', DYNAMIC_TYPE_APPLET: '小程序', DYNAMIC_TYPE_SUBSCRIPTION: '订阅', DYNAMIC_TYPE_LIVE_RCMD: '直播', DYNAMIC_TYPE_BANNER: '横幅', DYNAMIC_TYPE_UGC_SEASON: '合集', DYNAMIC_TYPE_PGC_UNION: '番剧影视', DYNAMIC_TYPE_SUBSCRIPTION_NEW: '新订阅'
    };
    const state = { dynamics: [], user: null, collecting: false, cancel: false };
    const PAGE_SIZE = 48;
    const el = (tag, options = {}) => { const node = document.createElement(tag); if (options.className) node.className = options.className; if (options.text !== undefined) node.textContent = options.text; if (options.attributes) Object.entries(options.attributes).forEach(([key, value]) => node.setAttribute(key, value)); return node; };
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const base = item => item && item.type === 'DYNAMIC_TYPE_FORWARD' ? (item.orig || item) : item;
    const time = item => Number(item && item.modules && item.modules.module_author && item.modules.module_author.pub_ts || 0);
    const formatTime = value => { const date = new Date(Number(value) * 1000); return Number.isNaN(date.getTime()) ? '时间未知' : date.toLocaleString(); };
    const isLottery = item => { const dynamic = base(item); const nodes = dynamic && dynamic.modules && dynamic.modules.module_dynamic && ((dynamic.modules.module_dynamic.major && dynamic.modules.module_dynamic.major.opus && dynamic.modules.module_dynamic.major.opus.summary && dynamic.modules.module_dynamic.major.opus.summary.rich_text_nodes) || (dynamic.modules.module_dynamic.desc && dynamic.modules.module_dynamic.desc.rich_text_nodes)) || []; return nodes.some(node => node && node.type === 'RICH_TEXT_NODE_TYPE_LOTTERY'); };
    const additional = item => { const dynamic = base(item); return dynamic && dynamic.modules && dynamic.modules.module_dynamic && dynamic.modules.module_dynamic.additional || {}; };
    const isChargeLottery = item => additional(item).type === 'ADDITIONAL_TYPE_UPOWER_LOTTERY';
    const isLiveReserve = item => additional(item).reserve && additional(item).reserve.stype === 2;
    const isVideoReserve = item => additional(item).reserve && additional(item).reserve.stype === 1;
    const hasReward = item => isLiveReserve(item) && Boolean(additional(item).reserve.desc3 && additional(item).reserve.desc3.text);
    const abort = () => Object.assign(new Error('查询已取消'), { name: 'AbortError' });

    function addStyles() {
        if (document.getElementById(IDS.styles)) return;
        const style = el('style', { attributes: { id: IDS.styles } });
        style.textContent = '#bds-task,#bds-progress,#bds-results,#bds-rules{box-sizing:border-box;font-family:Arial,"Microsoft YaHei",sans-serif;color:#202124}#bds-task *,#bds-progress *,#bds-results *,#bds-rules *{box-sizing:border-box}#bds-task,#bds-progress,#bds-rules{position:fixed;z-index:2147483647;top:50%;left:50%;width:min(460px,calc(100vw - 32px));padding:20px;transform:translate(-50%,-50%);background:#fff;border:1px solid #c8d0d9;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.28)}#bds-task h2,#bds-progress h2,#bds-rules h2{margin:0 0 8px;font-size:18px}#bds-task p,#bds-progress p,#bds-rules p{margin:0 0 14px;color:#667085;font-size:13px;line-height:1.55}#bds-task label{display:block;margin:12px 0 6px;color:#344054;font-size:13px;font-weight:700}#bds-task input,#bds-rules textarea{width:100%;border:1px solid #b9c0c9;border-radius:4px;outline:none}#bds-task input{height:36px;padding:0 10px}#bds-rules textarea{min-height:260px;padding:10px;resize:vertical;font:12px/1.5 Consolas,monospace}.bds-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}#bds-task button,#bds-progress button,#bds-results button,#bds-rules button{height:34px;padding:0 11px;border:1px solid #aeb7c2;border-radius:4px;background:#fff;color:#25364a;cursor:pointer;font-size:13px}#bds-task button:hover,#bds-progress button:hover,#bds-results button:hover,#bds-rules button:hover{background:#f0f5ff;border-color:#6b96d8}.primary{border-color:#00a1d6!important;background:#00a1d6!important;color:#fff!important}#bds-progress progress{width:100%;height:8px;margin:6px 0 12px;accent-color:#00a1d6}#bds-results{position:fixed;z-index:2147483646;inset:3vh 3vw;display:flex;flex-direction:column;overflow:hidden;background:#f6f8fa;border:1px solid #b9c0c9;border-radius:8px;box-shadow:0 18px 50px rgba(0,0,0,.32)}#bds-results .header{display:flex;align-items:center;min-height:64px;padding:12px 18px;background:#fff;border-bottom:1px solid #d8dee4}#bds-results h2{margin:0;font-size:18px}#bds-results .subtitle{margin:3px 0 0;color:#667085;font-size:12px}.header-actions{display:flex;gap:8px;margin-left:auto}.close{width:34px!important;padding:0!important;color:#57606a!important;font-size:24px!important;line-height:1}.toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:10px 18px;background:#fff;border-bottom:1px solid #e2e6ea}.search,.sort,.range-date{height:34px;padding:0 10px;border:1px solid #b9c0c9;border-radius:4px;background:#fff;color:#25364a;font-size:13px;outline:none}.search{width:min(300px,100%)}.sort{min-width:150px}.range-label,.range-separator{color:#667085;font-size:12px;white-space:nowrap}.range-date{width:145px}.toggle{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 4px;color:#57606a;font-size:13px;white-space:nowrap}.count{margin-left:auto;color:#667085;font-size:12px}.filters{max-height:235px;overflow:auto;padding:10px 18px 12px;background:#fff;border-bottom:1px solid #e2e6ea}.filter-group{display:flex;flex-wrap:wrap;align-items:center;gap:7px 12px;padding:7px 0;border-top:1px solid #eef1f4}.filter-group:first-child{border-top:0}.group-name{width:68px;color:#667085;font-size:12px;font-weight:700}.filter{display:inline-flex;align-items:center;gap:4px;color:#344054;font-size:12px;white-space:nowrap}.list{flex:1;min-height:0;overflow:auto;padding:16px 18px 24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;align-content:start}#bds-results .card{position:relative;min-width:0;height:300px;overflow:hidden;border:1px solid #d8dee4;border-radius:6px;background:#252b36;color:#fff}#bds-results .poster{position:absolute!important;inset:0!important;z-index:0;width:100%!important;height:100%!important;max-width:none!important;object-fit:cover}#bds-results .card-body{position:absolute!important;inset:0!important;z-index:1;display:flex!important;flex-direction:column;height:100%!important;padding:12px;background:linear-gradient(180deg,rgba(0,0,0,.14),rgba(0,0,0,.84))}#bds-results.poster-only .card-body{display:none!important}.badges{display:flex;flex-wrap:wrap;gap:5px;min-height:20px}.badge{padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.58);font-size:11px}.reward{background:#ca4b4b}.card-title{margin:8px 0 4px;overflow:hidden;font-size:15px;line-height:1.35;white-space:nowrap;text-overflow:ellipsis}.card-title a,.card-actions a{color:#fff;text-decoration:none}.card-time{color:#e8edf2;font-size:12px}.desc{display:-webkit-box;flex:1;margin:8px 0;overflow:hidden;color:#edf1f5;font-size:13px;line-height:1.48;white-space:pre-wrap;-webkit-box-orient:vertical;-webkit-line-clamp:5}.card-actions{display:flex;gap:8px}.card-actions a{flex:1;height:30px;padding:7px 8px;border:1px solid rgba(255,255,255,.55);border-radius:4px;text-align:center;font-size:12px}.load-more-row{display:flex;justify-content:center;padding:18px 0 2px}.load-more{min-width:140px}.empty{padding:48px 12px;color:#667085;text-align:center}.rule-error{min-height:18px;margin-top:8px;color:#c83d3d;font-size:12px}@media(max-width:680px){#bds-results{inset:0;border:0;border-radius:0}.header,.toolbar,.filters{padding-left:12px!important;padding-right:12px!important}.search{order:1;width:100%}.count{margin-left:0}.list{padding:12px}.filter-group{align-items:flex-start}.group-name{width:100%}}';
        document.head.appendChild(style);
    }

    async function request(url, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            if (state.cancel) throw abort();
            try {
                const endpoint = url + (url.includes('?') ? '&' : '?') + '_ts=' + Date.now();
                const response = await GM.xmlHttpRequest({ method: 'GET', url: endpoint });
                const data = JSON.parse(response.responseText);
                return data;
            } catch (error) {
                if (error.name === 'AbortError' || attempt === retries) throw error;
                await wait(1000);
            }
        }
    }
    async function getUser() { if (!state.user) state.user = (await request('https://api.bilibili.com/x/space/v2/myinfo')).data; return state.user; }
    function customSource() { const value = GM_getValue('customFilters', {}); return value && typeof value === 'object' ? value : {}; }
    function customRules() {
        return Object.entries(customSource()).flatMap(([name, rule]) => {
            try { if (!rule || !['checkbox', 'text'].includes(rule.type) || typeof rule.filter !== 'string') return []; const filter = new Function('return (' + rule.filter + ');')(); return typeof filter === 'function' ? [{ id: 'custom-' + name, name, type: rule.type, filter }] : []; }
            catch (error) { console.warn('自定义规则已跳过：' + name, error); return []; }
        });
    }
    function filterGroups() {
        const mine = item => item && item.modules && item.modules.module_author && item.modules.module_author.mid === state.user?.profile?.mid;
        const common = [
            ['mine', '只看自己', mine], ['not-mine', '排除自己', item => !mine(item)], ['forward', '只看转发', item => item && item.type === 'DYNAMIC_TYPE_FORWARD'], ['not-forward', '排除转发', item => !item || item.type !== 'DYNAMIC_TYPE_FORWARD'], ['video-reserve', '视频更新预告', isVideoReserve], ['live-reserve', '直播预告', isLiveReserve], ['charge', '充电动态', item => { const dynamic = base(item); return dynamic?.modules?.module_author?.icon_badge?.text === '充电专属'; }], ['reward-reserve', '有奖预约', hasReward], ['lottery', '互动抽奖', isLottery], ['charge-lottery', '充电互动抽奖', isChargeLottery], ['normal-lottery', '非充电互动抽奖', item => isLottery(item) && !isChargeLottery(item)],
            ['participated', '已参与', item => (hasReward(item) && item.reserve?.isFollow === 1) || (isLottery(item) && (item.reserveInfo?.followed && item.reserveInfo?.reposted)) || (isChargeLottery(item) && (item.reserveInfo?.has_charge_right && item.reserveInfo?.participated))], ['not-participated', '未参与', item => (hasReward(item) && item.reserve?.isFollow === 0) || (isLottery(item) && !(item.reserveInfo?.followed && item.reserveInfo?.reposted)) || (isChargeLottery(item) && !(item.reserveInfo?.has_charge_right && item.reserveInfo?.participated))], ['drawn', '已开奖', item => item.reserveInfo?.lottery_result], ['not-drawn', '未开奖', item => item.reserveInfo && !item.reserveInfo.lottery_result], ['winner', '我中奖的', item => { const result = item.reserveInfo?.lottery_result; if (!result) return false; return Object.values(result).some(list => list.some(prize => prize.uid === state.user?.profile?.mid)); }], ['not-winner', '未中奖', item => Boolean(item.reserveInfo?.lottery_result) && !common.find(rule => rule[0] === 'winner')[2](item)]
        ].map(row => ({ id: row[0], name: row[1], type: 'checkbox', filter: row[2] }));
        const typeMap = {};
        Object.entries(TYPE_NAMES).forEach(([key, name]) => {
            if (key === 'DYNAMIC_TYPE_FORWARD') return;
            const match = typeMap[name];
            if (match) {
                const previous = match.filter;
                match.filter = item => previous(item) || item.baseType === key;
            } else {
                typeMap[name] = { id: 'type-' + name, name, type: 'checkbox', filter: item => item.baseType === key };
            }
        });
        const types = Object.values(typeMap);
        return [['常用', common], ['动态类型', types], ['自定义', customRules()]];
    }
    function getDescText(dynamic, isForward = false) {
        const content = dynamic?.modules?.module_dynamic || {};
        const major = content.major || {};
        const titleText = major.opus?.title || major.archive?.title || '';
        let descText = major.opus?.summary?.text || content.desc?.text || major.archive?.desc || '';
        if (isForward && dynamic.orig) {
            if (dynamic.orig.type === 'DYNAMIC_TYPE_NONE') {
                descText += '<hr />' + (dynamic.orig.modules?.module_dynamic?.major?.none?.tips || '');
            } else {
                descText += '<hr />' + getDescText(dynamic.orig);
            }
        }
        return (titleText ? '<h3>' + titleText + '</h3><br />' : '') + descText;
    }
    function descriptionPlainText(dynamic, isForward = false) {
        const html = getDescText(dynamic, isForward);
        const container = document.createElement('div');
        container.innerHTML = html;
        return container.textContent || '';
    }
    function dynamicText(item) {
        const content = item?.modules?.module_dynamic || {};
        const author = item?.modules?.module_author || {};
        const titleText = (content.major?.opus?.title || content.major?.archive?.title || '').toLocaleUpperCase();
        const descText = (content.major?.opus?.summary?.text || content.desc?.text || content.major?.archive?.desc || '').toLocaleUpperCase();
        const originalAuthor = item?.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig?.modules?.module_author || {} : {};
        const originalDesc = item?.type === 'DYNAMIC_TYPE_FORWARD' ? (item.orig?.modules?.module_dynamic?.major?.opus?.summary?.text || '').toLocaleUpperCase() : '';
        return [author.name, author.mid, titleText, descText, originalAuthor.name, originalAuthor.mid, originalDesc].filter(Boolean).join('\n').toLocaleUpperCase();
    }
    function dynamicCard(item) {
        const dynamic = base(item) || {}; const author = item.modules && item.modules.module_author || {}; const dynamicModules = dynamic.modules || {}; const original = dynamicModules.module_author || author; const major = dynamicModules.module_dynamic && dynamicModules.module_dynamic.major || {}; const cover = major.opus && major.opus.pics && major.opus.pics[0] && major.opus.pics[0].url || major.archive && major.archive.cover || major.article && major.article.covers && major.article.covers[0] || major.pgc && major.pgc.cover || ''; const node = el('article', { className: 'card' });
        if (cover) node.appendChild(el('img', { className: 'poster', attributes: { src: cover, loading: 'lazy', alt: '' } }));
        const badges = el('div', { className: 'badges' }); badges.appendChild(el('span', { className: 'badge', text: TYPE_NAMES[item.baseType] || item.baseType || '未知类型' })); if (item.type === 'DYNAMIC_TYPE_FORWARD') badges.appendChild(el('span', { className: 'badge', text: '转发' })); if (hasReward(item) || isLottery(item) || isChargeLottery(item)) badges.appendChild(el('span', { className: 'badge reward', text: '抽奖' }));
        const title = el('div', { className: 'card-title' }); title.append(el('a', { text: author.name || '未知用户', attributes: { href: 'https://space.bilibili.com/' + (author.mid || ''), target: '_blank', rel: 'noreferrer' } }), item.type === 'DYNAMIC_TYPE_FORWARD' ? ' 转发了 ' + (original.name || '原动态') : ' 发布了动态');
        const description = getDescText(item, item?.type === 'DYNAMIC_TYPE_FORWARD') || '暂无可显示的文字内容';
        const desc = el('div', { className: 'desc' });
        desc.innerHTML = description;
        const actions = el('div', { className: 'card-actions' }); actions.appendChild(el('a', { text: '查看详情', attributes: { href: 'https://t.bilibili.com/' + item.id_str, target: '_blank', rel: 'noreferrer' } })); const body = el('div', { className: 'card-body' }); body.append(badges, title, el('div', { className: 'card-time', text: formatTime(time(item)) }), desc, actions); node.appendChild(body); return node;
    }
    function ruleDialog(onSaved) {
        document.getElementById(IDS.rules)?.remove(); addStyles(); const dialog = el('section', { attributes: { id: IDS.rules, role: 'dialog', 'aria-modal': 'true' } }); const editor = el('textarea', { attributes: { spellcheck: 'false' } }); editor.value = JSON.stringify(customSource(), null, 2); const error = el('div', { className: 'rule-error' }); const cancel = el('button', { text: '取消' }); const save = el('button', { className: 'primary', text: '保存规则' }); cancel.onclick = () => dialog.remove(); save.onclick = () => { try { const rules = JSON.parse(editor.value || '{}'); if (!rules || Array.isArray(rules) || typeof rules !== 'object') throw new Error('规则根节点必须是对象。'); Object.entries(rules).forEach(([name, rule]) => { if (!name.trim() || !rule || !['checkbox', 'text'].includes(rule.type) || typeof rule.filter !== 'string' || typeof new Function('return (' + rule.filter + ');')() !== 'function') throw new Error('规则“' + name + '”格式无效。'); }); GM_setValue('customFilters', rules); dialog.remove(); onSaved(); } catch (exception) { error.textContent = exception.message || '规则格式无效。'; } }; const actions = el('div', { className: 'bds-actions' }); actions.append(cancel, save); dialog.append(el('h2', { text: '自定义筛选规则' }), el('p', { text: '每项包含 type（checkbox 或 text）和 filter（箭头函数字符串）。启用复选框或填写文本后，规则返回 true 的动态才会显示。' }), editor, error, actions); document.body.appendChild(dialog);
    }
    function resultsDialog(note) {
        document.getElementById(IDS.results)?.remove(); addStyles(); const dialog = el('section', { attributes: { id: IDS.results, role: 'dialog', 'aria-modal': 'true' } }); const title = el('h2', { text: '动态结果' }); const subtitle = el('p', { className: 'subtitle' }); const close = el('button', { className: 'close', text: '×', attributes: { title: '关闭' } }); const rules = el('button', { text: '自定义规则' }); const headerActions = el('div', { className: 'header-actions' }); headerActions.append(rules, close); const headerText = el('div'); headerText.append(title, subtitle); const header = el('header', { className: 'header' }); header.append(headerText, headerActions);
        const search = el('input', { className: 'search', attributes: { type: 'search', placeholder: '搜索作者、UID、标题或正文' } }); const sort = el('select', { className: 'sort', attributes: { 'aria-label': '时间排序' } }); sort.append(el('option', { text: '时间倒序（新 → 旧）', attributes: { value: 'desc' } }), el('option', { text: '时间正序（旧 → 新）', attributes: { value: 'asc' } })); const rangeLabel = el('span', { className: 'range-label', text: '时间范围' }); const rangeStart = el('input', { className: 'range-date', attributes: { type: 'date', 'aria-label': '筛选开始日期', title: '筛选开始日期' } }); const rangeSeparator = el('span', { className: 'range-separator', text: '至' }); const rangeEnd = el('input', { className: 'range-date', attributes: { type: 'date', 'aria-label': '筛选结束日期', title: '筛选结束日期' } }); const posterBox = el('input', { attributes: { type: 'checkbox' } }); const poster = el('label', { className: 'toggle' }); poster.append(posterBox, '仅显示海报'); const reset = el('button', { text: '重置筛选' }); const toggle = el('button', { text: '收起筛选' }); const count = el('span', { className: 'count' }); const toolbar = el('div', { className: 'toolbar' }); toolbar.append(search, sort, rangeLabel, rangeStart, rangeSeparator, rangeEnd, poster, reset, toggle, count); const panel = el('div', { className: 'filters' }); const grid = el('div', { className: 'grid' }); const moreRow = el('div', { className: 'load-more-row' }); const list = el('main', { className: 'list' }); list.append(grid, moreRow); dialog.append(header, toolbar, panel, list); document.body.appendChild(dialog);
        const values = new Map(); let visible = []; let rendered = 0;
        const range = () => { const values = state.dynamics.map(time).filter(Boolean); return values.length ? formatTime(Math.min(...values)) + ' 至 ' + formatTime(Math.max(...values)) : '无有效时间'; };
        function renderMore() { const fragment = document.createDocumentFragment(); const next = visible.slice(rendered, rendered + PAGE_SIZE); next.forEach(item => fragment.appendChild(dynamicCard(item))); rendered += next.length; grid.appendChild(fragment); moreRow.replaceChildren(); if (!visible.length) grid.appendChild(el('div', { className: 'empty', text: '没有符合当前筛选条件的动态。' })); else if (rendered < visible.length) { const more = el('button', { className: 'load-more', text: '继续加载（剩余 ' + (visible.length - rendered).toLocaleString() + ' 条）' }); more.onclick = renderMore; moreRow.appendChild(more); } }
        function apply() { const query = search.value.trim().toLocaleUpperCase(); const from = rangeStart.value ? new Date(rangeStart.value + 'T00:00:00').getTime() / 1000 : -Infinity; const to = rangeEnd.value ? new Date(rangeEnd.value + 'T23:59:59').getTime() / 1000 : Infinity; const active = filterGroups().flatMap(row => row[1]).filter(rule => rule.type === 'text' ? Boolean((values.get(rule.id) || '').trim()) : Boolean(values.get(rule.id))); visible = state.dynamics.filter(item => { const value = time(item); return value >= from && value <= to && (!query || dynamicText(item).includes(query)); }).filter(item => active.every(rule => { try { return rule.filter(item, values.get(rule.id)); } catch (error) { console.warn('筛选规则执行失败：' + rule.name, error); return false; } })); visible.sort((a, b) => (sort.value === 'asc' ? time(a) - time(b) : time(b) - time(a))); title.textContent = '动态结果 ' + visible.length.toLocaleString() + ' / ' + state.dynamics.length.toLocaleString(); subtitle.textContent = (note ? note + ' · ' : '') + '时间范围：' + range(); count.textContent = '已匹配 ' + visible.length.toLocaleString() + ' 条'; rendered = 0; grid.replaceChildren(); renderMore(); }
        function renderFilters() { panel.replaceChildren(); filterGroups().forEach(([groupName, entries]) => { if (!entries.length) return; const group = el('div', { className: 'filter-group' }); group.appendChild(el('span', { className: 'group-name', text: groupName })); entries.forEach(rule => { const label = el('label', { className: 'filter' }); const input = el('input', { attributes: { type: rule.type } }); if (rule.type === 'checkbox') input.checked = Boolean(values.get(rule.id)); else { input.value = values.get(rule.id) || ''; input.placeholder = rule.name; } input.addEventListener(rule.type === 'text' ? 'input' : 'change', () => { values.set(rule.id, rule.type === 'checkbox' ? input.checked : input.value); apply(); }); label.append(input, rule.name); group.appendChild(label); }); panel.appendChild(group); }); }
        close.onclick = () => dialog.remove(); search.oninput = apply; sort.onchange = apply; rangeStart.onchange = apply; rangeEnd.onchange = apply; posterBox.onchange = () => dialog.classList.toggle('poster-only', posterBox.checked); reset.onclick = () => { values.clear(); search.value = ''; rangeStart.value = ''; rangeEnd.value = ''; sort.value = 'desc'; renderFilters(); apply(); }; toggle.onclick = () => { panel.hidden = !panel.hidden; toggle.textContent = panel.hidden ? '展开筛选' : '收起筛选'; }; rules.onclick = () => ruleDialog(() => { values.clear(); renderFilters(); apply(); }); renderFilters(); apply();
    }
    function progressDialog() {
        document.getElementById(IDS.progress)?.remove(); addStyles(); const dialog = el('section', { attributes: { id: IDS.progress, role: 'status' } }); const detail = el('p', { text: '正在读取动态列表...' }); const progress = el('progress', { attributes: { value: '0', max: '1' } }); const range = el('p'); const cancel = el('button', { text: '取消' }); cancel.onclick = () => { state.cancel = true; cancel.disabled = true; cancel.textContent = '正在取消'; }; const actions = el('div', { className: 'bds-actions' }); actions.appendChild(cancel); dialog.append(el('h2', { text: '正在收集动态' }), detail, progress, range, actions); document.body.appendChild(dialog); return { update(kept, scanned, earliest, latest) { detail.textContent = '已保留 ' + kept.toLocaleString() + ' 条，已扫描 ' + scanned.toLocaleString() + ' 条'; progress.max = Math.max(scanned, 1); progress.value = scanned; range.textContent = earliest && latest ? '已扫描时间范围：' + formatTime(earliest) + ' 至 ' + formatTime(latest) : ''; }, close() { dialog.remove(); } };
    }
    function taskDialog(selfOnly) {
        document.getElementById(IDS.task)?.remove(); addStyles(); const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); const toDate = value => value.toISOString().slice(0, 10); const dialog = el('section', { attributes: { id: IDS.task, role: 'dialog', 'aria-modal': 'true' } }); const hint = el('p', { text: 'Bilibili 只能从最新动态向前读取。开始日期之前的动态不会纳入结果，查询结束时间自动取当前时刻。' }); const start = el('input', { attributes: { type: 'date', value: toDate(yesterday) } }); const cancel = el('button', { text: '取消' }); const begin = el('button', { className: 'primary', text: '开始收集' }); cancel.onclick = () => dialog.remove(); begin.onclick = () => { const from = new Date(start.value + 'T00:00:00').getTime() / 1000; const to = Math.floor(Date.now() / 1000); if (!start.value || Number.isNaN(from)) { hint.textContent = '请选择有效的开始日期。'; hint.style.color = '#c83d3d'; return; } dialog.remove(); collect(from, to, selfOnly); }; const actions = el('div', { className: 'bds-actions' }); actions.append(cancel, begin); dialog.append(el('h2', { text: selfOnly ? '收集自己的动态' : '收集动态' }), hint, el('label', { text: '开始日期' }), start, actions); document.body.appendChild(dialog);
    }
    async function enrich(item) {
        const dynamic = base(item) || {}; item.baseType = dynamic.type || item.type; item.reserve = null; item.reserveInfo = null;
        if (isLiveReserve(item)) { const rid = additional(item).reserve.rid; if (rid) { item.reserveInfo = (await request('https://api.vc.bilibili.com/lottery_svr/v1/lottery_svr/lottery_notice?business_id=' + rid + '&business_type=10')).data; const businessId = item.reserveInfo && item.reserveInfo.business_id; if (businessId) item.reserve = (await request('https://api.bilibili.com/x/activity/up/reserve/relation/info?ids=' + businessId)).data?.list?.[businessId] || null; } }
        if (isLottery(item) && dynamic.id_str) item.reserveInfo = (await request('https://api.vc.bilibili.com/lottery_svr/v1/lottery_svr/lottery_notice?business_id=' + dynamic.id_str + '&business_type=1')).data;
        if (isChargeLottery(item) && dynamic.id_str) item.reserveInfo = (await request('https://api.vc.bilibili.com/lottery_svr/v1/lottery_svr/lottery_notice?business_id=' + dynamic.id_str + '&business_type=12')).data;
        return item;
    }
    async function collect(start, end, selfOnly) {
        if (state.collecting) return;
        state.collecting = true; state.cancel = false; state.dynamics = [];
        const progress = progressDialog(); const ids = new Set();
        let offset = ''; let scanned = 0; let earliest = 0; let latest = 0; let more = true; let partial = false; let shouldInclude = false; let errorCount = 0;
        try {
            const user = await getUser();
            while (more) {
                if (state.cancel) throw abort();
                try {
                    const features = '&features=itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,decorationCard,onlyfansAssetsV2,forwardListHidden,ugcDelete,onlyfansQaCard,commentsNewVersion';
                    const endpoint = selfOnly ? 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?host_mid=' + user.profile.mid + '&offset=' + offset + features : 'https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=all&offset=' + offset + features;
                    const data = await request(endpoint); const items = data?.data?.items || []; errorCount = 0;
                    if (!shouldInclude) shouldInclude = items.some(item => time(item) > 0 && time(item) < end + 24 * 60 * 60);
                    for (const item of items) {
                        if (!item?.id_str || ids.has(item.id_str)) continue;
                        ids.add(item.id_str); scanned++;
                        const value = time(item);
                        if (value) { earliest = !earliest ? value : Math.min(earliest, value); latest = Math.max(latest, value); }
                        if (item.type !== 'DYNAMIC_TYPE_LIVE_RCMD' && value && value < start) more = false;
                        item.baseType = item.type === 'DYNAMIC_TYPE_FORWARD' ? item.orig?.type : item.type;
                        item.display = true;
                        if (shouldInclude) { state.dynamics.push(await enrich(item)); progress.update(state.dynamics.length, scanned, earliest, latest); }
                    }
                    offset = data.data.offset || items[items.length - 1].id_str;
                    more = more && Boolean(data?.data?.has_more && offset);
                    progress.update(state.dynamics.length, scanned, earliest, latest);
                } catch (error) {
                    if (error.name === 'AbortError') throw error;
                    errorCount++;
                    if (errorCount >= 5) { partial = true; break; }
                    console.error('动态页面读取失败，正在重试', error);
                    await wait(1000);
                }
            }
        } catch (error) {
            partial = true;
            if (error.name !== 'AbortError') console.error('收集动态失败', error);
        } finally {
            state.collecting = false; progress.close();
        }
        state.dynamics.sort((a, b) => time(b) - time(a));
        resultsDialog(partial ? '查询未完整结束，以下为已收集的结果' : '查询完成');
    }
    GM_registerMenuCommand('检查动态', () => taskDialog(false));
    GM_registerMenuCommand('只看自己动态', () => taskDialog(true));
})();
