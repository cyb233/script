// ==UserScript==
// @name         e站收藏统计
// @namespace    Schwi
// @version      1.0
// @description  获取e站所有收藏，以及对所有标签进行排序以找到你最爱的标签，可按namespace分组，支持翻译
// @author       Schwi
// @match        *://e-hentai.org/*
// @match        *://exhentai.org/*
// @require      https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js
// @icon         https://e-hentai.org/favicon.ico
// @grant        GM_registerMenuCommand
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';
    // 在 https://e-hentai.org/ 或 https://exhentai.org/ 任意页面运行即可
    // 检查脚本是否运行在顶层窗口
    if (window.top !== window.self) {
        console.log("脚本不应运行于 iframe");
        return;
    }

    // 是否翻译标签(需下载翻译文本)
    const config = {
        translationUrl: "https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json",
        favoritesUrl: location.origin + "/favorites.php?inline_set=dm_e"
    }

    async function fetchFavorites(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.error('Fetch error:', error);
        }
    }

    async function getFavoritesList(queryUrl) {
        let favList = [];
        let nextUrl = queryUrl.href;
        while (nextUrl) {
            let resp = await fetchFavorites(nextUrl);
            if (resp) {
                let doc = new DOMParser().parseFromString(resp, "text/html");
                let next = doc.scripts[3];
                let scriptContent = next.textContent || next.innerText;
                let match = scriptContent.match(/var nexturl="(.*?)"/);
                nextUrl = match && match[1];
                if (nextUrl && nextUrl.startsWith('http') && new URL(nextUrl).pathname != queryUrl.pathname) {
                    nextUrl = null;
                }
                favList = favList.concat(Array.from(doc.querySelectorAll(".itg.glte>tbody>tr")));
            }
        }
        return favList;
    }

    function parseFavorites(favList) {
        let myFavList = [];
        favList.forEach(fav => {
            let title = fav.querySelector(".glink").innerText;
            let url = fav.href;
            let reclass = fav.querySelector(".cn").innerText;
            let tags = [];
            fav.querySelectorAll("td>[title]").forEach(tag => {
                let title = tag.title;
                if (title.startsWith(":")) {
                    title = "temp" + title;
                }
                tags.push(title);
            });
            myFavList.push({ title, url, reclass, tags });
        });
        return myFavList;
    }

    async function translateTags(myFavList, translationUrl) {
        try {
            const response = await fetchFavorites(translationUrl);
            if (!response) {
                throw new Error("Network response was not ok");
            }
            const db = JSON.parse(response);
            return myFavList.map(fav => {
                let newFav = { ...fav };
                if (newFav.reclass in db.data[0].data) {
                    newFav.reclass = db.data[0].data[newFav.reclass].name;
                }
                newFav.tags = newFav.tags.map(fullTag => {
                    let namespace = fullTag.split(":")[0];
                    let tag = fullTag.split(":")[1];
                    let data = db.data.filter(title => title.frontMatters.key === namespace);
                    if (data.length > 0) {
                        namespace = data[0].frontMatters.name;
                        if (tag in data[0].data) {
                            tag = data[0].data[tag].name;
                        }
                    }
                    return namespace + ":" + tag;
                });
                return newFav;
            });
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    }

    function sortByCount(list) {
        const array = Object.entries(list);
        array.sort((a, b) => (b[1] - a[1]) * 2 + (a[0].toUpperCase() > b[0].toUpperCase() ? 1 : -1));
        return Object.fromEntries(array);
    }

    function getReclassList(myFavList) {
        let reclassList = {};
        myFavList.forEach(fav => {
            if (fav.reclass in reclassList) {
                reclassList[fav.reclass]++;
            } else {
                reclassList[fav.reclass] = 1;
            }
        });
        return sortByCount(reclassList);
    }

    function getTagList(myFavList) {
        let tagList = {};
        myFavList.forEach(fav => {
            fav.tags.forEach(tag => {
                if (tag in tagList) {
                    tagList[tag]++;
                } else {
                    tagList[tag] = 1;
                }
            });
        });
        return sortByCount(tagList);
    }

    function getGroupedTagList(myFavList) {
        let groupedTagList = {};
        myFavList.forEach(fav => {
            fav.tags.forEach(fullTag => {
                let namespace = fullTag.split(":")[0];
                let tag = fullTag.split(":")[1];
                if (!(namespace in groupedTagList)) {
                    groupedTagList[namespace] = {};
                }
                if (fullTag in groupedTagList[namespace]) {
                    groupedTagList[namespace][fullTag]++;
                } else {
                    groupedTagList[namespace][fullTag] = 1;
                }
            });
        });
        for (let k in groupedTagList) {
            groupedTagList[k] = sortByCount(groupedTagList[k]);
        }
        return groupedTagList;
    }

    function showProgress(message) {
        let progressDiv = document.querySelector('#progressDiv');
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'progressDiv';
            progressDiv.style.position = 'fixed';
            progressDiv.style.top = '10px';
            progressDiv.style.left = '50%';
            progressDiv.style.transform = 'translateX(-50%)';
            progressDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
            progressDiv.style.color = 'white';
            progressDiv.style.padding = '10px';
            progressDiv.style.borderRadius = '5px';
            progressDiv.style.zIndex = '10001'; // 调大 z-index
            document.body.appendChild(progressDiv);
        }
        progressDiv.innerText = message;
    }

    function hideProgress() {
        const progressDiv = document.querySelector('#progressDiv');
        if (progressDiv) {
            progressDiv.remove();
        }
    }

    function showResults(result) {
        let resultDiv = document.querySelector('#resultDiv');
        if (!resultDiv) {
            resultDiv = document.createElement('div');
            resultDiv.id = 'resultDiv';
            resultDiv.style.position = 'fixed';
            resultDiv.style.top = '5%';
            resultDiv.style.left = '5%';
            resultDiv.style.width = '90%';
            resultDiv.style.height = '90%';
            resultDiv.style.backgroundColor = 'white';
            resultDiv.style.border = '1px solid black';
            resultDiv.style.overflow = 'auto';
            resultDiv.style.zIndex = '10000';
            document.body.appendChild(resultDiv);

            const closeButton = document.createElement('button');
            closeButton.innerText = '关闭';
            closeButton.style.position = 'absolute';
            closeButton.style.top = '10px';
            closeButton.style.right = '10px';
            closeButton.style.backgroundColor = 'red';
            closeButton.style.color = 'white';
            closeButton.style.border = 'none';
            closeButton.style.borderRadius = '5px';
            closeButton.style.padding = '5px 10px';
            closeButton.onclick = () => resultDiv.remove();
            resultDiv.appendChild(closeButton);
        }

        const createTable = (data, headers) => {
            const table = document.createElement('table');
            table.border = '1';
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.textAlign = 'center';

            const headerRow = document.createElement('tr');
            headers.forEach(header => {
                const th = document.createElement('th');
                th.innerText = header;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);

            data.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.style.height = '30px';

                const indexTd = document.createElement('td');
                indexTd.innerText = index + 1;
                tr.appendChild(indexTd);

                row.forEach(cell => {
                    const td = document.createElement('td');
                    td.innerText = cell;
                    tr.appendChild(td);
                });

                table.appendChild(tr);
            });

            return table;
        };

        const createGroupedTable = (data) => {
            const table = document.createElement('table');
            table.border = '1';
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.textAlign = 'center';

            const headerRow = document.createElement('tr');
            ['Namespace', '序号', 'Tag', 'Count'].forEach(header => {
                const th = document.createElement('th');
                th.innerText = header;
                headerRow.appendChild(th);
            });
            table.appendChild(headerRow);

            let index = 1;
            for (let namespace in data) {
                const tags = Object.entries(data[namespace]);
                tags.forEach((tag, tagIndex) => {
                    const tr = document.createElement('tr');
                    tr.style.height = '30px';

                    if (tagIndex === 0) {
                        const namespaceTd = document.createElement('td');
                        namespaceTd.rowSpan = tags.length;
                        namespaceTd.innerText = namespace;
                        tr.appendChild(namespaceTd);
                    }

                    const indexTd = document.createElement('td');
                    indexTd.innerText = tagIndex + 1;
                    tr.appendChild(indexTd);

                    const tagTd = document.createElement('td');
                    tagTd.innerText = tag[0];
                    tr.appendChild(tagTd);

                    const countTd = document.createElement('td');
                    countTd.innerText = tag[1];
                    tr.appendChild(countTd);

                    table.appendChild(tr);
                });
            }

            return table;
        };

        const buttonContainer = document.createElement('div');
        buttonContainer.style.textAlign = 'center';
        buttonContainer.style.marginBottom = '10px';

        const saveRawBtn = document.createElement('button');
        saveRawBtn.id = 'saveRawBtn';
        saveRawBtn.innerText = '保存原文结果';
        saveRawBtn.style.backgroundColor = '#4CAF50';
        saveRawBtn.style.color = 'white';
        saveRawBtn.style.border = 'none';
        saveRawBtn.style.borderRadius = '5px';
        saveRawBtn.style.padding = '10px 20px';
        saveRawBtn.style.marginRight = '10px';
        saveRawBtn.style.cursor = 'pointer';
        buttonContainer.appendChild(saveRawBtn);

        const saveTranslatedBtn = document.createElement('button');
        saveTranslatedBtn.id = 'saveTranslatedBtn';
        saveTranslatedBtn.innerText = '保存翻译结果';
        saveTranslatedBtn.style.backgroundColor = '#008CBA';
        saveTranslatedBtn.style.color = 'white';
        saveTranslatedBtn.style.border = 'none';
        saveTranslatedBtn.style.borderRadius = '5px';
        saveTranslatedBtn.style.padding = '10px 20px';
        saveTranslatedBtn.style.cursor = 'pointer';
        buttonContainer.appendChild(saveTranslatedBtn);

        resultDiv.appendChild(buttonContainer);

        const resultContainer = document.createElement('div');
        resultContainer.style.display = 'flex';
        resultContainer.style.justifyContent = 'space-around';

        const rawResultDiv = document.createElement('div');
        rawResultDiv.style.width = '45%';
        rawResultDiv.style.border = '1px solid black';
        rawResultDiv.style.padding = '10px';

        const rawResultTitle = document.createElement('h3');
        rawResultTitle.innerText = '原文结果';
        rawResultDiv.appendChild(rawResultTitle);

        const rawReclassTitle = document.createElement('h4');
        rawReclassTitle.innerText = 'Reclass List';
        rawResultDiv.appendChild(rawReclassTitle);
        rawResultDiv.appendChild(createTable(Object.entries(result.raw.reclassList), ['序号', 'Key', 'Value']));

        const rawTagTitle = document.createElement('h4');
        rawTagTitle.innerText = 'Tag List';
        rawResultDiv.appendChild(rawTagTitle);
        rawResultDiv.appendChild(createTable(Object.entries(result.raw.tagList), ['序号', 'Key', 'Value']));

        const rawGroupedTagTitle = document.createElement('h4');
        rawGroupedTagTitle.innerText = 'Grouped Tag List';
        rawResultDiv.appendChild(rawGroupedTagTitle);
        rawResultDiv.appendChild(createGroupedTable(result.raw.groupedTagList));

        resultContainer.appendChild(rawResultDiv);

        const translatedResultDiv = document.createElement('div');
        translatedResultDiv.style.width = '45%';
        translatedResultDiv.style.border = '1px solid black';
        translatedResultDiv.style.padding = '10px';

        const translatedResultTitle = document.createElement('h3');
        translatedResultTitle.innerText = '翻译结果';
        translatedResultDiv.appendChild(translatedResultTitle);

        const translatedReclassTitle = document.createElement('h4');
        translatedReclassTitle.innerText = 'Reclass List';
        translatedResultDiv.appendChild(translatedReclassTitle);
        translatedResultDiv.appendChild(createTable(Object.entries(result.translate.reclassList), ['序号', 'Key', 'Value']));

        const translatedTagTitle = document.createElement('h4');
        translatedTagTitle.innerText = 'Tag List';
        translatedResultDiv.appendChild(translatedTagTitle);
        translatedResultDiv.appendChild(createTable(Object.entries(result.translate.tagList), ['序号', 'Key', 'Value']));

        const translatedGroupedTagTitle = document.createElement('h4');
        translatedGroupedTagTitle.innerText = 'Grouped Tag List';
        translatedResultDiv.appendChild(translatedGroupedTagTitle);
        translatedResultDiv.appendChild(createGroupedTable(result.translate.groupedTagList));

        resultContainer.appendChild(translatedResultDiv);

        resultDiv.appendChild(resultContainer);

        resultDiv.querySelector('#saveRawBtn').onclick = () => {
            download('eh_raw.json', JSON.stringify(result.raw, null, 2));
        };

        resultDiv.querySelector('#saveTranslatedBtn').onclick = () => {
            download('eh_translated.json', JSON.stringify(result.translate, null, 2));
        };
    }

    async function collect(config) {
        showProgress('正在获取收藏列表...');
        const queryUrl = new URL(config.favoritesUrl);
        const favList = await getFavoritesList(queryUrl);
        let myFavList = parseFavorites(favList);

        showProgress('正在翻译标签...');
        let translatedFavList = await translateTags(myFavList, config.translationUrl);

        const reclassList = getReclassList(myFavList);
        const tagList = getTagList(myFavList);
        const groupedTagList = getGroupedTagList(myFavList);

        const translatedReclassList = getReclassList(translatedFavList);
        const translatedTagList = getTagList(translatedFavList);
        const translatedGroupedTagList = getGroupedTagList(translatedFavList);

        hideProgress();
        return {
            raw: {
                reclassList,
                tagList,
                groupedTagList,
                myFavList
            },
            translate: {
                reclassList: translatedReclassList,
                tagList: translatedTagList,
                groupedTagList: translatedGroupedTagList,
                myFavList: translatedFavList
            }
        };
    }

    function download(filename, data) {
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, filename);
    }

    GM_registerMenuCommand("统计收藏", async () => {
        const result = await collect(config);
        showResults(result);
    });

    // 移除页面上的翻译结果选项
})();
