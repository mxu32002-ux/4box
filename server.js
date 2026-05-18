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

    const properties = {
      "名稱": { title: [{ text: { content: name || "未命名隨手記" } }] },
      "分類": { select: { name: category } },
      "地區": { select: { name: mainRegion } },
      "細分地區/地點": { rich_text: [{ text: { content: subRegion || "" } }] },
      "地址": { rich_text: [{ text: { content: address || "" } }] },
      "營業時間": { rich_text: [{ text: { content: openTime || "" } }] },
      "公休日": { rich_text: [{ text: { content: offDay || "" } }] },
      "門票": { rich_text: [{ text: { content: ticketInfo || "" } }] },
      "備註": { rich_text: [{ text: { content: note || "" } }] }
    };

    if (foodType) {
      properties["總類"] = { select: { name: foodType } };
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

    const response = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: properties
    });

    return res.status(200).json({ success: true, message: '成功！' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('🌿 Live!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});