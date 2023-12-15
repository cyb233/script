// ==UserScript==
// @name         下载你赞助的fanbox
// @namespace    Schwi
// @version      0.1
// @description  快速下载你赞助的fanbox用户的所有投稿
// @author       You
// @match        https://*.fanbox.cc/*
// @exclude      https://www.fanbox.cc/*
// @icon         https://s.pximg.net/common/images/fanbox/favicon.ico
// @grant        GM_download
// ==/UserScript==

(function () {
    'use strict';
    const username = () => top.window.location.host.split('.')[0]
    const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))
    function get(url) {
        let xhr = new XMLHttpRequest()
        xhr.open("GET", url, false)
        xhr.withCredentials = true
        xhr.send()
        if (xhr.status === 200) {
            return JSON.parse(xhr.responseText)
        } else {
            console.error(xhr.statusText)
        }
    }
    function download(filename, url) {
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = filename
        a.click()
        a.remove()
    }
    function fmain() {
        console.log('下载所有')
        let startUrl = `https://api.fanbox.cc/post.listCreator?creatorId=${username()}&limit=1`
        let resp = get(startUrl)
        const firstId = resp.body.items[0].id
        let nextUrl = `https://api.fanbox.cc/post.info?postId=${firstId}`
        function repeatLoop() {
            return new Promise((resolve) => {
                const fileArray = []
                let i = 0
                while (nextUrl) {
                    console.log(`请求第${++i}个`)
                    let resp = get(nextUrl)
                    const files = resp.body.body.files
                    if (files) {
                        for (let file in files) {
                            fileArray.push(files[file])
                        }
                    }
                    const prevPost = resp.body.prevPost
                    if (!prevPost) {
                        break
                    }
                    nextUrl = `https://api.fanbox.cc/post.info?postId=${prevPost.id}`
                    sleep(500)
                }
                resolve(fileArray)
            })
        }
        repeatLoop().then(files => {
            console.log(files)
            let i = 0
            for (let file in files) {
                console.log(`下载第${++i}个`)
                GM_download({
                    url: files[file].url,
                    name: `${files[file].name}.${files[file].extension}`,
                    saveAs: false,
                    onerror: download => console.log(download)
                })
            }
        })
    }

    async function init() {
        let btns
        let btn
        while (!(btns && (btn = btns[1]))) {
            btns = document.querySelectorAll(`a[href="https://www.fanbox.cc/creators/supporting/@${username()}"]`)
            await sleep(100)
        }
        return btn
    }
    init().then(btn => {
        const div = document.createElement('div')
        div.innerHTML = `
        <button id='downloadAll''>下载所有</span>
        `
        btn.parentElement.appendChild(div)
        document.querySelector("#downloadAll").onclick = fmain
    })
})();
