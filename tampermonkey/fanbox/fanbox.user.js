// ==UserScript==
// @name         下载你赞助的fanbox
// @namespace    Schwi
// @version      4.7.1
// @description  查询并下载你赞助的 fanbox 用户投稿，支持限定查询数量
// @author       Schwi
// @match        https://*.fanbox.cc/*
// @icon         https://s.pximg.net/common/images/fanbox/favicon.ico
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM.xmlHttpRequest
// @noframes
// @connect      api.fanbox.cc
// @connect      downloads.fanbox.cc
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @require      https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.57/dist/zip.min.js
// @require      https://cdn.jsdelivr.net/gh/avoidwork/filesize.js@b480b2992a3ac2acb18a030c7b3ce11fe91fb6e0/dist/filesize.min.js
// @require      https://cdn.jsdelivr.net/npm/streamsaver@2.0.6/StreamSaver.min.js
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULT_PATH_FORMAT = '{postId}_{title}/{filename}';
    const PATH_FORMAT_STORAGE_KEY = 'pathFormat';
    const QUERY_LIMIT_STORAGE_KEY = 'queryLimit';
    const REQUEST_OPTIONS = { credentials: 'include' };
    const MAX_DOWNLOAD_ATTEMPTS = 3;

    const COLORS = Object.freeze({
        primary: '#007BFF',
        primaryHover: '#0056b3',
        danger: '#ff4d4f',
        dangerHover: '#d93637',
        success: '#28a745',
        successHover: '#218838'
    });

    const API = Object.freeze({
        creator: creatorId => `https://api.fanbox.cc/creator.get?creatorId=${creatorId}`,
        plans: creatorId => `https://api.fanbox.cc/plan.listCreator?creatorId=${creatorId}`,
        creatorPosts: (creatorId, limit = 1) =>
            `https://api.fanbox.cc/post.listCreator?creatorId=${creatorId}&limit=${limit}`,
        post: postId => `https://api.fanbox.cc/post.info?postId=${postId}`
    });

    const POST_TYPES = Object.freeze({
        text: { type: 'text', name: '文本' },
        image: { type: 'image', name: '图片' },
        file: { type: 'file', name: '文件' },
        video: {
            type: 'video',
            name: '视频',
            getFullUrl(embed) {
                const providers = {
                    soundcloud: `https://soundcloud.com/${embed.videoId}`,
                    vimeo: `https://vimeo.com/${embed.videoId}`,
                    youtube: `https://www.youtube.com/watch?v=${embed.videoId}`
                };
                return providers[embed.serviceProvider];
            }
        },
        article: { type: 'article', name: '文章' }
    });

    const state = {
        posts: [],
        planCounts: {},
        creatorInfo: null,
        queryLimit: null,
        hasLoadedPosts: false,
        postsCreatorId: null
    };
    const windows = { download: null, fetch: null, query: null, results: null, message: null };

    const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
    const formatSize = size => filesize.filesize(size, { base: 2 });

    async function openDialog(key, width, height, ariaLabel, config = {}) {
        windows[key]?.close();
        const window = await SchwiDialog.createDialog(width, height, { ariaLabel, showHeader: false, ...config });
        window.content.style.cssText = 'padding:0;overflow:hidden';
        windows[key] = window;
        window.onclose = () => { if (windows[key] === window) windows[key] = null; };
        return window;
    }

    async function showMessage(title, message) {
        const window = await openDialog('message', 420, 190, title, { title, showHeader: true });
        const text = createElement('p', { text: message, styles: { margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' } });
        const close = createButton('确定', { styles: { float: 'right', marginTop: '16px' }, onClick: window.close });
        window.content.append(text, close);
        window.show();
    }

    function normalizeQueryLimit(value) {
        const normalizedValue = String(value ?? '').trim();
        if (!normalizedValue) return null;
        const limit = Number(normalizedValue);
        return Number.isSafeInteger(limit) && limit > 0 ? limit : null;
    }

    function applyStyles(element, styles) {
        Object.assign(element.style, styles);
        return element;
    }

    function createElement(tagName, options = {}) {
        const element = document.createElement(tagName);
        if (options.text !== undefined) element.innerText = options.text;
        if (options.html !== undefined) element.innerHTML = options.html;
        if (options.className) element.className = options.className;
        if (options.styles) applyStyles(element, options.styles);
        return element;
    }

    function appendChildren(parent, ...children) {
        parent.append(...children);
        return parent;
    }

    function createButton(text, options = {}) {
        const {
            color = COLORS.primary,
            hoverColor = COLORS.primaryHover,
            styles = {},
            onClick
        } = options;
        const button = createElement('button', {
            text,
            styles: {
                backgroundColor: color,
                color: '#fff',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                padding: '5px 10px',
                transition: 'background-color 0.3s',
                ...styles
            }
        });
        button.onmouseover = () => { button.style.backgroundColor = hoverColor; };
        button.onmouseout = () => { button.style.backgroundColor = color; };
        if (onClick) button.onclick = onClick;
        return button;
    }

    function removeElement(element) {
        if (element.parentNode) element.parentNode.removeChild(element);
    }

    function getErrorMessage(error) {
        return error?.message || String(error);
    }

    async function fetchJsonWithRetry(
        url,
        options,
        maxRetries = 5,
        initialDelay = 2000,
        addBaseDelay = false
    ) {
        if (addBaseDelay) await sleep(500);

        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                const response = await fetch(url, options);
                if (response.status === 429) {
                    const waitTime = getRetryDelay(response.headers.get('Retry-After'), initialDelay, attempt);
                    console.warn(`API rate limit hit (429). Retrying after ${Math.round(waitTime / 1000)}s...`);
                    await sleep(waitTime);
                    attempt += 1;
                    continue;
                }
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                if (data.error) {
                    throw new Error(`API returned an error: ${data.message || JSON.stringify(data.body)}`);
                }
                return data;
            } catch (error) {
                if (error?.name === 'AbortError') throw error;
                console.error(
                    `Request to ${url} failed on attempt ${attempt + 1}/${maxRetries}:`,
                    getErrorMessage(error)
                );
                attempt += 1;
                if (attempt >= maxRetries) {
                    console.error(`Max retries reached for ${url}. Aborting.`);
                    throw error;
                }
                await sleep(initialDelay * (2 ** (attempt - 1)));
            }
        }

        throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts.`);
    }

    function getRetryDelay(retryAfter, initialDelay, attempt) {
        let waitTime = initialDelay * (2 ** attempt);
        if (!retryAfter) return Math.max(waitTime, 1000);

        const seconds = Number.parseInt(retryAfter, 10);
        if (!Number.isNaN(seconds)) {
            waitTime = seconds * 1000;
        } else {
            const retryDate = new Date(retryAfter);
            if (!Number.isNaN(retryDate.getTime())) waitTime = retryDate.getTime() - Date.now();
        }
        return Math.max(waitTime, 1000);
    }

    async function getCreatorInfo(forceRefresh = false) {
        if (state.creatorInfo && !forceRefresh) return state.creatorInfo;

        let creatorId = top.window.location.host.split('.')[0];
        let baseUrl = `https://${creatorId}.fanbox.cc`;
        if (creatorId === 'www') {
            const pathname = top.window.location.pathname;
            if (!pathname.startsWith('/@')) {
                await showMessage('无法查询投稿', '请访问用户页再执行脚本');
                throw new Error('请访问用户页再执行脚本');
            }
            creatorId = pathname.split('/@')[1].split('/')[0];
            baseUrl = `https://www.fanbox.cc/@${creatorId}`;
        }

        const response = await fetchJsonWithRetry(API.creator(creatorId), REQUEST_OPTIONS);
        state.creatorInfo = {
            creatorId,
            baseUrl,
            nickname: response.body.user.name
        };
        return state.creatorInfo;
    }

    function getMinimumEligibleFee(planCounts, requiredFee) {
        const eligibleFees = Object.keys(planCounts)
            .map(Number)
            .filter(fee => fee >= requiredFee);
        return eligibleFees.length > 0 ? Math.min(...eligibleFees) : Infinity;
    }

    function createPlanCounts(plans, userFee) {
        const planCounts = {
            '-2': {
                id: -2,
                title: '合计',
                fee: -2,
                description: null,
                hasAdultContent: plans.some(plan => plan.hasAdultContent),
                coverImageUrl: null,
                visible: null,
                count: 0
            },
            '-1': {
                id: -1,
                title: '可见',
                fee: -1,
                description: null,
                hasAdultContent: plans
                    .filter(plan => userFee >= plan.fee)
                    .some(plan => plan.hasAdultContent),
                coverImageUrl: null,
                visible: true,
                count: 0
            },
            0: {
                id: 0,
                title: '公开',
                fee: 0,
                description: null,
                hasAdultContent: false,
                coverImageUrl: null,
                visible: true,
                count: 0
            }
        };

        for (const plan of plans) {
            planCounts[plan.fee] = {
                id: plan.id,
                title: plan.title,
                fee: plan.fee,
                description: plan.description,
                hasAdultContent: plan.hasAdultContent,
                coverImageUrl: plan.coverImageUrl,
                visible: userFee >= plan.fee,
                count: 0
            };
        }
        return planCounts;
    }

    async function fetchAllPosts(progressBar, queryLimit, signal) {
        const { creatorId } = await getCreatorInfo();
        const requestOptions = { ...REQUEST_OPTIONS, signal };
        const planResponse = await fetchJsonWithRetry(API.plans(creatorId), requestOptions);
        const plans = planResponse.body.plans;
        const subscribedPlans = plans.filter(plan => plan.paymentMethod);
        const userFee = subscribedPlans.length === 0 ? 0 : subscribedPlans[0].fee;
        const planCounts = createPlanCounts(plans, userFee);

        const listResponse = await fetchJsonWithRetry(API.creatorPosts(creatorId), requestOptions);
        let nextPostId = listResponse.body.posts[0]?.id;
        const posts = [];
        let requestedCount = 0;
        let accessibleCount = 0;

        while (nextPostId && (queryLimit === null || requestedCount < queryLimit)) {
            requestedCount += 1;
            console.log(`请求第${requestedCount}个, Post ID: ${nextPostId}`);
            const response = await fetchJsonWithRetry(
                API.post(nextPostId),
                requestOptions,
                5,
                2000,
                true
            );
            const post = response.body.post;
            if (!post) {
                throw new Error(`投稿 ${nextPostId} 的接口响应中缺少 body.post`);
            }
            const requiredFee = post.feeRequired || 0;
            const minimumFee = getMinimumEligibleFee(planCounts, requiredFee);
            post.minFeeRequired = minimumFee;
            planCounts[minimumFee].count += 1;
            planCounts['-2'].count += 1;

            if (minimumFee > userFee) {
                const originalFee = minimumFee > requiredFee ? `(${requiredFee})` : '';
                console.log(
                    `${nextPostId}:${post.title} 赞助等级不足，至少需要 ${minimumFee}${originalFee} 日元档，您的档位是 ${userFee} 日元`
                );
            }

            post.isAccessible = minimumFee <= userFee && Boolean(post.body);
            if (post.isAccessible) {
                accessibleCount += 1;
                planCounts['-1'].count += 1;
                normalizePost(post, nextPostId);
            }
            posts.push(post);

            progressBar.update({
                requested: requestedCount,
                accessible: accessibleCount,
                inaccessible: requestedCount - accessibleCount
            });
            nextPostId = post.prevPost?.id;
        }

        if (queryLimit !== null && requestedCount === queryLimit && nextPostId) {
            console.info(`查询达到上限 ${queryLimit}，停止继续请求。`);
        }
        console.log(`共${posts.length}个作品`, posts);
        return { posts, planCounts };
    }

    function normalizePost(post, postId) {
        post.body.images ||= [];
        post.body.files ||= [];
        post.body.video ||= {};

        if (post.coverImageUrl) {
            post.body.cover = {
                id: '0_cover',
                extension: post.coverImageUrl.split('.').pop(),
                originalUrl: post.coverImageUrl
            };
        }

        switch (post.type) {
            case POST_TYPES.text.type:
            case POST_TYPES.file.type:
                break;
            case POST_TYPES.image.type:
                numberPostImages(post.body.images);
                break;
            case POST_TYPES.video.type:
                normalizeVideoPost(post);
                break;
            case POST_TYPES.article.type:
                normalizeArticlePost(post);
                break;
            default:
                console.log(`${postId}:${post.title} 未知类型 ${post.type}`);
        }
    }

    function numberPostImages(images) {
        const indexWidth = String(images.length).length;
        images.forEach((image, index) => {
            const number = String(index + 1).padStart(indexWidth, '0');
            image.id = `${number}_${image.id}`;
        });
    }

    function createHtmlDocument(title, bodyHtml) {
        return `
                        <!DOCTYPE html>
                        <html lang="zh-CN">
                        <head>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <title>${title}</title>
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
                        <body>${bodyHtml}</body></html>`;
    }

    function normalizeVideoPost(post) {
        const url = POST_TYPES.video.getFullUrl(post.body.video);
        post.body.html = createHtmlDocument(
            post.title,
            `<h1>${post.title}</h1><p><a href="${url}" target="_blank">${url}</a></p><p>${post.body.text}</p>`
        );
        post.body.text = '';
    }

    function normalizeArticlePost(post) {
        const { body } = post;
        appendArticleImages(body);
        appendArticleFiles(body);

        let articleHtml = '';
        if (post.coverImageUrl) {
            articleHtml += `<p><img src="${post.coverImageUrl}" alt=""/></p>`;
        }
        articleHtml += `<h1>${post.title}</h1>`;
        articleHtml += body.blocks.map(block => renderArticleBlock(block, body)).join('');
        body.html = createHtmlDocument(post.title, articleHtml);
    }

    function appendArticleImages(body) {
        let index = body.images.length;
        const imageMap = body.imageMap;
        const indexWidth = String(index + Object.keys(imageMap).length).length;
        for (const key in imageMap) {
            const image = imageMap[key];
            const number = String(index + 1).padStart(indexWidth, '0');
            body.images.push({ ...image, id: `${number}_${image.id}`, rawId: image.id });
            index += 1;
        }
    }

    function appendArticleFiles(body) {
        for (const key in body.fileMap) {
            const file = body.fileMap[key];
            body.files.push({ ...file, rawId: file.id });
        }
    }

    function renderArticleBlock(block, body) {
        switch (block.type) {
            case 'p':
                return `<p>${block.text}</p>`;
            case 'header':
                return `<h2>${block.text}</h2>`;
            case 'image': {
                const image = body.images.find(item => item.rawId === block.imageId);
                return `<p><img src="./${image.id}.${image.extension}" alt="${image.id}"></p>`;
            }
            case 'file': {
                const file = body.files.find(item => item.rawId === block.fileId);
                const filename = `${file.name}.${file.extension}`;
                return `<p><a href="./${filename}" download="${filename}">${filename}</a></p>`;
            }
            case 'embed': {
                const url = POST_TYPES.video.getFullUrl(body.embedMap[block.embedId]);
                return url
                    ? `<p><a href="${url}" target="_blank">${url}</a></p>`
                    : `<p>${JSON.stringify(block)}</p>`;
            }
            case 'url_embed': {
                const embed = body.urlEmbedMap[block.urlEmbedId];
                if (embed.type.startsWith('html')) {
                    return `<p class="iframely-responsive">${embed.html}</p>`;
                }
                if (embed.type === 'default') {
                    return `<p><a src="${embed.url}">${embed.host}</a></p>`;
                }
                return `<p>${JSON.stringify(block)}</p>`;
            }
            default:
                return `<p>${JSON.stringify(block)}</p>`;
        }
    }

    function formatDate(dateValue) {
        const date = new Date(dateValue);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    async function formatPath(pathFormat, post, item) {
        const illegalCharacters = /[\\/:*?"<>|]/g;
        const creator = await getCreatorInfo();
        return pathFormat
            .replace('{postId}', post.id)
            .replace('{title}', post.title.replace(illegalCharacters, '_'))
            .replace('{filename}', `${item.name}.${item.extension}`.replace(illegalCharacters, '_'))
            .replace('{creatorId}', creator.creatorId.replace(illegalCharacters, '_'))
            .replace('{nickname}', creator.nickname.replace(illegalCharacters, '_'))
            .replace('{publishedDate}', formatDate(post.publishedDatetime))
            .replace('{updatedDate}', formatDate(post.updatedDatetime))
            .replace('{publishedDatetime}', formatDate(post.publishedDatetime))
            .replace('{updatedDatetime}', formatDate(post.updatedDatetime));
    }

    async function buildDownloadQueues(posts, pathFormat) {
        const files = [];
        const covers = [];
        const texts = [];
        const creator = await getCreatorInfo();

        for (const post of posts) {
            for (const image of post.body.images || []) {
                files.push(await createRemoteDownload(post, image.originalUrl, image, pathFormat));
            }
            for (const file of post.body.files || []) {
                files.push(await createRemoteDownload(post, file.url, file, pathFormat));
            }
            if (post.body.cover) {
                const cover = post.body.cover;
                covers.push(await createRemoteDownload(post, cover.originalUrl, cover, pathFormat));
            }
            if (post.body.text) {
                texts.push(await createTextDownload(post, post.body.text, 'txt', pathFormat));
            }
            if (post.body.html) {
                texts.push(await createTextDownload(post, post.body.html, 'html', pathFormat));
            }

            texts.push({
                title: post.title,
                filename: await formatPath(pathFormat, post, { name: post.title, extension: 'url' }),
                text: `[InternetShortcut]\nURL=${creator.baseUrl}/posts/${post.id}`,
                publishedDatetime: post.publishedDatetime
            });
        }
        return { files, covers, texts };
    }

    async function createRemoteDownload(post, url, item, pathFormat) {
        return {
            title: post.title,
            filename: await formatPath(pathFormat, post, {
                name: item.name ?? item.id,
                extension: item.extension
            }),
            url,
            publishedDatetime: post.publishedDatetime
        };
    }

    async function createTextDownload(post, text, extension, pathFormat) {
        return {
            title: post.title,
            filename: await formatPath(pathFormat, post, { name: post.title, extension }),
            text,
            publishedDatetime: post.publishedDatetime
        };
    }

    function createUniqueFilename(filename, usedFilenames) {
        let uniqueFilename = filename;
        let counter = 1;
        while (usedFilenames.has(uniqueFilename)) {
            const extensionIndex = filename.lastIndexOf('.');
            const basename = filename.substring(0, extensionIndex);
            const extension = filename.substring(extensionIndex);
            uniqueFilename = `${basename}(${counter})${extension}`;
            counter += 1;
        }
        usedFilenames.add(uniqueFilename);
        return uniqueFilename;
    }

    async function downloadPosts(selectedPosts, pathFormat = DEFAULT_PATH_FORMAT) {
        function warnBeforeUnload(event) {
            event.preventDefault();
            event.returnValue = '文件可能还没下载完成，确认要离开吗？';
        }

        unsafeWindow.addEventListener('beforeunload', warnBeforeUnload);

        const startTime = new Date();
        const queue = await buildDownloadQueues(selectedPosts, pathFormat);
        const totalFiles = queue.files.length + queue.covers.length + queue.texts.length;
        const usedFilenames = new Set();
        const failedFiles = [];
        let totalDownloadedSize = 0;
        let isCancelled = false;

        console.log(`开始下载 ${totalFiles} 个文件`);

        const progressDialog = await createDownloadProgressDialog(totalFiles, startTime, () => {
            isCancelled = true;
        });
        const zipWriter = new zip.ZipWriter(new zip.BlobWriter('application/zip'));

        const context = {
            get isCancelled() { return isCancelled; },
            startTime,
            usedFilenames,
            failedFiles,
            progressDialog,
            get totalDownloadedSize() { return totalDownloadedSize; },
            addDownloadedSize(size) { totalDownloadedSize += size; }
        };

        await processRemoteDownloads(queue.files, zipWriter, context);
        if (!isCancelled) await processCoverDownloads(queue.covers, zipWriter, context);
        if (!isCancelled) await processTextDownloads(queue.texts, zipWriter, context);

        if (isCancelled) {
            console.log('下载已取消');
            progressDialog.close();
            unsafeWindow.removeEventListener('beforeunload', warnBeforeUnload);
            return;
        }

        console.log(`${queue.files.length + queue.texts.length} 个文件下载完成`);
        console.log('开始生成压缩包', zipWriter);
        const zipBlob = await zipWriter.close().catch(error => console.error(error));
        console.log(`压缩包生成完成，开始下载，压缩包大小:${formatSize(zipBlob.size)}`);

        progressDialog.updateTitle('下载完成');
        progressDialog.updateTotalSize(totalDownloadedSize, formatSize(zipBlob.size));
        progressDialog.stopElapsedTime();
        progressDialog.updateFailedFiles(failedFiles);
        progressDialog.updateConfirmButton(() => {
            progressDialog.close();
            unsafeWindow.removeEventListener('beforeunload', warnBeforeUnload);
        });
        progressDialog.addSaveButton(async () => {
            saveBlob(zipBlob, `${(await getCreatorInfo()).nickname}.zip`);
        });
        saveBlob(zipBlob, `${(await getCreatorInfo()).nickname}.zip`);
    }

    async function processRemoteDownloads(files, zipWriter, context) {
        for (const file of files) {
            if (context.isCancelled) break;
            await retryDownload(file, context, async () => {
                const response = await GM.xmlHttpRequest({
                    url: file.url,
                    responseType: 'blob',
                    onprogress: event => {
                        if (context.isCancelled) throw new Error('下载已取消');
                        if (!event.lengthComputable) return;
                        context.progressDialog.updateFileProgress(event.loaded, event.total);
                        const elapsedSeconds = (new Date() - context.startTime) / 1000;
                        const speed = (context.totalDownloadedSize + event.loaded) / elapsedSeconds;
                        context.progressDialog.updateSpeed(speed);
                    },
                    onerror: error => {
                        console.error(error);
                        throw error;
                    }
                });
                const blob = response.response;
                if (!blob?.size) throw new Error('文件大小为0');
                await addBlobToZip(file, blob, zipWriter, context);
            });
        }
    }

    async function processCoverDownloads(covers, zipWriter, context) {
        for (const cover of covers) {
            if (context.isCancelled) break;
            await retryDownload(cover, context, async () => {
                context.progressDialog.updateFileProgress(0, 0);
                const response = await fetch(cover.url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const blob = await response.blob();
                if (!blob.size) throw new Error('文件大小为0');
                context.progressDialog.updateFileProgress(blob.size, blob.size);
                await addBlobToZip(cover, blob, zipWriter, context);
            });
        }
    }

    async function retryDownload(file, context, operation) {
        let attempts = 0;
        while (attempts < MAX_DOWNLOAD_ATTEMPTS) {
            try {
                await operation();
                return;
            } catch (error) {
                attempts += 1;
                console.error(`${file.title}:${file.filename} 下载失败，重试第 ${attempts} 次`, error);
                if (attempts >= MAX_DOWNLOAD_ATTEMPTS) {
                    context.failedFiles.push({
                        filename: file.filename,
                        error: getErrorMessage(error),
                        url: file.url
                    });
                    context.progressDialog.updateFailedFiles(context.failedFiles);
                }
                await sleep(1000 * attempts);
            }
        }
    }

    async function addBlobToZip(file, blob, zipWriter, context) {
        context.addDownloadedSize(blob.size);
        context.progressDialog.updateTotalSize(context.totalDownloadedSize);
        const filename = createUniqueFilename(file.filename, context.usedFilenames);
        console.log(`${file.title}:${filename} 下载成功，文件大小 ${formatSize(blob.size)}`);
        await zipWriter.add(filename, new zip.BlobReader(blob));
        context.progressDialog.updateTotalProgress();
    }

    async function processTextDownloads(texts, zipWriter, context) {
        for (const textFile of texts) {
            if (context.isCancelled) break;
            try {
                const filename = createUniqueFilename(textFile.filename, context.usedFilenames);
                console.log(
                    `${textFile.title}:${textFile.filename} 下载成功，文件大小 ${formatSize(textFile.text.length)}`
                );
                context.addDownloadedSize(textFile.text.length);
                context.progressDialog.updateTotalSize(context.totalDownloadedSize);
                await zipWriter.add(filename, new zip.TextReader(textFile.text));
                context.progressDialog.updateTotalProgress();
            } catch (error) {
                console.error(`${textFile.title}:${textFile.filename} 下载失败`, error);
                context.failedFiles.push({
                    filename: textFile.filename,
                    error: getErrorMessage(error)
                });
                context.progressDialog.updateFailedFiles(context.failedFiles);
            }
        }
    }

    function saveBlob(blob, filename) {
        const fileStream = streamSaver.createWriteStream(filename, { size: blob.size });
        const readableStream = blob.stream();
        if (window.WritableStream && readableStream.pipeTo) {
            return readableStream.pipeTo(fileStream)
                .then(() => showMessage('下载完成', '下载结束，请查看下载目录'));
        }

        const streamWriter = fileStream.getWriter();
        const reader = readableStream.getReader();
        const pump = () => reader.read().then(result => (
            result.done
                ? streamWriter.close()
                : streamWriter.write(result.value).then(pump)
        ));
        return pump();
    }

    async function createDownloadProgressDialog(totalFiles, startTime, onCancel) {
        const window = await openDialog('download', '50vw', '50vh', '下载进度', { closeOnBackdropClick: false, closeOnEscape: false });
        const dialog = createElement('div', {
            styles: {
                backgroundColor: 'white',
                padding: '20px',
                fontFamily: 'Arial, sans-serif',
                textAlign: 'center',
                overflowY: 'auto',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box'
            }
        });
        const title = createElement('h2', { text: '下载进度', styles: { marginBottom: '20px' } });
        const totalProgress = createElement('p', {
            text: `总进度: 0/${totalFiles}`,
            styles: { marginBottom: '10px' }
        });
        const fileProgress = createElement('p', {
            text: '当前文件进度: 0B/0B',
            styles: { marginBottom: '10px' }
        });
        const totalSize = createElement('p', { text: '总大小: 0B', styles: { marginBottom: '10px' } });
        const startTimeElement = createElement('p', {
            text: `开始时间: ${startTime.toLocaleTimeString()}`,
            styles: { marginBottom: '10px' }
        });
        const elapsedTimeElement = createElement('p', {
            text: '已运行时间: 0秒',
            styles: { marginBottom: '10px' }
        });
        const speedElement = createElement('p', {
            text: '下载速度: 0B/s',
            styles: { marginBottom: '10px' }
        });
        const confirmButton = createButton('取消', {
            color: COLORS.danger,
            hoverColor: COLORS.dangerHover,
            onClick: () => { if (onCancel) onCancel(); }
        });
        const failedFilesTitle = createElement('h3', {
            text: '下载失败的文件',
            styles: { marginTop: '20px' }
        });
        const { table: failedFilesTable, body: failedFilesBody } = createFailedFilesTable();

        appendChildren(
            dialog,
            title,
            totalProgress,
            fileProgress,
            totalSize,
            startTimeElement,
            elapsedTimeElement,
            speedElement,
            confirmButton,
            failedFilesTitle,
            failedFilesTable
        );
        window.content.appendChild(dialog);
        window.show();

        let completedFiles = 0;
        const intervalId = setInterval(() => {
            elapsedTimeElement.innerText = `已运行时间: ${formatElapsedTime(startTime)}`;
        }, 1000);

        return {
            updateTitle(newTitle) {
                title.innerText = newTitle;
            },
            updateTotalProgress() {
                completedFiles += 1;
                totalProgress.innerText = `总进度: ${completedFiles}/${totalFiles}`;
            },
            updateFileProgress(loaded, total) {
                fileProgress.innerText = `当前文件进度: ${formatSize(loaded)}/${formatSize(total)}`;
            },
            updateTotalSize(size, zipSize) {
                totalSize.innerText = zipSize
                    ? `总大小: ${formatSize(size)} (压缩包大小: ${zipSize})`
                    : `总大小: ${formatSize(size)}`;
                const elapsedSeconds = (new Date() - startTime) / 1000;
                speedElement.innerText = `下载速度: ${formatSize(size / elapsedSeconds)}/s`;
            },
            updateSpeed(speed) {
                speedElement.innerText = `下载速度: ${formatSize(speed)}/s`;
            },
            updateFailedFiles(failedFiles) {
                renderFailedFiles(failedFilesBody, failedFiles);
            },
            updateConfirmButton(onConfirm) {
                confirmButton.innerText = '确认';
                confirmButton.onmouseover = () => { confirmButton.style.backgroundColor = COLORS.primaryHover; };
                confirmButton.onmouseout = () => { confirmButton.style.backgroundColor = COLORS.primary; };
                confirmButton.style.backgroundColor = COLORS.primary;
                confirmButton.onclick = onConfirm;
            },
            addSaveButton(onSave) {
                const saveButton = createButton('重新保存', {
                    color: COLORS.success,
                    hoverColor: COLORS.successHover,
                    onClick: onSave
                });
                confirmButton.parentNode.insertBefore(saveButton, confirmButton.nextSibling);
            },
            stopElapsedTime() {
                clearInterval(intervalId);
            },
            close() {
                clearInterval(intervalId);
                window.close();
            }
        };
    }

    function createFailedFilesTable() {
        const table = createElement('table', {
            styles: { width: '100%', borderCollapse: 'collapse', marginBottom: '10px' }
        });
        const header = document.createElement('tr');
        const columns = [
            ['序号', '10%'],
            ['文件名', '35%'],
            ['原因', '35%'],
            ['下载URL', '20%']
        ];
        for (const [name, width] of columns) {
            header.appendChild(createElement('th', {
                text: name,
                styles: { border: '1px solid #ccc', padding: '5px', width }
            }));
        }
        const body = document.createElement('tbody');
        table.append(header, body);
        renderFailedFiles(body, []);
        return { table, body };
    }

    function renderFailedFiles(tableBody, failedFiles) {
        tableBody.replaceChildren();
        if (failedFiles.length === 0) {
            const row = document.createElement('tr');
            const cell = createElement('td', {
                text: '无',
                styles: { border: '1px solid #ccc', padding: '5px' }
            });
            cell.colSpan = 4;
            row.appendChild(cell);
            tableBody.appendChild(row);
            return;
        }

        failedFiles.forEach((file, index) => {
            const row = document.createElement('tr');
            row.appendChild(createTableCell(index + 1));
            row.appendChild(createTableCell(file.filename));
            row.appendChild(createTableCell(file.error));

            const urlCell = createTableCell();
            const link = createElement('a', { text: '下载' });
            link.href = file.url;
            link.target = '_blank';
            link.download = file.filename;
            urlCell.appendChild(link);
            row.appendChild(urlCell);
            tableBody.appendChild(row);
        });
    }

    function createTableCell(text) {
        return createElement('td', {
            text,
            styles: { border: '1px solid #ccc', padding: '5px' }
        });
    }

    function formatElapsedTime(startTime) {
        const elapsedSeconds = Math.floor((new Date() - startTime) / 1000);
        const hours = Math.floor(elapsedSeconds / 3600);
        const minutes = Math.floor((elapsedSeconds % 3600) / 60);
        const seconds = elapsedSeconds % 60;
        return `${hours > 0 ? `${hours}小时` : ''}${minutes > 0 || hours > 0 ? `${minutes}分钟` : ''}${seconds}秒`;
    }

    async function createPostFetchProgress(queryLimit, onCancel) {
        const window = await openDialog('fetch', 390, 120, '正在查询投稿', { closeOnBackdropClick: false, closeOnEscape: false });
        const progress = createElement('aside', {
            styles: {
                padding: '14px 16px',
                backgroundColor: '#202124',
                color: '#fff',
                fontFamily: 'Arial, Microsoft YaHei, sans-serif',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box'
            }
        });
        const copy = createElement('div', { styles: { flexGrow: '1', minWidth: '0' } });
        const title = createElement('div', { text: '正在查询投稿', styles: { fontWeight: '700', fontSize: '14px' } });
        const detail = createElement('div', {
            text: `已查询 0/${queryLimit ?? '不限'} 篇 · 可见 0 · 不可见 0`,
            styles: { marginTop: '4px', color: '#c7cbd1', fontSize: '12px' }
        });
        const cancel = createButton('取消', {
            color: 'transparent',
            hoverColor: '#3b4047',
            styles: { border: '1px solid #72777d', flexShrink: '0' },
            onClick: onCancel
        });
        const row = createElement('div', { styles: { display: 'flex', alignItems: 'center', gap: '12px' } });
        appendChildren(copy, title, detail);
        appendChildren(row, copy, cancel);
        progress.appendChild(row);
        window.content.appendChild(progress);
        window.show();
        return {
            update({ requested, accessible, inaccessible }) {
                detail.innerText = `已查询 ${requested}/${queryLimit ?? '不限'} 篇 · 可见 ${accessible} · 不可见 ${inaccessible}`;
            },
            close() {
                window.close();
            }
        };
    }

    async function createQuerySettingsDialog(forceRefresh = false) {
        const window = await openDialog('query', 420, 310, '查询投稿');
        const dialog = createElement('form', {
            styles: {
                padding: '20px',
                backgroundColor: '#fff',
                fontFamily: 'Arial, Microsoft YaHei, sans-serif',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box'
            }
        });
        dialog.id = 'fanbox-query-settings';
        const title = createElement('h2', { text: '查询投稿', styles: { margin: '0 0 6px', fontSize: '18px' } });
        const description = createElement('p', {
            text: '可按需限制本次查询的最新投稿数量。留空将查询全部可追溯投稿。',
            styles: { margin: '0 0 18px', color: '#667085', fontSize: '13px', lineHeight: '1.5' }
        });
        const label = createElement('label', {
            text: '最大查询投稿数',
            styles: { display: 'block', marginBottom: '6px', color: '#344054', fontSize: '13px', fontWeight: '700' }
        });
        const input = createElement('input', {
            styles: { width: '260px', maxWidth: '100%', boxSizing: 'border-box', height: '36px', padding: '0 10px', border: '1px solid #b9c0c9', borderRadius: '4px', fontSize: '14px' }
        });
        input.type = 'number';
        input.min = '1';
        input.step = '1';
        input.inputMode = 'numeric';
        input.placeholder = '留空为不限制';
        input.value = GM_getValue(QUERY_LIMIT_STORAGE_KEY, '');
        const hint = createElement('p', { styles: { minHeight: '18px', margin: '6px 0 16px', color: '#667085', fontSize: '12px' } });
        const actions = createElement('div', { styles: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } });
        const cancel = createButton('取消', {
            color: '#fff',
            hoverColor: '#f2f4f7',
            styles: { color: '#344054', border: '1px solid #aeb7c2' },
            onClick: window.close
        });
        cancel.type = 'button';
        const submit = createButton(forceRefresh ? '重新获取' : '开始查询', { styles: { padding: '6px 14px' } });
        appendChildren(actions, cancel, submit);
        appendChildren(dialog, title, description, label, input, hint, actions);
        dialog.addEventListener('submit', event => {
            event.preventDefault();
            const value = input.value.trim();
            const queryLimit = normalizeQueryLimit(value);
            if (value && queryLimit === null) {
                hint.innerText = '请输入大于 0 的整数，或清空输入框以不限制。';
                hint.style.color = COLORS.danger;
                input.focus();
                return;
            }
            GM_setValue(QUERY_LIMIT_STORAGE_KEY, value);
            window.close();
            main({ queryLimit, forceRefresh });
        });
        window.content.appendChild(dialog);
        window.show();
        input.focus();
    }

    function updatePostVisibility(dialog) {
        const query = dialog.dataset.searchQuery || '';
        let visible = 0;
        dialog.querySelectorAll('.post-element').forEach(card => {
            const isInaccessible = card.dataset.accessible !== 'true';
            const matchesSearch = !query || card.dataset.search.includes(query);
            const shouldHide = !matchesSearch || (isInaccessible && dialog.dataset.showInaccessible !== 'true');
            card.hidden = shouldHide;
            card.style.display = shouldHide ? 'none' : 'flex';
            card.setAttribute('aria-hidden', String(shouldHide));
            if (!shouldHide) visible += 1;
        });
        const searchCount = dialog.querySelector('.fanbox-search-count');
        if (searchCount) searchCount.innerText = query ? `匹配 ${visible} 项` : `${visible} 项`;
        return visible;
    }

    async function createResultDialog(posts, planCounts) {
        const window = await openDialog('results', '94vw', '94vh', '投稿查询结果');
        const totalPosts = planCounts['-2'].count;
        const accessiblePosts = posts.filter(post => post.isAccessible).length;
        const queriedLabel = state.queryLimit === null
            ? `已查询 ${totalPosts} 篇`
            : `已查询 ${totalPosts}/${state.queryLimit} 篇`;
        const dialog = createElement('div', {
            styles: {
                backgroundColor: '#f6f8fa',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: 'Arial, Microsoft YaHei, sans-serif',
                width: '100%',
                height: '100%',
                boxSizing: 'border-box'
            }
        });

        const title = createElement('h2', {
            text: `投稿查询结果 0/${accessiblePosts} 可下载 · ${queriedLabel}`,
            styles: { margin: '0', fontSize: '18px' }
        });
        const header = createResultHeader(window, title);
        dialog.dataset.searchQuery = '';
        dialog.dataset.showInaccessible = 'false';
        const planSummary = createPlanSummary(dialog, posts, planCounts, updateTitle);
        const controls = createResultControls(dialog, posts, updateTitle);
        const content = createElement('div', {
            styles: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                gap: '12px',
                padding: '16px 20px 22px',
                flexGrow: '1',
                overflowY: 'auto',
                alignContent: 'start'
            }
        });

        posts.forEach((post, index) => content.appendChild(createPostCard(post, index, updateTitle)));
        appendChildren(dialog, header, planSummary, controls, content);
        window.content.appendChild(dialog);
        updatePostVisibility(dialog);
        window.show();

        function updateTitle() {
            const selectedCount = dialog.querySelectorAll('.post-element input[type="checkbox"]:checked').length;
            title.innerText = `投稿查询结果 ${selectedCount}/${accessiblePosts} 可下载 · ${queriedLabel}`;
        }
    }

    function createResultHeader(window, title) {
        const header = createElement('div', {
            styles: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 20px',
                backgroundColor: '#fff',
                borderBottom: '1px solid #d8dee4'
            }
        });
        const buttonGroup = createElement('div', { styles: { display: 'flex', gap: '10px' } });
        const refreshButton = createButton('重新获取', {
            onClick: async () => {
                window.close();
                createQuerySettingsDialog(true);
            }
        });
        const closeButton = createButton('关闭', {
            color: COLORS.danger,
            hoverColor: COLORS.dangerHover,
            onClick: window.close
        });
        appendChildren(buttonGroup, refreshButton, closeButton);
        return appendChildren(header, title, buttonGroup);
    }

    function createPlanSummary(dialog, posts, planCounts, updateTitle) {
        const summaryHtml = Object.entries(planCounts)
            .sort(([firstFee], [secondFee]) => firstFee - secondFee)
            .map(([fee, plan]) => {
                if (fee === '-2') return `${plan.title}: ${plan.count} 个`;
                const color = plan.visible ? 'green' : 'red';
                if (fee === '-1') {
                    return `<span style="color: ${color};">${plan.title}: ${plan.count} 个</span>`;
                }
                return `<button class="plan-fee-btn" data-fee="${plan.fee}" style="color:white;background-color:${color};border:none;border-radius:5px;padding:2px 8px;cursor:pointer;margin:0 2px;">${plan.title} 档位(${plan.fee} 日元): ${plan.count} 个</button>`;
            })
            .join(' | ');
        const summary = createElement('p', {
            html: `各档位投稿数量: ${summaryHtml}`,
            styles: { margin: '0', padding: '10px 20px', backgroundColor: '#fff', borderBottom: '1px solid #e2e6ea', fontSize: '13px' }
        });
        const inaccessibleCount = posts.filter(post => !post.isAccessible).length;
        if (inaccessibleCount > 0) {
            const unavailableLabel = createElement('label', {
                styles: { display: 'inline-flex', alignItems: 'center', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid #d0d7de', color: '#667085', cursor: 'pointer' }
            });
            const unavailableToggle = createElement('input', { styles: { margin: '0 6px 0 0' } });
            unavailableToggle.type = 'checkbox';
            unavailableToggle.addEventListener('change', () => {
                dialog.dataset.showInaccessible = unavailableToggle.checked ? 'true' : 'false';
                updatePostVisibility(dialog);
            });
            appendChildren(unavailableLabel, unavailableToggle, document.createTextNode(`显示不可见投稿 (${inaccessibleCount})`));
            summary.appendChild(unavailableLabel);
        }

        summary.addEventListener('click', event => {
            if (!event.target.classList.contains('plan-fee-btn')) return;
            const fee = Number(event.target.dataset.fee);
            const checkboxes = dialog.querySelectorAll('.post-element input[type="checkbox"]');
            const postElements = dialog.querySelectorAll('.post-element');
            let allChecked = true;

            checkboxes.forEach(checkbox => {
                if (checkbox.disabled) return;
                if (posts[checkbox.dataset.index].minFeeRequired === fee && !checkbox.checked) {
                    allChecked = false;
                }
            });
            checkboxes.forEach((checkbox, index) => {
                if (checkbox.disabled) return;
                if (posts[checkbox.dataset.index].minFeeRequired !== fee) return;
                checkbox.checked = !allChecked;
                postElements[index].style.backgroundColor = checkbox.checked ? '#eaf2ff' : '#fff';
            });
            updateTitle();
        });
        return summary;
    }

    function createResultControls(dialog, posts, updateTitle) {
        const controls = createElement('div', {
            styles: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '10px 20px',
                backgroundColor: '#fff',
                borderBottom: '1px solid #e2e6ea'
            }
        });
        const leftControls = createElement('div', {
            styles: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }
        });
        const search = createElement('input', {
            styles: { width: '210px', height: '34px', padding: '0 10px', border: '1px solid #b9c0c9', borderRadius: '4px', fontSize: '13px' }
        });
        search.type = 'search';
        search.placeholder = '搜索投稿标题或内容';
        const accessibleCount = posts.filter(post => post.isAccessible).length;
        const searchCount = createElement('span', { className: 'fanbox-search-count', text: `${accessibleCount} 项`, styles: { color: '#667085', fontSize: '12px' } });
        search.addEventListener('input', () => {
            dialog.dataset.searchQuery = search.value.trim().toLocaleLowerCase();
            updatePostVisibility(dialog);
        });
        const selectAllButton = createButton('全选可见');
        selectAllButton.onclick = () => {
            const postElements = [...dialog.querySelectorAll('.post-element')]
                .filter(card => !card.hidden && !card.querySelector('input[type="checkbox"]').disabled);
            const shouldSelect = postElements.some(card => !card.querySelector('input[type="checkbox"]').checked);
            postElements.forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.checked = shouldSelect;
                card.style.backgroundColor = shouldSelect ? '#eaf2ff' : '#fff';
            });
            selectAllButton.innerText = shouldSelect ? '取消全选可见' : '全选可见';
            updateTitle();
        };

        const downloadButton = createButton('下载选中', {
            onClick: async () => {
                const selectedPosts = Array.from(
                    dialog.querySelectorAll('.post-element input[type="checkbox"]:checked'),
                    checkbox => posts[checkbox.dataset.index]
                );
                if (selectedPosts.length === 0) {
                    await showMessage('无法开始下载', '请先选择要下载的投稿项');
                    return;
                }
                const pathFormat = dialog.querySelector('input[type="text"]').value || DEFAULT_PATH_FORMAT;
                await downloadPosts(selectedPosts, pathFormat).catch(error => console.error(error));
            }
        });
        appendChildren(leftControls, search, searchCount, selectAllButton, downloadButton);

        const rightControls = createPathFormatControls();
        return appendChildren(controls, leftControls, rightControls);
    }

    function createPathFormatControls() {
        const controls = createElement('div', {
            styles: { display: 'flex', alignItems: 'center' }
        });
        const label = createElement('label', {
            text: '下载路径格式 (可用参数: {postId}, {creatorId}, {nickname}, {title}, {filename}, {publishedDate}, {updatedDate}):',
            styles: { display: 'block', marginBottom: '5px' }
        });
        const input = createElement('input', {
            styles: { width: '200px', padding: '5px', fontSize: '14px' }
        });
        input.type = 'text';
        input.placeholder = '下载路径格式';
        input.value = GM_getValue(PATH_FORMAT_STORAGE_KEY, DEFAULT_PATH_FORMAT);
        input.onchange = () => GM_setValue(PATH_FORMAT_STORAGE_KEY, input.value);

        const resetButton = createButton('重置', {
            styles: { marginLeft: '10px' },
            onClick: () => {
                input.value = DEFAULT_PATH_FORMAT;
                GM_setValue(PATH_FORMAT_STORAGE_KEY, DEFAULT_PATH_FORMAT);
            }
        });
        return appendChildren(controls, label, input, resetButton);
    }

    function createPostCard(post, index, updateTitle) {
        const isAccessible = post.isAccessible;
        const card = createElement('div', {
            className: 'post-element',
            styles: {
                border: isAccessible ? '1px solid #d8dee4' : '1px dashed #c8ced6',
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: isAccessible ? '#fff' : '#f2f4f7',
                color: isAccessible ? '#202124' : '#98a2b3',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                justifyContent: 'space-between',
                height: '270px',
                boxShadow: isAccessible ? '0 1px 2px rgba(0, 0, 0, 0.05)' : 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
            }
        });
        card.dataset.accessible = String(isAccessible);
        card.hidden = !isAccessible;
        card.dataset.search = `${post.title} ${POST_TYPES[post.type]?.name || post.type} ${getPostPreviewText(post)}`.toLocaleLowerCase();
        if (isAccessible) {
            card.onmouseover = () => { card.style.borderColor = '#6b96d8'; card.style.boxShadow = '0 4px 12px rgba(31, 111, 235, 0.14)'; };
            card.onmouseout = () => { card.style.borderColor = '#d8dee4'; card.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'; };
        }

        const checkbox = createElement('input', { styles: { alignSelf: 'flex-end', marginBottom: '8px' } });
        checkbox.type = 'checkbox';
        checkbox.dataset.index = index;
        checkbox.disabled = !isAccessible;
        if (!isAccessible) checkbox.title = '当前投稿不可见，不能选择下载';
        const updateSelection = () => {
            if (!isAccessible) return;
            card.style.backgroundColor = checkbox.checked ? '#eaf2ff' : '#fff';
            updateTitle();
        };
        checkbox.addEventListener('click', event => event.stopPropagation());
        checkbox.addEventListener('change', updateSelection);

        const title = createSingleLineText('h3', post.title, {
            margin: '0',
            fontSize: '16px',
            minHeight: '20px',
            color: isAccessible ? '#202124' : '#667085'
        });
        const type = createSingleLineText(
            'p',
            `${POST_TYPES[post.type]?.name || post.type} · ${post.minFeeRequired} 日元`,
            { margin: '0', fontSize: '14px', color: isAccessible ? '#555' : '#98a2b3', minHeight: '15px' }
        );

        const body = post.body || {};
        const images = body.images || [];
        const files = body.files || [];
        const coverCount = body.cover ? 1 : 0;
        const mediaCount = createSingleLineText(
            'p',
            `${images.length} 张图片 | ${files.length} 个文件 | ${coverCount} 个封面`,
            { margin: '0', fontSize: '14px', color: isAccessible ? '#555' : '#98a2b3', minHeight: '15px' }
        );
        const publishTime = createSingleLineText(
            'p',
            `发布时间：${new Date(post.publishedDatetime).toLocaleString()}`,
            { margin: '0', fontSize: '14px', color: isAccessible ? '#555' : '#98a2b3', minHeight: '15px' }
        );
        const text = createElement('div', {
            text: isAccessible ? getPostPreviewText(post) : '当前档位不可见，无法选择下载。',
            styles: {
                marginTop: '10px',
                fontSize: '14px',
                color: isAccessible ? '#333' : '#98a2b3',
                overflowY: 'auto',
                overflowX: 'hidden',
                wordBreak: 'break-all',
                flexGrow: '1',
                width: '100%'
            }
        });
        const viewButton = createButton('查看详情', {
            styles: { marginTop: '10px', fontSize: '14px' },
            onClick: async event => {
                event.stopPropagation();
                window.open(`${(await getCreatorInfo()).baseUrl}/posts/${post.id}`, '_blank');
            }
        });

        card.onclick = () => {
            if (!isAccessible) return;
            checkbox.checked = !checkbox.checked;
            updateSelection();
        };
        return appendChildren(card, checkbox, title, type, mediaCount, publishTime, text, viewButton);
    }

    function createSingleLineText(tagName, text, styles) {
        return createElement(tagName, {
            text,
            styles: {
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
                flexShrink: '0',
                textAlign: 'center',
                ...styles
            }
        });
    }

    function getPostPreviewText(post) {
        if (!post.body) return '';
        if (post.body.text) return post.body.text;
        if (!post.body.html) return '';
        const documentFromHtml = new DOMParser().parseFromString(post.body.html, 'text/html');
        return documentFromHtml.body.innerText;
    }

    async function main({ queryLimit = null, forceRefresh = false } = {}) {
        try {
            const currentCreator = await getCreatorInfo(true);
            const shouldFetch = forceRefresh
                || !state.hasLoadedPosts
                || state.postsCreatorId !== currentCreator.creatorId
                || state.queryLimit !== queryLimit;
            if (shouldFetch) {
                const controller = new AbortController();
                const progressBar = await createPostFetchProgress(queryLimit, () => controller.abort());
                try {
                    const result = await fetchAllPosts(progressBar, queryLimit, controller.signal);
                    state.posts = result.posts;
                    state.planCounts = result.planCounts;
                    state.queryLimit = queryLimit;
                    state.hasLoadedPosts = true;
                    state.postsCreatorId = currentCreator.creatorId;
                } finally {
                    progressBar.close();
                }
            }
            await createResultDialog(state.posts, state.planCounts);
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.info('Post query cancelled');
                return;
            }
            console.error('An error occurred in the main process:', error);
            await showMessage('脚本运行出错', `${getErrorMessage(error)}\n请检查控制台以获取详细信息。`);
        }
    }

    GM_registerMenuCommand('查询投稿', () => createQuerySettingsDialog());
}());
