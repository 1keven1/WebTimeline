'use strict'
class EventCard {
    constructor(event, timeline, x, y) {
        this.event = event;
        this.timeline = timeline;
        this.x = x;
        this.y = y;
        this.isHovered = false;
        this.isSelected = false;
    }

    // 检测点是否在卡片内
    containsPoint(px, py) {
        const w = this.getWidth();
        const h = this.getHeight();
        return px >= this.x - w / 2 && px <= this.x + w / 2 &&
            py >= this.y - h / 2 && py <= this.y + h / 2;
    }

    // 获取当前宽度
    getWidth() {
        return this.isHovered ? 100 : 80;
    }

    // 获取当前高度
    getHeight() {
        return this.isHovered ? 50 : 30;
    }

    // 绘制卡片
    draw(ctx) {
        const w = this.getWidth();
        const h = this.getHeight();
        const color = this.timeline.color;

        // 背景
        ctx.fillStyle = this.isSelected ? '#fff' : color;
        ctx.beginPath();
        ctx.roundRect(this.x - w / 2, this.y - h / 2, w, h, 6);
        ctx.fill();

        if (this.isSelected) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 文字
        this.drawText(ctx);
    }

    // 绘制文字
    drawText(ctx) {
        const color = this.isSelected ? this.timeline.color : '#fff';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (this.isHovered) {
            // 悬浮模式：年份 + 标题
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText(this.event.year, this.x, this.y - 12);

            ctx.font = '10px sans-serif';
            const title = this.truncateText(this.event.title, 8);
            ctx.fillText(title, this.x, this.y + 8);
        } else {
            // 默认模式：仅标题
            ctx.font = '11px sans-serif';
            const title = this.truncateText(this.event.title, 6);
            ctx.fillText(title, this.x, this.y);
        }

        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
    }

    // 截断文本
    truncateText(text, maxLen) {
        return text.length > maxLen ? text.substring(0, maxLen - 1) + '...' : text;
    }
}