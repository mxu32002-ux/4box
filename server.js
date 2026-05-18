const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. 啟用跨網域權限與 JSON 解析（解決前端紅色報錯關鍵）
app.use(cors());
app.use(express.json());

// 2. 初始化 Notion 客戶端（自動讀取 Render 的環境變數）
const notion = new Client({
  auth: process.env.NOTION_INTEGRATION_TOKEN
});

// 3. 接收前端資料並寫入 Notion 的傳送門
app.post('/api/add-note', async (req, res) => {
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!databaseId) {
    return res.status(500).json({ success: false, error: '後端尚未設定 NOTION_DATABASE_ID 環境變數' });
  }

  try {
    const { 
      name, category, mainRegion, subRegion, address, 
      openTime, offDay, ticketInfo, foodType, 
      startDate, endDate, videoUrl, note 
    } = req.body;

    // 建立寫入 Notion 的屬性物件
    const properties = {
      "名稱": { title: [{ text: { content: name || "未命名隨手記" } }] },
      "分類": { select: { name: category } },
      "地區": { select: { name: mainRegion } },
      "細分地區/地點": { RichmondText: [{ text: { content: subRegion || "" } }] }, // 修正為你的萬能文字欄
      "地址": { rich_text: [{ text: { content: address || "" } }] },
      "營業時間": { rich_text: [{ text: { content: openTime || "" } }] },
      "公休日": { rich_text: [{ text: { content: offDay || "" } }] },
      "門票": { rich_text: [{ text: { content: ticketInfo || "" } }] },
      "備註": { rich_text: [{ text: { content: note || "" } }] }
    };

    // 動態填入選填或特殊格式欄位
    if (foodType) {
      properties["美食總類"] = { select: { name: foodType } };
    }
    if (videoUrl) {
      properties["影片連結"] = { url: videoUrl };
    }
    if (startDate) {
      properties["開始日期"] = { date: { start: startDate } };
    }
    if (endDate) {
      properties["結束日期"] = { date: { start: endDate } };
    }

    // 呼叫 Notion API 寫入資料
    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: properties
    });

    console.log('✅ 成功寫入 Notion:', response.id);
    return res.status(200).json({ success: true, message: '成功收藏至 Notion 雲端手帳！' });

  } catch (error) {
    console.error('❌ Notion API 寫入失敗，詳細錯誤:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      detail: error.body ? JSON.parse(error.body).message : '未知錯誤'
    });
  }
});

// 健康檢查節點
app.get('/', (req, res) => {
  res.send('🌿 SJ百寶任意門後端伺服器正在雲端優雅運行中...');
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});