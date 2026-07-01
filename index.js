require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { createCanvas, registerFont } = require('canvas');

// 在這裡馬上註冊你的字體！
registerFont('./font.ttf', { family: 'NotoSansTC' });
registerFont('./font2.ttf', { family: 'NotoSansTC-bold' });

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

// 輔助函式：尋找符合使用者輸入的日期
function findMatchingDate(schedules, inputDate) {
    const cleanInput = inputDate.replace(/[\/\-]/g, ''); 
    const uniqueDates = [...new Set(schedules.map(s => s["日期"].split('T')[0]))];
    for (const d of uniqueDates) {
        if (d.replace(/\-/g, '').includes(cleanInput)) return d;
    }
    return null;
}

// 🎨 Canvas 畫圓角矩形的輔助函式
function drawRoundRect(ctx, x, y, width, height, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

client.once('clientReady', async () => {
    await refreshData();
    setInterval(refreshData, 180000); 
    console.log(`✅ ${client.user.tag} 已上線並準備就緒！`);
});

const ADMIN_IDS = ['666630720181239848', '你的DiscordID2'];

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === '更新') {
        if (!ADMIN_IDS.includes(interaction.user.id)) {
            return interaction.reply({ content: '❌ 此指令僅限管理員使用。', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            await refreshData();
            await interaction.editReply('✅ 資料已強制重新整理！');
        } catch (error) {
            await interaction.editReply('❌ 資料更新失敗，請檢查 API。');
        }
        return; 
    }

    if (!cachedData) return interaction.reply('資料尚未準備好，請稍後再試。');

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

    const getSafeValue = (obj, keyword) => {
        const actualKey = Object.keys(obj).find(k => k.includes(keyword));
        const val = actualKey ? obj[actualKey] : '';
        return (val && String(val).trim() !== '') ? String(val).trim() : '待定';
    };

    // ==========================================
    // 指令 1：/站位 (Canvas 繪製版)
    // ==========================================
    if (interaction.commandName === '站位') {
        await interaction.deferReply(); 

        let targetDate = interaction.options.getString('日期');
        let matchedDate = targetDate ? findMatchingDate(cachedData.schedule, targetDate) : getNearestDate(cachedData.schedule);

        if (targetDate && !matchedDate) return interaction.editReply(`找不到包含 \`${targetDate}\` 的班表資料！`);
        
        const dateSchedules = cachedData.schedule.filter(s => s["日期"].startsWith(matchedDate));
        if (dateSchedules.length === 0) return interaction.editReply('該日無班表資料。');

        try {
            // 🌟 1. 設定畫布尺寸與排版變數
            const padding = 20;
            const cardW = 460;
            const cardH = 80;
            const gap = 15;
            const columns = 2;
            const rows = Math.ceil(dateSchedules.length / columns);
            
            const canvasW = 1000;
            const headerH = 130;
            const canvasH = headerH + padding + (rows * (cardH + gap)) + padding;

            const canvas = createCanvas(canvasW, canvasH);
            const ctx = canvas.getContext('2d');

            // 🌟 2. 畫背景與標題
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvasW, canvasH);

            ctx.fillStyle = '#bf3939'; // 紅色橫幅
            ctx.fillRect(0, 0, canvasW, headerH);

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';

            // ✅ 修正：補上雙引號，並將 Y 軸從 55 移到 70，避免大字頂部被切掉
            ctx.font = 'bold 50px "NotoSansTC-bold"';
            ctx.fillText('Rakuten Girls 站位總表', canvasW / 2, 70);

            // ✅ 修正：這裡也補上雙引號，並將 Y 軸從 100 稍微移到 115
            ctx.font = 'bold 22px "NotoSansTC"';
            ctx.globalAlpha = 0.9;
            ctx.fillText(`日期：${matchedDate}`, canvasW / 2, 115);
            ctx.globalAlpha = 1.0;

            // 🌟 3. 畫女孩卡片
            dateSchedules.forEach((s, i) => {
                const col = i % columns;
                const row = Math.floor(i / columns);
                const x = padding + col * (cardW + gap + 5);
                const y = headerH + padding + row * (cardH + gap);

                // 卡片外框
                ctx.fillStyle = '#ffffff';
                ctx.strokeStyle = '#c8c8c8';
                ctx.lineWidth = 1;
                drawRoundRect(ctx, x, y, cardW, cardH, 12, true, true);

                // 背號與姓名
                ctx.fillStyle = '#b3133e';
                ctx.font = '20px "NotoSansTC-Bold"';
                ctx.textAlign = 'left';
                ctx.fillText(String(getSafeValue(s, '背號')).padStart(2, '0'), x + 15, y + 50);

                ctx.fillStyle = '#000000';
                ctx.font = '20px "NotoSansTC-Bold"';
                ctx.fillText(getSafeValue(s, '姓名'), x + 55, y + 50);

                // 站位區域
                const zones = [{l: '上半', k: '上半'}, {l: '中場', k: '中場'}, {l: '下半', k: '下半'}];
                let startX = x + 170;

                zones.forEach(z => {
                    const text = getSafeValue(s, z.k);
                    if (text === '無') return;

                    const isPending = text === '待定' || text === '';
                    const theme = isPending ? zoneColors['待定'] : (zoneColors[text] || { color: '#ffffff', bg: '#3b3e45' });
                    const displayText = isPending ? '待定' : text;

                    // 站位底色方塊
                    ctx.fillStyle = theme.bg;
                    ctx.strokeStyle = isPending ? theme.color : theme.bg;
                    if (isPending) ctx.setLineDash([4, 4]); // 虛線

                    drawRoundRect(ctx, startX, y + 15, 85, 50, 10, true, true);
                    ctx.setLineDash([]); // 恢復實線

                    // 小標籤 (如: 上半)
                    ctx.textAlign = 'center';
                    ctx.fillStyle = theme.color;
                    ctx.font = '18px "NotoSansTC-Bold"';
                    ctx.globalAlpha = 0.8;
                    ctx.fillText(z.l, startX + 42.5, y + 33);
                    
                    // 站位文字 (如: 東)
                    ctx.globalAlpha = 1.0;
                    ctx.font = '16px "NotoSansTC-Bold"';
                    ctx.fillText(displayText, startX + 42.5, y + 57);

                    startX += 95;
                });
            });

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'schedule.png' });
            const embed = new EmbedBuilder().setImage('attachment://schedule.png').setColor(0xbf0000);
            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ 生成圖片失敗：${error.message}`);
        }
    }

    // ==========================================
    // 指令 2：/女孩 (維持不變)
    // ==========================================
    if (interaction.commandName === '女孩') {
        const target = interaction.options.getString('目標');
        const member = cachedData.members.find(m => 
            getSafeValue(m, '姓名') === target || String(getSafeValue(m, '背號')) === target
        );
        if (!member) return interaction.reply(`查無女孩：\`${target}\``);

        const memberSchedules = cachedData.schedule.filter(s => String(getSafeValue(s, '背號')) === String(getSafeValue(member, '背號')));
        const nearestDate = getNearestDate(memberSchedules);
        const latestSchedule = memberSchedules.find(s => s["日期"].startsWith(nearestDate));

        const monthlyRow = cachedData.monthly.find(row => 
            String(row['背號 (ID)'] || row['背號'] || '') === String(getSafeValue(member, '背號'))
        );

        let allDates = '無';
        if (monthlyRow) {
            const dates = Object.keys(monthlyRow).filter(key => 
                (key.includes('/') || key.includes('-')) && monthlyRow[key] === '❤️'
            );
            if (dates.length > 0) allDates = dates.join('、');
        }

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

        embed.addFields({ name: '🗓️ 本月班表', value: allDates, inline: false });

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
    // 指令 3：/月曆 (Canvas 繪製版)
    // ==========================================
    if (interaction.commandName === '月曆') {
        const targetName = interaction.options.getString('女孩');

        if (!targetName) {
            await interaction.deferReply();
            try {
                const monthlyData = cachedData.monthly;
                if (!monthlyData || monthlyData.length === 0) return interaction.editReply('目前暫無本月班表。');

                const headers = Object.keys(monthlyData[0]);
                
                // 🌟 1. 設定表格尺寸
                const cellW = 80;
                const cellH = 40;
                // 給姓名欄位稍微寬一點
                const colWidths = headers.map(h => (h.includes('姓名') || h.includes('Name')) ? 120 : cellW);
                const tableW = colWidths.reduce((a, b) => a + b, 0);
                
                const padding = 20;
                const canvasW = tableW + padding * 2;
                const canvasH = padding * 2 + 80 + (monthlyData.length + 1) * cellH; // 80 是標題高度

                const canvas = createCanvas(canvasW, canvasH);
                const ctx = canvas.getContext('2d');

                // 背景
                ctx.fillStyle = '#1e1f22';
                ctx.fillRect(0, 0, canvasW, canvasH);
                
                // 標題 (40px)
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.font = 'bold 40px "NotoSansTC"';
                ctx.fillText('本月班表', canvasW / 2, padding + 40);

                // 畫表格標題列 (紅底)
                const tableY = padding + 80;
                ctx.fillStyle = '#bf0000';
                ctx.fillRect(padding, tableY, tableW, cellH);

                ctx.fillStyle = '#ffffff';
                // ✅ 修正：補上後面的雙引號 (16px)
                ctx.font = 'bold 16px "NotoSansTC-bold"';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                let currentX = padding;
                headers.forEach((h, i) => {
                    ctx.fillText(h, currentX + colWidths[i] / 2, tableY + cellH / 2);
                    currentX += colWidths[i];
                });

                // 畫資料列 (14px)
                // ✅ 修正：補上後面的雙引號
                ctx.font = '14px "NotoSansTC-bold"';
                monthlyData.forEach((row, rowIndex) => {
                    const rowY = tableY + cellH + rowIndex * cellH;
                    currentX = padding;
                    
                    headers.forEach((h, colIndex) => {
                        // 畫框線
                        ctx.strokeStyle = '#444444';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(currentX, rowY, colWidths[colIndex], cellH);
                        
                        // 畫文字
                        ctx.fillStyle = '#ffffff';
                        const text = row[h] || '';
                        ctx.fillText(text, currentX + colWidths[colIndex] / 2, rowY + cellH / 2);
                        
                        currentX += colWidths[colIndex];
                    });
                });

                const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'monthly.png' });
                await interaction.editReply({ files: [attachment] });

            } catch (error) {
                console.error(error);
                await interaction.editReply(`❌ 生成圖片失敗：${error.message}`);
            }
            return;
        }

        const member = cachedData.members.find(m => {
            const name = m['姓名'] || m['姓名 (Name)'] || '';
            const id = String(m['背號'] || m['背號 (ID)'] || '');
            return name.trim() === targetName.trim() || id.trim() === targetName.trim();
        });

        if (!member) return interaction.reply({ content: `找不到女孩：\`${targetName}\`。`, ephemeral: true });

        const monthlyRow = cachedData.monthly.find(row => String(row['背號 (ID)'] || row['背號'] || '') === String(member['背號'] || member['背號 (ID)'] || ''));
        if (!monthlyRow) return interaction.reply(`${getSafeValue(member, '姓名')} 在本月總表中無資料。`);

        const workDates = Object.keys(monthlyRow).filter(key => (key.includes('/') || key.includes('-')) && monthlyRow[key] === '❤️');
        if (workDates.length === 0) return interaction.reply(`${getSafeValue(member, '姓名')} 本月目前沒上班 (❤️)。`);

        const embed = new EmbedBuilder()
            .setTitle(`🎀 ${getSafeValue(member, '姓名')} 本月班表`)
            .setThumbnail(getSafeValue(member, '照片連結 (Photo URL)'))
            .setDescription(workDates.join('\n'))
            .setColor(0xbf0000)
            .setFooter({ text: `共 ${workDates.length} 場排班` });

        await interaction.reply({ embeds: [embed] });
    }
    
    // ==========================================
    // 指令 4：/日期 (維持不變)
    // ==========================================
    if (interaction.commandName === '日期') {
        const dateInput = interaction.options.getString('日期');
        const targetName = interaction.options.getString('女孩');

        const matchedDate = findMatchingDate(cachedData.schedule, dateInput);
        if (!matchedDate) return interaction.reply(`找不到日期 \`${dateInput}\` 的相關班表。`);

        const member = cachedData.members.find(m => {
            const sheetName = String(getSafeValue(m, '姓名')).trim();
            const sheetID = String(getSafeValue(m, '背號')).trim();
            const inputTarget = String(targetName).trim();
            return sheetName === inputTarget || sheetID === inputTarget;
        });

        const schedule = cachedData.schedule.find(s => 
            s["日期"].startsWith(matchedDate) && 
            String(getSafeValue(s, '背號')) === String(getSafeValue(member, '背號'))
        );

        if (!schedule) return interaction.reply(`${getSafeValue(member, '姓名')} 在 ${matchedDate} 沒班。`);

        const embed = new EmbedBuilder()
            .setTitle(`🎀 ${getSafeValue(member, '姓名')} 站位資訊`)
            .setDescription(`**日期：** ${matchedDate}`)
            .setColor(0xbf0000)
            .setThumbnail(member["照片連結 (Photo URL)"]);

        const zones = [
            { name: '上半場', key: '上半' },
            { name: '中場', key: '中場' },
            { name: '下半場', key: '下半' }
        ];

        for (const zone of zones) {
            const rawVal = getSafeValue(schedule, zone.key);
            if (rawVal !== '無') {
                const displayVal = (rawVal === '') ? '待定' : rawVal;
                embed.addFields({ name: zone.name, value: `**${displayVal}**`, inline: true });
            }
        }

        await interaction.reply({ embeds: [embed] });
    }
});

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is active and running!');
});

app.listen(port, () => {
  console.log(`Keep-alive server is listening on port ${port}`);
});

client.login(process.env.DISCORD_TOKEN);