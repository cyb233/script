// ==UserScript==
// @name         Shadow DOM Dialog Utility
// @namespace    Schwi
// @version      1.2.0
// @description  Reusable Shadow DOM dialog utility for Tampermonkey scripts.
// @grant        none
// ==/UserScript==

/**
 * @typedef {Object} DialogWindow
 * @property {HTMLDivElement} content Shadow DOM container for caller content.
 * @property {HTMLDivElement} element The dialog element.
 * @property {() => void} show Show the dialog.
 * @property {() => void} close Close the dialog.
 * @property {(title: string) => void} setTitle Set the dialog title.
 * @property {((dialog: DialogWindow) => void)|null} onshow Called after the dialog is shown.
 * @property {((dialog: DialogWindow) => void)|null} onclose Called after the dialog is closed.
 */

/**
 * @typedef {Object} DialogConfig
 * @property {string} [title] Initial dialog title.
 * @property {boolean} [closeOnBackdropClick=true] Close when the overlay is clicked.
 * @property {boolean} [closeOnEscape=true] Close when Escape is pressed.
 * @property {boolean} [showCloseButton=true] Show the built-in close button.
 * @property {string} [ariaLabel] Accessible label used when no title is set.
 * @property {(dialog: DialogWindow) => void} [onshow] Called after the dialog is shown.
 * @property {(dialog: DialogWindow) => void} [onclose] Called after the dialog is closed.
 */

/**
 * Creates a modal dialog isolated from page styles with a Shadow DOM.
 * @param {number|string} width
 * @param {number|string} height
 * @param {DialogConfig} [config]
 * @returns {Promise<DialogWindow>}
 */
async function createDialog(width, height, config = {}) {
  if (!document.body) {
    await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  }

  const size = value => typeof value === 'number' ? `${value}px` : value;
  const host = document.createElement('div');
  const shadow = host.attachShadow({ mode: 'closed' });
  const overlay = document.createElement('div');
  const dialog = document.createElement('div');
  const header = document.createElement('header');
  const title = document.createElement('span');
  const closeButton = document.createElement('button');
  const content = document.createElement('div');
  const style = document.createElement('style');

  style.textContent = `
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    .overlay { position: fixed; z-index: 2147483647; inset: 0; display: grid; place-items: center; padding: 16px; background: rgb(0 0 0 / 45%); font-family: Arial, "Microsoft YaHei", sans-serif; }
    .dialog { display: flex; flex-direction: column; width: min(${size(width)}, calc(100vw - 32px)); height: min(${size(height)}, calc(100vh - 32px)); overflow: hidden; outline: none; background: #fff; border-radius: 6px; box-shadow: 0 12px 36px rgb(0 0 0 / 35%); color: #202124; }
    .header { display: flex; align-items: center; min-height: 44px; padding: 14px; border-bottom: 1px solid #ddd; font-size: 16px; font-weight: 600; }
    .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .close { width: 44px; height: 44px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 24px; line-height: 1; }
    .close:hover { background: #f2f2f2; }
    .content { flex: 1; min-height: 0; overflow: auto; padding: 14px; }
  `;
  overlay.className = 'overlay';
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  header.className = 'header';
  title.className = 'title';
  closeButton.className = 'close';
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', '关闭');
  content.className = 'content';

  const options = {
    closeOnBackdropClick: true,
    closeOnEscape: true,
    showCloseButton: true,
    ...config
  };

  let dialogWindow;
  const show = () => {
    if (!host.isConnected) {
      document.body.append(host);
      dialog.focus();
      dialogWindow.onshow?.(dialogWindow);
    }
  };
  const close = () => {
    if (!host.isConnected) return;
    host.remove();
    dialogWindow.onclose?.(dialogWindow);
  };
  const setTitle = value => {
    title.textContent = value;
    dialog.setAttribute('aria-label', value);
  };

  closeButton.hidden = !options.showCloseButton;
  if (options.title != null) setTitle(options.title);
  else if (options.ariaLabel != null) dialog.setAttribute('aria-label', options.ariaLabel);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (options.closeOnBackdropClick && event.target === overlay) close();
  });
  dialog.tabIndex = -1;
  dialog.addEventListener('keydown', event => {
    if (options.closeOnEscape && event.key === 'Escape') close();
  });

  header.append(title, closeButton);
  dialog.append(header, content);
  overlay.append(dialog);
  shadow.append(style, overlay);

  dialogWindow = {
    content,
    element: dialog,
    show,
    close,
    setTitle,
    onshow: typeof options.onshow === 'function' ? options.onshow : null,
    onclose: typeof options.onclose === 'function' ? options.onclose : null
  };
  return dialogWindow;
}

// Export one namespaced API so multiple utility scripts do not compete for a
// generic global such as `createDialog`.
globalThis.SchwiDialog = Object.freeze({ createDialog });
