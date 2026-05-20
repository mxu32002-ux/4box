const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors'); // ✅ 這裡宣告過一次就夠了！

const app = express();
const PORT = process.env.PORT || 3000;

// === 🔓 後端大開門：強制允許前端進行 GET, POST, 以及關鍵的 DELETE 動作 ===
// 🚫 這裡原本重複的 const cors = require('cors') 已經被拿掉了，不會再打架！
app.use(cors({
    origin: '*', // 允許來自任何地方的網頁讀取
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'], // 👈 必須指名道姓把 DELETE 寫出來！
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
const notion = new Client({
  auth: process.env.NOTION_INTEGRATION_TOKEN
});

app.post('/api/add-note', async (req, res) => {
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!databaseId) {
    return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });
  }

  try {
    const { 
      name, category, mainRegion, subRegion, address, 
      openTime, offDay, ticketInfo, foodType, 
      startDate, endDate, videoUrl, note 
    } = req.body;

    // 🎯 這裡已經嚴格修正為最標準的 Notion API 欄位格式
    const properties = {
      "名稱": { 
        title: [{ text: { content: name || "未命名隨手記" } }] 
      },
      "分類": { 
        select: { name: category } 
      },
      "主要地區": { 
        select: { name: mainRegion } 
      },
      "細分地區/地點": { 
        rich_text: [{ text: { content: subRegion || "" } }] 
      },
      "詳細地址": { 
        rich_text: [{ text: { content: address || "" } }] 
      },
      "營業/開放時間": { 
        rich_text: [{ text: { content: openTime || "" } }] 
      },
      "固定公休日": { 
        rich_text: [{ text: { content: offDay || "" } }] 
      },
      "門票/票券資訊": { 
        rich_text: [{ text: { content: ticketInfo || "" } }] 
      },
      "隨手札記備註": { 
        rich_text: [{ text: { content: note || "" } }] 
      }
    };

    // 選填與特殊格式欄位防禦
    if (foodType && foodType.trim() !== '') {
      properties["美食總類"] = { select: { name: foodType } };
    }
    if (videoUrl && videoUrl.trim() !== '') {
      properties["影片連結"] = { url: videoUrl };
    }
    if (startDate && startDate.trim() !== '') {
      properties["開始日期"] = { date: { start: startDate } };
    }
    if (endDate && endDate.trim() !== '') {
      properties["結束日期"] = { date: { start: endDate } };
    }

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: properties
    });

    console.log('✅ Notion 寫入成功:', response.id);
    return res.status(200).json({ success: true, message: '成功寫入 Notion！' });

  } catch (error) {
    console.error('❌ Notion 寫入失敗，詳細日誌:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// === 🎯 全新追加：更新 Notion 雲端舊資料的完美對齊版 ===
app.post('/api/notion-update/:id', async (req, res) => {
  const databaseId = process.env.NOTION_DATABASE_ID;
  
  if (!databaseId) {
    return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });
  }

  try {
    const { id } = req.params;
    const { 
      name, category, mainRegion, subRegion, address, 
      openTime, offDay, ticketInfo, foodType, 
      startDate, endDate, videoUrl, note 
    } = req.body;

    console.log(`🔄 [雲端智慧更新] 正在通知 Notion 修改頁面，ID: ${id}`);

    // 🎯 這裡的欄位完全複製你 add-note 的最標準格式，咬合度 100%！
    const properties = {
      "名稱": { 
        title: [{ text: { content: name || "未命名隨手記" } }] 
      },
      "分類": { // 👈 統一對齊叫「分類」！
        select: category ? { name: category } : null 
      },
      "主要地區": { 
        select: mainRegion ? { name: mainRegion } : null 
      },
      "細分地區/地點": { 
        rich_text: [{ text: { content: subRegion || "" } }] 
      },
      "詳細地址": { 
        rich_text: [{ text: { content: address || "" } }] 
      },
      "營業/開放時間": { 
        rich_text: [{ text: { content: openTime || "" } }] 
      },
      "固定公休日": { 
        rich_text: [{ text: { content: offDay || "" } }] 
      },
      "門票/票券資訊": { 
        rich_text: [{ text: { content: ticketInfo || "" } }] 
      },
      "隨手札記備註": { 
        rich_text: [{ text: { content: note || "" } }] 
      }
    };

    // 選填與特殊格式欄位防禦（與你的 add-note 一模一樣）
    if (foodType && foodType.trim() !== '') {
      properties["美食總類"] = { select: { name: foodType } };
    } else {
      properties["美食總類"] = { select: null }; // 如果清空了就抹除
    }
    
    if (videoUrl && videoUrl.trim() !== '') {
      properties["影片連結"] = { url: videoUrl };
    } else {
      properties["影片連結"] = { url: null };
    }
    
    if (startDate && startDate.trim() !== '') {
      properties["開始日期"] = { date: { start: startDate } };
    } else {
      properties["開始日期"] = null;
    }
    
    if (endDate && endDate.trim() !== '') {
      properties["結束日期"] = { date: { start: endDate } };
    } else {
      properties["結束日期"] = null;
    }

    // 呼叫 Notion 官方 API 進行舊頁面的資料覆蓋更新 (update)
    await notion.pages.update({
      page_id: id,
      properties: properties
    });

    console.log('✅ Notion 更新成功！ID:', id);
    return res.status(200).json({ success: true, message: '雲端手帳更新成功！' });

  } catch (error) {
    console.error('❌ Notion 更新失敗，詳細日誌:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🌿 Live!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// === 🎯 從 Notion 讀取所有手帳資料（已對齊分類與日期格式） ===
// === 🎯 從 Notion 讀取所有手帳資料（與雲端資料庫欄位 100% 絕對對齊版） ===
app.get('/api/notion', async (req, res) => {
    try {
        const databaseId = process.env.NOTION_DATABASE_ID;
        
        if (!databaseId) {
            return res.status(500).json({ success: false, error: '尚未設定 DATABASE_ID' });
        }

        // 向 Notion 查詢資料
        const response = await notion.databases.query({
            database_id: databaseId,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                }
            ]
        });

        // 🎯 這裡的翻譯箱，必須跟你的 Notion 資料庫欄位名稱完全一模一樣！
        const items = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                title: props['名稱']?.title[0]?.plain_text || '未命名',
                
                // 🛡️【關鍵核心對齊】確保讀取的是「分類」欄位，而不是「類別」
                category: props['分類']?.select?.name || '未分類',
                
                // 🎯 地區與地點局部對齊
                region: props['主要地區']?.select?.name || '',
                subRegion: props['細分地區/地點']?.rich_text[0]?.plain_text || '',
                
                address: props['詳細地址']?.rich_text[0]?.plain_text || '',
                time: props['營業/開放時間']?.rich_text[0]?.plain_text || '',
                holiday: props['固定公休日']?.rich_text[0]?.plain_text || '',
                ticket: props['門票/票券資訊']?.rich_text[0]?.plain_text || '',
                notes: props['隨手札記備註']?.rich_text[0]?.plain_text || '',
                
                // 📅 日期安全防呆抽取
                startDate: props['開始日期']?.date?.start || '',
                endDate: props['結束日期']?.date?.start || '',
                
                // 🎬 影片連結與狀態防呆
                videoUrl: props['影片連結']?.url || '',
                status: (props['status'] && props['status'].select && props['status'].select.name) ? props['status'].select.name : 'normal'
            };
        });

        // 成功打包送回前端網頁
        res.json({ success: true, data: items });

    } catch (error) {
        console.error("❌ Notion 雲端讀取失敗，詳細日誌:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// === 🗑️ 免費版相容：更新 status 欄位為 deleted，完美繞過付費牆 ===
app.delete('/api/notion/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log("====================================");
        console.log("🎬 免費版繞道工法！正在將此 ID 標記為刪除:", id);
        console.log("====================================");

        const myNotionClient = (typeof notion !== 'undefined') ? notion : 
                               (typeof Notion !== 'undefined') ? Notion : null;
                               
        if (!myNotionClient) throw new Error("找不到 notion 變數");

        // 🚀 衝進 Notion，把 status 欄位改成 "deleted"
        await myNotionClient.pages.update({
            page_id: id,
            properties: {
                'status': {
                    select: { name: 'deleted' }
                }
            }
        });

        console.log("🟢 成功！Notion 端該頁面的 status 已被改為 deleted！");
        res.json({ success: true, message: '雲端資料已成功標記刪除！' });

    } catch (error) {
        console.error("❌ 後端標記失敗，錯誤原因:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
