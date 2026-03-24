'use strict'
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
        this.dragging = false;
        this.lastMouseX = 0;
        this.editingId = null;

        this.canvas = document.getElementById('timelineCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('canvasContainer');

        this.init();
    }

    init() {
        this.loadSampleData();
        this.setupEventListeners();
        this.setupRangeSlider();
        this.renderSidebar();
        this.renderCategories();
        this.resizeCanvas();

        // 默认激活三体时间轴
        const threeBody = this.timelines.find(t => t.id === 'three-body');
        if (threeBody) {
            this.toggleTimeline(threeBody.id); // 会触发自动适配
        } else {
            this.render();
        }
    }

    loadSampleData() {
        // 内置示例数据：《三体》时间轴（基于用户提供的博客内容）
        this.timelines = [
            {
                id: 'three-body',
                title: '三体',
                category: '科幻文学',
                color: '#3b82f6',
                events: [
                    { year: 1453, title: '四维空间接触地球', desc: '君士坦丁堡战役中，四维空间翘曲点与地球接触', detail: '16时，四维空间翘曲点与地球接触，接触点为正值君士坦丁堡战役的君士坦丁堡，吞掉了奥多修斯北部布拉赫内区的一座清真寺的塔尖。5月28日21时，四维空间翘曲点完全离开地球。', era: '中世纪' },
                    { year: 1947, title: '叶文洁出生', desc: '叶文洁出生于1947年6月', detail: '', era: '' },
                    { year: 1967, title: '叶泰哲之死', desc: '叶泰哲在批斗会上被打死', detail: '留下了崩溃的妻子绍琳和女儿叶文洁。这是叶文洁人生的转折点。', era: '文革时代' },
                    { year: 1968, title: '红岸基地建成', desc: '红岸基地（雷达峰）建成', detail: '用于搜索地外文明的绝密国防工程。', era: '文革时代' },
                    { year: 1969, title: '叶文洁进入红岸', desc: '叶文洁被红岸基地吸收', detail: '叶文洁读了《寂静的春天》，帮白沐霖抄写举报信被诬陷，以戴罪立功为由进入红岸基地。', era: '文革时代' },
                    { year: 1971, title: '叶文洁发送信号', desc: '叶文洁向太阳发射信号', detail: '秋，叶文洁发现太阳是电波放大器，借试发射之机向太阳发射信号，8分钟后信号以光速飞向宇宙。', era: '文革时代' },
                    { year: 1975, title: '三体世界收到信号', desc: '1379号监听站收到地球消息', detail: '三体文明1379号监听站收到地球的消息，监听员发回了警告信息。', era: '' },
                    { year: 1979, title: '收到三体回复', desc: '叶文洁收到三体世界警告', detail: '10月21日凌晨，收到三体世界的警告回信。清晨，叶文洁回复希望三体来解决人类问题。下午杀死雷志成和杨卫宁。', era: '黄金时代' },
                    { year: 1980, title: '杨冬出生', desc: '叶文洁女儿杨冬出生', detail: '1980年6月，杨冬出生。', era: '黄金时代' },
                    { year: 1982, title: '三体舰队启航', desc: '三体第一舰队启航', detail: '三体第一舰队向着地球的大致方向启航。', era: '' },
                    { year: 1984, title: '智子工程启动', desc: '三体制定杀死地球科学的计划', detail: '三体文明收到叶文洁回信，确定地球坐标。元首制定染色、神迹、智子工程计划。', era: '' },
                    { year: 2007, title: '危机纪元开始', desc: '科学边界与科学家自杀', detail: '不到两个月内许多理论物理学家自杀。汪淼看到倒计时，宇宙背景辐射闪烁，ETO聚会，古筝行动夺取三体信息。', era: '危机纪元' },
                    { year: 2010, title: '面壁计划启动', desc: '四位面壁者选定', detail: '中国太空军成立。特别联大通过117号决议宣布逃亡主义非法。面壁计划启动，罗辑、泰勒、雷迪亚兹、希恩斯成为面壁者。', era: '危机纪元' },
                    { year: 2015, title: '罗辑发出咒语', desc: '黑暗森林法则初现', detail: '罗辑看到宇宙真相，称黑暗森林法则。感染基因导弹，冬眠前通过太阳向宇宙发射187J3X1恒星坐标。', era: '危机纪元' },
                    { year: 2205, title: '水滴攻击', desc: '三体水滴摧毁人类舰队', detail: '三体水滴到达太阳系，封死太阳。丁仪考察水滴，水滴启动，几乎全歼人类舰队。只有量子号和青铜时代号逃脱。', era: '危机纪元' },
                    { year: 2208, title: '建立威慑', desc: '罗辑建立黑暗森林威慑', desc: '罗辑与三体对决，以雪地工程布置的核弹建立威慑。三体接受谈判，解除太阳封锁。罗辑成为执剑人。', era: '' },
                    { year: 2270, title: '威慑终结', desc: '程心接任执剑人', detail: '程心当选执剑人，16分钟后水滴摧毁引力波发射器，威慑终止。万有引力号和蓝色空间号启动引力波广播。', era: '威慑纪元' },
                    { year: 2274, title: '三体世界毁灭', desc: '三体星系被光粒摧毁', detail: '10月，三体世界被光粒摧毁。云天明通过三个童话故事向程心传递情报。', era: '广播纪元' },
                    { year: 2400, title: '太阳系毁灭', desc: '二向箔打击，太阳系二维化', detail: '5月19日，程心被唤醒。二向箔使三维空间向二维跌落，太阳系毁灭。程心乘坐星环号逃离。', era: '掩体纪元' }
                ]
            },
            {
                id: 'quantum-physics',
                title: '量子力学发展史',
                category: '科学史',
                color: '#8b5cf6',
                events: [
                    { year: 1900, title: '普朗克量子假说', desc: '马克斯·普朗克提出能量量子化', detail: '为解释黑体辐射，普朗克提出能量不是连续的，而是以离散的能量包（量子）形式存在。E = hν', era: '量子诞生' },
                    { year: 1905, title: '光电效应', desc: '爱因斯坦解释光电效应', detail: '爱因斯坦提出光由光子组成，解释了光电效应，证明光具有粒子性。获得1921年诺贝尔物理学奖。', era: '' },
                    { year: 1913, title: '玻尔模型', desc: '尼尔斯·玻尔提出原子模型', detail: '电子在特定轨道上绕核运动，只能存在于特定的能级，跃迁时吸收或发射光子。', era: '' },
                    { year: 1924, title: '物质波', desc: '德布罗意提出物质波假说', detail: '路易·德布罗意提出所有物质都具有波动性，波长λ = h/p。为量子力学奠定基础。', era: '' },
                    { year: 1925, title: '矩阵力学', desc: '海森堡创立矩阵力学', detail: '维尔纳·海森堡提出用矩阵描述量子系统，与玻恩和约当共同发展。', era: '量子革命' },
                    { year: 1926, title: '薛定谔方程', desc: '薛定谔提出波动力学', detail: '埃尔温·薛定谔提出描述量子系统演化的波动方程，证明与矩阵力学等价。', era: '量子革命' },
                    { year: 1927, title: '不确定性原理', desc: '海森堡提出测不准原理', detail: '无法同时精确测量粒子的位置和动量，Δx·Δp ≥ ℏ/2。同年，玻尔提出互补原理。', era: '' },
                    { year: 1927, title: '第五次索尔维会议', desc: '量子力学大论战', detail: '玻尔与爱因斯坦就量子力学解释展开激烈辩论，爱因斯坦："上帝不掷骰子"。', era: '' },
                    { year: 1935, title: 'EPR悖论', desc: '爱因斯坦质疑量子力学完备性', detail: '爱因斯坦、波多尔斯基、罗森提出EPR悖论，质疑量子力学的局域性。', era: '' },
                    { year: 1935, title: '薛定谔的猫', desc: '量子叠加态思想实验', detail: '薛定谔提出猫同时处于生死叠加态的思想实验，质疑哥本哈根诠释。', era: '' }
                ]
            }
        ];
    }

    setupEventListeners() {
        // Canvas交互
        this.canvas.addEventListener('click', (e) => {
            // 如果点击目标是DOM卡片，不处理（由卡片自己处理）
            if (e.target.closest('.event-card')) return;

            // 否则视为点击空白处，取消选择
            this.selectedEvent = null;
            this.closeDetail();
            this.render(); // 会重新渲染DOM，移除active类
        });
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
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
        ctx.lineWidth = 2;
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
            ctx.arc(x, centerY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();

            // 或者画短竖线
            /*
            ctx.strokeStyle = timeline.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, centerY - 6);
            ctx.lineTo(x, centerY + 6);
            ctx.stroke();
            */
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

    renderEventDOMs(activeTimelinesData, trackHeight, width) {
        const overlay = document.getElementById('eventsOverlay');
        const timeSpan = this.viewEnd - this.viewStart;

        // 简单方案：全量重建（适合<100个事件）。如果事件多，需要改为差异更新
        overlay.innerHTML = '';

        activeTimelinesData.forEach((timeline, index) => {
            const centerY = index * trackHeight + trackHeight / 2;

            timeline.events.forEach(event => {
                // 虚拟渲染：只创建可视区内的事件（左右各留100px缓冲）
                const x = ((event.year - this.viewStart) / timeSpan) * width;
                if (x < -100 || x > width + 100) return;

                const cardEl = document.createElement('div');
                cardEl.className = 'event-card';
                cardEl.style.left = `${x}px`;
                cardEl.style.top = `${centerY}px`;
                cardEl.style.setProperty('--timeline-color', timeline.color);

                // 选中状态
                if (this.selectedEvent?.event === event &&
                    this.selectedEvent?.timelineId === timeline.id) {
                    cardEl.classList.add('active');
                }

                // 内容结构
                cardEl.innerHTML = `
                <div class="event-label">${event.title}</div>
                <div class="event-popup">
                    <div class="year">${event.year}</div>
                    <div class="title">${event.title}</div>
                    ${event.era ? `<div class="era">[${event.era}]</div>` : ''}
                </div>
            `;

                // 事件绑定
                cardEl.addEventListener('click', (e) => {
                    e.stopPropagation(); // 防止触发Canvas拖拽
                    this.selectEvent({
                        timeline: timeline,
                        event: event,
                        timelineId: timeline.id
                    });
                });

                // 【可选】如果需要悬浮高亮其他卡片，可在此绑定mouseenter
                cardEl.addEventListener('mouseenter', () => {
                    // 可以添加逻辑：高亮相关联的事件
                });

                overlay.appendChild(cardEl);
            });
        });
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
        this.dragging = true;
        this.lastMouseX = e.clientX;
        this.container.classList.add('dragging');
    }

    handleMouseUp() {
        this.dragging = false;
        this.container.classList.remove('dragging');
    }

    handleWheel(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
        const center = (this.viewStart + this.viewEnd) / 2;
        const span = (this.viewEnd - this.viewStart) * zoomFactor;

        this.viewStart = center - span / 2;
        this.viewEnd = center + span / 2;

        // 边界限制
        if (this.viewEnd - this.viewStart > this.maxYear - this.minYear) {
            this.viewStart = this.minYear;
            this.viewEnd = this.maxYear;
        }

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

// 动画循环（用于选中事件的脉冲效果）
function animate() {
    if (app.selectedEvent) {
        app.render();
    }
    requestAnimationFrame(animate);
}
animate();