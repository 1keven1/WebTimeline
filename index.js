'use strict'
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

// 初始化应用
const app = new TimelineApp(TIMELINE_INDEX, defaultTimelineIds);