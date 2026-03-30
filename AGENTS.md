# Timeline Visualizer - AI Agent Guide

## 项目概述

**Timeline Visualizer** 是一个基于浏览器的交互式时间轴可视化工具，用于展示多条时间线上的 chronological events。项目采用纯静态前端技术栈，无需构建步骤即可运行。

项目中的代码注释、文档（`Readme.md`）和 UI 文本均以**中文**为主。

### 核心功能
- 多时间轴并行展示，支持颜色区分与分类筛选
- Canvas 绘制时间轴轨道与刻度，DOM 覆盖层渲染可交互事件卡片
- 支持缩放（鼠标滚轮）、平移（拖拽）、范围选择器调整视图
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
| 逻辑 | 原生 JavaScript（ES6+，单 Class 架构） |
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
├── Timeline.js             # 核心应用逻辑（单文件，~919 行）
├── style.css               # 全部样式（单文件，~846 行）
├── Readme.md               # 待办事项与 Bug 跟踪（中文）
├── LICENSE                 # Apache License 2.0
├── .gitignore              # 忽略 Office 临时文件、*.tmp 等
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

### 核心类：`TimelineApp`（`Timeline.js`）

单例应用类，负责所有时间轴功能：

```javascript
// 关键属性
this.timelines          // 时间轴对象数组
this.activeTimelines    // 当前可见时间轴 ID 的 Set
this.viewStart/viewEnd  // 当前显示的时间范围
this.selectedEvent      // 当前选中事件
this._eventElements     // DOM 元素对象池（Map），用于性能优化
```

### 混合渲染架构

1. **Canvas 层**（`#timelineCanvas`）
   - 绘制轨道背景、时间刻度线/网格
   - 绘制事件标记（圆点）
   - 处理鼠标拖拽平移事件

2. **DOM 覆盖层**（`#eventsOverlay`）
   - 绝对定位的事件卡片（`.event-card`）
   - 显示纵向标签（`writing-mode: vertical-rl`）
   - 悬浮/点击弹出详情气泡（`.event-popup`）
   - 使用 `pointer-events` 精细控制事件穿透

3. **详情面板**（`#detailPanel`）
   - 右侧固定面板，通过 CSS `right` 属性滑入滑出

### 数据流

```
TIMELINE_INDEX（硬编码索引）
    ↓
fetch(TL_Data/*.json)
    ↓
this.timelines（内存中）
    ↓
render() → Canvas 绘制 + DOM 差异更新
```

### 性能优化：DOM 对象池

`renderEventDOMs()` 使用 `Map` 存储 `_eventElements`，实现：
- 复用已创建的 DOM 元素，避免频繁创建/销毁
- 仅对可见范围内的事件进行差异更新（进入/离开视口时增删）
- 标签显示采用碰撞检测（`MIN_LABEL_SPACING = 25`），按 `importance` 优先级分配显示空间

---

## 数据格式

### 时间轴索引（`TIMELINE_INDEX`，硬编码于 `Timeline.js` 顶部）

```javascript
const TIMELINE_INDEX = [
    {
        id: 'three-body',
        title: '三体',
        color: '#3b82f6',
        eventPath: './TL_Data/TL_ThreeBody.json',
        category: '科幻文学'
    },
    // ...
];
```

### 事件 JSON 格式（`TL_Data/*.json`）

```json
[
  {
    "year": 2007,
    "title": "事件标题",
    "label": "",
    "importance": 0,
    "desc": "简介",
    "detail": "详细信息",
    "era": "纪元名称"
  }
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `year` | int/string | 年份（可为负数表示公元前） |
| `title` | string | 短标题，显示在标签和弹出层中 |
| `label` | string | 可选自定义标签（当前逻辑中未优先使用） |
| `importance` | int | 0-2，影响标签显示优先级 |
| `desc` | string | 简介，显示在详情面板 |
| `detail` | string | 详细信息，显示在详情面板 |
| `era` | string | 历史时期/纪元分类 |

### CSV 格式（用于数据导入）

```csv
Year,Title,Lable,Importance,Desc,Detail,Era
2007,事件标题,,0,简介,详细信息,纪元名称
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
2. 在 `Timeline.js` 顶部的 `TIMELINE_INDEX` 数组中注册新条目
3. 刷新浏览器即可生效

### CSV 转 JSON

使用提供的 PowerShell 脚本：

```powershell
# 直接运行（会弹出文件选择对话框）
.\CSV\0_CSVToJson.ps1

# 或拖拽 CSV 文件到 0_CSVToJson.bat 上
```

脚本会自动将结果复制到剪贴板，也可选择保存为 `.json` 文件。

---

## 代码规范

### 命名约定
- **类名**：`PascalCase`（如 `TimelineApp`）
- **方法/变量**：`camelCase`（如 `renderSidebar`、`activeTimelines`）
- **常量**：`UPPER_SNAKE_CASE`（如 `MIN_LABEL_SPACING`）
- **CSS 类名**：`kebab-case`（如 `event-card`、`timeline-item`）

### 主题 CSS 变量

定义于 `style.css` 的 `:root` 中：

```css
--bg-primary: #0f172a;      /* 主背景 */
--bg-secondary: #1e293b;    /* 卡片/面板背景 */
--bg-tertiary: #334155;     /* 输入框/按钮背景 */
--text-primary: #f8fafc;    /* 主文字 */
--text-secondary: #94a3b8;  /* 次要文字 */
--accent-blue: #3b82f6;
--accent-purple: #8b5cf6;
--accent-emerald: #10b981;
--accent-rose: #f43f5e;
--accent-amber: #f59e0b;
--border-color: #475569;
```

### 交互模式

项目中广泛使用的"拖拽检测"模式：

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

## 已知问题（来自 `Readme.md`）

### Bug
- **右上角分类筛选不能正常工作**：`renderCategories()` 生成的分类标签在特定场景下（如空状态切换）行为异常
- **"上一个"/"下一个"按钮位置需要调整**：当前位于工具栏右侧，UI 布局待优化

### 待实现功能
- 大卡片（`.event-popup`）应显示 `desc` 而非 `title`
- 范围选择器：滑块上方显示选中范围，下方两侧显示总范围
- 左侧时间轴列表支持收起/隐藏
- 取消双击编辑，改为右键菜单（编辑/删除）
- 左侧列表支持拖拽排序
- 拖拽到边界时添加回弹动画
- 页面缩放控制（顶部工具栏）

### 优化项
- 将重要的 CSS 调整项进一步抽离为独立变量

---

## 测试与部署

### 测试
- **无自动化测试套件**，依赖手动测试
- 手动测试清单：
  1. 时间轴加载：确认所有 JSON 数据正常加载，无控制台报错
  2. 导航：测试缩放（滚轮）、平移（拖拽）、范围滑块
  3. 选择：点击事件卡片打开详情面板
  4. 筛选：点击分类标签切换显示
  5. CRUD：新建、编辑、删除时间轴
  6. 导入/导出：JSON 数据的复制与粘贴导入
  7. 键盘：Esc（关闭面板）、左右方向键（事件导航）

### 部署
- 项目为纯静态文件，可直接部署到任何静态托管服务（GitHub Pages、Vercel、Nginx 等）
- 确保 `TL_Data/*.json` 文件与 `index.html` 的相对路径关系保持不变

---

## 文件参考

| 文件 | 用途 | 行数（约） |
|------|------|-----------|
| `index.html` | HTML 结构、UI 布局 | 193 |
| `Timeline.js` | 应用逻辑、渲染、交互 | 919 |
| `style.css` | 样式、主题、动画 | 846 |
| `TL_Data/*.json` | 时间轴事件数据 | 因内容而异 |
| `CSV/0_CSVToJson.ps1` | CSV 转 JSON 工具 | 95 |

---

## 许可证

Apache License 2.0 - 详见 `LICENSE` 文件
