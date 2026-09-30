# Shadow DOM Dialog Utility

一个供其他 Tampermonkey 脚本复用的 Shadow DOM 弹窗工具。弹窗默认不会显示，调用 `show()` 后才会插入页面；调用方可以通过 `content` 填充内容，并通过 `element` 监听事件或添加 class。

## 效果示例
[Shadow DOM Dialog Utility Example](https://greasyfork.org/zh-CN/scripts/598027-shadow-dom-dialog-utility-example)
<img width="1265" height="575" alt="image" src="https://github.com/user-attachments/assets/57ddf8bd-891f-4a5a-9419-104e5233cb60" />

## 引用

在用户脚本头部加入已发布的 `@require`：

```js
// @require      https://update.greasyfork.org/scripts/597988/<version>/Shadow%20DOM%20Dialog%20Utility.js
```
具体各版本require地址应在 [https://greasyfork.org/zh-CN/scripts/597988-shadow-dom-dialog-utility](https://greasyfork.org/zh-CN/scripts/597988-shadow-dom-dialog-utility) 查看

工具加载后通过 `SchwiDialog.createDialog` 使用。使用命名空间可以避免与其他脚本的通用全局变量重名。

## 基本用法

```js
const dialog = await SchwiDialog.createDialog(480, 300, {
  title: '示例弹窗'
});

const text = document.createElement('p');
text.textContent = '这是 Shadow DOM 内的内容。';

const close = document.createElement('button');
close.type = 'button';
close.textContent = '关闭';
close.addEventListener('click', dialog.close);

dialog.content.append(text, close);
dialog.show();
```

完整示例见 [`dialog.example.user.js`](./dialog.example.user.js)。

## API

### `SchwiDialog.createDialog(width, height, config?)`

返回 `Promise<DialogWindow>`。`width` 和 `height` 可以是数字（自动按像素处理），也可以是 CSS 尺寸字符串，例如 `'32rem'` 或 `'80vw'`。

创建完成后弹窗处于隐藏状态，必须主动调用 `show()`。

### `DialogWindow`

| 属性或方法 | 说明 |
| --- | --- |
| `content` | Shadow DOM 内的内容容器（`HTMLDivElement`） |
| `element` | 对话框实际元素（`HTMLDivElement`），可添加 class 或监听事件 |
| `show()` | 显示弹窗；重复调用不会重复插入 |
| `close()` | 关闭并移除弹窗；重复调用不会重复触发关闭事件 |
| `setTitle(title)` | 设置标题及无障碍标签 |
| `onshow` | 显示后的回调，可直接赋值 |
| `onclose` | 关闭后的回调，可直接赋值 |

回调会收到当前 `DialogWindow` 实例：

```js
dialog.onshow = current => console.log('已显示', current);
dialog.onclose = current => console.log('已关闭', current);
```

### `config`

```js
{
  title: '初始标题',
  closeOnBackdropClick: true,
  closeOnEscape: true,
  showCloseButton: true,
  ariaLabel: '无障碍标签',
  onshow: dialog => {},
  onclose: dialog => {}
}
```

配置项默认值如下：

- `closeOnBackdropClick: true`：点击窗口外部的遮罩关闭。
- `closeOnEscape: true`：按 Escape 关闭。
- `showCloseButton: true`：显示内置关闭按钮。
- `title`：初始标题；调用 `setTitle()` 可以更新。
- `ariaLabel`：没有 `title` 时使用的无障碍标签。
- `onshow`、`onclose`：分别在实际显示、实际关闭后调用。

## 注意事项

- `content` 中添加的元素属于 Shadow DOM，页面原有 CSS 不会直接影响弹窗内部样式。
- `@require` 只负责加载工具，不会自动显示弹窗；请在需要时调用 `show()`。
