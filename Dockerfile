# 1. 使用 Puppeteer 官方推薦的基礎映像檔
FROM ghcr.io/puppeteer/puppeteer:latest

# 2. 切換為 root，這讓我們接下來的所有操作都有最高權限
USER root

# 3. 設定工作目錄
WORKDIR /usr/src/app

# 4. 複製所有的檔案進來 (此時所有檔案都會屬於 root)
COPY . .

# 5. 以 root 身份執行 npm install (絕對不會有權限問題)
RUN npm install

# 6. 安裝完成後，將整個目錄的擁有權轉交給 pptruser
RUN chown -R pptruser:pptruser /usr/src/app

# 7. 切換回 pptruser (為了安全性與 Puppeteer 的要求)
USER pptruser

# 8. 啟動 Bot
CMD ["node", "index.js"]