// ==UserScript==
// @name         双击切换密码可见性
// @namespace    Schwi
// @version      1.0.0
// @description  双击密码框，在 password 和 text 类型之间切换
// @author       Schwi
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes
// @supportURL   https://github.com/cyb233/script
// @license      GPL-3.0
// ==/UserScript==

(function () {
  'use strict';

  // 只记录由本脚本切换为 text 的输入框，避免误把普通文本框当成密码框。
  const revealedInputs = new WeakSet();

  const isInputElement = (element) => element instanceof HTMLInputElement;

  const togglePasswordVisibility = (input) => {
    if (!isInputElement(input) || (input.type !== 'password' && !revealedInputs.has(input))) {
      return;
    }

    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const shouldReveal = input.type === 'password';

    input.type = shouldReveal ? 'text' : 'password';

    if (shouldReveal) {
      revealedInputs.add(input);
    } else {
      revealedInputs.delete(input);
    }

    // 修改 type 可能会让光标位置发生变化，恢复用户原来的选区。
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  };

  // 使用事件委托，兼容单页应用和后来动态插入的密码框。
  document.addEventListener('dblclick', (event) => {
    const target = event.target;
    if (isInputElement(target)) {
      togglePasswordVisibility(target);
    }
  }, true);
})();
