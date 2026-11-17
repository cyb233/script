// ==UserScript==
// @name         Shadow DOM Dialog Utility Example
// @namespace    Schwi
// @version      1.0.5
// @description  Example usage of Shadow DOM Dialog Utility.
// @match        *://*/*
// @require      https://update.greasyfork.org/scripts/597988/2001408/Shadow%20DOM%20Dialog%20Utility.js
// @grant        GM_registerMenuCommand
// ==/UserScript==

(async function () {
  'use strict';

  const dialog = await SchwiDialog.createDialog(480, 480, {
    title: 'Shadow DOM 示例',
    closeOnBackdropClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    draggable: true,
    onclose: () => console.log('示例弹窗已关闭')
  });

  dialog.onshow = () => console.log('示例弹窗已打开');

  const message = document.createElement('p');
  message.textContent = '试试下面的表单元素，它们都位于弹窗的 Shadow DOM 内。';

  const form = document.createElement('form');
  form.className = 'demo-form';

  const nameLabel = document.createElement('label');
  nameLabel.textContent = '名称';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = '输入名称';
  nameInput.required = true;
  nameLabel.append(nameInput);

  const typeLabel = document.createElement('label');
  typeLabel.textContent = '类型';
  const typeSelect = document.createElement('select');
  for (const [value, label] of [['text', '文本'], ['image', '图片'], ['link', '链接']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    typeSelect.append(option);
  }
  typeLabel.append(typeSelect);

  const noteLabel = document.createElement('label');
  noteLabel.textContent = '备注';
  const noteInput = document.createElement('textarea');
  noteInput.rows = 2;
  noteInput.placeholder = '可选';
  noteLabel.append(noteInput);

  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'checkbox-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkboxLabel.append(checkbox, ' 置顶显示');

  const result = document.createElement('p');
  result.className = 'demo-result';
  result.setAttribute('role', 'status');

  const actions = document.createElement('div');
  actions.className = 'demo-actions';

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = '预览结果';

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '关闭';
  close.addEventListener('click', dialog.close);

  actions.append(submit, close);
  form.append(nameLabel, typeLabel, noteLabel, checkboxLabel, actions, result);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const type = typeSelect.selectedOptions[0].textContent;
    const note = noteInput.value.trim();
    result.textContent = `${nameInput.value.trim()} · ${type}${checkbox.checked ? ' · 置顶' : ''}${note ? ` · ${note}` : ''}`;
  });

  dialog.content.append(message, form);
  SchwiDialog.installStyles(dialog.content, `
    .demo-form { display: grid; gap: 12px; }
    .demo-form label:not(.checkbox-label) { display: grid; gap: 5px; font-size: 14px; }
    .demo-form input[type="text"], .demo-form select, .demo-form textarea { width: 100%; min-width: 0; padding: 8px; border: 1px solid #b8bec5; border-radius: 4px; background: #fff; color: #202124; font: inherit; }
    .demo-form textarea { resize: vertical; }
    .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 14px; }
    .demo-actions { display: flex; gap: 8px; }
    .demo-actions button { padding: 8px 12px; border: 1px solid #b8bec5; border-radius: 4px; background: #fff; color: #202124; cursor: pointer; }
    .demo-actions button[type="submit"] { border-color: #1769aa; background: #1769aa; color: #fff; }
    .demo-result { min-height: 1.4em; margin: 0; overflow-wrap: anywhere; font-size: 14px; }
  `, dialog.styleSupport);

  GM_registerMenuCommand('打开示例弹窗', () => {
    dialog.show();
  });
})();
