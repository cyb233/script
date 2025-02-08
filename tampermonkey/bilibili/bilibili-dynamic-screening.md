# Bilibili 动态筛选
通过油猴菜单执行

![image](https://github.com/user-attachments/assets/d769a529-99b0-4980-8f21-bfda88e27616)

注意：受限于B站Api，只能从最新动态向以前获取

效果如图所示：

![image](https://github.com/user-attachments/assets/3a98e480-1ff8-4489-8dc4-7207686eb9ce)

![image](https://github.com/user-attachments/assets/a6fe01c0-5597-491c-b749-80610d076128)

首次执行后，会出现储存界面，可以在这里增加自定义筛选规则

规则生效逻辑：text不为空/checkbox为真时

规则记录格式：
```json5
{
    "customFilters": {
        "全部显示": {
            "type": "checkbox",
            "filter": "(item, input) => true"
        },
        "全部不显示": {
            "type": "checkbox",
            "filter": "(item, input) => false"
        }
    }
}
// 格式说明
"显示名称": {
    "type": "checkbox", // 类型：text/checkbox
    "filter": "(item, input) => false" // 过滤条件，`item`一条动态对象，`input`text/checkbox的值，返回true则显示，受json格式限制，请写成字符串
}
```
> item格式可根据控制台日志确认

![image](https://github.com/user-attachments/assets/b45f5b94-1c74-4ba4-97fc-640ba10f3e13)

![image](https://github.com/user-attachments/assets/a320cccb-faa6-44d1-b63f-c40f6ce33658)
