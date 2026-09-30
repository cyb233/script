// ==UserScript==
// @name         Shadow DOM Dialog Utility Example
// @namespace    Schwi
// @version      1.0.3
// @description  Example usage of Shadow DOM Dialog Utility.
// @match        https://example.com/*
// @require      https://update.greasyfork.org/scripts/597988/1947281/Shadow%20DOM%20Dialog%20Utility.js
// @grant        GM_registerMenuCommand
// ==/UserScript==

(async function () {
  'use strict';

  const dialog = await SchwiDialog.createDialog(480, 300, {
    title: 'Shadow DOM 示例',
    closeOnBackdropClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    onclose: () => console.log('示例弹窗已关闭')
  });

  dialog.onshow = () => console.log('示例弹窗已打开');

  const message = document.createElement('p');
  message.textContent = '这个内容位于弹窗的 Shadow DOM 内。';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.addEventListener('click', dialog.close);

  dialog.content.append(message, close);

  GM_registerMenuCommand('打开示例弹窗', () => {
    dialog.show();
  });
})();
