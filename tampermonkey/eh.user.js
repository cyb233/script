// ==UserScript==
// @name         e站收藏统计
// @namespace    Schwi
// @version      0.8
// @description  获取e站所有收藏，以及对所有标签进行排序以找到你最爱的标签，可按namespace分组，支持翻译
// @author       Schwi
// @match        *://e-hentai.org/*
// @match        *://exhentai.org/*
// @icon         https://e-hentai.org/favicon.ico
// @grant        none
// @license      GPL-3.0
// ==/UserScript==

(function() {
    'use strict';
    // 在 https://e-hentai.org/ 或 https://exhentai.org/ 任意页面运行即可
    if (!["e-hentai.org", "exhentai.org"].includes(location.hostname)) {
        alert("error host!")
        throw new Error("error host!")
    }

    // 是否翻译标签(需下载翻译文本)
    const config = {}
    config.translationUrl = "https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json"
    config.favoritesUrl = location.origin + "/favorites.php?inline_set=dm_e"

    function collect(config){

        // 查询所有收藏
        const queryUrl = new URL(config.favoritesUrl || location.href + "favorites.php?inline_set=dm_e")
        let favList = []

        function get(url) {
            let xhr = new XMLHttpRequest()
            xhr.open("GET", url, false)
            xhr.send()
            if (xhr.status === 200) {
                return xhr.responseText
            } else {
                console.error(xhr.statusText)
            }
        }
        let nextUrl = queryUrl.href
        while (nextUrl) {
            let resp = get(nextUrl)
            if (resp) {
                let doc = new DOMParser().parseFromString(resp, "text/html")
                let next = doc.scripts[3]
                let scriptContent = next.textContent || next.innerText
                let match = scriptContent.match(/var nexturl="(.*?)"/)
                nextUrl = match && match[1]
                if(nextUrl && nextUrl.startsWith('http') && new URL(nextUrl).pathname != queryUrl.pathname) {
                    nextUrl = null
                }
                favList = favList.concat(Array.from(doc.querySelectorAll(".itg.glte>tbody>tr")))
            }
        }

        // 整理所有收藏内容
        let myFavList = []
        favList.forEach(fav => {
            let title = fav.querySelector(".glink").innerText
            let url = fav.href
            let reclass = fav.querySelector(".cn").innerText
            let tags = []
            fav.querySelectorAll("td>[title]").forEach(tag => {
                let title = tag.title
                if (title.startsWith(":")) {
                    title = "temp" + title
                }
                tags.push(title)
            })
            myFavList.push({ title, url, reclass, tags })
        })
        // 翻译tag
        const select = document.querySelector('#schwi_translate')
        if (select && select.checked) {
            const translationUrl = config.translationUrl || "https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json"
            try {
                const response = get(translationUrl)
                if (!response) {
                    throw new Error("Network response was not ok")
                }
                const db = JSON.parse(response)
                myFavList.forEach(fav => {
                    if (fav.reclass in db.data[0].data) {
                        fav.reclass = db.data[0].data[fav.reclass].name
                    }
                    fav.tags = fav.tags.map(fullTag => {
                        let namespace = fullTag.split(":")[0]
                        let tag = fullTag.split(":")[1]
                        let data = db.data.filter(title => title.frontMatters.key === namespace)
                        if (data.length > 0) {
                            namespace = data[0].frontMatters.name
                            if (tag in data[0].data) {
                                tag = data[0].data[tag].name
                            }
                        }
                        return namespace + ":" + tag
                    })
                })
            } catch (error) {
                console.error("Error fetching data:", error)
            }
        }

        function sortByCount(list) {
            const array = Object.entries(list)
            array.sort((a, b) => (b[1] - a[1]) * 2 + (a[0].toUpperCase() > b[0].toUpperCase() ? 1 : -1))
            return Object.fromEntries(array)
        }

        // reclass排序
        let reclassList = {}
        myFavList.forEach(fav => {
            if (fav.reclass in reclassList) {
                reclassList[fav.reclass]++
            } else {
                reclassList[fav.reclass] = 1
            }
        })
        reclassList = sortByCount(reclassList)

        // 所有tag排序
        let tagList = {}
        myFavList.forEach(fav => {
            fav.tags.forEach(tag => {
                if (tag in tagList) {
                    tagList[tag]++
                } else {
                    tagList[tag] = 1
                }
            })
        })
        tagList = sortByCount(tagList)

        // 按namespace分组的tag排序
        let groupedTagList = {}
        myFavList.forEach(fav => {
            fav.tags.forEach(fullTag => {
                let namespace = fullTag.split(":")[0]
                let tag = fullTag.split(":")[1]
                if (!(namespace in groupedTagList)) {
                    groupedTagList[namespace] = {}
                }
                if (fullTag in groupedTagList[namespace]) {
                    groupedTagList[namespace][fullTag]++
                } else {
                    groupedTagList[namespace][fullTag] = 1
                }
            })
        })
        for (let k in groupedTagList) {
            groupedTagList[k] = sortByCount(groupedTagList[k])
        }

        return { myFavList, reclassList, tagList, groupedTagList }
    }

    function download(filename, data) {
        const a = document.createElement('a')
        a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(data)
        a.download = filename
        a.style.display = 'none'
        a.click()
        a.remove()
    }

    const div = document.createElement('div')
    div.innerHTML = `
    <a id="schwi_btn">统计收藏</a>
    <input type="checkbox" id="schwi_translate" name="schwi_translate" />
    <label for="schwi_translate">翻译结果</label>
    `
    document.querySelector("#nb").appendChild(div)
    //不够宽了...
    document.querySelector("#nb").style.maxWidth='1200px'
    document.querySelector("#schwi_btn").onclick = (event) => {
        const { myFavList, reclassList, tagList, groupedTagList } = collect(config)
        console.log({ '收藏数量':Object.keys(myFavList).length, '标签数量':Object.keys(tagList).length })
        console.log(myFavList)
        console.log(reclassList)
        console.log(tagList)
        console.log(groupedTagList)
        const jsonStr = JSON.stringify({ reclassList, tagList, groupedTagList, myFavList }, null, 2)
        dowmload('eh.json', jsonStr)
    }
})();
