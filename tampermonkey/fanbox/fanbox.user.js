// ==UserScript==
// @name         下载你赞助的fanbox
// @namespace    Schwi
// @version      2.3
// @description  快速下载你赞助的fanbox用户的所有投稿
// @author       Schwi
// @match        https://*.fanbox.cc/*
// @icon         https://s.pximg.net/common/images/fanbox/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      api.fanbox.cc
// @connect      downloads.fanbox.cc
// @require      https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/dist/zip.min.js
// @require      https://cdn.jsdelivr.net/gh/avoidwork/filesize.js@b480b2992a3ac2acb18a030c7b3ce11fe91fb6e0/dist/filesize.min.js
// @require      https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window.self) return

    const api = {
        creator: (creatorId) => `https://api.fanbox.cc/creator.get?creatorId=${creatorId}`,
        plan: (creatorId) => `https://api.fanbox.cc/plan.listCreator?creatorId=${creatorId}`,
        creatorPost: (creatorId, limit = 1) => `https://api.fanbox.cc/post.listCreator?creatorId=${creatorId}&limit=${limit}`,
        post: (postId) => `https://api.fanbox.cc/post.info?postId=${postId}`
    }

    filesize = filesize.filesize

    let allPost = []
    let totalPost = 0

    const defaultFormat = `{publishedDatetime}_{title}/{filename}`

    const postType = {
        text: { type: 'text', name: '文本' },
        image: { type: 'image', name: '图片' },
        file: { type: 'file', name: '文件' },
        video: {
            type: 'video', name: '视频', getFullUrl: (blockEmbed) => {
                const serviceProvideMap = {
                    soundcloud: `https://soundcloud.com/${blockEmbed.videoId}`,
                    vimeo: `https://vimeo.com/${blockEmbed.videoId}`,
                    youtube: `https://www.youtube.com/watch?v=${blockEmbed.videoId}`
                }
                return serviceProvideMap[blockEmbed.serviceProvider]
            }
        },
        article: { type: 'article', name: '文章' }
    }
    const baseinfo = (() => {
        let cachedInfo = null;
        return async () => {
            if (cachedInfo) return cachedInfo;

            let creatorId = top.window.location.host.split('.')[0];
            let baseUrl = `https://${creatorId}.fanbox.cc`;
            if (creatorId === 'www') {
                const pathname = top.window.location.pathname;
                if (!pathname.startsWith('/@')) {
                    alert('请访问用户页再执行脚本');
                    throw new Error('请访问用户页再执行脚本');
                }
                creatorId = pathname.split('/@')[1].split('/')[0];
                baseUrl = `https://www.fanbox.cc/@${creatorId}`;
            }

            const creator = await fetch(api.creator(creatorId), { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
            const nickname = creator.body.user.name;

            cachedInfo = { creatorId, baseUrl, nickname };
            return cachedInfo;
        };
    })();

    async function getAllPost(progressBar) {
        const planData = await fetch(api.plan((await baseinfo()).creatorId), { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
        const yourPlan = planData.body.filter(plan => plan.paymentMethod)
        const yourFee = yourPlan.length === 0 ? 0 : yourPlan[0].fee
        const data = await fetch(api.creatorPost((await baseinfo()).creatorId), { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
        let nextId = data.body[0]?.id
        const postArray = []
        let i = 0
        while (nextId) {
            console.log(`请求第${++i}个`)
            const resp = await fetch(api.post(nextId), { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
            const feeRequired = resp.body.feeRequired || 0
            if (feeRequired <= yourFee) {
                // 处理post类型
                resp.body.body.images = resp.body.body.images || []
                resp.body.body.files = resp.body.body.files || []
                resp.body.body.video = resp.body.body.video || {}
                if (resp.body.coverImageUrl) {
                    // 封面图片，extension从url中获取
                    resp.body.body.cover = { id: 'cover', extension: resp.body.coverImageUrl.split('.').pop(), originalUrl: resp.body.coverImageUrl }
                }
                if (resp.body.type === postType.text.type) {
                } else if (resp.body.type === postType.image.type) {
                } else if (resp.body.type === postType.file.type) {
                } else if (resp.body.type === postType.video.type) {
                    const url = postType.video.getFullUrl(resp.body.body.video)
                    let html =
                        `
                        <!DOCTYPE html>
                        <html lang="zh-CN">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>${resp.body.title}</title>
                            <style>
                            .iframely-responsive>* {
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                position: absolute;
                                border: 0;
                                box-sizing: border-box;
                            }
                            </style>
                        </head>
                        <body>`
                    html += `<h1>${resp.body.title}</h1>`
                    html += `<p><a href="${url}" target="_blank">${url}</a></p>`
                    html += `<p>${resp.body.body.text}</p>`
                    html += `</body></html>`
                    resp.body.body.html = html
                    resp.body.body.text = ''
                } else if (resp.body.type === postType.article.type) {
                    const blocks = resp.body.body.blocks;
                    const image = resp.body.body.imageMap;
                    const file = resp.body.body.fileMap;
                    const embed = resp.body.body.embedMap;
                    const urlEmbed = resp.body.body.urlEmbedMap;
                    let html =
                        `
                        <!DOCTYPE html>
                        <html lang="zh-CN">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>${resp.body.title}</title>
                            <style>
                            .iframely-responsive>* {
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                position: absolute;
                                border: 0;
                                box-sizing: border-box;
                            }
                            </style>
                        </head>
                        <body>`
                    if (resp.body.coverImageUrl) {
                        html += `<p><img src="${resp.body.coverImageUrl}" alt=""/></p>`
                    }
                    html += `<h1>${resp.body.title}</h1>`

                    for (const block of blocks) {
                        if (block.type === 'p') {
                            html += `<p>${block.text}</p>`
                        } else if (block.type === 'header') {
                            html += `<h2>${block.text}</h2>`
                        } else if (block.type === 'image') {
                            const blockImg = image[block.imageId]
                            html += `<p><img src="${blockImg.originalUrl}" alt="${blockImg.id}"></p>`
                        } else if (block.type === 'file') {
                            const blockFile = file[block.fileId]
                            html += `<p><a href="${blockFile.url}" download="${blockFile.name}.${blockFile.extension}">${blockFile.name}.${blockFile.extension}</a></p>`
                        } else if (block.type === 'embed') {
                            const blockEmbed = embed[block.embedId]
                            const url = postType.video.getFullUrl(blockEmbed)
                            if (url) {
                                html += `<p><a href="${url}" target="_blank">${url}</a></p>`
                            } else {
                                html += `<p>${JSON.stringify(block)}</p>`
                            }
                        } else if (block.type === 'url_embed') {
                            const blockUrlEmbed = urlEmbed[block.urlEmbedId]
                            if (blockUrlEmbed.type.startsWith('html')) {
                                html += `<p class="iframely-responsive">${blockUrlEmbed.html}</p>`
                            } else if (blockUrlEmbed.type === 'default') {
                                html += `<p><a src="${blockUrlEmbed.url}">${blockUrlEmbed.host}</a></p>`
                            } else {
                                html += `<p>${JSON.stringify(block)}</p>`
                            }
                        } else {
                            html += `<p>${JSON.stringify(block)}</p>`
                        }
                    }
                    html += `</body></html>`
                    for (const key in image) {
                        resp.body.body.images.push(image[key])
                    }
                    for (const key in file) {
                        resp.body.body.files.push(file[key])
                    }
                    resp.body.body.html = html;
                } else {
                    console.log(`${nextId}:${resp.body.title} 未知类型 ${resp.body.type}`)
                }
                postArray.push(resp.body)
            } else {
                console.log(`${nextId}:${resp.body.title} 赞助等级不足，需要 ${feeRequired} 日元档，您的档位是 ${yourFee} 日元`)
            }
            progressBar.update(postArray.length, i)
            const prevPost = resp.body.prevPost
            nextId = prevPost?.id
            if (!nextId) {
                break
            }
        }
        console.log(`共${postArray.length}个作品`, postArray)
        progressBar.close()
        return { postArray, total: i }
    }

    /**
     * 格式化路径，替换模板中的占位符，并过滤非法路径字符
     * @param {string} pathFormat - 路径格式模板
     * @param {object} post - 投稿对象
     * @param {object} item - 文件或图片对象
     * @returns {string} - 格式化后的路径
     */
    async function formatPath(pathFormat, post, item) {
        const illegalChars = /[\\/:*?"<>|]/g;
        const formattedPath = pathFormat
            .replace('{title}', post.title.replace(illegalChars, '_'))
            .replace('{filename}', `${item.name}.${item.extension}`.replace(illegalChars, '_'))
            .replace('{creatorId}', (await baseinfo()).creatorId.replace(illegalChars, '_'))
            .replace('{nickname}', (await baseinfo()).nickname.replace(illegalChars, '_'))
            .replace('{publishedDatetime}', post.publishedDatetime.replace(illegalChars, '_'))
        return formattedPath;
    }

    async function downloadPost(selectedPost, pathFormat = defaultFormat) {
        const downloadFiles = []
        const downloadCovers = []
        const downloadTexts = []
        const fileNames = new Set(); // 用于记录已存在的文件名
        let totalDownloadedSize = 0;
        let isCancelled = false; // 用于标记是否取消下载
        const startTime = new Date(); // 记录下载开始时间

        function onBeforeUnload(event) {
            event.preventDefault();
            event.returnValue = '文件可能还没下载完成，确认要离开吗？';
        }

        unsafeWindow.addEventListener('beforeunload', onBeforeUnload);

        for (const post of selectedPost) {
            let cover = post.body.cover
            let imgs = post.body.images || []
            let files = post.body.files || []
            let text = post.body.text || ''
            let html = post.body.html || ''

            for (const img of imgs) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = await formatPath(pathFormat, post, { name: img.id, extension: img.extension })
                downloadFiles.push({
                    title: post.title,
                    filename: formattedPath,
                    url: img.originalUrl,
                    publishedDatetime: post.publishedDatetime
                })
            }
            for (const file of files) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = await formatPath(pathFormat, post, { name: file.name, extension: file.extension })
                downloadFiles.push({
                    title: post.title,
                    filename: formattedPath,
                    url: file.url,
                    publishedDatetime: post.publishedDatetime
                })
            }
            if (cover) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = await formatPath(pathFormat, post, { name: cover.id, extension: cover.extension })
                downloadCovers.push({
                    title: post.title,
                    filename: formattedPath,
                    url: cover.originalUrl,
                    publishedDatetime: post.publishedDatetime
                })
            }
            if (text) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = await formatPath(pathFormat, post, { name: post.title, extension: 'txt' })
                downloadTexts.push({
                    title: post.title,
                    filename: formattedPath,
                    text,
                    publishedDatetime: post.publishedDatetime
                })
            }
            if (html) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = await formatPath(pathFormat, post, { name: post.title, extension: 'html' })
                downloadTexts.push({
                    title: post.title,
                    filename: formattedPath,
                    text: html,
                    publishedDatetime: post.publishedDatetime
                })
            }
        }
        console.log(`开始下载 ${downloadFiles.length + downloadCovers.length + downloadTexts.length} 个文件`)

        // 创建下载进度提示dialog
        const downloadProgressDialog = createDownloadProgressDialog(downloadFiles.length + downloadCovers.length + downloadTexts.length, startTime, () => {
            isCancelled = true;
        });

        const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        const failedFiles = []; // 用于记录下载失败的文件名和原因
        for (const file of downloadFiles) {
            if (isCancelled) break; // 如果取消下载，则跳出循环
            let attempts = 0;
            while (attempts < 3) {
                try {
                    const resp = await GM.xmlHttpRequest({
                        url: file.url, responseType: 'blob', onprogress: (event) => {
                            if (isCancelled) throw new Error('下载已取消');
                            if (event.lengthComputable) {
                                downloadProgressDialog.updateFileProgress(event.loaded, event.total);
                            }
                        },
                        onerror: (e) => {
                            console.error(e);
                            throw e;
                        }
                    });
                    if (!resp.response?.size) {
                        throw new Error('文件大小为0');
                    }
                    totalDownloadedSize += resp.response.size;
                    downloadProgressDialog.updateTotalSize(totalDownloadedSize);
                    let filename = file.filename;
                    let counter = 1;
                    while (fileNames.has(filename)) {
                        const extIndex = file.filename.lastIndexOf('.');
                        const baseName = file.filename.substring(0, extIndex);
                        const extension = file.filename.substring(extIndex);
                        filename = `${baseName}(${counter})${extension}`;
                        counter++;
                    }
                    fileNames.add(filename);
                    console.log(`${file.title}:${filename} 下载成功，文件大小 ${filesize(resp.response.size)}`);
                    await writer.add(filename, new zip.BlobReader(resp.response));
                    downloadProgressDialog.updateTotalProgress();
                    break; // 下载成功，跳出重试循环
                } catch (e) {
                    attempts++;
                    console.error(`${file.title}:${file.filename} 下载失败，重试第 ${attempts} 次`, e);
                    if (attempts >= 3) {
                        failedFiles.push({ filename: file.filename, error: e.message, url: file.url });
                        downloadProgressDialog.updateFailedFiles(failedFiles); // 实时更新失败文件列表
                    }
                }
            }
        }
        for (const cover of downloadCovers) {
            if (isCancelled) break; // 如果取消下载，则跳出循环
            let attempts = 0;
            while (attempts < 3) {
                try {
                    downloadProgressDialog.updateFileProgress(0, 0);
                    const coverBlob = await fetch(cover.url).then(response => response.blob()).catch(e => console.error(e));
                    if (!coverBlob.size) {
                        throw new Error('文件大小为0');
                    }
                    downloadProgressDialog.updateFileProgress(coverBlob.size, coverBlob.size);
                    totalDownloadedSize += coverBlob.size;
                    downloadProgressDialog.updateTotalSize(totalDownloadedSize);
                    let filename = cover.filename;
                    let counter = 1;
                    while (fileNames.has(filename)) {
                        const extIndex = cover.filename.lastIndexOf('.');
                        const baseName = cover.filename.substring(0, extIndex);
                        const extension = cover.filename.substring(extIndex);
                        filename = `${baseName}(${counter})${extension}`;
                        counter++;
                    }
                    fileNames.add(filename);
                    console.log(`${cover.title}:${filename} 下载成功，文件大小 ${filesize(coverBlob.size)}`);
                    await writer.add(filename, new zip.BlobReader(coverBlob));
                    downloadProgressDialog.updateTotalProgress();
                    break; // 下载成功，跳出重试循环
                } catch (e) {
                    attempts++;
                    console.error(`${cover.title}:${cover.filename} 下载失败，重试第 ${attempts} 次`, e);
                    if (attempts >= 3) {
                        failedFiles.push({ filename: cover.filename, error: e.message, url: cover.url });
                        downloadProgressDialog.updateFailedFiles(failedFiles); // 实时更新失败文件列表
                    }
                }
            }
        }
        for (const text of downloadTexts) {
            if (isCancelled) break; // 如果取消下载，则跳出循环
            try {
                console.log(`${text.title}:${text.filename} 下载成功，文件大小 ${filesize(text.text.length)}`);
                let filename = text.filename;
                let counter = 1;
                while (fileNames.has(filename)) {
                    const extIndex = text.filename.lastIndexOf('.');
                    const baseName = text.filename.substring(0, extIndex);
                    const extension = text.filename.substring(extIndex);
                    filename = `${baseName}(${counter})${extension}`;
                    counter++;
                }
                fileNames.add(filename);
                totalDownloadedSize += text.text.length;
                downloadProgressDialog.updateTotalSize(totalDownloadedSize);
                await writer.add(filename, new zip.TextReader(text.text));
                downloadProgressDialog.updateTotalProgress();
            } catch (e) {
                console.error(`${text.title}:${text.filename} 下载失败`, e);
                failedFiles.push({ filename: text.filename, error: e.message });
                downloadProgressDialog.updateFailedFiles(failedFiles); // 实时更新失败文件列表
            }
        }
        if (isCancelled) {
            console.log('下载已取消');
            downloadProgressDialog.close();
            unsafeWindow.removeEventListener('beforeunload', onBeforeUnload);
            return;
        }
        console.log(`${downloadFiles.length + downloadTexts.length} 个文件下载完成`)
        console.log('开始生成压缩包', writer)
        const zipFileBlob = await writer.close().catch(e => console.error(e));
        console.log(`压缩包生成完成，开始下载，压缩包大小:${filesize(zipFileBlob.size)}`)
        downloadProgressDialog.updateTitle('下载完成');
        downloadProgressDialog.updateTotalSize(totalDownloadedSize, filesize(zipFileBlob.size));
        downloadProgressDialog.stopElapsedTime(); // 停止已运行时间更新
        downloadProgressDialog.updateFailedFiles(failedFiles); // 更新失败文件列表
        downloadProgressDialog.updateConfirmButton(() => {
            downloadProgressDialog.close();
            unsafeWindow.removeEventListener('beforeunload', onBeforeUnload);
        });
        downloadProgressDialog.addSaveButton(async () => {
            saveBlob(zipFileBlob, `${(await baseinfo()).nickname}.zip`);
        });
        saveBlob(zipFileBlob, `${(await baseinfo()).nickname}.zip`);
    }

    function saveBlob(blob, filename) {
        // 使用StreamSaver.js下载
        const fileStream = streamSaver.createWriteStream(filename, {
            size: blob.size
        })
        const readableStream = blob.stream()
        // more optimized pipe version
        // (Safari may have pipeTo but it's useless without the WritableStream)
        if (window.WritableStream && readableStream.pipeTo) {
            return readableStream.pipeTo(fileStream)
                .then(() => alert('下载结束，请查看下载目录'))
        }

        // Write (pipe) manually
        window.writer = fileStream.getWriter()

        const reader = readableStream.getReader()
        const pump = () => reader.read()
            .then(res => res.done
                ? writer.close()
                : writer.write(res.value).then(pump))

        pump()
    }

    // 创建下载进度提示dialog
    function createDownloadProgressDialog(totalFiles, startTime, onCancel) {
        const dialog = document.createElement('div');
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.padding = '20px';
        dialog.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        dialog.style.zIndex = '1000';
        dialog.style.fontFamily = 'Arial, sans-serif';
        dialog.style.borderRadius = '10px'; // 添加圆角
        dialog.style.width = '50%'; // 调整宽度到50%
        dialog.style.height = '50%'; // 调整高度到50%
        dialog.style.textAlign = 'center'; // 居中文本
        dialog.style.overflowY = 'auto'; // 超出时可滚动

        const title = document.createElement('h2');
        title.innerText = `下载进度`;
        title.style.marginBottom = '20px'; // 调整内边距
        dialog.appendChild(title);

        const totalProgress = document.createElement('p');
        totalProgress.innerText = `总进度: 0/${totalFiles}`;
        totalProgress.style.marginBottom = '10px'; // 调整内边距
        dialog.appendChild(totalProgress);

        const fileProgress = document.createElement('p');
        fileProgress.innerText = `当前文件进度: 0B/0B`;
        fileProgress.style.marginBottom = '10px'; // 调整内边距
        dialog.appendChild(fileProgress);

        const totalSize = document.createElement('p');
        totalSize.innerText = `总大小: 0B`;
        totalSize.style.marginBottom = '10px'; // 调整内边距
        dialog.appendChild(totalSize);

        const startTimeElement = document.createElement('p');
        startTimeElement.innerText = `开始时间: ${startTime.toLocaleTimeString()}`;
        startTimeElement.style.marginBottom = '10px'; // 调整内边距
        dialog.appendChild(startTimeElement);

        const elapsedTimeElement = document.createElement('p');
        elapsedTimeElement.innerText = `已运行时间: 0秒`;
        elapsedTimeElement.style.marginBottom = '10px'; // 调整内边距
        dialog.appendChild(elapsedTimeElement);

        const confirmButton = document.createElement('button');
        confirmButton.innerText = '取消';
        confirmButton.style.backgroundColor = '#ff4d4f'; // 修改背景颜色为红色
        confirmButton.style.color = '#fff'; // 修改文字颜色为白色
        confirmButton.style.border = 'none';
        confirmButton.style.borderRadius = '5px';
        confirmButton.style.cursor = 'pointer';
        confirmButton.style.padding = '5px 10px';
        confirmButton.style.transition = 'background-color 0.3s'; // 添加过渡效果
        confirmButton.onmouseover = () => { confirmButton.style.backgroundColor = '#d93637'; } // 添加悬停效果
        confirmButton.onmouseout = () => { confirmButton.style.backgroundColor = '#ff4d4f'; } // 恢复背景颜色
        confirmButton.onclick = () => {
            if (onCancel) onCancel();
        };
        dialog.appendChild(confirmButton);

        const failedFilesTitle = document.createElement('h3');
        failedFilesTitle.innerText = '下载失败的文件';
        failedFilesTitle.style.marginTop = '20px'; // 调整内边距
        dialog.appendChild(failedFilesTitle);

        const failedFilesTable = document.createElement('table');
        failedFilesTable.style.width = '100%';
        failedFilesTable.style.borderCollapse = 'collapse';
        failedFilesTable.style.marginBottom = '10px'; // 调整内边距

        const failedFilesHeader = document.createElement('tr');
        const indexHeader = document.createElement('th');
        indexHeader.innerText = '序号';
        indexHeader.style.border = '1px solid #ccc';
        indexHeader.style.padding = '5px';
        indexHeader.style.width = '10%'; // 设置序号列宽度
        const filenameHeader = document.createElement('th');
        filenameHeader.innerText = '文件名';
        filenameHeader.style.border = '1px solid #ccc';
        filenameHeader.style.padding = '5px';
        filenameHeader.style.width = '35%'; // 设置文件名列宽度
        const errorHeader = document.createElement('th');
        errorHeader.innerText = '原因';
        errorHeader.style.border = '1px solid #ccc';
        errorHeader.style.padding = '5px';
        errorHeader.style.width = '35%'; // 设置原因列宽度
        const urlHeader = document.createElement('th');
        urlHeader.innerText = '下载URL';
        urlHeader.style.border = '1px solid #ccc';
        urlHeader.style.padding = '5px';
        urlHeader.style.width = '20%'; // 设置下载URL列宽度
        failedFilesHeader.appendChild(indexHeader);
        failedFilesHeader.appendChild(filenameHeader);
        failedFilesHeader.appendChild(errorHeader);
        failedFilesHeader.appendChild(urlHeader);
        failedFilesTable.appendChild(failedFilesHeader);

        const failedFilesBody = document.createElement('tbody');
        const initialRow = document.createElement('tr');
        const initialCell = document.createElement('td');
        initialCell.colSpan = 4;
        initialCell.innerText = '无';
        initialCell.style.border = '1px solid #ccc';
        initialCell.style.padding = '5px';
        initialRow.appendChild(initialCell);
        failedFilesBody.appendChild(initialRow);
        failedFilesTable.appendChild(failedFilesBody);

        dialog.appendChild(failedFilesTable);

        document.body.appendChild(dialog);

        const intervalId = setInterval(() => {
            const elapsedTime = Math.floor((new Date() - startTime) / 1000);
            const hours = Math.floor(elapsedTime / 3600);
            const minutes = Math.floor((elapsedTime % 3600) / 60);
            const seconds = elapsedTime % 60;
            let elapsedTimeStr = '';
            if (hours > 0) {
                elapsedTimeStr += `${hours}小时`;
            }
            if (minutes > 0 || hours > 0) {
                elapsedTimeStr += `${minutes}分钟`;
            }
            elapsedTimeStr += `${seconds}秒`;
            elapsedTimeElement.innerText = `已运行时间: ${elapsedTimeStr}`;
        }, 1000);

        return {
            updateTitle: (newTitle) => {
                title.innerText = newTitle;
            },
            updateTotalProgress: () => {
                const currentCount = parseInt(totalProgress.innerText.split('/')[0].split(': ')[1]) + 1;
                totalProgress.innerText = `总进度: ${currentCount}/${totalFiles}`;
            },
            updateFileProgress: (loaded, total) => {
                fileProgress.innerText = `当前文件进度: ${filesize(loaded)}/${filesize(total)}`;
            },
            updateTotalSize: (size, zipSize) => {
                totalSize.innerText = zipSize ? `总大小: ${filesize(size)} (压缩包大小: ${zipSize})` : `总大小: ${filesize(size)}`;
            },
            updateFailedFiles: (failedFiles) => {
                failedFilesBody.innerHTML = ''; // 清空表格内容
                if (failedFiles.length > 0) {
                    failedFiles.forEach((file, index) => {
                        const row = document.createElement('tr');
                        const indexCell = document.createElement('td');
                        indexCell.innerText = index + 1;
                        indexCell.style.border = '1px solid #ccc';
                        indexCell.style.padding = '5px';
                        const filenameCell = document.createElement('td');
                        filenameCell.innerText = file.filename;
                        filenameCell.style.border = '1px solid #ccc';
                        filenameCell.style.padding = '5px';
                        const errorCell = document.createElement('td');
                        errorCell.innerText = file.error;
                        errorCell.style.border = '1px solid #ccc';
                        errorCell.style.padding = '5px';
                        const urlCell = document.createElement('td');
                        const urlLink = document.createElement('a');
                        urlLink.href = file.url;
                        urlLink.innerText = '下载';
                        urlLink.target = '_blank';
                        urlCell.appendChild(urlLink);
                        urlCell.style.border = '1px solid #ccc';
                        urlCell.style.padding = '5px';
                        row.appendChild(indexCell);
                        row.appendChild(filenameCell);
                        row.appendChild(errorCell);
                        row.appendChild(urlCell);
                        failedFilesBody.appendChild(row);
                    });
                } else {
                    const row = document.createElement('tr');
                    const cell = document.createElement('td');
                    cell.colSpan = 4;
                    cell.innerText = '无';
                    cell.style.border = '1px solid #ccc';
                    cell.style.padding = '5px';
                    row.appendChild(cell);
                    failedFilesBody.appendChild(row);
                }
            },
            updateConfirmButton: (onConfirm) => {
                confirmButton.innerText = '确认';
                confirmButton.style.backgroundColor = '#007BFF'; // 修改背景颜色为蓝色
                confirmButton.onmouseover = () => { confirmButton.style.backgroundColor = '#0056b3'; } // 添加悬停效果
                confirmButton.onmouseout = () => { confirmButton.style.backgroundColor = '#007BFF'; } // 恢复背景颜色
                confirmButton.onclick = onConfirm;
            },
            addSaveButton: (onSave) => {
                // 添加保存按钮
                const saveButton = document.createElement('button');
                saveButton.innerText = '重新保存';
                saveButton.style.backgroundColor = '#28a745'; // 修改背景颜色为绿色
                saveButton.style.color = '#fff'; // 修改文字颜色为白色
                saveButton.style.border = 'none';
                saveButton.style.borderRadius = '5px';
                saveButton.style.cursor = 'pointer';
                saveButton.style.padding = '5px 10px';
                saveButton.style.transition = 'background-color 0.3s'; // 添加过渡效果
                saveButton.onmouseover = () => { saveButton.style.backgroundColor = '#218838'; } // 添加悬停效果
                saveButton.onmouseout = () => { saveButton.style.backgroundColor = '#28a745'; } // 恢复背景颜色
                saveButton.onclick = onSave;
                // 将保存按钮添加到确认按钮的右侧
                confirmButton.parentNode.insertBefore(saveButton, confirmButton.nextSibling);
            },
            stopElapsedTime: () => {
                clearInterval(intervalId);
            },
            close: () => {
                clearInterval(intervalId);
                document.body.removeChild(dialog);
            }
        };
    }

    // 创建获取投稿进度条，长宽90%，实时显示postArray的长度
    function createProgressBar() {
        const progressBar = document.createElement('div')
        progressBar.style.position = 'fixed'
        progressBar.style.bottom = '10px'
        progressBar.style.left = '10px'
        progressBar.style.backgroundColor = 'rgba(0, 0, 0, 0.7)'
        progressBar.style.color = 'white'
        progressBar.style.padding = '5px 10px'
        progressBar.style.borderRadius = '5px'
        document.body.appendChild(progressBar)
        return {
            update: (num, total) => {
                progressBar.innerText = `已获取 ${num}/${total} 个投稿`
            },
            close: () => {
                document.body.removeChild(progressBar)
            }
        }
    }

    /**
     * 创建结果弹窗，长宽90%, 顶部标题栏显示`投稿查询结果${选中数量}/${总数量}`，右上角有关闭按钮
     * 弹窗顶部有一个全选按钮，点击后全选所有投稿，有一个下载按钮，点击后下载所有勾选的投稿
     * 点击下载按钮后，会下载所有选中的投稿，下载路径格式为输入框的值，传入downloadPost函数
     * 弹窗顶部有一个输入框，用于输入下载路径格式，通过GM_setValue和GM_getValue保存到本地，可用参数`{creatorId}`,`{nickname}`,`{title}`,`{filename}`,`{publishedDatetime}`，用于替换为投稿的用户名、标题、文件名、发布时间
     * 投稿结果使用grid布局，长宽200px，每个格子顶部正中为标题，第二行为文件和图片数量，剩余空间为正文，正文总是存在并撑满剩余空间，且Y轴可滚动
     * 点击格子可以选中或取消选中，选中的格子会被下载按钮下载
     * 底部有查看详情按钮，链接格式为`/posts/${post.body.id}`
     */
    function createResultDialog(allPost, total) {
        const dialog = document.createElement('div')
        dialog.style.position = 'fixed'
        dialog.style.top = '5%'
        dialog.style.left = '5%'
        dialog.style.width = '90%'
        dialog.style.height = '90%'
        dialog.style.backgroundColor = 'white'
        dialog.style.zIndex = '1000'
        dialog.style.padding = '20px'
        dialog.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)'
        dialog.style.display = 'flex'
        dialog.style.flexDirection = 'column'
        dialog.style.fontFamily = 'Arial, sans-serif'

        const header = document.createElement('div')
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.paddingBottom = '20px'; // 调整内边距
        header.style.fontSize = '18px'; // 增加字体大小

        const title = document.createElement('h2')
        title.innerText = `投稿查询结果 0/${allPost.length}/${total}`
        title.style.margin = '0'; // 移除默认的标题外边距

        header.appendChild(title)

        const closeButton = document.createElement('button')
        closeButton.innerText = '关闭'
        closeButton.style.backgroundColor = '#ff4d4f'; // 修改背景颜色为红色
        closeButton.style.color = '#fff'; // 修改文字颜色为白色
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.style.padding = '5px 10px';
        closeButton.style.transition = 'background-color 0.3s'; // 添加过渡效果
        closeButton.onmouseover = () => { closeButton.style.backgroundColor = '#d93637'; } // 添加悬停效果
        closeButton.onmouseout = () => { closeButton.style.backgroundColor = '#ff4d4f'; } // 恢复背景颜色
        closeButton.onclick = () => {
            document.body.removeChild(dialog)
        }
        header.appendChild(closeButton)

        dialog.appendChild(header)

        const controls = document.createElement('div')
        controls.style.display = 'flex'
        controls.style.justifyContent = 'space-between'
        controls.style.alignItems = 'center'
        controls.style.marginBottom = '20px'

        const leftControls = document.createElement('div')
        leftControls.style.display = 'flex'
        leftControls.style.alignItems = 'center'

        const selectAllButton = document.createElement('button')
        selectAllButton.innerText = '全选'
        selectAllButton.style.backgroundColor = '#007BFF'; // 背景颜色
        selectAllButton.style.color = 'white'; // 文字颜色
        selectAllButton.style.border = 'none'; // 去掉边框
        selectAllButton.style.borderRadius = '5px'; // 圆角
        selectAllButton.style.cursor = 'pointer';
        selectAllButton.style.padding = '5px 10px';
        selectAllButton.style.transition = 'background-color 0.3s'; // 过渡效果
        selectAllButton.style.marginRight = '10px'; // 添加右侧外边距
        selectAllButton.onmouseover = () => {
            selectAllButton.style.backgroundColor = '#0056b3'; // 鼠标悬停时的颜色
        }
        selectAllButton.onmouseout = () => {
            selectAllButton.style.backgroundColor = '#007BFF'; // 鼠标移开时的颜色
        }
        selectAllButton.onclick = () => {
            const checkboxes = dialog.querySelectorAll('input[type="checkbox"]')
            const postElements = dialog.querySelectorAll('.post-element')
            checkboxes.forEach((checkbox, index) => {
                checkbox.checked = !selectAllButton.classList.contains('deselect')
                postElements[index].style.backgroundColor = checkbox.checked ? 'lightblue' : 'white'
            })
            selectAllButton.classList.toggle('deselect')
            updateTitle()
        }
        leftControls.appendChild(selectAllButton)

        const downloadButton = document.createElement('button')
        downloadButton.innerText = '下载'
        downloadButton.style.backgroundColor = '#007BFF'; // 背景颜色
        downloadButton.style.color = 'white'; // 文字颜色
        downloadButton.style.border = 'none'; // 去掉边框
        downloadButton.style.borderRadius = '5px'; // 圆角
        downloadButton.style.cursor = 'pointer';
        downloadButton.style.padding = '5px 10px';
        downloadButton.style.transition = 'background-color 0.3s'; // 过渡效果
        downloadButton.onmouseover = () => {
            downloadButton.style.backgroundColor = '#0056b3'; // 鼠标悬停时的颜色
        }
        downloadButton.onmouseout = () => {
            downloadButton.style.backgroundColor = '#007BFF'; // 鼠标移开时的颜色
        }
        downloadButton.onclick = async () => {
            const selectedPost = []
            dialog.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                selectedPost.push(allPost[checkbox.dataset.index])
            })
            if (selectedPost.length === 0) {
                alert('请先选择要下载的投稿项');
                return;
            }
            const pathFormatInput = dialog.querySelector('input[type="text"]')
            const pathFormat = pathFormatInput.value || defaultFormat
            await downloadPost(selectedPost, pathFormat).catch(e => console.error(e))
        }
        leftControls.appendChild(downloadButton)

        controls.appendChild(leftControls)

        const rightControls = document.createElement('div')
        rightControls.style.display = 'flex'
        rightControls.style.alignItems = 'center'

        const pathFormatLabel = document.createElement('label')
        pathFormatLabel.innerText = '下载路径格式 (可用参数: {creatorId}, {nickname}, {title}, {filename}, {publishedDatetime}):'
        pathFormatLabel.style.display = 'block'
        pathFormatLabel.style.marginBottom = '5px'

        const pathFormatInput = document.createElement('input')
        pathFormatInput.type = 'text'
        pathFormatInput.placeholder = '下载路径格式'
        pathFormatInput.value = GM_getValue('pathFormat', defaultFormat)
        pathFormatInput.style.width = '200px'
        pathFormatInput.style.padding = '5px'
        pathFormatInput.style.fontSize = '14px'
        pathFormatInput.onchange = () => {
            GM_setValue('pathFormat', pathFormatInput.value)
        }

        rightControls.appendChild(pathFormatLabel)
        rightControls.appendChild(pathFormatInput)

        controls.appendChild(rightControls)

        dialog.appendChild(controls)

        const content = document.createElement('div')
        content.style.display = 'grid'
        content.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))'
        content.style.gap = '20px' // 控制postElement之间的距离
        content.style.padding = '20px'
        content.style.flexGrow = '1'
        content.style.overflowY = 'auto'

        allPost.forEach((post, index) => {
            const postElement = document.createElement('div')
            postElement.className = 'post-element'
            postElement.style.border = '1px solid #ccc'
            postElement.style.padding = '10px'
            postElement.style.borderRadius = '10px' // 增加圆角
            postElement.style.display = 'flex'
            postElement.style.flexDirection = 'column'
            postElement.style.alignItems = 'center'
            postElement.style.justifyContent = 'space-between'
            postElement.style.height = '250px' // 调整高度
            postElement.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.1)' // 添加阴影
            postElement.style.transition = 'transform 0.2s' // 添加过渡效果
            postElement.onmouseover = () => {
                postElement.style.transform = 'scale(1.05)' // 鼠标悬停时放大
            }
            postElement.onmouseout = () => {
                postElement.style.transform = 'scale(1)' // 鼠标移开时恢复
            }

            const checkbox = document.createElement('input')
            checkbox.type = 'checkbox'
            checkbox.dataset.index = index
            checkbox.style.marginBottom = '10px'
            postElement.appendChild(checkbox)

            const title = document.createElement('h3')
            title.innerText = post.title
            title.style.margin = '0'
            title.style.fontSize = '16px'
            title.style.textAlign = 'center'
            title.style.whiteSpace = 'nowrap' // 单行显示
            title.style.overflow = 'hidden' // 隐藏超出部分
            title.style.textOverflow = 'ellipsis' // 显示省略号
            title.style.width = '100%' // 确保宽度不超过父元素
            title.style.minHeight = '20px' // 设置最小高度
            title.style.flexShrink = '0' // 防止收缩
            postElement.appendChild(title)

            const typeElement = document.createElement('p')
            typeElement.innerText = `${postType[post.type]?.name || post.type}`
            typeElement.style.margin = '0'
            typeElement.style.fontSize = '14px'
            typeElement.style.color = '#555'
            typeElement.style.whiteSpace = 'nowrap' // 单行显示
            typeElement.style.overflow = 'hidden' // 隐藏超出部分
            typeElement.style.textOverflow = 'ellipsis' // 显示省略号
            typeElement.style.width = '100%' // 确保宽度不超过父元素
            typeElement.style.minHeight = '15px' // 设置最小高度
            typeElement.style.flexShrink = '0' // 防止收缩
            typeElement.style.textAlign = 'center' // 居中
            postElement.appendChild(typeElement)

            const images = post.body.images || []
            const files = post.body.files || []
            const cover = post.body.cover ? 1 : 0
            let text = post.body.text || ''
            if (!text && post.body.html) {
                const html = post.body.html
                const parser = new DOMParser()
                const doc = parser.parseFromString(html, 'text/html')
                text = doc.body.innerText
            }

            const mediaCount = document.createElement('p')
            mediaCount.innerText = `${images.length} 张图片 | ${files.length} 个文件 | ${cover} 个封面`
            mediaCount.style.margin = '0'
            mediaCount.style.fontSize = '14px'
            mediaCount.style.color = '#555'
            mediaCount.style.whiteSpace = 'nowrap' // 单行显示
            mediaCount.style.overflow = 'hidden' // 隐藏超出部分
            mediaCount.style.textOverflow = 'ellipsis' // 显示省略号
            mediaCount.style.width = '100%' // 确保宽度不超过父元素
            mediaCount.style.minHeight = '15px' // 设置最小高度
            mediaCount.style.flexShrink = '0' // 防止收缩
            mediaCount.style.textAlign = 'center' // 居中
            postElement.appendChild(mediaCount)

            const textElement = document.createElement('div')
            textElement.innerText = text
            textElement.style.marginTop = '10px'
            textElement.style.fontSize = '14px'
            textElement.style.color = '#333'
            textElement.style.overflowY = 'auto'
            textElement.style.overflowX = 'hidden'
            textElement.style.wordBreak = 'break-all' // 长单词换行
            textElement.style.flexGrow = '1' // 撑满剩余空间
            textElement.style.width = '100%' // 确保宽度不超过父元素
            postElement.appendChild(textElement)

            // 增加查看详情按钮
            const viewButton = document.createElement('button')
            viewButton.innerText = '查看详情'
            viewButton.style.marginTop = '10px'
            viewButton.style.padding = '5px 10px'
            viewButton.style.fontSize = '14px'
            viewButton.style.cursor = 'pointer'
            viewButton.style.backgroundColor = '#007BFF' // 背景颜色
            viewButton.style.color = 'white' // 文字颜色
            viewButton.style.border = 'none' // 去掉边框
            viewButton.style.borderRadius = '5px' // 圆角
            viewButton.style.transition = 'background-color 0.3s' // 过渡效果
            viewButton.onmouseover = () => {
                viewButton.style.backgroundColor = '#0056b3' // 鼠标悬停时的颜色
            }
            viewButton.onmouseout = () => {
                viewButton.style.backgroundColor = '#007BFF' // 鼠标移开时的颜色
            }
            viewButton.onclick = async (event) => {
                event.stopPropagation(); // 阻止事件冒泡
                window.open(`${(await baseinfo()).baseUrl}/posts/${post.id}`, '_blank')
            }
            postElement.appendChild(viewButton)

            postElement.onclick = () => {
                checkbox.checked = !checkbox.checked
                postElement.style.backgroundColor = checkbox.checked ? 'lightblue' : 'white'
                updateTitle()
            }

            content.appendChild(postElement)
        })

        dialog.appendChild(content)

        document.body.appendChild(dialog)

        function updateTitle() {
            const selectedCount = dialog.querySelectorAll('input[type="checkbox"]:checked').length
            title.innerText = `投稿查询结果 ${selectedCount}/${allPost.length}/${total}`
        }
    }

    async function fmain() {
        if (allPost.length === 0) {
            // 创建进度条
            const progressBar = createProgressBar()
            // 获取所有投稿
            const { postArray, total } = await getAllPost(progressBar).catch(e => console.error(e))
            allPost = postArray
            totalPost = total
        }
        // 创建结果弹窗
        const resultDialog = createResultDialog(allPost, totalPost)
    }

    GM_registerMenuCommand('查询投稿', fmain)

})();
