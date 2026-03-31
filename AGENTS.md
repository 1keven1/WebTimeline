# Timeline Visualizer - AI Agent Guide

## 项目概述

**Timeline Visualizer** 是一个基于浏览器的交互式时间轴可视化工具，用于展示多条时间线上的 chronological events。项目采用纯静态前端技术栈，无需构建步骤即可运行。

项目中的代码注释、文档（`Readme.md`）和 UI 文本均以**中文**为主。

### 核心功能
- 多时间轴并行展示，支持颜色区分与分类筛选
- Canvas 绘制时间轴轨道与刻度，DOM 覆盖层渲染可交互事件卡片
- 支持缩放（鼠标滚轮）、平移（拖拽）、范围选择器调整视图
- **侧边栏可收起/展开**（带动画过渡）
- **范围选择器**：滑块上方显示当前视口年份，下方显示整体时间范围
- **当前时间刻度**：亮黄色标记显示当前年份
- **月份显示**：放大时年份标签显示为 `年.月` 格式（如 2007.06）
- 事件详情侧滑面板
- 时间轴的增删改（通过模态框编辑 JSON 数据）
- 数据的导入/导出（JSON 格式）
- CSV 转 JSON 的数据预处理工具

### 当前内置时间轴
- **三体** (`three-body`)：科幻文学时间轴
- **量子力学发展史** (`quantum-physics`)：科学史时间轴

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 结构 | HTML5 |
| 样式 | CSS3（CSS Variables、Flexbox） |
| 逻辑 | 原生 JavaScript（ES6+，多 Class 架构） |
| 渲染 | HTML5 Canvas API + DOM Overlay |
| 数据格式 | JSON |
| 构建系统 | **无**（纯静态文件） |
| 辅助工具 | PowerShell + Windows Batch（CSV 转换） |

### 浏览器要求
- 支持 ES6+、Canvas API、Fetch API 的现代浏览器
- 由于使用 `fetch()` 加载 `TL_Data/*.json`，**直接通过 `file://` 协议打开可能因 CORS 限制导致数据加载失败**，建议通过本地 HTTP 服务器访问

---

## 项目结构

```
Timeline/
├── index.html              # 主入口，包含全部 UI 结构
├── index.js                # 时间轴索引配置与应用初始化
├── Timeline.js             # 核心应用逻辑（含数据类定义）
├── style.css               # 全部样式（CSS 变量主题）
├── AGENTS.md               # 本文件（AI 开发指南）
├── Readme.md               # 待办事项与 Bug 跟踪（中文）
├── LICENSE                 # Apache License 2.0
├── .gitignore              
├── CSV/                    # 数据转换工具
│   ├── 0_CSVToJson.bat     # Windows 批处理启动器
│   ├── 0_CSVToJson.ps1     # PowerShell 转换脚本
│   ├── ThreeBody.csv       # 示例 CSV 数据源
│   └── Timelines.xlsx      # Excel 编辑模板
└── TL_Data/                # 时间轴 JSON 数据
    ├── TL_ThreeBody.json
    └── TL_QuantumPhysics.json
```

### 重要说明
- **不存在** `package.json`、`pyproject.toml`、`Cargo.toml`、`vite.config.js` 或任何其他构建/包管理配置文件。
- 这是一个零依赖的纯前端项目，所有代码集中在 3 个核心文件中。

---

## 架构详情

### 文件依赖关系

```
index.html
├── index.js          (定义 TIMELINE_INDEX，初始化 TimelineApp)
├── Timeline.js       (核心逻辑与数据类)
└── style.css         (样式)
```

### 配置与数据类（`index.js`）

```javascript
// 时间轴元数据索引
const TIMELINE_INDEX = [
    { id: 'three-body', title: '三体', color: '#3b82f6', eventPath: './TL_Data/TL_ThreeBody.json', category: '科幻文学' },
    { id: 'quantum-physics', title: '量子力学发展史', color: '#8b5cf6', eventPath: './TL_Data/TL_QuantumPhysics.json', category: '科学史' }
];

const defaultTimelineId = 'three-body';
const app = new TimelineApp(TIMELINE_INDEX, defaultTimelineId);
```

### 核心类定义（`Timeline.js`）

```javascript
// 配置常量
const MIN_LABEL_SPACING = 25;        // 标签间最小像素间距
const PADDING_AMOUNT = 0.05;         // 年份范围的留白比例
const DRAG_THRESHOLD = 3;            // 拖拽检测阈值（像素）

// 数据类
class Timeline {
    constructor(id, title, events, color, category)
}

class TimelineEvent {
    constructor(year, title, label, importance, desc, detail, era)
}

class MyEvent {
    constructor(year, month, day)  // 用于精确日期计算
}
```

### 主应用类：`TimelineApp`

```javascript
// 关键属性
this.timelines          // Timeline[] 时间轴对象数组
this.activeTimelines    // Set<string> 当前可见时间轴 ID
this.viewStart/viewEnd  // 当前显示的时间范围（支持小数年份表示月份）
this.selectedEvent      // 当前选中事件
this._eventElements     // Map 用于 DOM 元素对象池（性能优化）

// 核心方法
init()                  // 初始化
loadData()              // 从 JSON 加载数据
render()                // 主渲染循环
renderTimeScale()       // 绘制时间刻度（含当前时间标记）
renderEventDOMs()       // DOM 覆盖层差异更新
setupRangeSlider()      // 范围选择器交互
toggleSidebar()         // 侧边栏收起/展开
```

### 混合渲染架构

1. **Canvas 层**（`#timelineCanvas`）
   - 绘制轨道背景、时间刻度线/网格
   - 绘制事件标记（圆点）
   - **亮黄色当前时间刻度线**（当当前年份在视口内时）
   - 处理鼠标拖拽平移事件

2. **DOM 覆盖层**（`#eventsOverlay`）
   - 绝对定位的事件卡片（`.event-card`）
   - 显示纵向标签（优先显示 `label`，否则显示 `title`）
   - 悬浮/点击弹出详情气泡（`.event-popup`）
   - 使用 `pointer-events` 精细控制事件穿透

3. **详情面板**（`#detailPanel`）
   - 右侧固定面板，通过 CSS `right` 属性滑入滑出
   - **支持文本选择**（全局 `user-select: none` 的例外）

4. **范围选择器**（底部）
   - 双滑块调整视口范围
   - 滑块上方标签显示当前选中年份
   - 下方标签显示整体事件范围

### 数据流

```
TIMELINE_INDEX（硬编码索引）
    ↓
fetch(TL_Data/*.json) → Timeline 实例
    ↓
this.timelines（内存中）
    ↓
render() → Canvas 绘制 + DOM 差异更新
```

### 性能优化

- **DOM 对象池**：`renderEventDOMs()` 使用 `Map` 存储 `_eventElements`，复用已创建的 DOM 元素
- **标签碰撞检测**：按 `importance` 优先级分配显示空间，避免重叠
- **Canvas 持续渲染**：侧边栏动画期间使用 `requestAnimationFrame` 保持流畅

---

## 数据格式

### 事件 JSON 格式（`TL_Data/*.json`）

```json
[
  {
    "year": 2007,
    "title": "事件标题",
    "label": "自定义标签",
    "importance": 1,
    "desc": "简介",
    "detail": "详细信息",
    "era": "纪元名称"
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `year` | int | 年份（可为负数表示公元前） |
| `title` | string | 短标题（label 为空时显示） |
| `label` | string | 可选自定义标签（优先显示） |
| `importance` | int | 0-2，影响标签显示优先级 |
| `desc` | string | 简介，显示在详情面板 |
| `detail` | string | 详细信息，显示在详情面板 |
| `era` | string | 历史时期/纪元分类 |

### CSV 格式（用于数据导入）

```csv
Year,Title,Lable,Importance,Desc,Detail,Era
2007,事件标题,,1,简介,详细信息,纪元名称
```

注意：CSV 表头使用 `Lable`（拼写与常见 `Label` 不同），与 `0_CSVToJson.ps1` 中的解析逻辑对应。

---

## 开发指南

### 运行项目

无需构建，直接通过本地 HTTP 服务器运行：

```bash
# Python 3
python -m http.server 8000

# 然后访问 http://localhost:8000
```

### 添加新时间轴

1. 在 `TL_Data/` 下创建 JSON 数据文件
2. 在 `index.js` 中的 `TIMELINE_INDEX` 数组注册新条目
3. 刷新浏览器即可生效

### 调整侧边栏动画时长

CSS 变量和 JS 已同步，只需修改 `:root` 中的值：

```css
:root {
    --sidebar-animation-duration: 300ms;  /* 修改此处 */
}
```

JS 会自动通过 `getComputedStyle()` 读取该值。

---

## 代码规范

### 命名约定
- **类名**：`PascalCase`（如 `TimelineApp`、`TimelineEvent`）
- **方法/变量**：`camelCase`（如 `renderSidebar`、`activeTimelines`）
- **常量**：`UPPER_SNAKE_CASE`（如 `MIN_LABEL_SPACING`）
- **CSS 类名**：`kebab-case`（如 `event-card`、`timeline-item`）

### 主题 CSS 变量

定义于 `style.css` 的 `:root` 中：

```css
--bg-primary: #0f172a;              /* 主背景 */
--bg-secondary: #1e293b;            /* 卡片/面板背景 */
--bg-tertiary: #334155;             /* 输入框/按钮背景 */
--text-primary: #f8fafc;            /* 主文字 */
--text-secondary: #94a3b8;          /* 次要文字 */
--accent-blue: #3b82f6;             /* 主强调色 */
--accent-purple: #8b5cf6;
--accent-emerald: #10b981;
--accent-rose: #f43f5e;
--accent-amber: #f59e0b;            /* 当前时间刻度颜色 */
--border-color: #475569;
--sidebar-animation-duration: 300ms; /* 动画时长 */
```

### 全局文本选择控制

- `body` 设置 `user-select: none` 防止误选
- `.detail-panel` 和 `.modal-body` 单独启用 `user-select: text`

### 交互模式

**拖拽检测**：
```javascript
this.dragging = true;
this.hasDragged = false;
this.dragStartX = e.clientX;

// mousemove 中
if (Math.abs(e.clientX - this.dragStartX) > DRAG_THRESHOLD) {
    this.hasDragged = true;
}

// click 中
if (this.hasDragged) return; // 忽略拖拽触发的点击
```

---

## 已知问题与待办（来自 `Readme.md`）

### 已修复
- ✅ 分类筛选功能正常工作
- ✅ "上一个"/"下一个"按钮已移至工具栏左侧
- ✅ 范围选择器显示改进（4个数字布局）
- ✅ 侧边栏支持收起/展开

### 待实现功能
- 大卡片（`.event-popup`）应显示 `desc` 而非 `title`
- 取消双击编辑，改为右键菜单（编辑/删除）
- 左侧列表支持拖拽排序
- 拖拽到边界时添加回弹动画
- 页面缩放控制（顶部工具栏）

---

## 测试与部署

### 测试
- **无自动化测试套件**，依赖手动测试
- 手动测试清单：
  1. 时间轴加载：确认所有 JSON 数据正常加载，无控制台报错
  2. 导航：测试缩放（滚轮）、平移（拖拽）、范围滑块
  3. 侧边栏：点击切换按钮测试收起/展开动画
  4. 选择：点击事件卡片打开详情面板
  5. 筛选：点击分类标签切换显示
  6. CRUD：新建、编辑、删除时间轴
  7. 导入/导出：JSON 数据的复制与粘贴导入
  8. 键盘：Esc（关闭面板）、左右方向键（事件导航）

### 部署
- 项目为纯静态文件，可直接部署到任何静态托管服务（GitHub Pages、Vercel、Nginx 等）
- 确保 `TL_Data/*.json` 文件与 `index.html` 的相对路径关系保持不变

---

## 文件参考

| 文件 | 用途 | 行数（约） |
|------|------|-----------|
| `index.html` | HTML 结构、UI 布局 | 201 |
| `index.js` | 时间轴索引配置与初始化 | 22 |
| `Timeline.js` | 应用逻辑、渲染、交互、数据类 | 1069 |
| `style.css` | 样式、主题、动画 | 928 |
| `TL_Data/*.json` | 时间轴事件数据 | 因内容而异 |
| `CSV/0_CSVToJson.ps1` | CSV 转 JSON 工具 | 95 |

---

## 许可证

Apache License 2.0 - 详见 `LICENSE` 文件
