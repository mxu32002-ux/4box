const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

app.get('/', (req, res) => {
  res.send('🌿 Live!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// === 新增：從 Notion 讀取所有手帳資料 ===
app.get('/api/notion', async (req, res) => {
    try {
        const databaseId = process.env.NOTION_DATABASE_ID;
        
        // 向 Notion 總部發出查詢請求
        const response = await notion.databases.query({
            database_id: databaseId,
            // 排序：讓最新建立的資料排在最前面
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
        });

        // 把 Notion 那堆複雜的 JSON 格式，翻譯成前端網頁看得懂的乾淨陣列
        const items = response.results.map(page => {
            const props = page.properties;
            
            // 這裡的安全保護：如果某個欄位在 Notion 是空的，就給它預設文字
            return {
                id: page.id,
                title: props.名稱?.title[0]?.plain_text || '未命名',
                category: props.類別?.select?.name || '未分類',
                region: props.主要地區?.select?.name || props.主要地區?.rich_text[0]?.plain_text || '',
                address: props.詳細地址?.rich_text[0]?.plain_text || '',
                time: props.營業/開放時間?.rich_text[0]?.plain_text || '',
                holiday: props.固定公休日?.rich_text[0]?.plain_text || '',
                ticket: props.門票/票券資訊?.rich_text[0]?.plain_text || '',
                notes: props.隨手札記備註?.rich_text[0]?.plain_text || ''
            };
        });

        // 成功把乾淨的資料回傳給前端 App
        res.json({ success: true, data: items });

    } catch (error) {
        console.error("Notion 讀取失敗詳細原因:", error.body || error);
        res.status(500).json({ success: false, error: error.message });
    }
});
