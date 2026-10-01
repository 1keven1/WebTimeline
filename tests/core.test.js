// 使用 Node.js 18+ 运行：node --test tests/core.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const context = vm.createContext({ setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync(path.join(root, 'TimelineCore.js'), 'utf8') +
    '\nthis.api = { TimelineUtils, MyEvent, Timeline };', context);
vm.runInContext(fs.readFileSync(path.join(root, 'Timeline.js'), 'utf8') + '\nthis.App = TimelineApp;', context);
const { TimelineUtils: utils, MyEvent, Timeline } = context.api;
const example = () => ({ id: 'test', title: '测试', color: '#123456', category: '历史',
    events: [{ year: '2007', month: '-6', day: '-15', title: '事件', importance: '3' }] });

test('正负月日的位置不变，显示精度正确', () => {
    for (const year of [-200, 1979, 2000, 2007, 2024]) for (const month of [1, 2, 6, 12]) {
        for (const day of [1, 15, 28]) for (const sm of [1, -1]) for (const sd of [1, -1]) {
            const event = { year, month: sm * month, day: sd * day, era: '时期' };
            const date = (year < 0 ? `前${-year}` : `${year}`) +
                (sm > 0 ? `.${String(month).padStart(2, '0')}` : '') +
                (sm > 0 && sd > 0 ? `.${String(day).padStart(2, '0')}` : '');
            assert.equal(utils.date.getDecimalYear(event), utils.date.getDecimalYear({ year, month, day }));
            assert.equal(utils.date.formatEventDate(event), date);
            assert.equal(utils.date.getDetailedDateDesc(event), date.replace(/^前/, '公元前') + ' (时期)');
        }
    }
});

test('数据规范化返回模型实例、不修改输入，拒绝非法数据', () => {
    const raw = example(), before = JSON.stringify(raw);
    const result = utils.data.normalizeTimeline(raw);
    assert.ok(result instanceof Timeline);
    assert.ok(result.events[0] instanceof MyEvent);
    assert.equal(result.events[0].year, 2007);
    assert.equal(result.events[0].month, -6);
    assert.equal(result.events[0].importance, 3);
    assert.equal(result.events[0].detail, '');
    assert.equal(JSON.stringify(raw), before);
    assert.equal(utils.data.normalizeEvent({ year: 0, title: '零年', month: '', day: null }).month, null);
    assert.throws(() => utils.data.normalizeTimeline({ ...raw, events: {} }), /数组/);
    for (const year of ['', ' ', null, undefined, 'abc', Infinity, true, []]) {
        assert.throws(() => utils.data.normalizeEvent({ year, title: '事件' }), /年份/);
    }
    assert.throws(() => utils.data.normalizeTimelines([raw, raw]), /重复/);
});

test('现有四份 JSON 正常加载，顺序及日期位置不变，HTTP 失败可报告', async () => {
    const index = fs.readdirSync(path.join(root, 'TL_Data')).filter(f => f.endsWith('.json'))
        .map(file => ({ id: file, title: file, eventPath: `TL_Data/${file}` }));
    context.fetch = async file => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8')) });
    const timelines = await utils.data.loadTimelines(index);
    assert.equal(timelines.length, 4);
    timelines.forEach(timeline => {
        const raw = JSON.parse(fs.readFileSync(path.join(root, 'TL_Data', timeline.id), 'utf8'));
        assert.equal(timeline.events.length, raw.length);
        timeline.events.forEach((event, i) => {
            assert.equal(event.title, raw[i].title);
            assert.equal(utils.date.getDecimalYear(event), utils.date.getDecimalYear(raw[i]));
        });
    });
    context.fetch = async () => ({ ok: false, status: 404 });
    const issues = [];
    assert.equal((await utils.data.loadTimelines(index, (type, message) => issues.push(message))).length, 0);
    assert.equal(issues.length, 4);
    assert.match(issues[0], /404/);
});

test('无效编辑和导入保留原数据，有效保存使用模型实例', () => {
    const values = { inputTitle: '测试', inputCategory: '历史', inputColor: '#123456',
        inputEvents: '{"year":2007}', importInput: '[{"id":"bad"}]' };
    context.document = { getElementById: id => ({ value: values[id] }) };
    const app = Object.create(context.App.prototype);
    const original = utils.data.normalizeTimeline(example());
    Object.assign(app, { timelines: [original], editingId: 'test', activeTimelines: new Set(['test']),
        showToast(message) { this.message = message; }, closeModal() {}, renderSidebar() {},
        renderCategories() {}, render() {} });
    app.saveTimeline();
    assert.match(app.message, /保存失败/);
    assert.equal(app.timelines[0], original);
    app.importFromInput();
    assert.match(app.message, /导入失败/);
    assert.equal(app.timelines[0], original);
    values.inputEvents = JSON.stringify(example().events);
    app.saveTimeline();
    assert.equal(app.message, '保存成功');
    assert.ok(app.timelines[0].events[0] instanceof MyEvent);
});

test('防抖保留最后一次调用和调用者上下文', async () => {
    const calls = [];
    const owner = { value: 7, run: utils.debounce(function (arg) { calls.push([this.value, arg]); }, 5) };
    owner.run(1); owner.run(2);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.deepEqual(calls, [[7, 2]]);
});

// 独立环境，避免其他用例中的 DOM / fetch 替身影响初始化测试。
function createStartupFixture() {
    let bindings = 0, loads = 0, renders = 0;
    const env = vm.createContext({
        window: { innerWidth: 1200, matchMedia: () => ({ matches: false }) },
        document: { getElementById: id => id === 'timelineCanvas' ? { getContext: () => ({}) } : {} }
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'Timeline.js'), 'utf8') + '\nthis.App = TimelineApp;', env);
    const app = new env.App();
    for (const name of ['setupRangeSlider', 'initTheme', 'initCurrentTimeToggle',
        'updateFullscreenButtonState', 'resizeCanvas', 'renderSidebar', 'renderCategories']) app[name] = () => {};
    app.setupEventListeners = () => { bindings++; };
    app.render = app.resetView = () => { renders++; };
    app.loadData = async () => { loads++; app.timelines = [{ id: 'test' }]; };
    return { env, app, counts: () => ({ bindings, loads, renders }) };
}

test('构造无需 DOM，显式初始化等待数据且重复调用只执行一次', async () => {
    const { env, app, counts } = createStartupFixture();
    delete env.document;
    assert.doesNotThrow(() => new env.App());
    env.document = { getElementById: id => id === 'timelineCanvas' ? { getContext: () => ({}) } : {} };
    assert.equal(app.canvas, null);
    assert.deepEqual(counts(), { bindings: 0, loads: 0, renders: 0 });
    const first = app.init([], 'test');
    assert.equal(first, app.init([], 'ignored'));
    await first;
    assert.equal(app.activeTimelines.has('test'), true);
    assert.equal(first, app.init([]));
    assert.deepEqual(counts(), { bindings: 1, loads: 1, renders: 1 });
});

test('初始化失败向调用方传递，重复调用不再次绑定事件或请求数据', async () => {
    const { env, app, counts } = createStartupFixture();
    let requests = 0;
    env.TimelineUtils = { data: { loadTimelines: async () => { requests++; throw new Error('加载失败'); } } };
    app.loadData = env.App.prototype.loadData;
    const first = app.init([], 'test');
    await assert.rejects(first, /加载失败/);
    assert.equal(first, app.init([]));
    await assert.rejects(app.init([]), /加载失败/);
    assert.equal(requests, 1);
    assert.equal(counts().bindings, 1);
    assert.equal(counts().renders, 0);
});

test('未指定默认时间轴时完成初始化并渲染空状态', async () => {
    const { app, counts } = createStartupFixture();
    await app.init([]);
    assert.equal(app.activeTimelines.size, 0);
    assert.equal(counts().renders, 1);
});

test('加载跳过空轴，重复定位只警告且保留事件', async () => {
    const warnings = [];
    const events = [{ year: 2000, month: 6, title: '甲' },
        { year: 2000, month: -6, title: '乙' }];
    context.fetch = async file => ({ ok: true, json: async () => file === 'empty' ? [] : events });
    const index = ['empty', 'one', 'two'].map(id => ({ id, title: id, eventPath: id }));
    const timelines = await utils.data.loadTimelines(index, (...args) => warnings.push(args));
    assert.equal(timelines.length, 2);
    assert.equal(timelines[0].events.length, 2);
    assert.deepEqual(warnings.map(w => w[0]), ['error', 'warning', 'warning']);
    assert.match(warnings[1][1], /one.*甲、乙/);
    assert.equal((await utils.data.loadTimelines(index.slice(0, 1))).length, 0);
});

function rangeApp(events = []) {
    const app = new context.App();
    app.timelines = [{ id: 'test', events }];
    app.activeTimelines.add('test');
    app.render = app.updateRangeSlider = () => {};
    app.showToast = message => { app.message = message; };
    return app;
}

test('单事件、同年及同日事件按实际日期居中，重置和拖动保留最小跨度', () => {
    for (const events of [
        [{ year: 2000, month: 6, title: '甲' }],
        [{ year: 2000, month: 6 }, { year: 2000, month: -6 }],
        [{ year: 2000, month: 1 }, { year: 2000, month: 12 }]
    ]) {
        const app = rangeApp(events);
        app.resetView();
        const dates = events.map(utils.date.getDecimalYear);
        assert.ok(Math.abs((app.viewStart + app.viewEnd) / 2 -
            (Math.min(...dates) + Math.max(...dates)) / 2) < 1e-9);
        assert.ok(Math.abs(app.viewEnd - app.viewStart - 3) < 1e-9);
        app.viewStart += 100; app.viewEnd += 100;
        app.clampViewBounds();
        assert.ok(app.viewStart >= app.minYear);
        assert.ok(app.viewEnd <= app.maxYear + 1e-9);
    }
    const app = rangeApp([]);
    app.resetView();
    assert.ok(Number.isFinite(app.viewStart) && app.viewEnd - app.viewStart >= 3);
    app.activeTimelines.clear();
    app.resetView();
    assert.ok(Number.isFinite(app.viewEnd) && app.viewEnd > app.viewStart);
});

test('输入范围交换、补足、整体限制边界并回填，非法输入不改视图', () => {
    const app = rangeApp();
    app.minYear = 1900; app.maxYear = 2100;
    const nodes = {};
    context.document = { getElementById: id => nodes[id] ||= { value: '', style: {} } };
    app.updateRangeSlider = context.App.prototype.updateRangeSlider;
    for (const [start, end, expectedStart, expectedEnd] of [
        ['2005', '2000', 2000, 2005], ['2000', '2000', 2000, 2003],
        ['2000.5', '2001', 2000.5, 2003.5], ['2200', '2201', 2097, 2100],
        ['1800', '1801', 1900, 1903], ['1800', '2200', 1900, 2100]
    ]) {
        context.document.getElementById('viewStartInput').value = start;
        context.document.getElementById('viewEndInput').value = end;
        app.applyViewRange();
        assert.equal(app.viewStart, expectedStart);
        assert.equal(app.viewEnd, expectedEnd);
        assert.equal(Number(nodes.viewStartInput.value), expectedStart);
        assert.equal(Number(nodes.viewEndInput.value), expectedEnd);
    }
    for (const invalid of ['', ' ', '2000abc', 'Infinity']) {
        nodes.viewStartInput.value = invalid; nodes.viewEndInput.value = '2000';
        const before = [app.viewStart, app.viewEnd];
        app.applyViewRange();
        assert.deepEqual([app.viewStart, app.viewEnd], before);
        assert.match(app.message, /有效/);
    }
});

test('空轴错误写入控制台，Toast 仅汇总一次；同日事件只警告', async () => {
    const app = rangeApp();
    const errors = [], warnings = [], toasts = [];
    context.console = { error: message => errors.push(message), warn: message => warnings.push(message) };
    context.fetch = async file => ({ ok: true, json: async () => file === 'same' ?
        [{ year: 2000, title: '甲' }, { year: 2000, title: '乙' }] : [] });
    app.showToast = message => toasts.push(message);
    await app.loadData(['empty1', 'empty2', 'same'].map(id => ({ id, title: id, eventPath: id })));
    assert.equal(app.timelines.length, 1);
    assert.equal(errors.length, 2);
    assert.equal(warnings.length, 1);
    assert.equal(toasts.length, 1);
    assert.match(toasts[0], /跳过 2 条/);
});


test('混合加载隔离网络、HTTP、解析、字段、空轴和重复 ID 错误，保持索引顺序', async () => {
    const issues = [];
    let finishFirst;
    context.fetch = async file => {
        if (file === 'network') throw new Error('网络断开');
        if (file === 'http') return { ok: false, status: 404 };
        if (file === 'slow') await new Promise(resolve => { finishFirst = resolve; });
        return { ok: true, json: async () => {
            if (file === 'json') throw new SyntaxError('JSON 解析失败');
            if (file === 'invalid') return [{ year: 'abc', title: '错误' }];
            if (file === 'empty') return [];
            return [{ year: 2000, title: file }];
        } };
    };
    const paths = ['slow', 'network', 'http', 'json', 'invalid', 'empty', 'fast', 'duplicate'];
    const index = paths.map(file => ({ id: file === 'duplicate' ? 'slow' : file,
        title: file, eventPath: file }));
    index.push(null);
    const task = utils.data.loadTimelines(index, (type, message) => issues.push({ type, message }));
    finishFirst();
    const result = await task;
    assert.deepEqual(Array.from(result, t => t.id), ['slow', 'fast']);
    assert.equal(issues.length, 7);
    assert.ok(issues.every(issue => issue.type === 'error'));
    for (const text of ['网络断开', '404', 'JSON 解析失败', '年份', '空时间轴', 'ID 重复', '缺少事件文件路径']) {
        assert.ok(issues.some(issue => issue.message.includes(text)), text);
    }
    assert.equal(result[0].events[0].title, 'slow');
});

test('同 ID 首条失败时可加载后续有效数据；全部失败仍完成初始化', async () => {
    context.fetch = async file => ({ ok: file !== 'bad', status: 404,
        json: async () => [{ year: 2000, title: '事件' }] });
    const index = ['bad', 'good'].map(eventPath => ({ id: 'same', title: eventPath, eventPath }));
    const result = await utils.data.loadTimelines(index);
    assert.equal(result.length, 1);
    assert.equal(result[0].title, 'good');
    assert.equal((await utils.data.loadTimelines([])).length, 0);
    await assert.rejects(utils.data.loadTimelines(null), /索引必须是数组/);
    const { env, app, counts } = createStartupFixture();
    env.TimelineUtils = utils;
    env.console = { error() {}, warn() {} };
    app.loadData = env.App.prototype.loadData;
    const messages = [];
    app.showToast = message => messages.push(message);
    await app.init(index.slice(0, 1), 'same');
    assert.equal(app.timelines.length, 0);
    assert.equal(app.activeTimelines.size, 0);
    assert.equal(counts().renders, 1);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /未加载到可用时间轴/);
});
