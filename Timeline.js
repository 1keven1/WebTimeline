'use strict'

// ============ 常量定义 ============
const MIN_LABEL_SPACING = {
    desktop: 25,  // 电脑端标签间最小像素间距
    mobile: 20,   // 移动端标签间最小像素间距（屏幕较小，用更小值）
    get(isMobile) {
        return isMobile ? this.mobile : this.desktop;
    }
};
const PADDING_AMOUNT = 0.2; // 年份范围的留白
const VIEWPORT_MARGIN = 0.07; // 视口边缘的额外年份范围（占留白后范围的百分比）
const DRAG_THRESHOLD = 3; // 移动超过3px视为拖拽
const TIMELINE_WIDTH = 4; // 时间轴线条宽度
const MIN_YEAR_SPAN = 3; // 最小视图跨度（年），避免过度放大
const YEARSCALE_BOLD_COLOR = '#46566b';
const YEARSCALE_BOLD_WIDTH = 1.5;
const YEARSCALE_BOLD_FONT = 'bold 14px sans-serif';
const YEARSCALE_COLOR = '#334155';
const YEARSCALE_WIDTH = 1;
const YEARSCALE_FONT = '11px sans-serif';
const CURRENT_YEAR_COLOR = '#facc15';
const CURRENT_YEAR_WIDTH = 2;
const CURRENT_YEAR_FONT = 'bold 14px sans-serif';

// ============ 工具函数 ============
/**
 * 将值限制在指定范围内
 */
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

/**
 * 防抖函数
 */
const debounce = (fn, delay) => {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
};

/**
 * HTML 转义函数，防止 XSS
 */
const escapeHtml = (text) => {
    const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[<>&"']/g, m => map[m]);
};

/**
 * 请求全屏（带浏览器前缀兼容）
 */
const requestFullscreen = (elem) => {
    const fn = elem.requestFullscreen || elem.webkitRequestFullscreen ||
        elem.mozRequestFullScreen || elem.msRequestFullscreen;
    return fn ? fn.call(elem) : Promise.reject('不支持全屏');
};

// ============ 类定义 ============
/**
 * 时间轴中的事件对象结构体
 */
class MyEvent {
    /**
    * @param {Int} year 事件年份
    * @param {String} title 事件标题
    * @param {String} label 事件标签（为空则使用标题）
    * @param {Int} importance 重要度
    * @param {String} desc 描述
    * @param {String} detail 细节
    * @param {String} era 时代 可为空
     */
    constructor(year, month, day, title, label = '', importance = 0, desc, detail, era = '') {
        // 确保年份是数字（JSON 可能返回字符串）
        this.year = Number(year);
        this.month = month ? Number(month) : null;
        this.day = day ? Number(day) : null;
        this.title = title;
        this.label = label;
        this.importance = importance;
        this.desc = desc;
        this.detail = detail;
        this.era = era;
    }
}

/**
 * 时间轴对象结构体
 */
class Timeline {
    /**
    * @param {String} id 
    * @param {String} title 
    * @param {MyEvent[]} events 
    * @param {String} color 
    * @param {String} category 
     */
    constructor(id, title, events, color, category) {
        this.id = id;
        this.title = title;
        this.color = color;
        this.category = category;
        this.events = events;
    }
}

class TimelineApp {
    constructor(timelineIndex, defaultTimelineIds) {
        /** @type {Timeline[]} */
        this.timelines = [];
        /** @type {Set<String>} */
        this.activeTimelines = new Set();
        this.minYear = 0;
        this.maxYear = 10000;
        this.viewStart = 1453;
        this.viewEnd = 2020;
        /** @type {timelineId: String, event: MyEvent} */
        this.selectedEvent = null;
        this.lastMouseX = 0;
        this.editingId = null;
        this.contextMenuTimelineId = null;
        this.showCurrentTime = true; // 是否显示当前时间刻度
        this._dpr = 1; // 设备像素比，默认为1，后续会在resizeCanvas中更新
        this.isMobile = false; // 是否为移动端，后续会在init中检测并设置

        // 拖拽相关
        this.dragging = false;
        this.hasDragged = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // 触摸相关
        this.touchState = {
            isTouching: false,
            touches: [],
            startTouches: [],
            startViewStart: 0,
            startViewEnd: 0,
            startDistance: 0,
            startCenterX: 0,
            startCenterY: 0,
            panStartViewStart: 0,
            panStartViewEnd: 0,
            longPressTimer: null,
            longPressDelay: 600, // 长按延迟毫秒
            isLongPress: false,
            touchStartTime: 0,
            cardTouchStart: null
        };

        // 初始化DOM对象池
        this._eventElements = new Map();

        this.canvas = document.getElementById('timelineCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvasContainer');

        this.init(timelineIndex, defaultTimelineIds);
    }

    async init(timelineIndex, defaultTimelineIds) {
        // 检测设备类型：是否为移动端（触摸设备或屏幕宽度<=1024px）
        this.isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;

        if (this.isMobile) {
            // 如果是微信浏览器，直接显示提示覆盖层，不加载其他内容
            if (this.isWeChatBrowser()) {
                const wechatOverlay = document.getElementById('wechatOverlay');
                if (wechatOverlay) wechatOverlay.classList.add('active');
                return;
            }

            // 初始检查屏幕方向（仅移动端）
            this.checkOrientation_Mobile();
        }
        this.setupEventListeners();
        this.setupRangeSlider();
        this.initTheme();
        this.initCurrentTimeToggle();
        this.updateFullscreenButtonState();
        this.resizeCanvas();

        // 加载时间轴数据
        await this.loadData(timelineIndex);

        // 默认激活时间轴（支持单个字符串或数组）
        const ids = Array.isArray(defaultTimelineIds) ? defaultTimelineIds : [defaultTimelineIds];
        ids.forEach(id => {
            if (this.timelines.find(t => t.id === id)) {
                this.activeTimelines.add(id);
            }
        });

        // 如果有激活的时间轴，重置视图并渲染
        if (this.activeTimelines.size > 0) {
            this.resetView();
        }

        this.renderSidebar();
        // 生成类别标签
        this.renderCategories();
    }

    /**
     * 根据INDEX，从Json中加载事件数据
     */
    async loadData(timelineIndex) {
        try {
            // 并行加载所有时间轴内容
            const loadPromises = timelineIndex.map(async (meta) => {
                const res = await fetch(meta.eventPath);
                /** @type {MyEvent[]} */
                const timelineEvents = await res.json();
                return new Timeline(
                    meta.id,
                    meta.title,
                    timelineEvents.map(e => new MyEvent(e.year, e.month, e.day, e.title, e.label, e.importance, e.desc, e.detail, e.era)),
                    meta.color,
                    meta.category
                );
            });

            this.timelines = await Promise.all(loadPromises);
        } catch (err) {
            console.error('加载时间轴数据失败:', err);
            this.showToast('数据加载失败');
            this.timelines = [];
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // Canvas交互
        this.canvas.addEventListener('click', (e) => {
            // 如果点击目标是DOM卡片，不处理（由卡片自己处理）
            if (e.target.closest('.event-card')) return;

            // 如果没有拖拽则取消选择
            if (!this.hasDragged) {
                this.selectedEvent = null;
                this.closeDetail();
                this.render(); // 会重新渲染DOM，移除active类
            }
        });
        // 鼠标移动（更新坐标并处理拖拽）
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));

        // 在Window上监听mouseup，防止无法取消拖拽
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.container.addEventListener('wheel', (e) => this.handleWheel(e));

        // 窗口调整
        const handleResize = () => {
            requestAnimationFrame(() => {
                this.resizeCanvas();
                this.render();
            });
        };
        window.addEventListener('resize', handleResize);

        // 键盘导航
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDetail();
            if (e.key === 'ArrowLeft') this.previousEvent();
            if (e.key === 'ArrowRight') this.nextEvent();
        });

        // 点击其他地方关闭右键菜单
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });

        // 视图范围输入框回车键支持
        const viewStartInput = document.getElementById('viewStartInput');
        const viewEndInput = document.getElementById('viewEndInput');
        if (viewStartInput && viewEndInput) {
            const handleEnter = (e) => {
                if (e.key === 'Enter') this.applyViewRange();
            };
            viewStartInput.addEventListener('keypress', handleEnter);
            viewEndInput.addEventListener('keypress', handleEnter);
        }

        // 当鼠标重新进入窗口时，检查左键是否已释放（按钮状态为0表示未按下）
        this.container.addEventListener('mouseenter', (e) => {
            if (this.dragging && e.buttons === 0) {
                // 如果正在拖拽状态但鼠标按钮未按下，说明在外部释放了，强制结束
                this.handleMouseUp();
            }
        });

        // 监听全屏状态变化，更新按钮样式
        const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
        fullscreenEvents.forEach(event => {
            document.addEventListener(event, () => this.updateFullscreenButtonState());
        });

        // 触摸事件支持
        if (this.isMobile) this.setupTouchEventListeners_Mobile();
    }

    /**
     * 设置触摸事件监听器（移动端）
     */
    setupTouchEventListeners_Mobile() {
        const container = this.container;

        // 触摸开始
        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });

        // 触摸移动
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });

        // 触摸结束
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        container.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // 初始化方向检测
        this.checkOrientation_Mobile();
        // 使用防抖优化resize事件
        const debouncedCheck = debounce(() => {
            this.checkOrientation_Mobile();
        }, 100);
        window.addEventListener('resize', () => {
            debouncedCheck();
            // 同步更新视口高度（修复 iOS Safari 底部工具栏）
            this.updateViewportHeight();
        });
        window.addEventListener('orientationchange', () => {
            this.checkOrientation_Mobile();
            // 方向变化后延迟重新计算，确保尺寸正确
            setTimeout(() => {
                this.updateViewportHeight();
                this.resizeCanvas();
                this.render();
            }, 100);
        });

    }

    /**
     * 检测是否是微信浏览器
     */
    isWeChatBrowser() {
        return /MicroMessenger/i.test(navigator.userAgent);
    }

    /**
     * 更新视口高度 CSS 变量（修复 iOS Safari 底部工具栏高度问题）
     */
    updateViewportHeight() {
        // 使用 window.innerHeight 获取真实可视高度（不包含 iOS Safari 底部工具栏）
        const vh = window.innerHeight;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    /**
     * 检查屏幕方向（仅移动端）
     */
    checkOrientation_Mobile() {
        const overlay = document.getElementById('orientationOverlay');
        if (!overlay) return;

        this.updateViewportHeight();

        // 使用多种方式检测横屏状态（提高兼容性）
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        const isLandscapeByAngle = Math.abs(window.orientation) === 90;
        const isLandscapeBySize = window.innerWidth > window.innerHeight;
        const isActuallyLandscape = isLandscape || isLandscapeByAngle || isLandscapeBySize;

        // 横屏时隐藏覆盖层
        if (isActuallyLandscape) {
            overlay.classList.remove('active');
            // 横屏后重新计算布局
            setTimeout(() => { this.resizeCanvas(); this.render(); }, 100);
        } else {
            // 竖屏时显示覆盖层
            overlay.classList.add('active');
        }
    }

    /**
     * 更新全屏按钮状态
     */
    updateFullscreenButtonState() {
        const btn = document.getElementById('fullscreenBtn');
        if (!btn) return;

        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement;

        if (isFullscreen) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    /**
     * 切换全屏模式
     */
    async toggleFullscreen() {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement ||
            document.mozFullScreenElement || document.msFullscreenElement;

        if (isFullscreen) {
            const exitFn = document.exitFullscreen || document.webkitExitFullscreen ||
                document.mozCancelFullScreen || document.msExitFullscreen;
            if (exitFn) await exitFn.call(document);
        } else {
            try {
                await requestFullscreen(document.documentElement);
                this.showToast('已进入全屏模式');
            } catch (err) {
                this.showToast('无法进入全屏模式');
            }
        }
        setTimeout(() => { this.resizeCanvas(); this.render(); }, 300);
    }

    /**
     * 进入全屏并锁定横屏
     */
    async enterFullscreenAndLock() {
        try {
            await requestFullscreen(document.documentElement);
            if (screen.orientation?.lock) {
                await screen.orientation.lock('landscape');
                this.showToast('已锁定横屏模式');
            } else {
                this.showToast('浏览器不支持，请手动旋转设备至横屏');
            }
            setTimeout(() => { this.resizeCanvas(); this.render(); }, 300);
        } catch (err) {
            this.showToast('浏览器不支持，请手动旋转设备至横屏');
        }
    }

    /**
     * 触摸开始处理
     */
    handleTouchStart(e) {
        e.preventDefault();

        const touches = e.touches;
        const state = this.touchState;

        state.touches = Array.from(touches);
        state.startTouches = Array.from(touches);
        state.isTouching = true;
        state.isLongPress = false;
        state.touchStartTime = Date.now();

        // 记录当前视图范围（用于缩放）
        state.startViewStart = this.viewStart;
        state.startViewEnd = this.viewEnd;

        if (touches.length === 1) {
            // 单指：可能是拖动或长按
            const touch = touches[0];
            state.startX = touch.clientX;
            state.startY = touch.clientY;

            // 检查是否点击在时间轴项上
            const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const timelineItem = target?.closest('.timeline-item');

            if (timelineItem) {
                // 在时间轴项上，设置长按定时器
                state.longPressTarget = timelineItem;
                state.longPressTimer = setTimeout(() => {
                    state.isLongPress = true;
                    this.handleLongPress(touch.clientX, touch.clientY, timelineItem);
                }, state.longPressDelay);
            } else {
                // 在画布上，启动拖动
                state.longPressTarget = null;
                this.dragging = true;
                this.hasDragged = false;
                this.dragStartX = touch.clientX;
                this.dragStartY = touch.clientY;
                this.lastMouseX = touch.clientX;
                this.container.classList.add('dragging');
            }
        } else if (touches.length === 2) {
            // 双指：准备缩放和平移
            state.startDistance = this.getTouchDistanceX(touches);
            // 记录起始中心点（用于平移计算）
            state.startCenterX = (touches[0].clientX + touches[1].clientX) / 2;
            state.startCenterY = (touches[0].clientY + touches[1].clientY) / 2;
            // 记录起始视图位置（用于平移）
            state.panStartViewStart = this.viewStart;
            state.panStartViewEnd = this.viewEnd;
            // 取消长按定时器
            if (state.longPressTimer) {
                clearTimeout(state.longPressTimer);
                state.longPressTimer = null;
            }
        }
    }

    /**
     * 触摸移动处理
     */
    handleTouchMove(e) {
        e.preventDefault();

        const touches = e.touches;
        const state = this.touchState;

        if (!state.isTouching) return;

        if (touches.length === 1 && state.touches.length === 1) {
            // 单指拖动
            const touch = touches[0];
            const dx = touch.clientX - state.startX;
            const dy = touch.clientY - state.startY;

            // 检测移动距离，如果移动超过阈值则取消长按
            if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
                if (state.longPressTimer) {
                    clearTimeout(state.longPressTimer);
                    state.longPressTimer = null;
                }

                if (!this.dragging && !state.longPressTarget) {
                    // 开始拖动
                    this.dragging = true;
                    this.hasDragged = false;
                    this.dragStartX = state.startX;
                    this.dragStartY = state.startY;
                    this.lastMouseX = state.startX;
                    this.container.classList.add('dragging');
                }
            }

            if (this.dragging) {
                // 检测是否移动超过阈值
                if (Math.abs(touch.clientX - this.dragStartX) > DRAG_THRESHOLD ||
                    Math.abs(touch.clientY - this.dragStartY) > DRAG_THRESHOLD) {
                    this.hasDragged = true;
                }

                this.handleDragMove(touch.clientX);
            }
        } else if (touches.length === 2 && state.startTouches.length === 2) {
            // 双指缩放 + 平移
            this.handlePinchMove(touches);
        }

        state.touches = Array.from(touches);
    }

    /**
     * 触摸结束处理
     */
    handleTouchEnd(e) {
        e.preventDefault();

        const state = this.touchState;
        const touches = e.touches;

        // 清除长按定时器
        if (state.longPressTimer) {
            clearTimeout(state.longPressTimer);
            state.longPressTimer = null;
        }

        if (touches.length === 0) {
            // 所有手指都离开
            state.isTouching = false;
            state.touches = [];

            // 结束拖动
            if (this.dragging) {
                this.dragging = false;
                this.container.classList.remove('dragging');
            }

            // 如果不是长按且没有拖动，则是点击
            if (!state.isLongPress && !this.hasDragged) {
                const touch = e.changedTouches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);

                // 检查是否点击在时间轴项上
                const timelineItem = target?.closest('.timeline-item');
                if (timelineItem && state.longPressTarget === timelineItem) {
                    // 触发点击
                    timelineItem.click();
                } else if (!target?.closest('.event-card')) {
                    // 点击空白处，取消选择
                    this.selectedEvent = null;
                    this.closeDetail();
                    this.render();
                }
            }

            state.longPressTarget = null;
            state.isLongPress = false;
            this.hasDragged = false;
        } else {
            // 还有手指在屏幕上（双指变单指）
            state.touches = Array.from(touches);
            state.startTouches = Array.from(touches);
            state.startDistance = touches.length === 2 ? this.getTouchDistanceX(touches) : 0;

            if (touches.length === 1) {
                // 双指松开一个变单指，更新单指拖动的起始状态
                state.startX = touches[0].clientX;
                state.startY = touches[0].clientY;
                // 使用当前视图位置作为单指拖动的起始点
                state.panStartViewStart = this.viewStart;
                state.panStartViewEnd = this.viewEnd;
                // 重置拖动状态，允许继续拖动
                this.dragging = false;
                this.hasDragged = false;
            }
        }
    }

    /**
     * 获取双指间距离
     */
    getTouchDistance(touches) {
        if (touches.length < 2) return 0;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    getTouchDistanceX(touches) {
        if (touches.length < 2) return 0;
        return Math.abs(touches[0].clientX - touches[1].clientX);
    }

    /**
     * 长按处理
     */
    handleLongPress(x, y, timelineItem) {
        // 长按处理：模拟右键菜单
        const index = Array.from(document.querySelectorAll('.timeline-item')).indexOf(timelineItem);
        if (index >= 0 && index < this.timelines.length) {
            this.showContextMenu({ clientX: x, clientY: y }, this.timelines[index].id);
        }
    }

    /**
     * 设置范围选择器
     */
    setupRangeSlider() {
        const slider = document.getElementById('rangeSlider');
        const leftHandle = document.getElementById('handleLeft');
        const rightHandle = document.getElementById('handleRight');
        const selection = document.getElementById('rangeSelection');

        let isDragging = null;
        let panStartLeft = 0;
        let panStartRight = 0;
        let panStartX = 0;

        const updateRange = () => {
            const left = parseFloat(leftHandle.style.left);
            const right = parseFloat(rightHandle.style.left);

            selection.style.left = left + '%';
            selection.style.width = (right - left) + '%';

            const totalSpan = this.maxYear - this.minYear;
            this.viewStart = this.minYear + (totalSpan * left / 100);
            this.viewEnd = this.minYear + (totalSpan * right / 100);

            // 更新滑块上的年份标签（当前视口范围）
            document.getElementById('handleLeftLabel').textContent = Math.round(this.viewStart);
            document.getElementById('handleRightLabel').textContent = Math.round(this.viewEnd);

            // 更新下方整体范围标签
            document.getElementById('extentMinLabel').textContent = Math.round(this.minYear);
            document.getElementById('extentMaxLabel').textContent = Math.round(this.maxYear);

            this.render();
        };

        // 合并鼠标和触摸的拖动逻辑
        const handleMove = (clientX) => {
            if (!isDragging) return;

            const rect = slider.getBoundingClientRect();
            let percent = ((clientX - rect.left) / rect.width) * 100;
            percent = clamp(percent, 0, 100);

            // 计算最小百分比跨度（对应MIN_YEAR_SPAN年）
            const totalSpan = this.maxYear - this.minYear;
            const minPercentSpan = totalSpan > 0 ? (MIN_YEAR_SPAN / totalSpan) * 100 : 5;

            if (isDragging === 'left') {
                const right = parseFloat(rightHandle.style.left);
                // 限制最小年份跨度
                if (percent < right - minPercentSpan) {
                    leftHandle.style.left = percent + '%';
                }
            } else if (isDragging === 'right') {
                const left = parseFloat(leftHandle.style.left);
                // 限制最小年份跨度
                if (percent > left + minPercentSpan) {
                    rightHandle.style.left = percent + '%';
                }
            } else if (isDragging === 'pan') {
                // 平移模式：整体移动选择区域
                const deltaPercent = percent - panStartX;
                let newLeft = panStartLeft + deltaPercent;
                let newRight = panStartRight + deltaPercent;

                // 边界检查
                if (newLeft < 0) {
                    newLeft = 0;
                    newRight = panStartRight - panStartLeft;
                }
                if (newRight > 100) {
                    newRight = 100;
                    newLeft = 100 - (panStartRight - panStartLeft);
                }

                leftHandle.style.left = newLeft + '%';
                rightHandle.style.left = newRight + '%';
            }

            updateRange();
        };

        const handleMouseMove = (e) => handleMove(e.clientX);
        const handleTouchMove = (e) => {
            e.preventDefault();
            handleMove(e.touches[0].clientX);
        };

        const stopDrag = () => {
            isDragging = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', stopDrag);
            document.removeEventListener('touchcancel', stopDrag);
            selection.classList.remove('panning');
        };

        const startDrag = (type, startX = 0) => {
            isDragging = type;
            panStartX = startX;
            if (type === 'pan') {
                panStartLeft = parseFloat(leftHandle.style.left);
                panStartRight = parseFloat(rightHandle.style.left);
                selection.classList.add('panning');
            }
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', stopDrag);
            document.addEventListener('touchcancel', stopDrag);
        };

        leftHandle.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag('left'); });
        leftHandle.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag('left'); }, { passive: false });

        rightHandle.addEventListener('mousedown', (e) => { e.preventDefault(); startDrag('right'); });
        rightHandle.addEventListener('touchstart', (e) => { e.preventDefault(); startDrag('right'); }, { passive: false });

        // 中间区域拖动平移
        const startPan = (e) => {
            e.preventDefault();
            const rect = slider.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
            if (clientX === undefined) return;
            const startX = ((clientX - rect.left) / rect.width) * 100;
            startDrag('pan', startX);
        };

        selection.addEventListener('mousedown', startPan);
        selection.addEventListener('touchstart', (e) => { startPan(e); }, { passive: false });
    }

    /**
     * 调整Canvas尺寸（考虑高DPR）
     */
    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // 设置 Canvas 实际像素尺寸（考虑设备像素比）
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);

        // 设置 Canvas CSS 尺寸
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // 缩放绘图上下文以适应高 DPR
        this.ctx.scale(dpr, dpr);

        // 保存 DPR 供其他方法使用
        this._dpr = dpr;
    }

    /**
     * 获取 Canvas 的 CSS 尺寸（逻辑像素）
     */
    getCanvasWidth() { return this.canvas.clientWidth; }
    getCanvasHeight() { return this.canvas.clientHeight; }

    /**
     * 边界检查：确保视图范围在有效范围内
     */
    clampViewBounds() {
        if (this.viewStart < this.minYear) {
            this.viewEnd += this.minYear - this.viewStart;
            this.viewStart = this.minYear;
        }
        if (this.viewEnd > this.maxYear) {
            this.viewStart -= this.viewEnd - this.maxYear;
            this.viewEnd = this.maxYear;
        }
    }

    /**
     * 绘制所有时间轴（Canvas）与事件（DOM）
     */
    render() {
        const ctx = this.ctx;
        const width = this.getCanvasWidth();
        const height = this.getCanvasHeight();

        // 清空Canvas
        ctx.clearRect(0, 0, width, height);

        if (this.activeTimelines.size === 0) {
            document.getElementById('emptyState').style.display = 'block';
            // 清空DOM
            this._eventElements.forEach(el => el.remove());
            this._eventElements.clear();
            document.getElementById('eventsOverlay').innerHTML = '';
            return;
        }
        document.getElementById('emptyState').style.display = 'none';

        // 绘制时间刻度
        this.renderTimeScale(ctx, width, height);

        // 计算可见时间轴
        const activeTimelinesData = this.timelines.filter(t => this.activeTimelines.has(t.id));
        const trackHeight = height / activeTimelinesData.length;

        // 绘制每个时间轴
        activeTimelinesData.forEach((timeline, index) => {
            this.renderTimelineTrack(ctx, timeline, index, trackHeight, width);
        });

        // 渲染DOM事件卡片（虚拟列表）
        this.renderEventDOMs(activeTimelinesData, trackHeight, width);

        // 更新范围选择器
        this.updateMinMaxFromActiveTimelines();
        this.updateRangeSlider();
    }

    /**
     * 渲染单个时间轴轨道
     */
    renderTimelineTrack(ctx, timeline, trackIndex, trackHeight, width) {
        const y = trackIndex * trackHeight;
        const centerY = y + trackHeight / 2;
        const color = timeline.color;

        // 绘制轨道标签
        ctx.fillStyle = color;
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(timeline.title, 20, y + 40);

        // 绘制时间线
        ctx.strokeStyle = color;
        ctx.lineWidth = TIMELINE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        const timeSpan = this.viewEnd - this.viewStart;

        // 在每个事件位置画时间点标记
        timeline.events.forEach(event => {
            if (event.year < this.viewStart || event.year > this.viewEnd) return;
            // 获取小数年份（考虑月份和日期）
            const decimalYear = this.getDecimalYear(event);
            if (decimalYear < this.viewStart || decimalYear > this.viewEnd) return;
            const x = ((decimalYear - this.viewStart) / timeSpan) * width;

            // 画小圆点
            ctx.beginPath();
            ctx.arc(x, centerY, 6, 0, Math.PI * 2);
            ctx.fillStyle = timeline.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, centerY, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        });
    }

    /**
     * 使用Canvas绘制年份刻度 + 当前时间刻度
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Number} width 视口宽度
     * @param {Number} height 视口高度
     */
    renderTimeScale(ctx, width, height) {
        const timeSpan = this.viewEnd - this.viewStart;

        // DPR调整 （在高DPR设备上，时间跨度看起来更大，需要适当增加刻度间隔以避免过密）
        const dpr = this._dpr || 1;
        const adjustedSpan = timeSpan * ((dpr - 1) * 0.5 + 1);
        const step = this.calculateTimeStep(adjustedSpan);

        // 根据视图范围动态决定重要刻度间隔（粗线）
        let majorStep;
        if (adjustedSpan > 2000) majorStep = 1000;
        else if (adjustedSpan > 1000) majorStep = 500;
        else if (adjustedSpan > 200) majorStep = 100;
        else if (adjustedSpan > 100) majorStep = 50;
        else majorStep = 10;

        // 绘制主刻度
        for (let t = Math.ceil(this.viewStart / step) * step; t <= this.viewEnd; t += step) {
            const x = ((t - this.viewStart) / timeSpan) * width;

            // 判断是否为重要刻度（粗线）
            const isMajor = Math.round(t) % majorStep === 0;

            // 刻度线
            ctx.strokeStyle = isMajor ? YEARSCALE_BOLD_COLOR : YEARSCALE_COLOR;
            ctx.lineWidth = isMajor ? YEARSCALE_BOLD_WIDTH : YEARSCALE_WIDTH;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // 年份标签
            ctx.fillStyle = isMajor ? '#94a3b8' : '#64748b';
            ctx.font = isMajor ? YEARSCALE_BOLD_FONT : YEARSCALE_FONT;
            ctx.textAlign = 'center';
            // 小数部分转换为月份显示
            const year = Math.floor(t);
            const fraction = t - year;
            // 电脑端上下都显示年份，移动端只在上方显示
            if (fraction > 0.001) {
                const month = Math.min(11, Math.floor(fraction * 12));
                ctx.fillText(`${year}.${month.toString().padStart(2, '0')}`, x, 20);
                if (!this.isMobile) ctx.fillText(`${year}.${month.toString().padStart(2, '0')}`, x, height - 10);
            } else {
                ctx.fillText(year.toString(), x, 20);
                if (!this.isMobile) ctx.fillText(year.toString(), x, height - 10);
            }
        }

        // 绘制当前时间刻度
        if (this.showCurrentTime) {
            const currentEvent = new MyEvent(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
            const currentDecimalYear = this.getDecimalYear(currentEvent);
            if (currentDecimalYear >= this.viewStart && currentDecimalYear <= this.viewEnd) {
                const x = ((currentDecimalYear - this.viewStart) / timeSpan) * width;

                // 刻度线
                ctx.strokeStyle = CURRENT_YEAR_COLOR;
                ctx.lineWidth = CURRENT_YEAR_WIDTH;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();

                // 当前年份标签
                ctx.fillStyle = CURRENT_YEAR_COLOR;
                ctx.font = CURRENT_YEAR_FONT;
                ctx.textAlign = 'center';
                ctx.fillText(this.formatEventDate(currentEvent), x, 35);
                if (!this.isMobile) ctx.fillText(this.formatEventDate(currentEvent), x, height - 25);
            }
        }

        ctx.textAlign = 'left';
    }

    /**
     * 使用差异更新更新DOM元素（标签与大卡片）
     * @param {Timeline[]} activeTimelinesData 
     * @param {Number} trackHeight 轨道Y轴位置
     * @param {Number} width Canvas的宽度
     */
    renderEventDOMs(activeTimelinesData, trackHeight, width) {
        const overlay = document.getElementById('eventsOverlay');
        const timeSpan = this.viewEnd - this.viewStart;

        // 收集当前应该显示的所有事件
        /** @type {Map<string, {x: number, y: number, event: MyEvent, timeline: Timeline, hasLabel: boolean}>} */
        const eventsToShow = new Map(); // key -> {x, y, event, timeline, hasLabel}

        activeTimelinesData.forEach((timeline, trackIndex) => {
            const centerY = trackIndex * trackHeight + trackHeight / 2;

            // 计算可见事件
            const visibleEvents = timeline.events
                .map(event => ({
                    event,
                    x: ((this.getDecimalYear(event) - this.viewStart) / timeSpan) * width,
                    importance: event.importance || 0,
                    decimalYear: this.getDecimalYear(event),
                    key: `${timeline.id}-${event.year}-${event.title}`
                }))
                .filter(item => item.x >= -150 && item.x <= width + 150);

            // 按重要度选择显示标签的
            const sorted = [...visibleEvents].sort((a, b) => {
                if (b.importance !== a.importance) return b.importance - a.importance;
                return a.decimalYear - b.decimalYear;
            });

            const showLabelSet = new Set();
            const labelPositions = [];

            sorted.forEach(item => {
                let hasSpace = true;
                for (const pos of labelPositions) {
                    if (Math.abs(item.x - pos) < MIN_LABEL_SPACING.get(this.isMobile)) {
                        hasSpace = false;
                        break;
                    }
                }
                if (hasSpace) {
                    showLabelSet.add(item.key);
                    labelPositions.push(item.x);
                }
            });

            // 存入Map
            visibleEvents.forEach(item => {
                eventsToShow.set(item.key, {
                    ...item,
                    timeline,
                    centerY,
                    hasLabel: showLabelSet.has(item.key)
                });
            });
        });

        // 1. 删除不再可见的DOM
        this._eventElements.forEach((el, key) => {
            if (!eventsToShow.has(key)) {
                el.remove();
                this._eventElements.delete(key);
            }
        });

        // 2. 更新或创建DOM
        const fragment = document.createDocumentFragment();

        eventsToShow.forEach((data, key) => {
            const { event, x, centerY, timeline, hasLabel } = data;
            const isSelected = this.selectedEvent?.event === event &&
                this.selectedEvent?.timelineId === timeline.id;

            let el = this._eventElements.get(key);

            if (!el) {
                // 新建DOM元素
                el = document.createElement('div');
                el.className = 'event-card';
                el.style.setProperty('--timeline-color', timeline.color);

                // 内容结构
                el.innerHTML = `
                <div class="event-label">${event.label || event.title}</div>
                <div class="event-popup">
                    <div class="year">${this.formatEventDate(event)}</div>
                    <div class="title">${event.desc || event.title}</div>
                    ${event.era ? `<div class="era">[${event.era}]</div>` : ''}
                </div>
            `;

                // 点击事件：打开详情面板
                el.addEventListener('click', (e) => {
                    // 如果操作是拖拽，不是点击，不打开面板
                    if (this.hasDragged) return;

                    // 防止触发Canvas点击（取消选择）
                    e.stopPropagation();
                    this.selectEvent(timeline, event, timeline.id);
                });

                // 移动端触摸支持
                el.addEventListener('touchstart', (e) => {
                    e.preventDefault();

                    const state = this.touchState;

                    if (e.touches.length === 1) {
                        // 单指：启动拖动
                        state.isTouching = true;
                        this.dragging = true;
                        this.hasDragged = false;
                        this.dragStartX = e.touches[0].clientX;
                        this.dragStartY = e.touches[0].clientY;
                        this.lastMouseX = e.touches[0].clientX;
                        this.container.classList.add('dragging');

                        state.cardTouchStart = {
                            x: e.touches[0].clientX,
                            y: e.touches[0].clientY,
                            time: Date.now()
                        };
                    } else if (e.touches.length === 2) {
                        // 双指：切换到缩放模式（第二个手指按下时）
                        // 取消单指拖动
                        this.dragging = false;
                        this.container.classList.remove('dragging');

                        // 设置双指缩放状态
                        state.touches = Array.from(e.touches);
                        state.startTouches = Array.from(e.touches);
                        state.startDistance = this.getTouchDistanceX(e.touches);
                        state.startCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                        state.startCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
                        state.panStartViewStart = this.viewStart;
                        state.panStartViewEnd = this.viewEnd;
                    }
                }, { passive: false });

                el.addEventListener('touchmove', (e) => {
                    // 阻止浏览器默认行为，防止左右滑动导航
                    e.preventDefault();

                    const touch = e.touches[0];
                    const state = this.touchState;

                    if (e.touches.length === 1 && this.dragging) {
                        // 单指拖动
                        if (Math.abs(touch.clientX - this.dragStartX) > DRAG_THRESHOLD ||
                            Math.abs(touch.clientY - this.dragStartY) > DRAG_THRESHOLD) {
                            this.hasDragged = true;
                        }
                        this.handleDragMove(touch.clientX);
                    } else if (e.touches.length === 2 && state.startTouches.length === 2) {
                        // 双指缩放（因为事件不会冒泡到容器，在这里处理）
                        this.handlePinchMove(e.touches);
                    }

                    // 更新状态
                    state.touches = Array.from(e.touches);
                }, { passive: false });

                el.addEventListener('touchend', (e) => {
                    // 结束拖动
                    if (this.dragging) {
                        this.dragging = false;
                        this.container.classList.remove('dragging');
                    }

                    if (this.touchState.cardTouchStart && !this.hasDragged) {
                        const touch = e.changedTouches[0];
                        const start = this.touchState.cardTouchStart;
                        const dx = touch.clientX - start.x;
                        const dy = touch.clientY - start.y;
                        const dt = Date.now() - start.time;

                        // 如果移动很小且时间短，视为点击
                        if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.selectEvent(timeline, event, timeline.id);
                        }
                    }
                    this.hasDragged = false;
                    this.touchState.cardTouchStart = null;
                }, { passive: false });

                // 在标签上按下鼠标也能启动拖拽，并阻止文本选择
                el.addEventListener('mousedown', (e) => this.handleMouseDown(e));

                this._eventElements.set(key, el);
                fragment.appendChild(el);
            }

            // 更新位置和状态（无论新旧）
            el.style.left = `${x}px`;
            el.style.top = `${centerY}px`;
            el.classList.toggle('active', isSelected);
            el.classList.toggle('has-label', hasLabel);
            el.classList.toggle('no-label', !hasLabel);

            // 标签可见性控制（通过CSS）
            const label = el.querySelector('.event-label');
            if (label) {
                label.style.display = hasLabel ? 'block' : 'none';
            }
        });

        if (fragment.children.length > 0) {
            overlay.appendChild(fragment);
        }
    }

    /**
     * 渲染侧边栏
     */
    renderSidebar() {
        const list = document.getElementById('timelineList');
        list.innerHTML = '';

        this.timelines.forEach(timeline => {
            const item = document.createElement('div');
            item.className = 'timeline-item' + (this.activeTimelines.has(timeline.id) ? ' active' : '');
            item.innerHTML = `
                <div class="timeline-color-indicator" style="background: ${timeline.color}"></div>
                <div class="timeline-item-content">
                    <div class="timeline-item-title">${timeline.title}</div>
                    <div class="timeline-item-meta">
                        <span class="timeline-item-category">${timeline.category}</span>
                        <span>${timeline.events.length} 个事件</span>
                    </div>
                </div>
            `;
            item.onclick = () => this.toggleTimeline(timeline.id);
            item.oncontextmenu = (e) => {
                e.preventDefault();
                this.showContextMenu(e, timeline.id);
            };

            // 移动端长按支持
            let longPressTimer = null;
            item.addEventListener('touchstart', (e) => {
                longPressTimer = setTimeout(() => {
                    e.preventDefault();
                    const touch = e.touches[0];
                    this.showContextMenu({ clientX: touch.clientX, clientY: touch.clientY }, timeline.id);
                }, 600);
            }, { passive: false });

            item.addEventListener('touchend', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });

            item.addEventListener('touchmove', () => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
            });

            list.appendChild(item);
        });
    }

    /**
     * 渲染类别标签
     */
    renderCategories() {
        const filter = document.getElementById('categoryFilter');
        const categories = [...new Set(this.timelines.map(t => t.category))];

        // filter.innerHTML = '<span class="category-tag" onclick="app.filterCategory(\'all\')">全部</span>';
        categories.forEach(cat => {
            filter.innerHTML += `<span class="category-tag" onclick="app.filterCategory('${cat}')">${cat}</span>`;
        });
    }

    /**
     * 切换时间轴可视性
     * @param {String} id 时间轴id
     */
    toggleTimeline(id) {
        const wasEmpty = this.activeTimelines.size === 0;

        if (this.activeTimelines.has(id)) this.activeTimelines.delete(id);
        else this.activeTimelines.add(id);
        this.renderSidebar();

        if (wasEmpty && this.activeTimelines.size > 0) {
            // 从空状态变为有内容，重置视图
            this.resetView();
        } else if (this.activeTimelines.size > 0) {
            // 计算新的时间范围
            let newMin = Infinity, newMax = -Infinity;
            this.timelines
                .filter(t => this.activeTimelines.has(t.id))
                .forEach(t => {
                    t.events.forEach(e => {
                        if (e.year < newMin) newMin = e.year;
                        if (e.year > newMax) newMax = e.year;
                    });
                });
            const newSpan = newMax - newMin;
            const currentSpan = this.viewEnd - this.viewStart;

            // 只有当新范围比当前视图范围小时才重置视图
            if (newSpan < currentSpan) {
                this.resetView();
            } else {
                // 否则只更新范围选择器的数据，保持当前视图
                this.updateMinMaxFromActiveTimelines();
                this.updateRangeSlider();
                this.render();
            }
        } else {
            // 没有激活的时间轴了
            this.render();
        }
    }

    /**
     * 切换侧边栏收起/展开
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        sidebar.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');

        // 动画期间持续重绘以保持流畅
        const startTime = performance.now();
        // 从 CSS 变量读取动画时长，保持与 CSS 同步
        const duration = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--sidebar-animation-duration')) || 300;

        const animate = (now) => {
            const elapsed = now - startTime;
            this.resizeCanvas();
            this.render();
            if (elapsed < duration) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * 切换日夜模式
     */
    toggleTheme() {
        const html = document.documentElement;
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');
        const currentTheme = html.getAttribute('data-theme');

        if (currentTheme === 'light') {
            html.removeAttribute('data-theme');
            themeIcon.textContent = '☀️';
            themeText.textContent = '日间';
        } else {
            html.setAttribute('data-theme', 'light');
            themeIcon.textContent = '🌙';
            themeText.textContent = '夜间';
        }

        // 重绘以应用新主题
        this.render();
    }

    /**
     * 初始化主题（默认夜间模式）
     */
    initTheme() {
        const themeIcon = document.getElementById('themeIcon');
        const themeText = document.getElementById('themeText');

        // 默认夜间模式（无需从localStorage读取）
        themeIcon.textContent = '☀️';
        themeText.textContent = '日间';
    }

    /**
     * 初始化当前时间刻度按钮状态
     */
    initCurrentTimeToggle() {
        const btn = document.getElementById('currentTimeToggle');
        if (this.showCurrentTime && btn) {
            btn.classList.add('active');
        }
    }

    /**
     * 切换当前时间刻度显示
     */
    toggleCurrentTime() {
        this.showCurrentTime = !this.showCurrentTime;
        const btn = document.getElementById('currentTimeToggle');

        if (this.showCurrentTime) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }

        this.render();
    }

    filterCategory(category) {
        if (category === 'all') {
            this.timelines.forEach(t => this.activeTimelines.add(t.id));
        } else {
            this.activeTimelines.clear();
            this.timelines.filter(t => t.category === category).forEach(t => this.activeTimelines.add(t.id));
        }

        this.resetView();
        this.renderSidebar();
        this.render();
    }

    /**
     * 将 year/month/day 转换为小数年份,如：1979年10月21日 → 1979.805
     * 支持负数月份/日期（如 -6）：用于偏移计算但不显示
     * @param {MyEvent} event 事件对象，包含 year, month, day
     * @return {Number} 转换后的小数年份
     */
    getDecimalYear(event) {
        if (!event.month || event.month === '') return event.year;

        // 处理负数月份（用于偏移但不显示）
        const month = Math.abs(event.month);

        // 月份转换为年的小数：1月=0, 12月≈0.92
        const monthFraction = (month - 1) / 12;

        // 日期转换为月的小数，再转为年的小数
        let dayFraction = 0;
        if (event.day && event.day !== '') {
            const day = Math.abs(event.day);
            const daysInMonth = new Date(event.year, month, 0).getDate(); // 获取该月总天数
            dayFraction = (day - 1) / daysInMonth / 12;
        }

        return event.year + monthFraction + dayFraction;
    }

    /**
     * 格式化显示日期，如 "1979.10.21" 或 "1979.10" 或 "1979"
     * 支持负数月份/日期（如 -6）：只进行偏移计算但不显示
     * 年份为负时显示为 "前XX年" 格式
     * @param {MyEvent} event 事件对象，包含 year, month, day
     * @returns {String} 格式化后的日期字符串，如 "1979.10.21" 或 "前200年"
     */
    formatEventDate(event) {
        const yearStr = event.year < 0 ? `前${-event.year}` : event.year.toString();
        // 无月份或月份为负数（用于偏移但不显示）时，只显示年份
        if (!event.month || event.month === '' || event.month < 0) return yearStr;
        // 有月份但无日期或日期为负数时，显示年.月
        if (!event.day || event.day === '' || event.day < 0) return `${yearStr}.${event.month.toString().padStart(2, '0')}`;
        // 有月份和正数日期时，显示年.月.日
        return `${yearStr}.${event.month.toString().padStart(2, '0')}.${event.day.toString().padStart(2, '0')}`;
    }

    /**
     * 获取详细日期描述，如 "1979.10.21" 或 "公元前200年"
     * 年份为负时显示为 "公元前XX年" 格式
     * @param {MyEvent} event 事件对象，包含 year, month, day, era
     * @returns {String} 格式化后的日期字符串
     */
    getDetailedDateDesc(event) {
        const yearStr = event.year < 0 ? `公元前${-event.year}` : event.year.toString();
        // 无月份或月份为负数时，只显示年份
        if (!event.month || event.month === '' || event.month < 0) {
            return event.era ? `${yearStr} (${event.era})` : yearStr;
        }
        // 有月份时，显示年.月（使用阿拉伯数字年份）
        const dateStr = `${event.year < 0 ? yearStr : yearStr}.${event.month.toString().padStart(2, '0')}`;
        if (!event.day || event.day === '' || event.day < 0) {
            return event.era ? `${dateStr} (${event.era})` : dateStr;
        }
        // 有月份和日期时，显示年.月.日
        const fullDateStr = `${dateStr}.${event.day.toString().padStart(2, '0')}`;
        return event.era ? `${fullDateStr} (${event.era})` : fullDateStr;
    }

    /**
     * 更新Min year与Max year
     */
    updateMinMaxFromActiveTimelines() {
        if (this.activeTimelines.size === 0) return;

        let min = Infinity;
        let max = -Infinity;

        this.timelines
            .filter(t => this.activeTimelines.has(t.id))
            .forEach(t => {
                t.events.forEach(e => {
                    if (e.year < min) min = e.year;
                    if (e.year > max) max = e.year;
                });
            });

        // 添加边距
        const padding = (max - min) * PADDING_AMOUNT;
        this.minYear = Math.floor(min - padding);
        this.maxYear = Math.ceil(max + padding);

        // 确保视图范围在值域内
        this.viewStart = Math.max(this.minYear, this.viewStart);
        this.viewEnd = Math.min(this.maxYear, this.viewEnd);
    }

    /**
     * 计算当前缩放下竖线的间距
     * @param {Number} span 总年份
     * @returns 间距
     */
    calculateTimeStep(span) {
        if (span > 5000) return 500;
        if (span > 1000) return 100;
        if (span > 500) return 50;
        if (span > 100) return 10;
        if (span > 50) return 5;
        if (span > 10) return 1;
        return 0.5;
    }

    /**
     * 处理拖动移动（通用于鼠标和触摸）
     * @param {Number} clientX - 当前 X 坐标
     */
    handleDragMove(clientX) {
        if (!this.dragging) return;

        const deltaX = clientX - this.lastMouseX;
        const timeSpan = this.viewEnd - this.viewStart;
        const timeDelta = (deltaX / this.getCanvasWidth()) * timeSpan;

        this.viewStart -= timeDelta;
        this.viewEnd -= timeDelta;

        this.clampViewBounds();
        this.updateRangeSlider();
        this.render();
        this.lastMouseX = clientX;
    }

    /**
     * 处理双指缩放（通用于容器和事件卡片）
     * @param {TouchList} touches - 触摸列表
     */
    handlePinchMove(touches) {
        const state = this.touchState;
        const currentDistance = this.getTouchDistanceX(touches);

        if (state.startDistance <= 0) return;

        // 1. 计算缩放
        const scale = currentDistance / state.startDistance;
        const startSpan = state.panStartViewEnd - state.panStartViewStart;
        let newSpan = startSpan / scale;

        // 限制缩放范围
        const maxSpan = this.maxYear - this.minYear;
        newSpan = clamp(newSpan, MIN_YEAR_SPAN, maxSpan);

        // 2. 计算双指中心点的移动（平移）
        const currentCenterX = (touches[0].clientX + touches[1].clientX) / 2;
        const deltaCenterX = currentCenterX - state.startCenterX;

        const rect = this.canvas.getBoundingClientRect();
        const canvasWidth = this.getCanvasWidth();

        // 计算平移对应的时间变化
        const timeDelta = (deltaCenterX / canvasWidth) * newSpan;

        // 3. 计算中心点对应的时间位置（考虑缩放后的位置）
        const centerRatio = (state.startCenterX - rect.left) / canvasWidth;
        const centerTime = state.panStartViewStart + centerRatio * startSpan;

        // 4. 综合缩放和平移计算新视图
        let newStart = centerTime - centerRatio * newSpan - timeDelta;
        let newEnd = centerTime + (1 - centerRatio) * newSpan - timeDelta;

        // 5. 边界检查
        if (newStart < this.minYear) {
            newStart = this.minYear;
            newEnd = this.minYear + newSpan;
        }
        if (newEnd > this.maxYear) {
            newEnd = this.maxYear;
            newStart = this.maxYear - newSpan;
        }

        this.viewStart = newStart;
        this.viewEnd = newEnd;
        this.updateRangeSlider();
        this.render();
    }

    /**
     * 鼠标移动处理
     */
    handleMouseMove(e) {
        if (this.dragging) {
            // 检测是否移动超过阈值
            const dx = Math.abs(e.clientX - this.dragStartX);
            const dy = Math.abs(e.clientY - this.dragStartY);
            if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
                this.hasDragged = true;
            }

            this.handleDragMove(e.clientX);
        }
    }

    /**
     * 鼠标按下处理
     */
    handleMouseDown(e) {
        if (e.button === 0) {
            this.dragging = true;
            this.dragStartX = e.clientX;  // 记录起始位置
            this.dragStartY = e.clientY;
            this.hasDragged = false;      // 重置拖拽标志
            this.lastMouseX = e.clientX;
            this.container.classList.add('dragging');
        }
    }

    /**
     * 鼠标释放处理
     */
    handleMouseUp() {
        if (!this.dragging) return; // 如果没在拖拽，直接返回
        this.dragging = false;
        this.lastMouseX = 0;
        this.container.classList.remove('dragging');
    }

    /**
     * 滚轮缩放处理
     */
    handleWheel(e) {
        // 防止页面滚动
        e.preventDefault();

        // 获取鼠标相对于Canvas的位置
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const width = this.getCanvasWidth();

        // 计算鼠标指针当前对应的时间点（世界坐标）
        const timeSpan = this.viewEnd - this.viewStart;
        const mouseTime = this.viewStart + (mouseX / width) * timeSpan;

        // 计算缩放
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        let newSpan = timeSpan * zoomFactor;

        // 限制最大缩放范围（不能小于当前时间轴总跨度）
        const maxSpan = this.maxYear - this.minYear;
        newSpan = clamp(newSpan, MIN_YEAR_SPAN, maxSpan);

        // 计算鼠标位置在视口中的比例（0到1之间）
        const ratio = mouseX / width;

        // 以鼠标位置为中心计算新的视图范围
        let newStart = mouseTime - ratio * newSpan;
        let newEnd = mouseTime + (1 - ratio) * newSpan;

        // 边界检查与调整：如果超出边界，进行硬裁剪
        if (newStart < this.minYear) {
            newStart = this.minYear;
            newEnd = this.minYear + newSpan;
        }
        if (newEnd > this.maxYear) {
            newEnd = this.maxYear;
            newStart = this.maxYear - newSpan;
        }

        this.viewStart = newStart;
        this.viewEnd = newEnd;
        this.updateRangeSlider();
        this.render();
    }

    /**
     * 更新范围选择器
     */
    updateRangeSlider() {
        const totalSpan = this.maxYear - this.minYear;
        const left = ((this.viewStart - this.minYear) / totalSpan) * 100;
        const right = ((this.viewEnd - this.minYear) / totalSpan) * 100;

        document.getElementById('handleLeft').style.left = left + '%';
        document.getElementById('handleRight').style.left = right + '%';
        document.getElementById('rangeSelection').style.left = left + '%';
        document.getElementById('rangeSelection').style.width = (right - left) + '%';

        // 更新滑块上的年份标签（当前视口范围）
        document.getElementById('handleLeftLabel').textContent = Math.round(this.viewStart);
        document.getElementById('handleRightLabel').textContent = Math.round(this.viewEnd);

        // 更新下方整体范围标签
        document.getElementById('extentMinLabel').textContent = Math.round(this.minYear);
        document.getElementById('extentMaxLabel').textContent = Math.round(this.maxYear);

        // 更新工具栏输入框
        const viewStartInput = document.getElementById('viewStartInput');
        const viewEndInput = document.getElementById('viewEndInput');
        if (viewStartInput && viewEndInput) {
            viewStartInput.value = Math.round(this.viewStart);
            viewEndInput.value = Math.round(this.viewEnd);
        }
    }

    /**
     * 应用用户输入的视图范围
     */
    applyViewRange() {
        const startInput = document.getElementById('viewStartInput');
        const endInput = document.getElementById('viewEndInput');

        let start = parseInt(startInput.value);
        let end = parseInt(endInput.value);

        if (isNaN(start) || isNaN(end)) {
            this.showToast('请输入有效的年份');
            return;
        }

        // 确保起始小于结束
        if (start >= end) {
            this.showToast('起始年份必须小于结束年份');
            return;
        }

        // 限制最小跨度
        const span = end - start;
        if (span < MIN_YEAR_SPAN) {
            end = start + MIN_YEAR_SPAN;
            this.showToast(`视图范围至少${MIN_YEAR_SPAN}年，已自动调整`);
        }

        // 边界检查
        start = clamp(start, this.minYear, this.maxYear);
        end = clamp(end, this.minYear, this.maxYear);

        this.viewStart = start;
        this.viewEnd = end;

        this.updateRangeSlider();
        this.render();
    }

    /**
     * 选中事件
     * @param {Timeline} timeline 时间轴
     * @param {MyEvent} event 选中的事件
     * @param {String} timelineId 时间轴ID
     */
    selectEvent(timeline, event, timelineId) {
        this.selectedEvent = { timelineId, event };
        this.render();

        // 填充详情面板
        document.getElementById('detailYear').textContent = this.getDetailedDateDesc(event);
        document.getElementById('detailTitle').textContent = event.title;
        document.getElementById('detailDesc').textContent = event.desc || '暂无简介';
        // 将换行符分隔的文本转换为段落 HTML，以便 CSS 控制段间距
        const detailText = event.detail || '暂无详细信息';
        // 先统一换行符为 \n，再分割
        const paragraphs = detailText.replace(/\r\n/g, '\n').split('\n').map(p => p.trim()).filter(p => p);
        const detailHtml = paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('');
        document.getElementById('detailContent').innerHTML = detailHtml;
        document.getElementById('detailTimeline').textContent = timeline.title;
        document.getElementById('detailTimeline').style.color = timeline.color;
        document.getElementById('detailEra').textContent = event.era || '-';
        // 滚动详情面板内容区域回顶部
        document.querySelector('.detail-content').scrollTop = 0;

        // 打开面板
        document.getElementById('detailPanel').classList.add('open');
    }

    closeDetail() {
        document.getElementById('detailPanel').classList.remove('open');
        this.selectedEvent = null;
        this.render();
    }

    resetView() {
        if (this.activeTimelines.size === 0) return;

        // 计算并设置视图范围
        this.updateMinMaxFromActiveTimelines();
        const margin = (this.maxYear - this.minYear) * VIEWPORT_MARGIN;
        this.viewStart = this.minYear + margin;
        this.viewEnd = this.maxYear - margin;

        this.updateRangeSlider();
        this.render();
    }

    previousEvent() {
        if (!this.selectedEvent) return;

        const timeline = this.timelines.find(t => t.id === this.selectedEvent.timelineId);
        const idx = timeline.events.indexOf(this.selectedEvent.event);
        if (idx > 0) {
            this.selectEvent(timeline, timeline.events[idx - 1], timeline.id);
        }
    }

    nextEvent() {
        if (!this.selectedEvent) return;

        const timeline = this.timelines.find(t => t.id === this.selectedEvent.timelineId);
        const idx = timeline.events.indexOf(this.selectedEvent.event);
        if (idx < timeline.events.length - 1) {
            this.selectEvent(timeline, timeline.events[idx + 1], timeline.id);
        }
    }

    editTimeline(id) {
        const timeline = this.timelines.find(t => t.id === id);
        if (!timeline) return;

        this.editingId = id;
        document.getElementById('modalTitle').textContent = '编辑时间轴';
        document.getElementById('inputTitle').value = timeline.title;
        document.getElementById('inputCategory').value = timeline.category;
        document.getElementById('inputColor').value = timeline.color;
        document.getElementById('inputEvents').value = JSON.stringify(timeline.events, null, 2);
        document.getElementById('btnDelete').style.display = 'inline-block';
        document.getElementById('timelineModal').classList.add('active');
    }

    saveTimeline() {
        const title = document.getElementById('inputTitle').value.trim();
        const category = document.getElementById('inputCategory').value;
        const color = document.getElementById('inputColor').value;
        const eventsText = document.getElementById('inputEvents').value.trim();

        if (!title) {
            this.showToast('请输入时间轴标题');
            return;
        }

        let events = [];
        if (eventsText) {
            try {
                events = JSON.parse(eventsText);
            } catch (e) {
                this.showToast('JSON格式错误：' + e.message);
                return;
            }
        }

        if (this.editingId) {
            const timeline = this.timelines.find(t => t.id === this.editingId);
            timeline.title = title;
            timeline.category = category;
            timeline.color = color;
            timeline.events = events;
        } else {
            const newTimeline = {
                id: 'timeline-' + Date.now(),
                title,
                category,
                color,
                events
            };
            this.timelines.push(newTimeline);
            this.activeTimelines.add(newTimeline.id);
        }

        this.closeModal();
        this.renderSidebar();
        this.renderCategories();
        this.render();
        this.showToast('保存成功');
    }

    deleteTimeline() {
        if (!this.editingId) return;

        if (confirm('确定要删除这个时间轴吗？')) {
            this.timelines = this.timelines.filter(t => t.id !== this.editingId);
            this.activeTimelines.delete(this.editingId);
            this.closeModal();
            this.renderSidebar();
            this.renderCategories();
            this.render();
            this.showToast('已删除');
        }
    }

    // 右键菜单相关方法
    showContextMenu(e, timelineId) {
        this.contextMenuTimelineId = timelineId;
        const menu = document.getElementById('contextMenu');

        // 支持鼠标事件和触摸事件
        let x = e.clientX;
        let y = e.clientY;

        // 确保菜单不会超出屏幕
        const menuWidth = 120;
        const menuHeight = 80;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (x + menuWidth > windowWidth) {
            x = windowWidth - menuWidth - 10;
        }
        if (y + menuHeight > windowHeight) {
            y = windowHeight - menuHeight - 10;
        }

        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.add('active');
    }

    hideContextMenu() {
        this.contextMenuTimelineId = null;
        document.getElementById('contextMenu').classList.remove('active');
    }

    editFromContextMenu() {
        if (this.contextMenuTimelineId) {
            this.editTimeline(this.contextMenuTimelineId);
            this.hideContextMenu();
        }
    }

    deleteFromContextMenu() {
        if (!this.contextMenuTimelineId) return;

        if (confirm('确定要删除这个时间轴吗？')) {
            this.timelines = this.timelines.filter(t => t.id !== this.contextMenuTimelineId);
            this.activeTimelines.delete(this.contextMenuTimelineId);
            this.renderSidebar();
            this.renderCategories();
            this.render();
            this.showToast('已删除');
        }
        this.hideContextMenu();
    }

    closeModal() {
        document.getElementById('timelineModal').classList.remove('active');
    }

    importData() {
        document.getElementById('ioModalTitle').textContent = '导入数据';
        document.getElementById('jsonPreview').textContent = '';
        document.getElementById('importSection').style.display = 'block';
        document.getElementById('btnImport').style.display = 'inline-block';
        document.getElementById('ioModal').classList.add('active');
    }

    exportData() {
        const data = JSON.stringify(this.timelines, null, 2);
        document.getElementById('ioModalTitle').textContent = '导出数据';
        document.getElementById('jsonPreview').textContent = data;
        document.getElementById('importSection').style.display = 'none';
        document.getElementById('btnImport').style.display = 'none';
        document.getElementById('ioModal').classList.add('active');
    }

    closeIOModal() {
        document.getElementById('ioModal').classList.remove('active');
    }

    copyToClipboard() {
        const text = document.getElementById('jsonPreview').textContent;
        navigator.clipboard.writeText(text).then(() => {
            this.showToast('已复制到剪贴板');
        });
    }

    importFromInput() {
        const text = document.getElementById('importInput').value.trim();
        if (!text) {
            this.showToast('请输入JSON数据');
            return;
        }

        try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
                this.timelines = data;
                this.activeTimelines.clear();
                this.timelines.forEach(t => this.activeTimelines.add(t.id));
                this.closeIOModal();
                this.renderSidebar();
                this.renderCategories();
                this.resetView();
                this.showToast('导入成功');
            } else {
                throw new Error('数据必须是数组格式');
            }
        } catch (e) {
            this.showToast('导入失败：' + e.message);
        }
    }

    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
}
