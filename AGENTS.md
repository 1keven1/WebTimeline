# Timeline Visualizer - 开发指南

## 项目与运行

多时间轴对照工具，使用原生 JavaScript、HTML、CSS，Canvas 绘制轨道，DOM 展示事件。文档和注释使用中文，无构建流程或后端。

在项目根目录启动静态服务：

```powershell
python -m http.server 8080
```

访问 <http://localhost:8080/>。不要依赖 `file://` 加载 JSON。

## 文件职责

| 文件 | 职责 |
|---|---|
| `index.html` | 页面结构、面板、脚本加载 |
| `index.js` | 时间轴索引、默认选择、显式启动与失败提示 |
| `TimelineCore.js` | 数据模型、通用工具、日期规则、数据加载与校验 |
| `Timeline.js` | 应用状态、Canvas/DOM 渲染、交互 |
| `style.css` | 日夜主题、布局、动画、移动端样式 |
| `TL_Data/*.json` | 事件数据 |
| `CSV/` | CSV、Excel 编辑文件与 Windows 转换脚本 |
| `tests/core.test.js` | Core 与初始化回归测试 |
| `Readme.md` | 用户操作与数据格式 |
| `TODO.txt` | 待办事项，保持简短描述 |

脚本按 `TimelineCore.js` → `Timeline.js` → `index.js` 加载。项目代码采用 Apache License 2.0，见 `LICENSE`。

## 启动与依赖

```javascript
const app = new TimelineApp();
app.init(TIMELINE_INDEX, defaultTimelineIds).catch(error => {
    console.error('初始化时间轴失败:', error);
    app.showToast('初始化失败，请检查数据和网络后刷新页面');
});
```

- 构造函数只创建状态，不访问 DOM 或请求数据。
- DOM 就绪后调用 `init()`，获取元素、绑定交互、加载数据并首次渲染。
- `init()` 返回 Promise；重复调用返回首次任务，忽略新参数，失败后也不重新执行。当前入口提示刷新重试。
- 移动端微信浏览器会显示提示并提前结束初始化，不加载数据。
- 页面使用一个全局 `app`，内联事件依赖该名称；类本身不强制单例。
- Core 不依赖 `app`。应用负责状态和提示，Core 返回结果或抛出错误。

## Core

### 数据模型

- `MyEvent`：`year`、`month`、`day`、`title`、`label`、`importance`、`desc`、`detail`、`era`。
- `Timeline`：`id`、`title`、`color`、`category`、`events`。
- 两个类用于保存数据；外部数据应经过规范化函数，不能只依赖构造函数校验。

### TimelineUtils

普通对象函数库，不需要实例化：

| 分组 | 函数 |
|---|---|
| 通用 | `clamp`、`debounce` |
| `dom` | `escapeHtml`、`requestFullscreen` |
| `date` | `getDecimalYear`、`formatEventDate`、`getDetailedDateDesc` |
| `data` | `normalizeEvent`、`normalizeTimeline`、`normalizeTimelines`、`loadTimelines` |

加载、编辑和现有导入逻辑共用 `data`。规范化返回新的模型实例，不修改输入；校验完成后才写入应用状态。

校验范围：

- 年份必填，年份、月、日和重要度需能转换为有限数字。
- 月日缺省为 `null`，重要度缺省为 0，可选文本缺省为空字符串。
- 事件标题非空；时间轴 ID、标题需为非空字符串，事件数据需为数组。
- 批量规范化检查重复时间轴 ID，保持输入顺序。
- 暂未校验月日有效范围、重要度范围、颜色格式，也不自动排序事件。

`loadTimelines(index, onIssue)` 并行加载，单条请求、解析、校验失败或空数据时跳过，保留其余成功数据及索引顺序。重复 ID 保留首条成功数据。同轴重复定位日期仅警告，保留事件。

`onIssue(type, message)` 报告 `error`（跳过）或 `warning`（保留）。应用逐条写入控制台，失败仅汇总一次 Toast；全部失败时显示空状态。修正后刷新重试。索引本身不是数组等启动错误仍由入口捕获。

### 日期规则

定位取月日的绝对值，每月占 `1/12` 年，日按该月天数细分。正负月日的位置相同：

- 负月份：隐藏月和日。
- 正月份、负日期：只隐藏日。
- 未提供月份：日期不参与定位或显示。
- 负年份：表示公元前。

例如 `year: 2007, month: -6` 显示 `2007`，定位为 `2007 + 5/12 ≈ 2007.4167`。完整字段规范见 README。

## 应用与渲染

关键状态：`timelines`、`activeTimelines`、`viewStart/viewEnd`、`minYear/maxYear`、`selectedEvent`、`touchState`、`showCurrentTime`。

- Canvas 绘制共享刻度、轨道和事件圆点，DOM 覆盖层负责标签、摘要和点击。
- `_eventElements` 是事件 DOM 缓存；离开可见范围的节点会移除，并非框架式虚拟 DOM。
- 标签按重要度与像素间距取舍，最高重要度也不保证始终显示。
- 坐标由当前可见范围线性映射；常规最小缩放跨度由 `MIN_YEAR_SPAN` 控制，当前为 3 年。
- 边界按实际日期计算，不足最小跨度时居中补足；无事件时使用默认有效边界。输入范围先交换倒序值，再保留起点补足跨度，最后整体移入边界并回填。
- 鼠标与单指拖动平移，双指缩放和平移；`hasDragged` 用于区分点击与拖动。
- 范围选择器支持左右滑块和中间选区拖动；侧栏收起时内容向左移动。
- 相邻事件导航使用数组顺序。事件 DOM 缓存键目前由时间轴 ID、年份、标题组成。

主题变量位于 `style.css` 的 `:root` 和 `[data-theme="light"]`，主要有 `--bg-canvas`、`--bg-ui`、`--text-primary`、`--text-secondary`、`--sidebar-width`。Canvas 颜色由 `Timeline.js` 中的 `COLORS` 管理，不在文档复制色值。

主要响应式断点为 1024px，侧栏宽度从 280px 调整到 170px。触摸设备也会启用移动端交互；全屏和横屏锁定取决于浏览器支持。

## 功能边界与数据维护

- 页面支持多轨道选择、分类、缩放平移、范围输入、详情导航、主题、全屏和当前时间开关。
- 侧栏右键或长按可编辑、删除。修改只存在于当前页面，刷新恢复原文件。
- 新建、导入、导出保留了部分代码或对话框，但没有页面打开入口；README 不将它们列为可用功能。
- 新时间轴：在 `TL_Data/` 添加事件数组，再在 `index.js` 注册唯一 ID、标题、颜色、分类和路径。
- CSV 表头：`Year,Month,Day,Title,Label,Importance,Desc,Detail,Era`。`Label` 对应 JSON 的 `label`。
- CSV 转换：将文件拖到 `CSV/0_CSVToJson.bat`，或运行 `CSV/0_CSVToJson.ps1 -InputFile 路径`。单条记录的输出仍需检查是否有数组外层。
- 详情正文已转义；卡片、侧栏和分类仍有直接拼接 HTML 的位置，使用可信数据。
- 已知问题与后续优化统一维护在 `TODO.txt`，不在本文件重复列表。

## 修改与验证

- 类名用 PascalCase，函数和变量用 camelCase，常量用 UPPER_SNAKE_CASE，CSS 类用 kebab-case。
- 函数注释简要写用途、参数、返回值；必要时说明错误，不重复描述代码。
- 修改日期、字段处理或启动流程时，同步测试和相关文档；数据格式以 README 为用户入口。
- 当前保持普通脚本与单向依赖，不为拆文件引入框架或构建工具。

使用 Node.js 18+：

```powershell
node --test tests/core.test.js
```

测试覆盖日期正负号、规范化、现有 JSON、失败时的数据保留、防抖、初始化、空轴跳过、重复日期警告和视图范围修正。

页面回归：数据加载、缩放平移、范围输入和滑块、事件详情与键盘导航、分类、侧栏、主题、右键编辑删除。涉及触摸或全屏时另做移动端验证。
