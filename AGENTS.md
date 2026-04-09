# Timeline Visualizer - AI Agent Guide

## 项目概述

**Timeline Visualizer** 是一个交互式网页时间轴可视化工具，用于展示多条时间轴上的 chronological events。它采用混合渲染架构，结合 HTML5 Canvas 绘制时间轴轨道和 DOM 元素实现可交互的事件卡片。

项目文档和代码注释主要使用**中文**。

### 核心功能
- 多时间轴支持，支持颜色编码和分类
- 基于 Canvas 的交互式时间轴渲染 + DOM 事件覆盖层
- 缩放（鼠标滚轮）、平移（拖拽）、范围选择导航
- 事件详情面板展示完整信息
- JSON 数据导入/导出功能
- 分类筛选系统
- 右键上下文菜单编辑/删除时间轴
- 可折叠侧边栏带动画效果
- CSV 转 JSON 数据准备工具
- 移动端触摸手势支持（单指拖动、双指缩放）
- 横屏提示与全屏锁定
- 日夜模式切换
- 当前时间刻度显示开关

### 现有时间轴
- **中国史** (chinese-history): 中国历史时间线，红色主题 `#c43939`
- **世界史** (world-history): 世界历史时间线，蓝色主题 `#029bca`
- **三体** (three-body): 科幻文学时间线，紫色主题 `#8b32ff`
- **物理学发展史** (quantum-physics): 科学史时间线，粉色主题 `#cc43ee`

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 结构 | HTML5 |
| 样式 | CSS3 (CSS 变量、Flexbox、Grid) |
| 逻辑 | 原生 JavaScript (ES6+、基于类) |
| 渲染 | HTML5 Canvas API + DOM 覆盖层 |
| 数据格式 | JSON |
| 构建系统 | 无（纯静态文件）|

### 浏览器要求
- 支持 ES6+ 的现代浏览器
- Canvas API 支持
- Fetch API 支持
- 移动端需支持横屏显示

---

## 项目结构

```
Timeline/
├── index.html              # 主入口 - 包含所有 UI 标记（~253 行）
├── Timeline.js             # 核心应用逻辑（~1887 行）
├── index.js                # 入口点：定义 TIMELINE_INDEX 并初始化应用
├── style.css               # 暗色主题样式表（~1264 行）
├── Readme.md               # 数据格式文档和 TODO 列表（中文）
├── AGENTS.md               # 本文件 - AI 代理指南
├── LICENSE                 # Apache License 2.0
├── .gitignore              # 忽略 Office 临时文件、*.tmp
├── CSV/                    # 数据转换工具
│   ├── 0_CSVToJson.bat     # Windows 批处理启动器
│   ├── 0_CSVToJson.ps1     # PowerShell 转换脚本
│   ├── ThreeBody.csv       # 示例 CSV 数据源
│   ├── Physics.csv         # 物理时间线 CSV 源
│   └── Timelines.xlsx      # Excel 时间线编辑模板
└── TL_Data/                # 时间线 JSON 数据文件
    ├── TL_ChineseHistory.json   # 中国历史时间线事件
    ├── TL_WorldHistory.json     # 世界历史时间线事件
    ├── TL_ThreeBody.json        # 三体时间线事件
    └── TL_Physics.json          # 物理学史时间线事件
```

---

## 架构详解

### 核心类

#### `MyEvent` (位于 `Timeline.js`)
事件对象结构：
```javascript
{
    year: Number,           // 事件年份（负数为公元前）
    month: Number,          // 可选：1-12（负数为仅用于偏移）
    day: Number,            // 可选：1-31（负数为仅用于偏移）
    title: String,          // 事件标题（显示在详情面板）
    label: String,          // 短标签（显示在时间轴卡片上）
    importance: Number,     // 0-7，影响标签可见性优先级
    desc: String,           // 简介
    detail: String,         // 完整详细内容
    era: String             // 历史时期分类
}
```

#### `Timeline` (位于 `Timeline.js`)
时间轴对象结构：
```javascript
{
    id: String,             // 唯一标识符
    title: String,          // 显示标题
    color: String,          // 十六进制颜色代码
    category: String,       // 用于筛选的分类
    events: MyEvent[]       // 事件数组
}
```

#### `TimelineApp` (主类，位于 `Timeline.js`)
单例应用类，管理所有时间轴功能：

```javascript
// 关键属性
this.timelines          // 时间轴对象数组
this.activeTimelines    // 当前可见时间轴 ID 集合
this.viewStart/viewEnd  // 当前显示的时间范围
this.minYear/maxYear    // 整体时间边界
this.selectedEvent      // 当前选中事件
this._eventElements     // DOM 元素池（性能优化）
this.dragging           // 拖拽状态（用于平移）
this.hasDragged         // 区分拖拽和点击
this.touchState         // 触摸状态（单指/双指）
this.showCurrentTime    // 是否显示当前时间刻度
```

### 渲染架构

应用采用**混合渲染方案**：

1. **Canvas 层** (`#timelineCanvas`)：
   - 绘制时间轴轨道（水平线）
   - 绘制时间刻度/网格线
   - 绘制事件标记点（轨道上的圆点）
   - 处理平移的鼠标事件

2. **DOM 覆盖层** (`#eventsOverlay`)：
   - 包含可交互的事件卡片 (`event-card` 元素)
   - 显示事件标签（竖排文字）
   - 悬停/点击显示弹出详情
   - 处理点击交互

3. **详情面板** (`#detailPanel`)：
   - 固定右侧的浮动卡片样式面板
   - 使用 CSS 过渡动画滑入/滑出
   - 显示选中事件的完整信息

### 数据流

```
TIMELINE_INDEX (index.js) → fetch() → TimelineApp.timelines → render() → Canvas + DOM
                                      ↓
                              用户交互
                              (缩放、平移、选择)
```

---

## 数据格式

### 时间线索引 (`TIMELINE_INDEX`，位于 `index.js`)
```javascript
const TIMELINE_INDEX = [
    {
        id: 'chinese-history',
        title: '中国史',
        color: '#c43939',
        eventPath: './TL_Data/TL_ChineseHistory.json',
        category: '历史'
    },
    {
        id: 'world-history',
        title: '世界史',
        color: '#029bca',
        eventPath: './TL_Data/TL_WorldHistory.json',
        category: '历史'
    },
    {
        id: 'three-body',
        title: '三体',
        color: '#8b32ff',
        eventPath: './TL_Data/TL_ThreeBody.json',
        category: '科幻文学'
    },
    {
        id: 'quantum-physics',
        title: '物理学发展史',
        color: '#cc43ee',
        eventPath: './TL_Data/TL_Physics.json',
        category: '科学史'
    }
];

// 默认选中的时间轴 ID 列表（可以是单个字符串或数组）
const defaultTimelineIds = ['three-body', 'chinese-history'];
```

### 事件 JSON 格式 (`TL_Data/*.json`)
```json
[
  {
    "year": 1979,
    "month": 10,
    "day": 21,
    "title": "叶文洁收到三体回复",
    "label": "叶收到三体回复",
    "importance": 7,
    "desc": "叶文洁收到三体世界的警告信息，并回复",
    "detail": "凌晨0点，在向太阳发射信息不到9年后...",
    "era": "黄金时代"
  }
]
```

### CSV 格式（用于数据导入）
CSV 文件应包含以下列：`Year`, `Month`, `Day`, `Title`, `Lable`, `Importance`, `Desc`, `Detail`, `Era`

**注意**：月份和日期可以为负值，用于时间偏移（位置调整）但不显示。

---

## 开发指南

### 运行项目

无需构建流程。直接在现代网页浏览器中打开 `index.html`：

```bash
# 方式 1：直接文件打开
# 在浏览器中打开 index.html

# 方式 2：简单 HTTP 服务器（推荐，用于 Fetch API）
cd Timeline
python -m http.server 8000
# 然后访问 http://localhost:8000
```

### 添加新时间轴

1. **在 `TL_Data/` 中创建 JSON 数据文件**：
   ```json
   [
     {"year": 1900, "month": 1, "day": 1, "title": "事件", "importance": 0, "desc": "...", "detail": "...", "era": "..."}
   ]
   ```

2. **在 `TIMELINE_INDEX` 中注册**（位于 `index.js`）：
   ```javascript
   const TIMELINE_INDEX = [
     // ... 现有时间轴
     {
       id: 'my-timeline',
       title: '我的时间轴',
       color: '#f59e0b',
       eventPath: './TL_Data/TL_MyTimeline.json',
       category: '自定义分类'
     }
   ];
   ```

3. **刷新浏览器** - 新时间轴将出现在侧边栏中

### CSV 转 JSON

使用提供的 PowerShell 脚本：

```powershell
# 方式 1：将 CSV 文件拖拽到 0_CSVToJson.bat
# 方式 2：直接运行
.\CSV\0_CSVToJson.ps1 -InputFile ".\CSV\MyData.csv"
```

脚本功能：
- 将 CSV 转换为格式化的 JSON
- 自动复制到剪贴板
- 可选保存到文件

---

## 代码规范

### 命名规范（代码库中使用）
- **类名**: `PascalCase`（如 `TimelineApp`）
- **方法/变量**: `camelCase`（如 `renderSidebar`, `activeTimelines`）
- **常量**: `UPPER_SNAKE_CASE`（如 `MIN_LABEL_SPACING`）
- **CSS 类**: `kebab-case`（如 `event-card`, `timeline-item`）

### CSS 变量（主题）
位于 `style.css` 的 `:root` 中：
```css
--bg-primary: #0f172a;      /* 主背景 */
--bg-secondary: #1e293b;    /* 卡片/面板背景 */
--bg-tertiary: #334155;     /* 输入/按钮背景 */
--text-primary: #f8fafc;    /* 主文本 */
--text-secondary: #94a3b8;  /* 次要文本 */
--accent-blue: #3b82f6;     /* 主强调色 */
--accent-purple: #8b5cf6;   /* 次强调色 */
--accent-emerald: #10b981;
--accent-rose: #f43f5e;
--accent-amber: #f59e0b;
--border-color: #475569;
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6);
--sidebar-animation-duration: 300ms;
--header-height: 60px;
```

### 日间模式变量
位于 `style.css` 的 `[data-theme="light"]` 中：
```css
--bg-primary: #f1f5f9;
--bg-secondary: #ffffff;
--bg-tertiary: #e2e8f0;
--text-primary: #1e293b;
--text-secondary: #64748b;
```

### 事件处理模式
```javascript
// 拖拽检测模式
this.dragging = true;
this.hasDragged = false;
this.dragStartX = e.clientX;

// 在 mousemove 中
if (Math.abs(e.clientX - this.dragStartX) > DRAG_THRESHOLD) {
    this.hasDragged = true;
}

// 在 click 处理中 - 如果是拖拽则忽略
if (this.hasDragged) return;
```

---

## 关键实现细节

### 事件卡片的虚拟 DOM
应用使用基于 Map 的对象池系统 (`this._eventElements`) 来：
- 复用 DOM 元素而不是重新创建
- 区分可见与隐藏的事件
- 在渲染期间最小化 DOM 操作

### 时间刻度计算
```javascript
calculateTimeStep(span) {
    if (span > 5000) return 500;
    if (span > 1000) return 100;
    if (span > 500) return 50;
    if (span > 100) return 10;
    if (span > 50) return 5;
    if (span > 10) return 1;
    return 0.5;
}
```

### 坐标映射
```javascript
// 年份转 X 坐标
const x = ((year - this.viewStart) / timeSpan) * canvasWidth;

// X 坐标转年份
const year = this.viewStart + (x / canvasWidth) * timeSpan;
```

### 小数年份计算
事件可以有月份/日期用于精确定位。`getDecimalYear()` 方法转换为小数：
- 1月 = 0.0, 12月 ≈ 0.92
- 日期进一步细化位置

### 日期偏移功能
负的月份/日期值用于时间偏移但不显示：
- `{"year": 2007, "month": -6}` 显示为 "2007" 但定位在 2007.5
- 当同一年有多个事件需要视觉分离时有用

### 触摸手势支持
- **单指**：拖动平移时间轴
- **双指**：缩放 + 平移（以双指中心为基准）
- **长按**：在移动端模拟右键菜单

### 响应式断点
- **桌面端**: > 1024px
- **平板/移动端**: <= 1024px（侧边栏宽度从 280px 变为 200px）
- **小屏移动端**: <= 768px（详情面板全宽）

---

## 已知问题和 TODO（来自 Readme.md）

### Bug
- 范围选择器最小范围大于滚轮缩放最小值（3年）
- 用滚轮缩放到最大后，范围选择器无法在小范围内调整

### 功能
- 移动端优化（UI 优化、禁止元素左右滑动、禁止用户缩放）
- 分类又能被选中了（需修复）
- 详情面板已改为浮动卡片样式
- 侧边栏时间轴列表支持拖动排序
- 拖拽到边界时做类似网页的弹性回弹效果
- 下方范围选择器中间部分也可以拖动
- 时间轴纵向位置调整
- 左侧时间轴列表收起时内容改为向左移动而非压缩
- 延迟加载 JSON 文件（只在打开时间轴时加载）
- 优化日间模式配色

### 优化
- 分离重要的 CSS 变量以便主题调整
- 优化 `renderSidebar` 避免完全重新生成

---

## 测试

无自动化测试套件。手动测试清单：

1. **时间轴加载**：验证所有时间轴加载无控制台错误
2. **导航**：测试缩放（鼠标滚轮）、平移（拖动）、重置视图
3. **范围选择器**：拖动滑块调整可见范围
4. **选择**：点击事件打开详情面板
5. **分类筛选**：点击分类标签筛选时间轴
6. **侧边栏**：测试折叠/展开切换
7. **CRUD 操作**：通过 UI 创建、编辑、删除时间轴
8. **上下文菜单**：右键点击时间轴项进行编辑/删除
9. **导入/导出**：测试 JSON 导入/导出功能
10. **键盘**：测试 Escape（关闭面板）、方向键（导航事件）
11. **移动端**：测试触摸手势、横屏提示、全屏锁定
12. **日夜模式**：切换主题验证样式变化

---

## 安全注意事项

1. **XSS 防护**：事件详情内容直接插入 DOM，确保 JSON 数据源可信
2. **CORS**：使用 Fetch API 加载 JSON，生产环境需配置适当的 CORS 头
3. **数据验证**：导入 JSON 时验证数组格式，但不验证字段内容
4. **敏感数据**：剪贴板操作使用 `navigator.clipboard`，需用户授权

---

## 文件参考

| 文件 | 用途 | 行数 |
|------|------|------|
| `index.html` | HTML 结构、UI 布局 | ~253 |
| `Timeline.js` | 应用逻辑、渲染、交互 | ~1887 |
| `index.js` | 时间线索引定义和应用初始化 | ~37 |
| `style.css` | 样式、主题、动画 | ~1264 |
| `TL_Data/*.json` | 时间轴事件数据 | 各异 |
| `CSV/0_CSVToJson.ps1` | CSV 转 JSON 工具 | ~97 |

---

## 许可证

Apache License 2.0 - 详见 `LICENSE` 文件
