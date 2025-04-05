// ==UserScript==
// @name         动画疯跳过广告和年龄确认
// @namespace    Schwi
// @version      0.1
// @description  巴哈姆特动画疯跳过广告和年龄确认
// @author       Schwi
// @match        https://ani.gamer.com.tw/animeVideo.php?sn=*
// @icon         https://i2.bahamut.com.tw/favicon.svg
// @grant        none
// @noframes
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

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

  const interval = setInterval(() => {
    const video = document.querySelector('#ani_video_html5_api');
    if (!video) {
      console.debug('未找到视频元素');
      return;
    }

    if (userMuted === null) {
      console.debug('记录用户初始静音状态:', video.muted);
      userMuted = video.muted;
    }

    if (!accSkipped) {
      skipAgreement();
    }

    skipAd(video);

    if (adSkipped) {
      restoreMuteStatus(video);
    }

    if (accSkipped) {
      console.debug('年龄确认已跳过，持续检测广告');
      // 不清理定时器，持续检测广告
    }
  }, 1000);
})();