// ==UserScript==
// @name         颜色标识B站收藏番剧作品更新状态
// @namespace    Schwi
// @version      0.3
// @description  灰色未开播，绿色已完结，红色连载中
// @author       Schwi
// @match        https://space.bilibili.com/*/bangumi
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @noframes
// @license      GPL-3.0
// ==/UserScript==

(function() {
    'use strict';
    const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
    async function repeatLoop() {
        while (true) {
            const tips = document.querySelector("#tips")
            if (tips == null) {
                const tabs = document.querySelector(".sub-tabs.clearfix")
                const filter = document.querySelector(".sub-tabs.clearfix > .filter-content")
                const span = document.createElement('span')
                span.id = 'tips'
                span.innerHTML = '<span style="background:#00000020">即将开播</span> <span style="background:#00ff0020">已完结</span> <span style="background:#ff000020">连载中</span>'
                if (tabs && filter) {
                    tabs.insertBefore(span, filter)
                }
            }
            const follows = document.querySelectorAll(".pgc-follow-list > .pgc-space-follow-item")
            follows.forEach(ele=>{
                const state = ele.querySelector('.publish-state')
                if (state) {
                    if (state.innerText == '即将开播') {
                        ele.style.background='#00000020'
                    } else if (state.innerText.indexOf('全') === 0) {
                        ele.style.background='#00ff0020'
                    } else if (state.innerText.indexOf('更新至') === 0) {
                        ele.style.background='#ff000020'
                    }
                } else {
                    ele.style.background='#00000020'
                }
            })
            await sleep(100)
        }
    }
    repeatLoop()
})();
