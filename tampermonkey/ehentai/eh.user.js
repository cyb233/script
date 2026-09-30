// ==UserScript==
// @name         e站收藏统计
// @namespace    Schwi
// @version      2.0.1
// @description  统计全部收藏及标签使用次数，支持翻译、分类浏览和导出
// @author       Schwi
// @match        *://e-hentai.org/*
// @match        *://exhentai.org/*
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @icon         https://e-hentai.org/favicon.ico
// @grant        GM_registerMenuCommand
// @noframes
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    const config = {
        translationUrl: 'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json',
        favoritesUrl: `${location.origin}/favorites.php?inline_set=dm_e`
    };
    const id = {
        progress: 'eh-favorite-stats-progress', dialog: 'eh-favorite-stats-dialog'
    };
    let activeController = null;
    let progressWindow = null;
    let progressRoot = null;
    let resultsWindow = null;
    let messageWindow = null;

    function element(tag, { className, text, attributes } = {}) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        if (attributes) Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    }

    function addStyles(content) {
        const style = element('style');
        style.textContent = `
            #${id.progress},#${id.dialog}{box-sizing:border-box;font-family:Arial,"Microsoft YaHei",sans-serif;color:#202124}#${id.progress}{position:fixed;z-index:2147483647;right:20px;bottom:20px;width:min(360px,calc(100vw - 32px));padding:14px 16px;background:#202124;color:#fff;border-radius:6px;box-shadow:0 10px 28px #00000047}#${id.progress} .eh-progress-row{display:flex;align-items:center;gap:12px}#${id.progress} .eh-progress-copy{flex:1;min-width:0}#${id.progress} .eh-progress-title{font-size:14px;font-weight:700}#${id.progress} .eh-progress-detail{margin-top:4px;color:#c7cbd1;font-size:12px}#${id.progress} button{padding:6px 9px;background:transparent;color:#fff;border:1px solid #72777d;border-radius:4px;cursor:pointer}
            #${id.dialog}{position:fixed;z-index:2147483646;inset:3vh 3vw;display:flex;flex-direction:column;background:#fff;border:1px solid #b9c0c9;border-radius:8px;box-shadow:0 18px 50px #00000052;overflow:hidden}#${id.dialog} *{box-sizing:border-box}#${id.dialog} .eh-header{position:relative;display:flex;align-items:center;justify-content:center;min-height:62px;padding:12px 56px;background:#f6f8fa;border-bottom:1px solid #d8dee4;text-align:center}#${id.dialog} .eh-title{margin:0;font-size:18px;font-weight:700}#${id.dialog} .eh-subtitle{margin:3px 0 0;color:#667085;font-size:12px}#${id.dialog} .eh-close{position:absolute;right:18px;width:32px;height:32px;padding:0;background:transparent;border:0;border-radius:4px;color:#4b5563;cursor:pointer;font-size:24px;line-height:1}#${id.dialog} .eh-close:hover{background:#e8ecf0;color:#202124}
            #${id.dialog} .eh-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:14px 18px 10px}#${id.dialog} .eh-stat{min-width:0;padding:10px 12px;background:#f6f8fa;border:1px solid #e2e6ea;border-radius:5px}#${id.dialog} .eh-stat-label{color:#667085;font-size:12px}#${id.dialog} .eh-stat-value{margin-top:4px;color:#1f4b99;font-size:20px;font-weight:700}#${id.dialog} .eh-toolbar{display:flex;align-items:center;gap:8px;padding:4px 18px 14px;border-bottom:1px solid #e2e6ea}#${id.dialog} .eh-search,#${id.dialog} .eh-namespace-jump{height:34px;padding:0 10px;background:#fff;border:1px solid #b9c0c9;border-radius:4px;color:#202124;outline:0}#${id.dialog} .eh-search{width:min(340px,100%)}#${id.dialog} .eh-namespace-jump{max-width:220px;cursor:pointer}#${id.dialog} .eh-search:focus,#${id.dialog} .eh-namespace-jump:focus{border-color:#1f6feb;box-shadow:0 0 0 2px #1f6feb2e}#${id.dialog} .eh-match-count{min-width:72px;color:#667085;font-size:12px}#${id.dialog} .eh-actions{display:flex;gap:8px;margin-left:auto}#${id.dialog} .eh-button{height:34px;padding:0 11px;background:#fff;border:1px solid #aeb7c2;border-radius:4px;color:#25364a;cursor:pointer;font-size:13px}#${id.dialog} .eh-button:hover{background:#f0f5ff;border-color:#6b96d8}
            #${id.dialog} .eh-tabs{display:flex;gap:2px;padding:0 18px;background:#f6f8fa;border-bottom:1px solid #d8dee4}#${id.dialog} .eh-tab{min-height:42px;padding:0 12px;background:transparent;border:0;border-bottom:2px solid transparent;color:#57606a;cursor:pointer;font-size:13px}#${id.dialog} .eh-tab:hover{color:#1f4b99}#${id.dialog} .eh-tab[aria-selected="true"]{border-bottom-color:#1f6feb;color:#1f4b99;font-weight:700}#${id.dialog} .eh-content{flex:1;min-height:0;overflow:auto;padding:16px 18px 22px;background:#fff}#${id.dialog} .eh-panel[hidden]{display:none}#${id.dialog} .eh-panel-title{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin:0 0 10px}#${id.dialog} .eh-panel-title h2{margin:0;font-size:15px}#${id.dialog} .eh-panel-title span{color:#667085;font-size:12px}
            #${id.dialog} table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:13px}#${id.dialog} th,#${id.dialog} td{padding:8px 10px;border-bottom:1px solid #e3e7eb;overflow:hidden;text-align:left;text-overflow:ellipsis;white-space:nowrap}#${id.dialog} th{position:sticky;top:-16px;z-index:1;background:#f6f8fa;border-top:1px solid #d8dee4;color:#455468;font-size:12px;font-weight:700}#${id.dialog} tbody tr:hover{background:#f4f8ff}#${id.dialog} .eh-namespace-group:hover{background:transparent}#${id.dialog} .eh-namespace-group td{padding:13px 10px 7px;background:#eaf2ff;border-bottom:2px solid #b9d3f5;color:#16477d;font-weight:700}#${id.dialog} .eh-namespace-group:first-child td{padding-top:8px}#${id.dialog} .eh-namespace-meta{margin-left:10px;color:#58769a;font-size:12px;font-weight:400}#${id.dialog} .eh-index,#${id.dialog} .eh-count{width:68px;text-align:right;font-variant-numeric:tabular-nums}#${id.dialog} .eh-count{width:84px;color:#1f4b99;font-weight:700}#${id.dialog} .eh-total td{background:#f6f8fa;border-top:1px solid #d8dee4;color:#25364a;font-weight:700}#${id.dialog} .eh-empty{padding:38px 12px;color:#667085;text-align:center}
            @media(max-width:680px){#${id.dialog}{inset:0;border:0;border-radius:0}#${id.dialog} .eh-header{padding:10px 12px}#${id.dialog} .eh-summary{padding:10px 12px 8px;gap:6px}#${id.dialog} .eh-stat{padding:8px}#${id.dialog} .eh-stat-value{font-size:17px}#${id.dialog} .eh-toolbar{flex-wrap:wrap;padding:4px 12px 10px}#${id.dialog} .eh-search{order:1;width:100%}#${id.dialog} .eh-namespace-jump{max-width:100%}#${id.dialog} .eh-tabs{overflow-x:auto;padding:0 8px}#${id.dialog} .eh-content{padding:12px}#${id.dialog} th,#${id.dialog} td{padding:8px}}#${id.progress},#${id.dialog}{position:static;inset:auto;z-index:auto;transform:none;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}
        `;
        content.appendChild(style);
    }

    async function showMessage(title, message) {
        messageWindow?.close();
        const window = await SchwiDialog.createDialog(420, 190, { title, showCloseButton: true });
        const text = element('p', { text: message });
        text.style.cssText = 'margin:0;line-height:1.6;white-space:pre-wrap';
        const close = element('button', { text: '确定', attributes: { type: 'button' } });
        close.style.cssText = 'float:right;margin-top:16px';
        close.addEventListener('click', window.close);
        window.content.append(text, close);
        messageWindow = window;
        window.onclose = () => { if (messageWindow === window) messageWindow = null; };
        window.show();
    }

    async function showProgress(message, detail = '') {
        if (!progressWindow) {
            progressWindow = await SchwiDialog.createDialog(390, 120, { ariaLabel: '收藏统计进度', showHeader: false, closeOnBackdropClick: false, closeOnEscape: false });
            progressWindow.content.style.cssText = 'padding:0;overflow:hidden';
            addStyles(progressWindow.content);
            progressRoot = element('aside', { attributes: { id: id.progress, role: 'status', 'aria-live': 'polite' } });
            const copy = element('div', { className: 'eh-progress-copy' });
            copy.append(element('div', { className: 'eh-progress-title' }), element('div', { className: 'eh-progress-detail' }));
            const cancel = element('button', { text: '取消', attributes: { type: 'button' } });
            cancel.addEventListener('click', () => activeController?.abort());
            const row = element('div', { className: 'eh-progress-row' });
            row.append(copy, cancel);
            progressRoot.appendChild(row);
            progressWindow.content.appendChild(progressRoot);
            progressWindow.show();
        }
        progressRoot.querySelector('.eh-progress-title').textContent = message;
        progressRoot.querySelector('.eh-progress-detail').textContent = detail;
    }

    const hideProgress = () => {
        progressWindow?.close();
        progressWindow = null;
        progressRoot = null;
    };

    async function fetchText(url, signal) {
        const response = await fetch(url, { signal, credentials: 'include' });
        if (!response.ok) throw new Error(`请求失败（HTTP ${response.status}）`);
        return response.text();
    }

    function findNextUrl(doc, currentUrl, favoritesPath) {
        for (const script of doc.scripts) {
            const match = (script.textContent || '').match(/var\s+nexturl\s*=\s*"([^"]*)"/);
            if (!match?.[1]) continue;
            const next = new URL(match[1], currentUrl);
            return next.origin === location.origin && next.pathname === favoritesPath ? next.href : null;
        }
        return null;
    }

    async function getFavoritesList(queryUrl, signal) {
        const favorites = [];
        const visited = new Set();
        let nextUrl = queryUrl.href;
        let page = 0;
        while (nextUrl && !visited.has(nextUrl)) {
            visited.add(nextUrl);
            page++;
            await showProgress('正在读取收藏', `已获取第 ${page} 页，发现 ${favorites.length} 条记录`);
            const doc = new DOMParser().parseFromString(await fetchText(nextUrl, signal), 'text/html');
            favorites.push(...doc.querySelectorAll('.itg.glte > tbody > tr'));
            nextUrl = findNextUrl(doc, nextUrl, queryUrl.pathname);
        }
        return favorites;
    }

    function parseFavorites(rows) {
        return rows.flatMap(row => {
            const link = row.querySelector('.glink');
            const category = row.querySelector('.cn');
            if (!link || !category) return [];
            const tags = [...row.querySelectorAll('td > [title]')].map(tag => tag.title.startsWith(':') ? `temp${tag.title}` : tag.title).filter(Boolean);
            return [{ title: link.innerText.trim(), url: link.href, reclass: category.innerText.trim(), tags }];
        });
    }

    async function getTranslate(url, signal) {
        await showProgress('正在获取标签翻译', '统计完成，正在下载翻译数据');
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error(`翻译请求失败（HTTP ${response.status}）`);
        return response.json();
    }

    function sortByCount(list, key) {
        return list.sort((a, b) => b.count - a.count || a[key].localeCompare(b[key]));
    }

    function getReclassList(favorites) {
        const result = {};
        favorites.forEach(({ reclass }) => { result[reclass] ??= { reclass, translate: '', intro: '', count: 0 }; result[reclass].count++; });
        return sortByCount(Object.values(result), 'reclass');
    }

    function getTagList(favorites) {
        const result = {};
        favorites.forEach(({ tags }) => tags.forEach(tag => { result[tag] ??= { tag, translate: '', intro: '', count: 0 }; result[tag].count++; }));
        return sortByCount(Object.values(result), 'tag');
    }

    function getGroupedTagList(favorites) {
        const groups = {};
        favorites.forEach(({ tags }) => tags.forEach(fullTag => {
            const index = fullTag.indexOf(':');
            const namespace = index === -1 ? 'misc' : fullTag.slice(0, index);
            const tag = index === -1 ? fullTag : fullTag.slice(index + 1);
            groups[namespace] ??= {};
            groups[namespace][fullTag] ??= { tag, translate: '', intro: '', count: 0 };
            groups[namespace][fullTag].count++;
        }));
        return Object.entries(groups).map(([namespace, tags]) => ({ namespace, translate: '', tags: sortByCount(Object.values(tags), 'tag') })).sort((a, b) => a.namespace.localeCompare(b.namespace));
    }

    function translateResult(favorites, translation) {
        const reclassList = getReclassList(favorites);
        const tagList = getTagList(favorites);
        const groupedTagList = getGroupedTagList(favorites);
        const data = Array.isArray(translation?.data) ? translation.data : [];
        const namespaces = new Map(data.filter(entry => entry?.namespace).map(entry => [entry.namespace, entry]));
        const categories = translation?.data?.[1]?.data || {};
        reclassList.forEach(item => {
            const value = categories[item.reclass.toLowerCase().replace(/\s/g, '')];
            if (value) Object.assign(item, { translate: value.name || '', intro: value.intro || '' });
        });
        const translateTag = (item, namespace, tag) => {
            const group = namespaces.get(namespace);
            const value = group?.data?.[tag];
            item.translate = `${group?.frontMatters?.name || namespace}:${value?.name || tag}`;
            item.intro = value?.intro || '';
        };
        tagList.forEach(item => {
            const index = item.tag.indexOf(':');
            translateTag(item, index === -1 ? 'misc' : item.tag.slice(0, index), index === -1 ? item.tag : item.tag.slice(index + 1));
        });
        groupedTagList.forEach(group => {
            const source = namespaces.get(group.namespace);
            group.translate = source?.frontMatters?.name || group.namespace;
            group.tags.forEach(tag => {
                const value = source?.data?.[tag.tag];
                tag.translate = value?.name || tag.tag;
                tag.intro = value?.intro || '';
            });
        });
        return { reclassList, tagList, groupedTagList, myFavList: favorites };
    }

    function createCell(value, className = '', title = '') {
        const cell = element('td', { className, text: String(value ?? '') });
        if (title) cell.title = title;
        return cell;
    }

    function createTable(columns, rows, values, total) {
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        columns.forEach(column => header.appendChild(element('th', { className: column.className, text: column.label })));
        head.appendChild(header);
        const body = document.createElement('tbody');
        rows.forEach((row, index) => {
            const rowValues = values(row, index);
            const tr = document.createElement('tr');
            tr.dataset.search = rowValues.map(value => value.text).join(' ').toLocaleLowerCase();
            rowValues.forEach(value => tr.appendChild(createCell(value.text, value.className, value.title)));
            body.appendChild(tr);
        });
        if (total !== undefined) {
            const tr = element('tr', { className: 'eh-total' });
            tr.appendChild(createCell('合计'));
            for (let index = 1; index < columns.length - 1; index++) tr.appendChild(createCell(''));
            tr.appendChild(createCell(total, 'eh-count'));
            body.appendChild(tr);
        }
        table.append(head, body);
        return table;
    }

    function createGroupedTable(groups) {
        const columns = [{ label: '序号', className: 'eh-index' }, { label: '标签' }, { label: '翻译' }, { label: '数量', className: 'eh-count' }];
        const table = document.createElement('table');
        const head = document.createElement('thead');
        const header = document.createElement('tr');
        columns.forEach(column => header.appendChild(element('th', { className: column.className, text: column.label })));
        head.appendChild(header);
        const body = document.createElement('tbody');
        groups.forEach(group => {
            const groupHeader = element('tr', { className: 'eh-namespace-group' });
            groupHeader.dataset.namespace = group.namespace;
            const groupCell = element('td', { attributes: { colspan: columns.length } });
            groupCell.append(element('span', { text: group.namespace }), element('span', { className: 'eh-namespace-meta', text: `${group.translate} · ${group.tags.length} 项` }));
            groupHeader.appendChild(groupCell);
            body.appendChild(groupHeader);
            group.tags.forEach((tag, index) => {
                const tr = document.createElement('tr');
                tr.dataset.namespace = group.namespace;
                tr.dataset.search = `${group.namespace} ${group.translate} ${tag.tag} ${tag.translate}`.toLocaleLowerCase();
                tr.append(createCell(index + 1, 'eh-index', tag.intro), createCell(tag.tag, '', tag.intro), createCell(tag.translate, '', tag.intro), createCell(tag.count, 'eh-count', tag.intro));
                body.appendChild(tr);
            });
        });
        table.append(head, body);
        return table;
    }

    function createPanel(panelId, title, count, table) {
        const panel = element('section', { className: 'eh-panel', attributes: { id: panelId, role: 'tabpanel' } });
        const heading = element('div', { className: 'eh-panel-title' });
        heading.append(element('h2', { text: title }), element('span', { text: `${count.toLocaleString()} 项` }));
        panel.append(heading, table, element('div', { className: 'eh-empty', text: '没有匹配的记录', attributes: { hidden: '' } }));
        return panel;
    }

    function exportHtml(result) {
        const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
        const makeRows = (items, cells) => items.map((item, index) => `<tr>${cells(item, index).map(cell => `<td>${escape(cell)}</td>`).join('')}</tr>`).join('');
        const table = (title, headers, body, total) => `<section><h2>${title}</h2><table><thead><tr>${headers.map(value => `<th>${escape(value)}</th>`).join('')}</tr></thead><tbody>${body}${total === undefined ? '' : `<tr class="total"><td colspan="${headers.length - 1}">合计</td><td>${total}</td></tr>`}</tbody></table></section>`;
        const groups = result.groupedTagList.flatMap(group => group.tags.map((tag, index) => [group.namespace, group.translate, index + 1, tag.tag, tag.translate, tag.count]));
        return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>e站收藏统计</title><style>body{max-width:1200px;margin:32px auto;padding:0 16px;font-family:Arial,"Microsoft YaHei",sans-serif;color:#202124}table{width:100%;border-collapse:collapse;margin-bottom:28px}th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left}th,.total{background:#f4f6f8}.total{font-weight:bold}</style><h1>e站收藏统计</h1><p>收藏 ${result.myFavList.length} 项，标签 ${result.tagList.length} 项，命名空间 ${result.groupedTagList.length} 个</p>${table('分类', ['序号', '分类', '翻译', '数量'], makeRows(result.reclassList, (item, index) => [index + 1, item.reclass, item.translate, item.count]), result.myFavList.length)}${table('标签', ['序号', '标签', '翻译', '数量'], makeRows(result.tagList, (item, index) => [index + 1, item.tag, item.translate, item.count]))}${table('按命名空间', ['命名空间', '翻译', '序号', '标签', '翻译', '数量'], makeRows(groups, item => item))}</html>`;
    }

    async function showResults(result) {
        resultsWindow?.close();
        const window = await SchwiDialog.createDialog('94vw', '94vh', { ariaLabel: '收藏统计结果', showHeader: false });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        addStyles(window.content);
        resultsWindow = window;
        window.onclose = () => { if (resultsWindow === window) resultsWindow = null; };
        const dialog = element('div', { attributes: { id: id.dialog, role: 'dialog', 'aria-modal': 'true', 'aria-label': '收藏统计结果', tabindex: '-1' } });
        dialog.translate = false;
        const closeDialog = window.close;
        const header = element('header', { className: 'eh-header' });
        const title = document.createElement('div');
        title.append(element('h1', { className: 'eh-title', text: '收藏统计' }), element('p', { className: 'eh-subtitle', text: '按使用次数降序排列，悬停标签可查看说明' }));
        const close = element('button', { className: 'eh-close', text: '×', attributes: { type: 'button', title: '关闭（Esc）', 'aria-label': '关闭' } });
        close.addEventListener('click', closeDialog);
        header.append(title, close);
        const summary = element('div', { className: 'eh-summary' });
        [['收藏', result.myFavList.length], ['标签', result.tagList.length], ['命名空间', result.groupedTagList.length]].forEach(([label, value]) => {
            const stat = element('div', { className: 'eh-stat' });
            stat.append(element('div', { className: 'eh-stat-label', text: label }), element('div', { className: 'eh-stat-value', text: value.toLocaleString() }));
            summary.appendChild(stat);
        });
        const toolbar = element('div', { className: 'eh-toolbar' });
        const search = element('input', { className: 'eh-search', attributes: { type: 'search', placeholder: '搜索当前表格中的原文、翻译或命名空间', 'aria-label': '搜索当前表格' } });
        const namespaceJump = element('select', { className: 'eh-namespace-jump', attributes: { 'aria-label': '跳转到命名空间', hidden: '' } });
        namespaceJump.appendChild(element('option', { text: '跳转到命名空间', attributes: { value: '' } }));
        result.groupedTagList.forEach(group => {
            namespaceJump.appendChild(element('option', { text: `${group.namespace} (${group.tags.length})`, attributes: { value: group.namespace } }));
        });
        const matches = element('span', { className: 'eh-match-count' });
        const actions = element('div', { className: 'eh-actions' });
        const json = element('button', { className: 'eh-button', text: '导出 JSON', attributes: { type: 'button' } });
        const html = element('button', { className: 'eh-button', text: '导出 HTML', attributes: { type: 'button' } });
        json.addEventListener('click', () => download('eh_collect.json', JSON.stringify(result, null, 2), 'application/json'));
        html.addEventListener('click', () => download('eh_collect.html', exportHtml(result), 'text/html'));
        actions.append(json, html);
        toolbar.append(search, namespaceJump, matches, actions);
        const tabs = element('div', { className: 'eh-tabs', attributes: { role: 'tablist', 'aria-label': '统计分类' } });
        const content = element('main', { className: 'eh-content' });
        const regularColumns = (name) => [{ label: '序号', className: 'eh-index' }, { label: name }, { label: '翻译' }, { label: '数量', className: 'eh-count' }];
        const panels = [
            createPanel('eh-panel-reclass', '收藏分类', result.reclassList.length, createTable(regularColumns('分类'), result.reclassList, (row, index) => [{ text: index + 1, className: 'eh-index' }, { text: row.reclass, title: row.intro }, { text: row.translate, title: row.intro }, { text: row.count, className: 'eh-count', title: row.intro }], result.myFavList.length)),
            createPanel('eh-panel-tags', '全部标签', result.tagList.length, createTable(regularColumns('标签'), result.tagList, (row, index) => [{ text: index + 1, className: 'eh-index' }, { text: row.tag, title: row.intro }, { text: row.translate, title: row.intro }, { text: row.count, className: 'eh-count', title: row.intro }])),
            createPanel('eh-panel-groups', '按命名空间', result.groupedTagList.length, createGroupedTable(result.groupedTagList))
        ];
        let active = 0;
        const tabButtons = panels.map((panel, index) => {
            const tab = element('button', { className: 'eh-tab', text: ['分类', '全部标签', '命名空间'][index], attributes: { type: 'button', role: 'tab', 'aria-controls': panel.id, 'aria-selected': index === 0 ? 'true' : 'false' } });
            tab.addEventListener('click', () => selectPanel(index));
            tabs.appendChild(tab);
            content.appendChild(panel);
            return tab;
        });
        function filterRows() {
            const query = search.value.trim().toLocaleLowerCase();
            const panel = panels[active];
            const rows = [...panel.querySelectorAll('tbody tr:not(.eh-total):not(.eh-namespace-group)')];
            let visible = 0;
            rows.forEach(row => { row.hidden = Boolean(query) && !row.dataset.search.includes(query); if (!row.hidden) visible++; });
            if (active === 2) {
                panel.querySelectorAll('.eh-namespace-group').forEach(groupHeader => {
                    let groupVisible = false;
                    for (let row = groupHeader.nextElementSibling; row && !row.classList.contains('eh-namespace-group'); row = row.nextElementSibling) {
                        if (!row.hidden) groupVisible = true;
                    }
                    groupHeader.hidden = !groupVisible;
                });
            }
            panel.querySelector('.eh-empty').hidden = visible > 0;
            matches.textContent = query ? `匹配 ${visible.toLocaleString()} 项` : `${rows.length.toLocaleString()} 项`;
        }
        function selectPanel(index) {
            active = index;
            panels.forEach((panel, itemIndex) => { panel.hidden = itemIndex !== index; });
            tabButtons.forEach((tab, itemIndex) => tab.setAttribute('aria-selected', itemIndex === index ? 'true' : 'false'));
            namespaceJump.hidden = index !== 2;
            filterRows();
        }
        search.addEventListener('input', filterRows);
        namespaceJump.addEventListener('change', () => {
            if (!namespaceJump.value) return;
            search.value = '';
            filterRows();
            const target = [...panels[2].querySelectorAll('.eh-namespace-group')].find(row => row.dataset.namespace === namespaceJump.value);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        dialog.append(header, summary, toolbar, tabs, content);
        window.content.appendChild(dialog);
        selectPanel(0);
        window.show();
    }

    function download(filename, data, type = 'text/plain') {
        saveAs(new Blob([data], { type: `${type};charset=utf-8` }), filename);
    }

    async function runCollection() {
        if (activeController) return;
        activeController = new AbortController();
        try {
            const rows = await getFavoritesList(new URL(config.favoritesUrl), activeController.signal);
            const favorites = parseFavorites(rows);
            let translation = null;
            try {
                translation = await getTranslate(config.translationUrl, activeController.signal);
            } catch (error) {
                if (error.name === 'AbortError') throw error;
                console.warn('Unable to load translations:', error);
                await showProgress('翻译加载失败', '将显示原始统计结果');
            }
            await showProgress('正在整理统计结果', `共 ${favorites.length.toLocaleString()} 条收藏`);
            await showResults(translateResult(favorites, translation));
        } catch (error) {
            if (error.name === 'AbortError') console.info('Favorite collection cancelled');
            else {
                console.error('Favorite collection failed:', error);
                await showMessage('收藏统计失败', error.message || '请检查登录状态和网络连接。');
            }
        } finally {
            activeController = null;
            hideProgress();
        }
    }

    GM_registerMenuCommand('统计收藏', runCollection);
})();
