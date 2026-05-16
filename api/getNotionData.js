const { Client } = require('@notionhq/client');

// process.env 代表「環境變數」，這是鎖在保險箱裡的密碼，不會寫死在程式碼中
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  try {
    // 向 Notion 請求資料庫內容
    const response = await notion.databases.query({
      database_id: databaseId,
    });
    
    // 成功的話，把 Notion 的資料變成 JSON 格式傳給前端 HTML
    res.status(200).json(response.results);
  } catch (error) {
    // 失敗的話，回傳錯誤訊息
    res.status(500).json({ error: error.message });
  }
}