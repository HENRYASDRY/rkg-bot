# 使用 Puppeteer 官方推薦的基礎映像檔
FROM ghcr.io/puppeteer/puppeteer:latest

# 切換到 root 以進行權限設定
USER root

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json，並直接將擁有者設定為 pptruser
COPY --chown=pptruser:pptruser package*.json ./

# 切換回 pptruser 使用者來安裝套件 (這很重要！)
USER pptruser
RUN npm install

# 複製其餘程式碼，同樣設定擁有者為 pptruser
COPY --chown=pptruser:pptruser . .

# 啟動 Bot
CMD ["node", "index.js"]