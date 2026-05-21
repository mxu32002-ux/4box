const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// === 🔓 設定跨域存取 (CORS) ===
app.use(cors({ 
    origin: '*', 
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization'] 
}));
app.use(express.json());

// === 🚀 初始化 Notion 客戶端 ===
const notion = new Client({ auth: process.env.NOTION_INTEGRATION_TOKEN });

// ==========================================================
// 🆕 新增卡片到 Notion (Add Note) - 絕對免疫版
// ==========================================================
app.post('/api/add-note', async (req, res) => {
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!databaseId) return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });

    try {
        const { name, category, mainRegion, subRegion, address, openTime, offDay, ticketInfo, foodType, startDate, endDate, videoUrl, note } = req.body;
        
        // 🎯 1. 核心包裹
        const properties = {
            "Name": { title: [{ text: { content: name || "未命名隨手記" } }] },
            "細分地區/地點": { rich_text: subRegion ? [{ text: { content: subRegion } }] : [] },
            "詳細地址": { rich_text: address ? [{ text: { content: address } }] : [] },
            "營業/開放時間": { rich_text: openTime ? [{ text: { content: openTime } }] : [] },
            "固定公休日": { rich_text: offDay ? [{ text: { content: offDay } }] : [] },
            "門票/票券資訊": { rich_text: ticketInfo ? [{ text: { content: ticketInfo } }] : [] },
            "隨手札記備註": { rich_text: note ? [{ text: { content: note } }] : [] }
        };

        // 🛡️ 2. 危險包裹防禦
        if (category && category.trim() !== '') properties["分類"] = { select: { name: category } };
        if (mainRegion && mainRegion.trim() !== '') properties["主要地區"] = { select: { name: mainRegion } };
        if (foodType && foodType.trim() !== '') properties["美食種類"] = { select: { name: foodType } };
        if (videoUrl && videoUrl.trim() !== '') properties["影片連結"] = { url: videoUrl };
        if (startDate && startDate.trim() !== '') properties["開始日期"] = { date: { start: startDate } };
        if (endDate && endDate.trim() !== '') properties["結束日期"] = { date: { start: endDate } };

        const response = await notion.pages.create({ parent: { database_id: databaseId }, properties: properties });
        res.json({ success: true, data: response });
    } catch (error) {
        console.error("❌ Notion 新增失敗:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/notion-update/:id', async (req, res) => {
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (!databaseId) return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });

    try {
        const { id } = req.params;
        const { name, category, mainRegion, subRegion, address, openTime, offDay, ticketInfo, foodType, startDate, endDate, videoUrl, note } = req.body;

        // 1. 初始化一個空的 properties 物件
        const properties = {};

        // 2. 只有有值時才寫入，不要傳 null
        properties["Name"] = { title: [{ text: { content: name || "未命名隨手記" } }] };
        
        if (subRegion) properties["細分地區/地點"] = { rich_text: [{ text: { content: subRegion } }] };
        if (address) properties["詳細地址"] = { rich_text: [{ text: { content: address } }] };
        if (openTime) properties["營業/開放時間"] = { rich_text: [{ text: { content: openTime } }] };
        if (offDay) properties["固定公休日"] = { rich_text: [{ text: { content: offDay } }] };
        if (ticketInfo) properties["門票/票券資訊"] = { rich_text: [{ text: { content: ticketInfo } }] };
        if (note) properties["隨手札記備註"] = { rich_text: [{ text: { content: note } }] };

        // 3. 處理 Select 欄位 (一定要確認 Notion 裡真的叫這些名字)
        if (category) properties["分類"] = { select: { name: category } };
        if (mainRegion) properties["主要地區"] = { select: { name: mainRegion } };
        if (foodType && foodType.trim() !== '') properties["美食種類"] = { select: { name: foodType } };

        // 4. 處理特殊欄位 (日期與連結)
        if (videoUrl && videoUrl.trim() !== '') properties["影片連結"] = { url: videoUrl };
        if (startDate && startDate.trim() !== '') properties["開始日期"] = { date: { start: startDate } };
        if (endDate && endDate.trim() !== '') properties["結束日期"] = { date: { start: endDate } };

        // 5. 發送更新
        await notion.pages.update({ page_id: id, properties: properties });
        
        res.json({ success: true, message: '雲端手帳更新成功！' });
    } catch (error) {
        console.error("❌ Notion 更新失敗:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================================
// 📋 讀取所有資料
// ==========================================================
app.get('/api/notion', async (req, res) => {
    try {
        const databaseId = process.env.NOTION_DATABASE_ID;
        if (!databaseId) return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });

        const response = await notion.databases.query({ database_id: databaseId, sorts: [{ timestamp: 'created_time', direction: 'descending' }] });

        const items = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                title: props['Name']?.title[0]?.plain_text || '未命名', // 
                category: props['分類']?.select?.name || '未分類',
                region: props['主要地區']?.select?.name || '',
                subRegion: props['細分地區/地點']?.rich_text[0]?.plain_text || '',
                address: props['詳細地址']?.rich_text[0]?.plain_text || '',
                time: props['營業/開放時間']?.rich_text[0]?.plain_text || '',
                holiday: props['固定公休日']?.rich_text[0]?.plain_text || '',
                ticket: props['門票/票券資訊']?.rich_text[0]?.plain_text || '',
                notes: props['隨手札記備註']?.rich_text[0]?.plain_text || '',
                startDate: props['開始日期']?.date?.start || '',
                endDate: props['結束日期']?.date?.start || '',
                videoUrl: props['影片連結']?.url || '',
                status: props['status']?.select?.name || 'normal',
                
                // 🎯 【關鍵修復】加上這行，美食種類才不會一直跳回日式！
                foodType: props['美食種類']?.select?.name || ''
            };
        });
        res.json({ success: true, data: items });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================================
// 🗑️ 標記為刪除 (status = deleted)
// ==========================================================
app.delete('/api/notion/:id', async (req, res) => {
    try {
        await notion.pages.update({ page_id: req.params.id, properties: { 'status': { select: { name: 'deleted' } } } });
        res.json({ success: true, message: '已成功標記為刪除' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => res.send('🌿 Live!'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
