'use strict'
const TIMELINE_INDEX = [
    {
        id: 'three-body',
        title: '三体',
        color: '#3b82f6',
        eventPath: './TL_Data/TL_ThreeBody.json',
        category: '科幻文学'
    },
    {
        id: 'quantum-physics',
        title: '物理学发展史',
        color: '#8b5cf6',
        eventPath: './TL_Data/TL_Physics.json',
        category: '科学史'
    }
];

const defaultTimelineId = 'three-body';

// 初始化应用
const app = new TimelineApp(TIMELINE_INDEX, defaultTimelineId);