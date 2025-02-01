// ==UserScript==
// @name         下载你赞助的fanbox
// @namespace    Schwi
// @version      0.5
// @description  快速下载你赞助的fanbox用户的所有投稿
// @author       Schwi
// @match        https://*.fanbox.cc/*
// @icon         https://s.pximg.net/common/images/fanbox/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      api.fanbox.cc
// @connect      downloads.fanbox.cc
// @require      https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/dist/zip.min.js
// @require      https://cdn.jsdelivr.net/gh/avoidwork/filesize.js@b480b2992a3ac2acb18a030c7b3ce11fe91fb6e0/dist/filesize.min.js
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window.self) return

    const postType = {
        text: { type: 'text', name: '文本' },
        image: { type: 'image', name: '图片' },
        file: { type: 'file', name: '文件' },
        article: { type: 'article', name: '文章' }
    }
    const baseinfo = () => {
        let username = top.window.location.host.split('.')[0]
        let baseUrl = `https://${username}.fanbox.cc`
        if (username === 'www') {
            const pathname = top.window.location.pathname
            if (!pathname.startsWith('/@')) {
                alert('请访问用户页再执行脚本')
                throw new Error('请访问用户页再执行脚本')
            }
            username = pathname.split('/@')[1].split('/')[0]
            baseUrl = `https://www.fanbox.cc/@${username}`
        }
        return { username, baseUrl }
    }

    async function getAllPost(progressBar) {
        const plan = `https://api.fanbox.cc/plan.listCreator?creatorId=${baseinfo().username}`
        const planData = await fetch(plan, { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
        const yourPlan = planData.body.filter(plan => plan.paymentMethod)
        const yourFee = yourPlan.length === 0 ? 0 : yourPlan[0].fee
        const api = `https://api.fanbox.cc/post.listCreator?creatorId=${baseinfo().username}&limit=1`
        const data = await fetch(api, { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
        let nextId = data.body[0]?.id
        const postArray = []
        let i = 0
        while (nextId) {
            console.log(`请求第${++i}个`)
            const resp = await fetch(`https://api.fanbox.cc/post.info?postId=${nextId}`, { credentials: 'include' }).then(response => response.json()).catch(e => console.error(e));
            const feeRequired = resp.body.feeRequired || 0
            if (feeRequired <= yourFee) {
                // 处理post类型
                resp.body.body.images = resp.body.body.images || []
                resp.body.body.files = resp.body.body.files || []
                if (resp.body.type === postType.text.type) {
                    resp.body.body.text = resp.body.body.text;
                } else if (resp.body.type === postType.image.type) {
                    resp.body.body.images = resp.body.body.images;
                    resp.body.body.text = resp.body.body.text;
                } else if (resp.body.type === postType.file.type) {
                    resp.body.body.files = resp.body.body.files;
                    resp.body.body.text = resp.body.body.text;
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
                        <body>
                            <p><img src="${resp.body.coverImageUrl}" alt=""/></p>
                            <h1>${resp.body.title}</h1>
                        `
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
                            html += `<p>${JSON.stringify(block)}</p>`
                        } else if (block.type === 'url_embed') {
                            const blockUrlEmbed = urlEmbed[block.urlEmbedId]
                            if (blockUrlEmbed.type.startsWith('html')) {
                                html += `<p class="iframely-responsive">${blockUrlEmbed.html}</p>`
                            } else {
                                html += `<p>${JSON.stringify(block)}</p>`
                            }
                        } else {
                            html += `<p>${JSON.stringify(block)}</p>`
                        }
                    }
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
                progressBar.update(postArray.length)
            } else {
                console.log(`${nextId}:${resp.body.title} 赞助等级不足，需要 ${feeRequired} 日元档，您的档位是 ${yourFee} 日元`)
            }
            const prevPost = resp.body.prevPost
            nextId = prevPost?.id
            if (!nextId) {
                break
            }
        }
        console.log(`共${postArray.length}个作品`, postArray)
        progressBar.close()
        return postArray
    }

    /**
     * 格式化路径，替换模板中的占位符，并过滤非法路径字符
     * @param {string} pathFormat - 路径格式模板
     * @param {object} post - 投稿对象
     * @param {object} item - 文件或图片对象
     * @returns {string} - 格式化后的路径
     */
    function formatPath(pathFormat, post, item) {
        const illegalChars = /[\\/:*?"<>|]/g;
        const formattedPath = pathFormat
            .replace('{title}', post.title.replace(illegalChars, '_'))
            .replace('{filename}', `${item.name}.${item.extension}`.replace(illegalChars, '_'))
            .replace('{username}', baseinfo().username.replace(illegalChars, '_'))
            .replace('{publishedDatetime}', post.publishedDatetime.replace(illegalChars, '_'))
        return formattedPath;
    }

    async function downloadPost(selectedPost, pathFormat = `{title}/{filename}`) {
        const downloadFiles = []
        const downloadTexts = []
        for (const post of selectedPost) {
            let imgs = post.body.images || []
            let files = post.body.files || []
            let text = post.body.text || ''
            let html = post.body.html || ''

            for (const img of imgs) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = formatPath(pathFormat, post, { name: img.id, extension: img.extension })
                downloadFiles.push({
                    title: post.title,
                    filename: formattedPath,
                    url: img.originalUrl,
                    publishedDatetime: post.publishedDatetime
                })
            }
            for (const file of files) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = formatPath(pathFormat, post, { name: file.name, extension: file.extension })
                downloadFiles.push({
                    title: post.title,
                    filename: formattedPath,
                    url: file.url,
                    publishedDatetime: post.publishedDatetime
                })
            }
            if (text) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = formatPath(pathFormat, post, { name: post.title, extension: 'txt' })
                downloadTexts.push({
                    title: post.title,
                    filename: formattedPath,
                    text,
                    publishedDatetime: post.publishedDatetime
                })
            }
            if (html) {
                // 根据pathFormat记录路径，用于之后打包为zip
                const formattedPath = formatPath(pathFormat, post, { name: post.title, extension: 'html' })
                downloadTexts.push({
                    title: post.title,
                    filename: formattedPath,
                    text: html,
                    publishedDatetime: post.publishedDatetime
                })
            }
        }
        console.log(`开始下载 ${downloadFiles.length + downloadTexts.length} 个文件`)

        // 创建下载进度提示dialog
        const downloadProgressDialog = createDownloadProgressDialog(downloadFiles.length + downloadTexts.length);

        const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
        for (const file of downloadFiles) {
            const resp = await GM.xmlHttpRequest({
                url: file.url, responseType: 'blob', onprogress: (event) => {
                    if (event.lengthComputable) {
                        downloadProgressDialog.updateFileProgress(event.loaded, event.total);
                    }
                }
            });
            if (resp.response.size === 0) {
                console.log(`${file.title}:${file.filename} 下载失败`)
                continue
            }
            console.log(`${file.title}:${file.filename} 下载成功，文件大小 ${filesize(resp.response.size)}`)
            await writer.add(file.filename, new zip.BlobReader(resp.response));
            downloadProgressDialog.updateTotalProgress();
        }
        for (const text of downloadTexts) {
            console.log(`${text.title}:${text.filename} 下载成功，文件大小 ${filesize(text.text.length)}`)
            await writer.add(text.filename, new zip.TextReader(text.text));
            downloadProgressDialog.updateTotalProgress();
        }
        console.log(`${downloadFiles.length + downloadTexts.length} 个文件下载完成`)
        console.log('开始生成压缩包', writer)
        const zipFileBlob = await writer.close();
        console.log(`压缩包生成完成，开始下载，压缩包大小:${filesize(zipFileBlob.size)}`)
        GM_download({
            url: URL.createObjectURL(zipFileBlob),
            name: `${baseinfo().username}.zip`
        })
        downloadProgressDialog.close();
    }

    // 创建下载进度提示dialog
    function createDownloadProgressDialog(totalFiles) {
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
        dialog.style.width = '300px'; // 固定宽度
        dialog.style.textAlign = 'center'; // 居中文本

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

        document.body.appendChild(dialog);

        return {
            updateTotalProgress: () => {
                const currentCount = parseInt(totalProgress.innerText.split('/')[0].split(': ')[1]) + 1;
                totalProgress.innerText = `总进度: ${currentCount}/${totalFiles}`;
            },
            updateFileProgress: (loaded, total) => {
                fileProgress.innerText = `当前文件进度: ${filesize(loaded)}/${filesize(total)}`;
            },
            close: () => {
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
            update: (num) => {
                progressBar.innerText = `已获取 ${num} 个投稿`
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
     * 弹窗顶部有一个输入框，用于输入下载路径格式，例如`{title}/{filename}`，默认为`{title}/{filename}`，通过GM_setValue和GM_getValue保存到本地，可用参数`{username}`,`{title}`,`{filename}`,`{publishedDatetime}`，用于替换为投稿的用户名、标题、文件名、发布时间
     * 投稿结果使用grid布局，长宽200px，每个格子顶部正中为标题，第二行为文件和图片数量，剩余空间为正文，正文总是存在并撑满剩余空间，且Y轴可滚动
     * 点击格子可以选中或取消选中，选中的格子会被下载按钮下载
     * 底部有查看详情按钮，链接格式为`/posts/${post.body.id}`
     */
    function createResultDialog(allPost) {
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
        title.innerText = `投稿查询结果 0/${allPost.length}`
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
            const pathFormat = pathFormatInput.value || `{title}/{filename}`
            await downloadPost(selectedPost, pathFormat)
        }
        leftControls.appendChild(downloadButton)

        controls.appendChild(leftControls)

        const rightControls = document.createElement('div')
        rightControls.style.display = 'flex'
        rightControls.style.alignItems = 'center'

        const pathFormatLabel = document.createElement('label')
        pathFormatLabel.innerText = '下载路径格式 (可用参数: {username}, {title}, {filename}, {publishedDatetime}):'
        pathFormatLabel.style.display = 'block'
        pathFormatLabel.style.marginBottom = '5px'

        const pathFormatInput = document.createElement('input')
        pathFormatInput.type = 'text'
        pathFormatInput.placeholder = '下载路径格式'
        pathFormatInput.value = GM_getValue('pathFormat', `{title}/{filename}`)
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
            let text = post.body.text || ''
            if (!text && post.body.html) {
                const html = post.body.html
                const parser = new DOMParser()
                const doc = parser.parseFromString(html, 'text/html')
                text = doc.body.innerText
            }

            const mediaCount = document.createElement('p')
            mediaCount.innerText = `${images.length} 张图片 | ${files.length} 个文件`
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
            viewButton.onclick = (event) => {
                event.stopPropagation(); // 阻止事件冒泡
                window.open(`${baseinfo().baseUrl}/posts/${post.id}`, '_blank')
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
            title.innerText = `投稿查询结果 ${selectedCount}/${allPost.length}`
        }
    }

    async function fmain() {
        // 创建进度条
        const progressBar = createProgressBar()
        // 获取所有投稿
        const allPost = await getAllPost(progressBar)
        // 创建结果弹窗
        const resultDialog = createResultDialog(allPost)
    }

    GM_registerMenuCommand('查询投稿', fmain)

})();
