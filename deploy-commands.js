const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
    new SlashCommandBuilder()
        .setName('站位')
        .setDescription('查詢站位總表')
        .addStringOption(option => 
            option.setName('日期')
                  .setDescription('輸入日期 (如: 0618)。留空則顯示最近一天的總表')
                  .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('女孩')
        .setDescription('查詢特定女孩最近一天的站位')
        .addStringOption(option => 
            option.setName('目標')
                  .setDescription('請輸入女孩「姓名」或「背號」 (例如: 琳妲 或 0)')
                  .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('日期')
        .setDescription('查詢指定日期與女孩的站位')
        .addStringOption(o => o.setName('日期').setDescription('輸入日期 (如 0701)').setRequired(true))
        .addStringOption(o => o.setName('女孩').setDescription('輸入女孩姓名').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('月曆')
        .setDescription('查看總表或個人排班')
        .addStringOption(option => 
            option.setName('女孩')
                .setDescription('輸入姓名 (若不填則顯示總表)')
                .setRequired(false) // 設為非必填
        ),
    new SlashCommandBuilder()
    .setName('更新')
    .setDescription('強制重新讀取試算表資料 (僅限管理員)')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ 指令註冊完成！包含 /站位 與 /女孩');
    } catch (error) {
        console.error('註冊指令失敗:', error);
    }
})();