'use strict';

// 应用共享的基础定义。不得依赖 TimelineApp 或全局 app。
// ============ 数据模型 ============
/**
 * 时间轴中的事件对象结构体
 */
class MyEvent {
    /**
    * @param {Number|String} year 年份，负数表示公元前
    * @param {Number|String|null} month 月份，负数隐藏月日
    * @param {Number|String|null} day 日期，负数隐藏日
    * @param {String} title 事件标题
    * @param {String} label 事件标签（为空则使用标题）
    * @param {Number} importance 重要度
    * @param {String} desc 描述
    * @param {String} detail 细节
    * @param {String} era 时代 可为空
     */
    constructor(year, month, day, title, label = '', importance = 0, desc, detail, era = '') {
        // 确保年月日是数字（JSON 可能返回字符串）
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
    * @param {String} id 时间轴唯一标识
    * @param {String} title 时间轴标题
    * @param {MyEvent[]} events 事件数组
    * @param {String} color 轨道颜色
    * @param {String} category 分类
     */
    constructor(id, title, events, color, category) {
        this.id = id;
        this.title = title;
        this.color = color;
        this.category = category;
        this.events = events;
    }
}

// ============ 工具函数库 ============
const TimelineUtils = {
    /**
     * 将数值限制在指定范围内
     * @param {Number} value 待限制的数值
     * @param {Number} min 最小值，应不大于 max
     * @param {Number} max 最大值
     * @returns {Number} 限制后的数值
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * 延迟执行最后一次调用，保留参数和 this
     * @param {Function} fn 待执行的函数
     * @param {Number} delay 延迟时间，单位为毫秒
     * @returns {Function} 防抖处理后的函数
     */
    debounce(fn, delay) {
        let timer = null;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    dom: {
        /**
         * 转义 HTML 特殊字符，用于 HTML 文本位置
         * @param {*} text 待转义的内容
         * @returns {String} 转义后的文本
         */
        escapeHtml(text) {
            const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
            return String(text).replace(/[<>&"']/g, m => map[m]);
        },

        /**
         * 请求元素全屏，兼容前缀接口；不支持时返回拒绝的 Promise
         * @param {Element} element 需要全屏显示的元素
         * @returns {Promise<void>|undefined} 全屏请求结果，旧版接口可能不返回 Promise
         */
        requestFullscreen(element) {
            const fn = element.requestFullscreen || element.webkitRequestFullscreen ||
                element.mozRequestFullScreen || element.msRequestFullscreen;
            return fn ? fn.call(element) : Promise.reject('不支持全屏');
        }
    },

    date: {
        /**
         * 将 year/month/day 转换为小数年份（每月占 1/12 年）
         * 月、日的正负号只控制显示；绝对值相同的日期具有相同位置
         * @param {MyEvent} event 事件对象，包含 year, month, day
         * @returns {Number} 小数年份
         */
        getDecimalYear(event) {
            const year = Number(event.year);
            if (!event.month || event.month === '') return year;

            // 定位只使用绝对值，不因显示精度改变位置
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

            return year + monthFraction + dayFraction;
        },

        /**
         * 格式化显示日期，如 "1979.10.21" 或 "1979.10" 或 "1979"
         * 负月份隐藏月和日；负日期只隐藏日，均不影响定位
         * 年份为负时显示为 "前XX年" 格式
         * @param {MyEvent} event 事件对象，包含 year, month, day
         * @param {String} [bcePrefix='前'] 公元前年份的显示前缀
         * @returns {String} 日期文本
         */
        formatEventDate(event, bcePrefix = '前') {
            const yearStr = event.year < 0 ? `${bcePrefix}${-event.year}` : event.year.toString();
            // 无月份或月份为负数（用于偏移但不显示）时，只显示年份
            if (!event.month || event.month === '' || event.month < 0) return yearStr;
            // 有月份但无日期或日期为负数时，显示年.月
            if (!event.day || event.day === '' || event.day < 0) return `${yearStr}.${event.month.toString().padStart(2, '0')}`;
            // 有月份和正数日期时，显示年.月.日
            return `${yearStr}.${event.month.toString().padStart(2, '0')}.${event.day.toString().padStart(2, '0')}`;
        },

        /**
         * 生成详情日期，使用“公元前”前缀并附加时期
         * @param {MyEvent} event 事件对象，包含 year, month, day, era
         * @returns {String} 格式化后的日期字符串
         */
        getDetailedDateDesc(event) {
            // 与卡片共用显示规则，避免负号在两个位置产生不同效果
            const dateStr = TimelineUtils.date.formatEventDate(event, '公元前');
            return event.era ? `${dateStr} (${event.era})` : dateStr;
        },

    },

    // 所有数据入口共用这些规则；仅返回新对象，不修改原始输入或应用状态。
    data: {
        /**
         * 校验事件并统一数字、文本类型；不检查月日范围
         * 月日缺省为 null，重要度缺省为 0，可选文本缺省为空字符串
         * @param {Object} raw 原始事件数据，需包含有效年份和非空标题
         * @returns {MyEvent} 新建的事件对象，不修改原始数据
         * @throws {Error} 对象、数字字段或标题无效
         */
        normalizeEvent(raw) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                throw new Error('事件必须是对象');
            }
            /**
             * 将数字或数字字符串转换为有限数值，空值使用指定默认值
             * @param {Number|String|null|undefined} value 原始字段值
             * @param {String} name 字段名称，用于错误提示
             * @param {Number|null} [fallback] 空值的默认值，未指定则该字段必填
             * @returns {Number|null} 转换后的数值或默认值
             * @throws {Error} 必填字段为空或数值无效
             */
            const number = (value, name, fallback) => {
                if (value == null || value === '') {
                    if (fallback !== undefined) return fallback;
                    throw new Error(`${name}不能为空`);
                }
                if ((typeof value !== 'number' && typeof value !== 'string') ||
                    (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) {
                    throw new Error(`${name}必须是有效数字`);
                }
                return Number(value);
            };
            /**
             * 将字段转换为文本，null 和 undefined 转为空字符串
             * @param {*} value 原始字段值
             * @returns {String} 转换后的文本
             */
            const text = value => value == null ? '' : String(value);
            const year = number(raw.year, '年份');
            const month = number(raw.month, '月份', null);
            const day = number(raw.day, '日期', null);
            const importance = number(raw.importance, '重要度', 0);
            if (!text(raw.title).trim()) throw new Error('事件标题不能为空');

            return new MyEvent(
                year, month, day,
                text(raw.title),
                text(raw.label),
                importance,
                text(raw.desc), text(raw.detail), text(raw.era));
        },

        /**
         * 校验时间轴信息，并将内部事件统一转换为 MyEvent 对象
         * 未提供颜色时使用蓝色，未提供分类时使用“其他”
         * @param {Object} raw 原始时间轴数据，包含 id、title、events、color、category
         * @returns {Timeline} 新建的时间轴对象，保持原事件顺序
         * @throws {Error} ID、标题、事件数组或事件字段无效
         */
        normalizeTimeline(raw) {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
                throw new Error('时间轴必须是对象');
            }
            if (typeof raw.id !== 'string' || !raw.id.trim()) throw new Error('时间轴 ID 不能为空');
            if (typeof raw.title !== 'string' || !raw.title.trim()) throw new Error('时间轴标题不能为空');
            if (!Array.isArray(raw.events)) throw new Error('事件数据必须是数组');
            const events = raw.events.map((event, index) => {
                try {
                    return TimelineUtils.data.normalizeEvent(event);
                } catch (error) {
                    throw new Error(`第 ${index + 1} 个事件：${error.message}`);
                }
            });

            return new Timeline(
                raw.id,
                raw.title,
                events,
                raw.color == null ? '#3b82f6' : String(raw.color),
                raw.category == null ? '其他' : String(raw.category));
        },

        /**
         * 批量规范化时间轴，并检查时间轴 ID 是否重复
         * @param {Object[]} raw 原始时间轴数组
         * @returns {Timeline[]} 新建的时间轴数组，保持原时间轴顺序
         * @throws {Error} 数组、时间轴无效或 ID 重复
         */
        normalizeTimelines(raw) {
            if (!Array.isArray(raw)) throw new Error('数据必须是数组格式');
            const ids = new Set();
            return raw.map(item => {
                const timeline = TimelineUtils.data.normalizeTimeline(item);
                if (ids.has(timeline.id)) throw new Error(`时间轴 ID 重复：${timeline.id}`);
                ids.add(timeline.id);
                return timeline;
            });
        },

        /**
         * 按索引并行加载 JSON 并规范化，状态和提示由调用方处理
         * @param {Object[]} index 时间轴索引数组
         * @param {String} index[].id 时间轴唯一标识
         * @param {String} index[].title 时间轴标题
         * @param {String} index[].eventPath 事件 JSON 文件路径
         * @param {String} [index[].color] 时间轴颜色
         * @param {String} [index[].category] 时间轴分类
         * @param {Function} [onIssue] 接收 error（跳过）或 warning（保留）及说明
         * @returns {Promise<Timeline[]>} 非空时间轴数组，保持索引顺序
         * @throws {Error} 索引不是数组
         */
        async loadTimelines(index, onIssue = () => {}) {
            // 索引整体无效时交给调用方处理，单条错误则在下方隔离。
            if (!Array.isArray(index)) throw new Error('时间轴索引必须是数组');

            // 并行加载并等待全部结束；allSettled 保留每条结果，不因单条失败中断。
            const results = await Promise.allSettled(index.map(async meta => {
                if (!meta || typeof meta.eventPath !== 'string' || !meta.eventPath.trim()) {
                    throw new Error('缺少事件文件路径');
                }
                const response = await fetch(meta.eventPath);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                // 合并索引信息与事件 JSON，校验字段并转为模型；空轴按失败处理。
                const timeline = TimelineUtils.data.normalizeTimeline({ ...meta, events: await response.json() });
                if (!timeline.events.length) throw new Error('空时间轴');
                return timeline;
            }));

            const timelines = [], ids = new Set();
            // 结果顺序与索引一致，不受请求完成先后影响。
            results.forEach((result, i) => {
                const meta = index[i];
                const source = `${meta?.title || '未命名'} (${meta?.id || '无 ID'}, ${meta?.eventPath || '无路径'})`;
                // 附上名称、ID 和路径报告失败，跳过该条并继续收集。
                if (result.status === 'rejected') {
                    onIssue('error', `已跳过时间轴：${source}：${result.reason?.message || result.reason}`);
                    return;
                }

                // 重复 ID 只保留首条成功数据，避免选择和渲染时混淆。
                const timeline = result.value;
                if (ids.has(timeline.id)) {
                    onIssue('error', `已跳过时间轴：${source}：时间轴 ID 重复`);
                    return;
                }
                ids.add(timeline.id);
                timelines.push(timeline);

                // 按实际定位日期分组，月日正负号不影响重复判断。
                const dates = new Map();
                for (const event of timeline.events) {
                    const date = TimelineUtils.date.getDecimalYear(event);
                    if (!dates.has(date)) dates.set(date, []);
                    dates.get(date).push(event.title);
                }
                // 同日期事件仅警告，列出标题供作者修正，不删除或移动事件。
                for (const [date, titles] of dates) {
                    if (titles.length > 1) onIssue('warning', `同日期事件：${source}，定位年份 ${date}：${titles.join('、')}`);
                }
            });
            return timelines;
        }
    }
};
