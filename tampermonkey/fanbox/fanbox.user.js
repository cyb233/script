// ==UserScript==
// @name         下载你赞助的fanbox
// @namespace    Schwi
// @version      0.4
// @description  快速下载你赞助的fanbox用户的所有投稿
// @author       Schwi
// @match        https://*.fanbox.cc/*
// @icon         https://s.pximg.net/common/images/fanbox/favicon.ico
// @grant        GM_download
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';
    if (window !== top.window) return
    const username = () => {
        let username = top.window.location.host.split('.')[0]
        if (username === 'www') {
            const pathname = top.window.location.pathname
            if (pathname.indexOf('/@') == -1) {
                return
            }
            username = pathname.split('/@')[1].split('/')[0]
        }
        return username
    }
    let yourPlan
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
        let nextId = resp.body[0].id
        function repeatLoop() {
            return new Promise((resolve) => {
                const fileArray = []
                let i = 0
                while (nextId) {
                    console.log(`请求第${++i}个`)
                    let resp = get(`https://api.fanbox.cc/post.info?postId=${nextId}`)
                    if (resp.body.body) {
                        const files = resp.body.body.files
                        if (files) {
                            console.log(`找到了 ${files.length} 个附件`)
                            for (let file in files) {
                                fileArray.push(files[file])
                            }
                        }
                    }else{
                        console.log(`${nextId}:${resp.body.title} 赞助等级不足，需要 ${resp.body.feeRequired} 日元档，您的档位是 ${yourPlan} 日元`)
                    }
                    const prevPost = resp.body.prevPost
                    nextId = prevPost?.id
                    if (!nextId) {
                        break
                    }
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
                    name: `${username()}_${files[file].name}.${files[file].extension}`,
                    saveAs: false,
                    onload: () => console.log(`成功 ${username()}_${files[file].name}.${files[file].extension}`),
                    onerror: download => console.error(`失败 ${username()}_${files[file].name}.${files[file].extension}, ${download}`),
                    ontimeout: () => console.error(`超时${username()}_${files[file].name}.${files[file].extension}`)
                })
            }
        })
    }

    async function init() {
        let div
        while (!div) {
            div = document.querySelector('[class|=CreatorHeader__IsNotMobileSmallWrapper] [class|=styled__UserStatusWrapper]')
            await sleep(100)
        }
        return div
    }
    init().then(div => {
        console.log('添加下载按钮')
        let btn = document.createElement('button')
        btn.id = 'downloadAll'
        btn.innerText = '下载所有'
        btn.onclick = fmain
        div.appendChild(btn)
    }).then(() => {
        let resp = get(`https://api.fanbox.cc/plan.listCreator?creatorId=${username()}`)
        let yourPlans = resp.body.filter(plan => plan.paymentMethod)
        if (yourPlans.length === 0) {
            console.log('您没有赞助过此画师')
            yourPlan = 0
            return
        }
        yourPlan = yourPlans[0].fee
    })
})();
