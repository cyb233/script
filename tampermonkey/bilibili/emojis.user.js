// ==UserScript==
// @name         下载直播间所有Emojis
// @namespace    Schwi
// @version      0.1
// @description  下载直播间所有Emojis
// @author       Schwi
// @match        https://live.bilibili.com/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';
    //下载方法
    const downloadRes = async (url, name) => {
        let response = await fetch(url) // 内容转变成blob地址
        let blob = await response.blob() // 创建隐藏的可下载链接
        let objectUrl = window.URL.createObjectURL(blob)
        let a = document.createElement("a")
        a.href = objectUrl
        a.download = name
        a.click()
        a.remove()
    }
    function downloadEmojis(...pkgIds) {
        fetch(`https://api.live.bilibili.com/xlive/web-ucenter/v2/emoticon/GetEmoticons?platform=pc&room_id=${location.pathname.substring(1)}`,{credentials: "include"}).then(res=>res.json()).then(json=>{
            console.log(json.data.data)
            let i = 0
            for (let emojis of json.data.data) {
                if (pkgIds.length === 0 || pkgIds.includes(emojis.pkg_id)) {
                    for (let emoticon of emojis.emoticons) {
                        i++
                        console.log(emoticon)
                        setTimeout(() => {
                            downloadRes(emoticon.url, `${emojis.pkg_id}_${emoticon.emoticon_id}_${emoticon.emoji}_${emoticon.emoticon_unique}.png`)
                        }, 1000 * i)
                    }
                }
            }
            console.log(`共计${i}个`)
        })
    }
})();
