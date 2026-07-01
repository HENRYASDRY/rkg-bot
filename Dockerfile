# 1. 使用 Puppeteer 官方推薦的基礎映像檔
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. 切換為 root 以進行資料夾建立與權限設定
USER root

# 3. 建立工作目錄，並把整個目錄的擁有權直接交給 pptruser
RUN mkdir -p /usr/src/app && chown -R pptruser:pptruser /usr/src/app

# 4. 設定工作目錄
WORKDIR /usr/src/app

# 5. [關鍵] 從現在開始，後續所有的指令都使用 pptruser 執行
USER pptruser

# 6. 複製 package.json (此時複製進來的檔案預設會歸屬於目前使用者 pptruser)
COPY package*.json ./

# 7. 安裝依賴 (現在 pptruser 對整個 /usr/src/app 都有完整權限了)
RUN npm install

# 8. 複製所有程式碼
COPY . .

# 9. 啟動 Bot
CMD ["node", "index.js"]