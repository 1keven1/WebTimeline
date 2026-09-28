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
    await assert.rejects(utils.data.loadTimelines(index), /404/);
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
