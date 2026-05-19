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

        // 轉譯資料格式
        const items = response.results.map(page => {
            const props = page.properties;
            return {
                id: page.id,
                title: props['名稱']?.title[0]?.plain_text || '未命名',
                category: props['類別']?.select?.name || '未分類',
                region: props['主要地區']?.select?.name || props['主要地區']?.rich_text[0]?.plain_text || '',
                address: props['詳細地址']?.rich_text[0]?.plain_text || '',
                time: props['營業/開放時間']?.rich_text[0]?.plain_text || '',
                holiday: props['固定公休日']?.rich_text[0]?.plain_text || '',
                ticket: props['門票/票券資訊']?.rich_text[0]?.plain_text || '',
                notes: props['隨手札記備註']?.rich_text[0]?.plain_text || ''
            };
        });

        // 成功回傳
        res.json({ success: true, data: items });

    } catch (error) {
        console.error("Notion 讀取失敗:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================================
// 🚀 核心功能：從 Render 後端把 Notion 資料撈回來並顯示在畫面上
// ==========================================================
async function loadNotionData() {
    // 瞄準我們剛剛在 HTML 設定好的那個 diaryList 大框框
    const listContainer = document.getElementById('diaryList'); 
    if (!listContainer) return;

    try {
        // 1. 讀取時，畫面上先顯示文青風轉圈圈動畫
        listContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 text-center text-stone-400">
                <i class="fa-solid fa-spinner fa-spin text-xl mb-3 text-diary-primary"></i>
                <p class="text-xs font-serif">正在翻開 Notion 雲端手帳本...</p>
            </div>
        `;

        // 2. 向你的 Render 後端要資料
        // ⚠️ 請把底下的網址改成你真正的 Render 網址（昨天測試成功 success:true 的那個）
        const response = await fetch('https://你的專案名字.onrender.com/api/notion'); 
        const result = await response.json();
        
        if (result.success && result.data) {
            const cloudData = result.data;
            
            // 清空載入中提示
            listContainer.innerHTML = ''; 
            
            // 3. 安全機制：如果 Notion 雲端完全沒資料，就還原顯示你原本的「白紙」畫面
            if (cloudData.length === 0) {
                listContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-20 text-center">
                        <div class="w-16 h-16 bg-white rounded-full flex items-center justify-center text-stone-300 border border-diary-light/40 mb-3 shadow-soft">
                            <i class="fa-solid fa-wind text-xl"></i>
                        </div>
                        <h3 class="font-serif font-bold text-stone-400 text-sm">這兒還是一張白紙</h3>
                        <p class="text-[11px] text-stone-400 font-serif mt-1">點擊右下角按鈕寫下新的足跡記憶</p>
                    </div>
                `;
                return;
            }

            // 4. 有資料！開始把 Notion 資料，一筆一筆畫成超美的文青卡片
            cloudData.forEach(item => {
                const cardHtml = `
                    <div class="bg-white rounded-2xl p-5 mb-4 shadow-soft border border-diary-light/30 font-serif text-left w-full max-w-md mx-auto">
                        <div class="flex justify-between items-start mb-3">
                            <h4 class="font-bold text-stone-700 text-base">${item.title}</h4>
                            <span class="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">${item.category}</span>
                        </div>
                        <div class="text-xs text-stone-500 space-y-1.5">
                            ${item.region || item.address ? `<p>📍 <strong>地點：</strong>[${item.region}] ${item.address}</p>` : ''}
                            ${item.time ? `<p>🕒 <strong>時間：</strong>${item.time}</p>` : ''}
                            ${item.holiday ? `<p>❌ <strong>公休：</strong>${item.holiday}</p>` : ''}
                            ${item.ticket ? `<p>🎫 <strong>門票：</strong>${item.ticket}</p>` : ''}
                            ${item.notes ? `<p class="mt-2 pt-2 border-t border-stone-100 text-stone-600 italic">📝 ${item.notes}</p>` : ''}
                        </div>
                    </div>
                `;
                // 把做好的精美卡片一張張疊進大框框裡
                listContainer.insertAdjacentHTML('beforeend', cardHtml);
            });
            
            console.log("📜 成功從 Notion 雲端同步了 " + cloudData.length + " 筆回憶！");
        }
    } catch (error) {
        console.error("網頁讀取雲端資料失敗:", error);
        listContainer.innerHTML = '<div class="text-xs text-stone-400 py-10 text-center">❌ 雲端同步失敗，請檢查網路。</div>';
    }
}

// ==========================================================
// ⏰ 自動執行：只要網頁一打開，立刻自動執行上面的雲端同步
// ==========================================================
window.addEventListener('DOMContentLoaded', () => {
    loadNotionData();
});
