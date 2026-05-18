const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // 允許你的 GitHub Pages 前端網站跨網域呼叫

// 這裡不要直接寫死 Token 和 ID，我們用環境變數環境保護它！
const notion = new Client({ auth: process.env.NOTION_INTEGRATION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

app.post('/api/add-note', async (req, res) => {
    const item = req.body;
    const region = item.exhibitionRegion || item.attractionRegion || item.foodRegion || item.storeRegion || '台北';
    const subRegion = item.exhibitionLocation || item.attractionRegionSub || item.foodRegionSub || item.storeRegionSub || '';
    const address = item.exhibitionAddress || item.attractionAddress || item.foodAddress || item.storeAddress || '';
    const time = item.exhibitionTime || item.attractionTime || item.foodTime || item.storeTime || '';
    const closed = item.foodClosed || item.storeClosed || '';
    const ticket = item.exhibitionTicket || item.attractionTicket || '';
    const video = item.exhibitionVideo || item.attractionVideo || item.foodVideo || item.storeVideo || '';
    const notes = item.exhibitionNotes || item.attractionNotes || item.foodNotes || item.storeNotes || '';

    try {
        const properties = {
            '名稱': { title: [{ text: { content: item.title } }] },
            '分類': { select: { name: item.category } },
            '主要地區': { select: { name: region } },
            '細分地區/地點': { rich_text: [{ text: { content: subRegion } }] },
            '詳細地址': { rich_text: [{ text: { content: address } }] },
            '營業/開放時間': { rich_text: [{ text: { content: time } }] },
            '固定公休日': { rich_text: [{ text: { content: closed } }] },
            '門票/票券資訊': { rich_text: [{ text: { content: ticket } }] },
            '隨手札記備註': { rich_text: [{ text: { content: notes } }] }
        };

        if (item.category === '美食' && item.foodType) properties['美食總類'] = { select: { name: item.foodType } };
        if (item.category === '展覽' && item.exhibitionStartDate) properties['開始日期'] = { date: { start: item.exhibitionStartDate } };
        if (item.category === '展覽' && item.exhibitionEndDate) properties['結束日期'] = { date: { start: item.exhibitionEndDate } };
        if (video) properties['影片連結'] = { url: video };

        const response = await notion.pages.create({ parent: { database_id: DATABASE_ID }, properties: properties });
        res.status(200).json({ success: true, response });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Render 會自動分配 PORT，所以要用 process.env.PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));