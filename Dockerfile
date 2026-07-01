# 使用 Puppeteer 官方推薦的基礎映像檔，內含 Chromium
FROM ghcr.io/puppeteer/puppeteer:latest

# 設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 並安裝依賴
COPY package*.json ./
RUN npm install

# 複製所有程式碼
COPY . .

# 執行指令
CMD ["node", "index.js"]