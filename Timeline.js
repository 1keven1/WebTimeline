'use strict'
const MIN_LABEL_SPACING = 25; // 标签间最小像素间距


class TimelineApp {
    constructor() {
        this.timelines = [];
        this.activeTimelines = new Set();
        this.currentZoom = 1;
        this.minYear = 0;
        this.maxYear = 10000;
        this.viewStart = 1453;
        this.viewEnd = 2020;
        this.mouseX = 0;
        this.mouseY = 0;
        this.hoveredEvent = null;
        this.selectedEvent = null;
        this.lastMouseX = 0;
        this.editingId = null;

        // 拖拽相关
        this.dragging = false;
        this.hasDragged = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragThreshold = 3; // 移动超过3px视为拖拽

        // 初始化DOM对象池
        this._eventElements = new Map();

        this.canvas = document.getElementById('timelineCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvasContainer');

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupRangeSlider();
        this.renderSidebar();
        this.renderCategories();
        this.resizeCanvas();

        this.loadData().then(() => {
            // 默认激活三体时间轴
            const threeBody = this.timelines.find(t => t.id === 'three-body');
            if (threeBody) this.toggleTimeline(threeBody.id); 
        })
    }

    async loadData() {
        try {
            // 1. 加载注册表（这是分类的唯一来源）
            const indexRes = await fetch('./Timelines.json');
            const timelineIndex = await indexRes.json();

            // 2. 并行加载所有时间轴内容
            const loadPromises = timelineIndex.map(async (meta) => {
                const res = await fetch(`./${meta.file}`);
                const timelineData = await res.json();
                return {
                    ...timelineData,
                    category: meta.category,  // 强制使用 index 的分类
                };
            });

            this.timelines = await Promise.all(loadPromises);
        } catch (err) {
            console.error('加载时间轴数据失败:', err);
            this.showToast('数据加载失败');
            this.timelines = [];
        }
    }

    setupEventListeners() {
        // Canvas交互
        this.canvas.addEventListener('click', (e) => {
            // 如果点击目标是DOM卡片，不处理（由卡片自己处理）
            if (e.target.closest('.event-card')) return;

            // 如果没有拖拽则取消选择
            if(!this.hasDragged){
                this.selectedEvent = null;
                this.closeDetail();
                this.render(); // 会重新渲染DOM，移除active类
            }
        });
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        // 在Window上监听mouseup，防止无法取消拖拽
        window.addEventListener('mouseup', () => this.handleMouseUp());
        this.container.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });

        // 窗口调整
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.render();
        });

        // 键盘导航
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeDetail();
            if (e.key === 'ArrowLeft') this.previousEvent();
            if (e.key === 'ArrowRight') this.nextEvent();
        });

        // 当鼠标重新进入窗口时，检查左键是否已释放（按钮状态为0表示未按下）
        this.container.addEventListener('mouseenter', (e) => {
            if (this.dragging && e.buttons === 0) {
                // 如果正在拖拽状态但鼠标按钮未按下，说明在外部释放了，强制结束
                this.handleMouseUp();
            }
        });
    }

    setupRangeSlider() {
        const slider = document.getElementById('rangeSlider');
        const leftHandle = document.getElementById('handleLeft');
        const rightHandle = document.getElementById('handleRight');
        const selection = document.getElementById('rangeSelection');

        let isDragging = null;

        const updateRange = () => {
            const left = parseFloat(leftHandle.style.left);
            const right = parseFloat(rightHandle.style.left);

            selection.style.left = left + '%';
            selection.style.width = (right - left) + '%';

            const totalSpan = this.maxYear - this.minYear;
            this.viewStart = this.minYear + (totalSpan * left / 100);
            this.viewEnd = this.minYear + (totalSpan * right / 100);

            document.getElementById('rangeStartLabel').textContent = Math.round(this.viewStart);
            document.getElementById('rangeEndLabel').textContent = Math.round(this.viewEnd);

            this.render();
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const rect = slider.getBoundingClientRect();
            let percent = ((e.clientX - rect.left) / rect.width) * 100;
            percent = Math.max(0, Math.min(100, percent));

            if (isDragging === 'left') {
                const right = parseFloat(rightHandle.style.left);
                if (percent < right - 5) {
                    leftHandle.style.left = percent + '%';
                }
            } else if (isDragging === 'right') {
                const left = parseFloat(leftHandle.style.left);
                if (percent > left + 5) {
                    rightHandle.style.left = percent + '%';
                }
            }

            updateRange();
        };

        const handleMouseUp = () => {
            isDragging = null;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        leftHandle.addEventListener('mousedown', (e) => {
            isDragging = 'left';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });

        rightHandle.addEventListener('mousedown', (e) => {
            isDragging = 'right';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }

    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

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
            item.ondblclick = () => this.editTimeline(timeline.id);
            list.appendChild(item);
        });
    }

    renderCategories() {
        const filter = document.getElementById('categoryFilter');
        const categories = [...new Set(this.timelines.map(t => t.category))];

        filter.innerHTML = '<span class="category-tag active" onclick="app.filterCategory(\'all\')">全部</span>';
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

        // 如果从空状态变为有内容，自动适配范围（带padding）
        if (wasEmpty && this.activeTimelines.size > 0) {
            this.resetView();
        } else {
            this.render();
        }
    }

    filterCategory(category) {
        document.querySelectorAll('.category-tag').forEach(tag => {
            tag.classList.toggle('active', tag.textContent === (category === 'all' ? '全部' : category));
        });

        if (category === 'all') {
            this.timelines.forEach(t => this.activeTimelines.add(t.id));
        } else {
            this.activeTimelines.clear();
            this.timelines.filter(t => t.category === category).forEach(t => this.activeTimelines.add(t.id));
        }

        this.renderSidebar();
        this.render();
    }


    /**
     * 绘制所有时间轴（Canvas）与事件（DOM）
     */
    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 清空Canvas
        ctx.clearRect(0, 0, width, height);

        if (this.activeTimelines.size === 0) {
            document.getElementById('emptyState').style.display = 'block';
            // 清空DOM
            if (this._eventElements) {
                this._eventElements.forEach(el => el.remove());
                this._eventElements.clear();
            }
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
     * 
     * @param {CanvasRenderingContext2D} ctx 
     * @param {*} timeline 
     * @param {*} trackIndex 
     * @param {*} trackHeight 
     * @param {Number} width 
     */
    renderTimelineTrack(ctx, timeline, trackIndex, trackHeight, width) {
        const y = trackIndex * trackHeight;
        const centerY = y + trackHeight / 2;
        const color = timeline.color;

        // 绘制轨道背景
        ctx.fillStyle = trackIndex % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, y, width, trackHeight);

        // 绘制轨道标签
        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(timeline.title, 20, y + 25);

        // 绘制时间线
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        const timeSpan = this.viewEnd - this.viewStart;

        // 在每个事件位置画时间点标记（小圆点或短竖线）
        timeline.events.forEach(event => {
            if (event.year < this.viewStart || event.year > this.viewEnd) return;
            const x = ((event.year - this.viewStart) / timeSpan) * width;

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

    
    renderTimeScale(ctx, width, height) {
        const timeSpan = this.viewEnd - this.viewStart;
        const step = this.calculateTimeStep(timeSpan);

        ctx.fillStyle = '#64748b';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';

        for (let year = Math.ceil(this.viewStart / step) * step; year <= this.viewEnd; year += step) {
            const x = ((year - this.viewStart) / timeSpan) * width;

            // 刻度线
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // 年份标签
            ctx.fillText(year.toString(), x, height - 10);
        }

        ctx.textAlign = 'left';
    }

    /**
     * 使用差异更新更新DOM元素（标签与大卡片）
     * @param {*} activeTimelinesData 
     * @param {Number} trackHeight 轨道Y轴位置
     * @param {Number} width Canvas的宽度
     */
    renderEventDOMs(activeTimelinesData, trackHeight, width) {
        const overlay = document.getElementById('eventsOverlay');
        const timeSpan = this.viewEnd - this.viewStart;

        // 收集当前应该显示的所有事件
        const eventsToShow = new Map(); // key -> {x, y, event, timeline, hasLabel}

        activeTimelinesData.forEach((timeline, trackIndex) => {
            const centerY = trackIndex * trackHeight + trackHeight / 2;

            // 计算可见事件
            const visibleEvents = timeline.events
                .map(event => ({
                    event,
                    x: ((event.year - this.viewStart) / timeSpan) * width,
                    importance: event.importance || 0,
                    year: event.year,
                    key: `${timeline.id}-${event.year}-${event.title}`
                }))
                .filter(item => item.x >= -150 && item.x <= width + 150);

            // 按重要度选择显示标签的
            const sorted = [...visibleEvents].sort((a, b) => {
                if (b.importance !== a.importance) return b.importance - a.importance;
                return a.year - b.year;
            });

            const showLabelSet = new Set();
            const labelPositions = [];

            sorted.forEach(item => {
                let hasSpace = true;
                for (const pos of labelPositions) {
                    if (Math.abs(item.x - pos) < MIN_LABEL_SPACING) {
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
                <div class="event-label">${event.title}</div>
                <div class="event-popup">
                    <div class="year">${event.year}</div>
                    <div class="title">${event.title}</div>
                    ${event.era ? `<div class="era">[${event.era}]</div>` : ''}
                </div>
            `;

                // 点击事件：打开详情面板
                el.addEventListener('click', (e) => {
                    // 如果操作是拖拽，不是点击，不打开面板
                    if (this.hasDragged) return;

                    // 防止触发Canvas点击（取消选择）
                    e.stopPropagation();
                    this.selectEvent({ timeline, event, timelineId: timeline.id });
                });

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

        // 添加10%边距
        const padding = (max - min) * 0.1;
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
        // TODO: 更新算法
        if (span > 10000) return 1000;
        if (span > 5000) return 500;
        if (span > 1000) return 100;
        if (span > 500) return 50;
        if (span > 100) return 10;
        if (span > 50) return 5;
        if (span > 10) return 1;
        return 0.5;
    }

    handleMouseMove(e) {
        if (this.dragging) {
            // 检测是否移动超过阈值
            const dx = Math.abs(e.clientX - this.dragStartX);
            const dy = Math.abs(e.clientY - this.dragStartY);
            if (dx > this.dragThreshold || dy > this.dragThreshold) {
                this.hasDragged = true;
            }
            
            const deltaX = e.clientX - this.lastMouseX;
            const timeSpan = this.viewEnd - this.viewStart;
            const timeDelta = (deltaX / this.canvas.width) * timeSpan;

            this.viewStart -= timeDelta;
            this.viewEnd -= timeDelta;

            // 边界检查
            if (this.viewStart < this.minYear) {
                this.viewEnd += this.minYear - this.viewStart;
                this.viewStart = this.minYear;
            }
            if (this.viewEnd > this.maxYear) {
                this.viewStart -= this.viewEnd - this.maxYear;
                this.viewEnd = this.maxYear;
            }

            this.updateRangeSlider();
            this.render();
            this.lastMouseX = e.clientX;
        }
    }

    handleMouseDown(e) {
        if(e.button === 0){
            this.dragging = true;
            this.dragStartX = e.clientX;  // 记录起始位置
            this.dragStartY = e.clientY;
            this.hasDragged = false;      // 重置拖拽标志
            this.lastMouseX = e.clientX;
            this.container.classList.add('dragging');
        }
    }

    handleMouseUp() {
        if (!this.dragging) return; // 如果没在拖拽，直接返回
        this.dragging = false;
        this.lastMouseX = 0;
        this.container.classList.remove('dragging');
    }

    handleWheel(e) {
        e.preventDefault();

        // 获取鼠标相对于Canvas的位置
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const width = this.canvas.width;

        // 计算鼠标指针当前对应的时间点（世界坐标）
        const timeSpan = this.viewEnd - this.viewStart;
        const mouseTime = this.viewStart + (mouseX / width) * timeSpan;

        // 计算缩放
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        let newSpan = timeSpan * zoomFactor;

        // 限制最大缩放范围（不能小于当前时间轴总跨度）
        const maxSpan = this.maxYear - this.minYear;
        if (newSpan > maxSpan) {
            newSpan = maxSpan;
        }
        // 限制最小缩放范围（避免过度放大，最少显示5年）
        if (newSpan < 5) {
            newSpan = 5;
        }

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

        document.getElementById('rangeStartLabel').textContent = Math.round(this.viewStart);
        document.getElementById('rangeEndLabel').textContent = Math.round(this.viewEnd);
    }

    selectEvent({ timeline, event, timelineId }) {
        this.selectedEvent = { timelineId, event };
        this.render();

        // 填充详情面板
        document.getElementById('detailYear').textContent = event.year + (event.era ? ` (${event.era})` : '');
        document.getElementById('detailTitle').textContent = event.title;
        document.getElementById('detailDesc').textContent = event.desc || '暂无简介';
        document.getElementById('detailContent').textContent = event.detail || '暂无详细信息';
        document.getElementById('detailTimeline').textContent = timeline.title;
        document.getElementById('detailTimeline').style.color = timeline.color;
        document.getElementById('detailEra').textContent = event.era || '-';

        // 打开面板
        document.getElementById('detailPanel').classList.add('open');
    }

    closeDetail() {
        document.getElementById('detailPanel').classList.remove('open');
        this.selectedEvent = null;
        this.render();
    }

    zoomIn() {
        const center = (this.viewStart + this.viewEnd) / 2;
        const span = (this.viewEnd - this.viewStart) * 0.8;
        this.viewStart = center - span / 2;
        this.viewEnd = center + span / 2;
        this.updateRangeSlider();
        this.render();
    }

    zoomOut() {
        const center = (this.viewStart + this.viewEnd) / 2;
        const span = (this.viewEnd - this.viewStart) * 1.25;
        this.viewStart = Math.max(this.minYear, center - span / 2);
        this.viewEnd = Math.min(this.maxYear, center + span / 2);
        this.updateRangeSlider();
        this.render();
    }

    resetView() {
        if (this.activeTimelines.size === 0) return;

        // 计算所有激活时间轴的事件范围
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

        const padding = (max - min) * 0.1;
        this.minYear = Math.floor(min - padding);
        this.maxYear = Math.ceil(max + padding);
        this.viewStart = this.minYear;
        this.viewEnd = this.maxYear;

        this.updateRangeSlider();
        this.render();
    }

    previousEvent() {
        if (!this.selectedEvent) return;

        const timeline = this.timelines.find(t => t.id === this.selectedEvent.timelineId);
        const idx = timeline.events.indexOf(this.selectedEvent.event);
        if (idx > 0) {
            this.selectEvent({
                timeline,
                event: timeline.events[idx - 1],
                timelineId: timeline.id
            });
        }
    }

    nextEvent() {
        if (!this.selectedEvent) return;

        const timeline = this.timelines.find(t => t.id === this.selectedEvent.timelineId);
        const idx = timeline.events.indexOf(this.selectedEvent.event);
        if (idx < timeline.events.length - 1) {
            this.selectEvent({
                timeline,
                event: timeline.events[idx + 1],
                timelineId: timeline.id
            });
        }
    }

    newTimeline() {
        this.editingId = null;
        document.getElementById('modalTitle').textContent = '新建时间轴';
        document.getElementById('inputTitle').value = '';
        document.getElementById('inputCategory').value = '科幻文学';
        document.getElementById('inputColor').value = '#3b82f6';
        document.getElementById('inputEvents').value = '';
        document.getElementById('btnDelete').style.display = 'none';
        document.getElementById('timelineModal').classList.add('active');
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

// 初始化应用
const app = new TimelineApp();
