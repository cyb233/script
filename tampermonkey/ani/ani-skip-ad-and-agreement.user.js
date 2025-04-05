// ==UserScript==
// @name         动画疯跳过广告和年龄确认
// @namespace    Schwi
// @version      0.2
// @description  巴哈姆特动画疯跳过广告和年龄确认
// @author       Schwi
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @icon         https://i2.bahamut.com.tw/favicon.svg
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @noframes
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  const defaultConfig = {
    debug: false,
    skipAgreement: true,
    skipAd: true,
    clickNext: false,
  };

  const config = GM_getValue('config', defaultConfig)

  const menuIds = [];
  const resetMenus = () => {
    menuIds.forEach((id) => {
      GM_unregisterMenuCommand(id);
    });
    menuIds.length = 0;
    menuIds.push(
      GM_registerMenuCommand(`跳过年龄确认：${config.skipAgreement ? '开' : '关'}`, () => {
        config.skipAgreement = !config.skipAgreement;
        GM_setValue('config', config);
        resetMenus();
      }),
      GM_registerMenuCommand(`跳过广告：${config.skipAd ? '开' : '关'}`, () => {
        config.skipAd = !config.skipAd;
        GM_setValue('config', config);
        resetMenus();
      }),
      GM_registerMenuCommand(`自动下一集：${config.clickNext ? '开' : '关'}`, () => {
        config.clickNext = !config.clickNext;
        GM_setValue('config', config);
        resetMenus();
      })
    )
  }

  resetMenus();


  let accSkipped = false;
  let adSkipped = false;
  let userMuted = null;
  let adMuted = false;

  const skipAgreement = () => {
    const accAgreement = document.querySelector('#adult');
    if (accAgreement) {
      console.log('跳过年龄确认');
      accAgreement.click();
      accSkipped = true;
    }
  };

  const skipAd = (video) => {
    const adSkipButton = document.querySelector('#adSkipButton.vast-skip-button');
    if (adSkipButton) {
      if (adSkipButton.classList.contains('enable')) {
        console.log('跳过广告');
        adSkipButton.click();
        adSkipped = true;
      } else if (!adMuted) {
        console.debug('广告未跳过，静音广告');
        video.muted = true;
        adMuted = true;
      }
    }
  };

  const restoreMuteStatus = (video) => {
    if (userMuted !== null) {
      console.log('恢复用户静音状态');
      video.muted = !!userMuted;
      userMuted = null;
      adSkipped = false;
      adMuted = false;
    }
  };

  const nextEpisode = (video) => {
    const nextButton = document.querySelector('#nextEpisode');
    if (nextButton) {
      if (video.ended) {
        console.log('点击下一集');
        nextButton.click();
      } else {
        console.debug('视频未结束，等待下一集');
      }
    } else {
      console.debug('未找到下一集按钮');
    }
  };

  const interval = setInterval(() => {
    const video = document.querySelector('#ani_video_html5_api');
    if (!video) {
      console.debug('未找到视频元素');
      return;
    }

    // 记录用户初始静音状态
    if (userMuted === null) {
      console.debug('记录用户初始静音状态:', video.muted);
      userMuted = video.muted;
    }

    // 根据配置：跳过年龄确认
    if (config.skipAgreement && !accSkipped) {
      skipAgreement();
    }

    // 根据配置：跳过广告
    if (config.skipAd) {
      skipAd(video);
    }

    if (adSkipped) {
      restoreMuteStatus(video);
    }

    // 根据配置：自动下一集
    if (config.clickNext) {
      nextEpisode(video);
    }
  }, 1000);
})();