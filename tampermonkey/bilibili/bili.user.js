// ==UserScript==
// @name         颜色标识B站收藏番剧作品更新状态
// @namespace    Schwi
// @version      0.1
// @description  灰色未开播，绿色已完结，红色连载中
// @author       Schwi
// @match        https://space.bilibili.com/*/bangumi
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @license      GPL-3.0
// ==/UserScript==

(function() {
    'use strict';
    const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
    async function repeatLoop() {
        while (true) {
            const follows = document.querySelectorAll(".pgc-follow-list > .pgc-space-follow-item")
            follows.forEach(ele=>{
                const state = ele.querySelector('.publish-state')
                if (state.innerText == '即将开播') {
                    ele.style.background='#00000020'
                } else if (state.innerText.indexOf('全') === 0) {
                    ele.style.background='#00ff0020'
                } else if (state.innerText.indexOf('更新至') === 0) {
                    ele.style.background='#ff000020'
                } else {
                    ele.style.background=''
                }
            })
            await sleep(1000)
        }
    }
    repeatLoop()
})();
