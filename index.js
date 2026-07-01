const nodeHtmlToImage = require('node-html-to-image');
const { AttachmentBuilder } = require('discord.js'); // 記得在原本的 discord.js 引入裡加上這個
require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

let cachedData = null;

// 定期更新資料
async function refreshData() {
    try {
        const response = await axios.get(process.env.API_URL);
        cachedData = response.data;
        console.log(`[${new Date().toLocaleTimeString()}] 資料已更新！`);
    } catch (error) {
        console.error("API 讀取失敗：", error);
    }
}

// 輔助函式：取得最接近今天的日期
function getNearestDate(schedules) {
    if (!schedules || schedules.length === 0) return null;
    const uniqueDates = [...new Set(schedules.map(s => s["日期"].split('T')[0]))];
    const now = new Date();
    
    let nearestDate = uniqueDates[0];
    let minDiff = Infinity;

    for (const d of uniqueDates) {
        const diff = Math.abs(new Date(d) - now);
        if (diff < minDiff) {
            minDiff = diff;
            nearestDate = d;
        }
    }
    return nearestDate;
}

// 輔助函式：尋找符合使用者輸入的日期 (支援模糊搜尋，如輸入 0618 找到 2026-06-18)
function findMatchingDate(schedules, inputDate) {
    const cleanInput = inputDate.replace(/[\/\-]/g, ''); 
    const uniqueDates = [...new Set(schedules.map(s => s["日期"].split('T')[0]))];
    for (const d of uniqueDates) {
        if (d.replace(/\-/g, '').includes(cleanInput)) return d;
    }
    return null;
}

client.once('clientReady', async () => {
    await refreshData();
    // 修改這裡：180000 毫秒 = 3 分鐘
    setInterval(refreshData, 180000); 
    console.log(`✅ ${client.user.tag} 已上線並準備就緒！`);
});
// 1. 設定管理員 ID (請填入你自己的 Discord User ID)
const ADMIN_IDS = ['666630720181239848', '你的DiscordID2'];

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

        // 2. /更新 指令邏輯
        if (interaction.commandName === '更新') {
            // 權限檢查
            if (!ADMIN_IDS.includes(interaction.user.id)) {
                return interaction.reply({ content: '❌ 此指令僅限管理員使用。', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            
            try {
                await refreshData(); // 呼叫你原本的更新函數
                await interaction.editReply('✅ 資料已強制重新整理！');
            } catch (error) {
                await interaction.editReply('❌ 資料更新失敗，請檢查 API。');
            }
            return; // 處理完更新後直接跳出
        }
    if (!interaction.isChatInputCommand()) return;
    if (!cachedData) return interaction.reply('資料尚未準備好，請稍後再試。');
 // 🎨 定義站位專屬配色字典
        const zoneColors = {
            '東':   { color: '#b71c1c', bg: '#ffebee' },
            '一壘': { color: '#b71c1c', bg: '#ffebee' },
            '西':   { color: '#1a237e', bg: '#e3f2fd' },
            '三壘': { color: '#1a237e', bg: '#e3f2fd' },
            '東R':  { color: '#ef6c00', bg: '#fff3e0' },
            '西R':  { color: '#2e7d32', bg: '#e8f5e9' },
            '大樂': { color: '#6a1b9a', bg: '#f3e5f5' },
            '專區': { color: '#d84315', bg: '#fbe9e7' },
            '待定': { color: '#999999', bg: '#eeeeee' }
        };
    // 🏆 新增一個防呆小工具：能自動忽略欄位名稱多餘的空白，且如果是空值會自動填入「無」
    const getSafeValue = (obj, keyword) => {
        const actualKey = Object.keys(obj).find(k => k.includes(keyword));
        const val = actualKey ? obj[actualKey] : '';
        return (val && String(val).trim() !== '') ? String(val).trim() : '待定';
    };

    // ==========================================
    // 指令 1：/站位 (總表查詢 - 一眼看完 ＋ 動態標籤配色版)
    // ==========================================
    if (interaction.commandName === '站位') {
        await interaction.deferReply(); 

        let targetDate = interaction.options.getString('日期');
        let matchedDate;

        if (targetDate) {
            matchedDate = findMatchingDate(cachedData.schedule, targetDate);
            if (!matchedDate) return interaction.editReply(`找不到包含 \`${targetDate}\` 的班表資料！`);
        } else {
            matchedDate = getNearestDate(cachedData.schedule);
        }

        const dateSchedules = cachedData.schedule.filter(s => s["日期"].startsWith(matchedDate));
        if (dateSchedules.length === 0) return interaction.editReply('該日無班表資料。');

       

        let htmlCards = dateSchedules.map(s => {
           const getZone = (label, val) => {
                const text = getSafeValue(s, val);
                
                // 規則：如果是空的（沒排班），回傳一個空字串，圖片上就不會佔位
                if (text === '無') return ''; 

                // 規則：如果是 "" (待定)，顯示待定顏色
                if (text === '') {
                    const theme = zoneColors['待定'];
                    return `
                    <div class="zone" style="background-color: ${theme.bg}; border-color: ${theme.color}; border-style: dashed;">
                        <span class="z-label" style="color: ${theme.color};">待定</span>
                    </div>`;
                }

                // 其他正常班表
                const theme = zoneColors[text] || { color: '#ffffff', bg: '#3b3e45' };
                return `
                <div class="zone" style="background-color: ${theme.bg}; border-color: ${theme.bg};">
                    <span class="z-label" style="color: ${theme.color}; opacity: 0.8;">${label}</span>
                    <span style="color: ${theme.color};">${text}</span>
                </div>`;
            };

            return `
            <div class="member-row">
                <div class="member-info">
                    <span class="id-badge">${String(getSafeValue(s, '背號')).padStart(2, '0')}</span>
                    <span class="name-text">${getSafeValue(s, '姓名')}</span>
                </div>
                <div class="zones">
                    ${getZone('上半', '上半')}
                    ${getZone('中場', '中場')}
                    ${getZone('下半', '下半')}
                </div>
            </div>
            `;
        }).join('');

        const htmlContent = `
        <html>
          <style>
            body { 
                font-family: 'PingFang TC', 'Microsoft JhengHei', sans-serif; 
                padding: 20px; 
                background-color: #ffffff; 
                width: 1000px; 
                margin: 0;
            }
            .main-container {
                background-color: transparent; /* 👈 改為透明 */
                border-radius: 20px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                overflow: hidden;
            }
            .header-banner {
                background: linear-gradient(135deg, #bf0000 0%, #ff3b3b 100%); 
                padding: 20px;
                text-align: center;
                color: #ffffff;
                border-radius: 20px 20px 0 0; /* 讓頭部依然保有圓角 */
            }
            .header-banner h2 { margin: 0; font-size: 36px; font-weight: 900; letter-spacing: 2px; }
            .header-banner p { margin: 8px 0 0 0; font-size: 22px; opacity: 0.9; font-weight: bold; }
            
            .list-container {
                padding: 20px;
                display: grid;
                grid-template-columns: 1fr 1fr; 
                gap: 15px 20px; 
            }

            .member-row {
                background: #ffffff;
                border-radius: 12px;
                padding: 12px 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                box-shadow: inset 0 0 0 1px #c8c8c8;
            }
            .member-info {
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 130px; 
            }
            .id-badge {
                color: #a3a6aa;
                font-weight: bold;
                font-family: monospace;
                font-size: 20px;
            }
            .name-text {
                font-size: 26px; 
                font-weight: 900;
                color: #000000;
            }
            .zones {
                display: flex;
                gap: 10px;
            }
            .zone {
                border-radius: 10px;
                padding: 6px 14px;
                text-align: center;
                font-weight: 900;
                font-size: 24px;
                min-width: 50px;
                display: flex;
                flex-direction: column;
                align-items: center;
                border: 1px solid;
            }
            .zone.empty {
                background: transparent;
                border-color: #4a4d53;
                border-style: dashed;
                color: #6a6f7a;
            }
            .z-label {
                font-size: 13px;
                margin-bottom: 2px;
                font-weight: bold;
            }
          </style>
          <body>
            <div class="main-container">
                <div class="header-banner">
                    <h2>Rakuten Girls 站位總表</h2>
                    <p>📅 日期：${matchedDate}</p>
                </div>
                <div class="list-container">
                    ${htmlCards}
                </div>
            </div>
          </body>
        </html>
        `;

        const imageBuffer = await nodeHtmlToImage({ 
            html: htmlContent,
            transparent: true 
        });
        
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'colored_schedule.png' });

        const embed = new EmbedBuilder()
            .setImage('attachment://colored_schedule.png')
            .setColor(0xbf0000);

        await interaction.editReply({ embeds: [embed], files: [attachment] });
    }
// ==========================================
    // 指令 2：/女孩 (個人最新站位 + Monthly_Schedule 中的班表)
    // ==========================================
    if (interaction.commandName === '女孩') {
        const target = interaction.options.getString('目標');
        
        const member = cachedData.members.find(m => 
            getSafeValue(m, '姓名') === target || String(getSafeValue(m, '背號')) === target
        );
        if (!member) return interaction.reply(`查無女孩：\`${target}\``);

        // 1. 取得該成員的詳細站位 (維持使用 schedule)
        const memberSchedules = cachedData.schedule.filter(s => String(getSafeValue(s, '背號')) === String(getSafeValue(member, '背號')));
        const nearestDate = getNearestDate(memberSchedules);
        const latestSchedule = memberSchedules.find(s => s["日期"].startsWith(nearestDate));

        // 2. [新邏輯] 從 Monthly_Schedule 抓取該成員的班表日期
        const monthlyRow = cachedData.monthly.find(row => 
            String(row['背號 (ID)'] || row['背號'] || '') === String(getSafeValue(member, '背號'))
        );

        let allDates = '無';
        if (monthlyRow) {
            // 找出所有值為 '❤️' 的日期標題
            const dates = Object.keys(monthlyRow).filter(key => 
                (key.includes('/') || key.includes('-')) && monthlyRow[key] === '❤️'
            );
            if (dates.length > 0) {
                allDates = dates.join('、');
            }
        }

        // 3. 處理欄位顯示
        const getZoneText = (val) => {
            const text = latestSchedule ? getSafeValue(latestSchedule, val) : '無';
            return (text === '無' || text === '') ? null : text;
        };

        const embed = new EmbedBuilder()
            .setTitle(`🎀 ${getSafeValue(member, '姓名')}`)
            .setDescription(`**背號：** #${String(getSafeValue(member, '背號')).padStart(2, '0')}`)
            .setThumbnail(member["照片連結 (Photo URL)"])
            .setColor(0xbf0000)
            .addFields({ name: '📅 最近班表', value: nearestDate || '無', inline: false });

        const p1 = getZoneText('上半');
        const p2 = getZoneText('中場');
        const p3 = getZoneText('下半');

        if (p1) embed.addFields({ name: '上半場', value: `**${p1}**`, inline: true });
        if (p2) embed.addFields({ name: '中場', value: `**${p2}**`, inline: true });
        if (p3) embed.addFields({ name: '下半場', value: `**${p3}**`, inline: true });

        // 這裡現在顯示的是來自 Monthly_Schedule 的 ❤️ 日期
        embed.addFields({ name: '🗓️ 本月班表', value: allDates, inline: false });

        // IG 按鈕處理
        const components = [];
        const igLink = getSafeValue(member, 'IG') || getSafeValue(member, 'Instagram');
        if (igLink && igLink.startsWith('http')) {
            components.push(new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('前往 Instagram').setURL(igLink).setStyle(ButtonStyle.Link).setEmoji('1521773815703535636')
            ));
        }

        await interaction.reply({ embeds: [embed], components });
    }

    // ==========================================
    // 指令 3：/月曆 (總表圖片 或 個人日期清單)
    // ==========================================
    if (interaction.commandName === '月曆') {
        const targetName = interaction.options.getString('女孩');

    // [模式 A] 若沒選女孩：維持原本的總表圖片功能
    if (!targetName) {
        await interaction.deferReply();
        const monthlyData = cachedData.monthly;
        if (!monthlyData || monthlyData.length === 0) return interaction.editReply('目前暫無本月班表。');

        const headers = Object.keys(monthlyData[0]);
        let tableRows = monthlyData.map(row => `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`).join('');

        const htmlContent = `
        <html>
            <style>
                body { font-family: 'PingFang TC', sans-serif; background: #1e1f22; color: white; padding: 20px; width: fit-content; }
                .card { background: #2b2d31; border-radius: 16px; padding: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
                table { border-collapse: collapse; width: 100%; }
                th { background: #bf0000; color: white; padding: 12px; }
                td { border-bottom: 1px solid #444; padding: 10px; text-align: center; }
            </style>
            <body>
                <div class="card">
                    <h2 style="text-align:center;">📅 本月班表</h2>
                    <table>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                        ${tableRows}
                    </table>
                </div>
            </body>
        </html>
        `;

        const imageBuffer = await nodeHtmlToImage({ html: htmlContent, transparent: true });
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'monthly.png' });

        await interaction.editReply({ files: [attachment] });
        return;
        }

        // [模式 B] 若有選成員：顯示 Embed (直接從 Monthly_Schedule 提取)
        const member = cachedData.members.find(m => {
            const name = m['姓名'] || m['姓名 (Name)'] || '';
            const id = String(m['背號'] || m['背號 (ID)'] || '');
            return name.trim() === targetName.trim() || id.trim() === targetName.trim();
        });

        if (!member) {
            return interaction.reply({ 
                content: `找不到女孩：\`${targetName}\`。`, 
                ephemeral: true 
            });
        }

        // 1. 在 monthly 資料中找出該成員那一列
        const monthlyRow = cachedData.monthly.find(row => 
            String(row['背號 (ID)'] || row['背號'] || '') === String(member['背號'] || member['背號 (ID)'] || '')
        );

        if (!monthlyRow) return interaction.reply(`${getSafeValue(member, '姓名')} 在本月總表中無資料。`);

        // 2. 過濾出所有含有 '❤️' 的日期
        // Object.keys(monthlyRow) 會拿到所有標題 (如 "7/10", "7/11"...)
        // 我們排除掉 "姓名" 和 "背號" 等非日期欄位
        const workDates = Object.keys(monthlyRow).filter(key => {
            return (key.includes('/') || key.includes('-')) && monthlyRow[key] === '❤️';
        });

        if (workDates.length === 0) return interaction.reply(`${getSafeValue(member, '姓名')} 本月目前沒上班 (❤️)。`);

        // 3. 建立 Embed
        const embed = new EmbedBuilder()
            .setTitle(`🎀 ${getSafeValue(member, '姓名')} 本月班表`)
            .setThumbnail(getSafeValue(member, '照片連結 (Photo URL)'))
            .setDescription(workDates.join('\n')) // 直接列出所有有 ❤️ 的日期
            .setColor(0xbf0000)
            .setFooter({ text: `共 ${workDates.length} 場排班` });

        await interaction.reply({ embeds: [embed] });
            }
    
    // ==========================================
    // 指令 4：/日期 (指定日期 + 女孩 = 指定日期的女孩站位)
    // ==========================================
    if (interaction.commandName === '日期') {
        const dateInput = interaction.options.getString('日期');
        const targetName = interaction.options.getString('女孩');

        // 1. 搜尋符合輸入的日期
        const matchedDate = findMatchingDate(cachedData.schedule, dateInput);
        if (!matchedDate) return interaction.reply(`找不到日期 \`${dateInput}\` 的相關班表。`);

        // 2. 搜尋符合輸入的女孩
        // 修改這一段
        const member = cachedData.members.find(m => {
        const sheetName = String(getSafeValue(m, '姓名')).trim();
        const sheetID = String(getSafeValue(m, '背號')).trim();
        const inputTarget = String(targetName).trim();
        
        // 增加除錯：如果一直查不到，這裡會告訴你它在比對什麼
        // console.log(`比對中：Sheet姓名[${sheetName}] vs 輸入[${inputTarget}]`);
        
        return sheetName === inputTarget || sheetID === inputTarget;
    });

        // 3. 在該日期中尋找該女孩的班表
        const schedule = cachedData.schedule.find(s => 
            s["日期"].startsWith(matchedDate) && 
            String(getSafeValue(s, '背號')) === String(getSafeValue(member, '背號'))
        );

        if (!schedule) return interaction.reply(`${getSafeValue(member, '姓名')} 在 ${matchedDate} 沒班。`);

        // 4. 顯示站位 Embed (左對齊，且無班則隱藏)
        const embed = new EmbedBuilder()
            .setTitle(`🎀 ${getSafeValue(member, '姓名')} 站位資訊`)
            .setDescription(`**日期：** ${matchedDate}`)
            .setColor(0xbf0000)
            .setThumbnail(member["照片連結 (Photo URL)"]);

        // 定義要檢查的場次
        const zones = [
            { name: '上半場', key: '上半' },
            { name: '中場', key: '中場' },
            { name: '下半場', key: '下半' }
        ];

        // 動態加入欄位
        for (const zone of zones) {
            const rawVal = getSafeValue(schedule, zone.key);
            
            // 判斷邏輯：
            // 1. 如果是 "無" -> 完全隱藏
            // 2. 如果是 "" (空字串) -> 顯示 "暫定"
            // 3. 其他內容 -> 顯示內容
            if (rawVal !== '無') {
                const displayVal = (rawVal === '') ? '待定' : rawVal;
                embed.addFields({ 
                    name: zone.name, 
                    value: `**${displayVal}**`, 
                    inline: true 
                });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
});


const express = require('express');
const app = express();
// Render 會自動分配一個 PORT 環境變數給你的應用程式
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running!');
});

app.listen(port, () => {
  console.log(`Keep-alive server is listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);