# 1. 使用 Puppeteer 官方推薦的基礎映像檔
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. 切換為 root 以進行資料夾建立
USER root

# 3. 建立工作目錄並設定權限
RUN mkdir -p /usr/src/app && chown -R pptruser:pptruser /usr/src/app

# 4. 設定工作目錄
WORKDIR /usr/src/app

# 5. [關鍵] 從現在開始，後續所有的指令都使用 pptruser 執行
USER pptruser

# 6. 複製 package.json，並強制指定擁有者為 pptruser (這是解決 EACCES 的關鍵)
COPY --chown=pptruser:pptruser package*.json ./

# 7. 安裝依賴
RUN npm install

# 8. 複製所有程式碼，同樣指定擁有者為 pptruser
COPY --chown=pptruser:pptruser . .

# 9. 啟動 Bot
CMD ["node", "index.js"]