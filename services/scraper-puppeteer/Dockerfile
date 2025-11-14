FROM node:18-alpine

# Install Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

# Copy shared types
COPY shared/types /app/shared/types

# Copy service files
COPY services/scraper-puppeteer/package*.json ./
RUN npm install

COPY services/scraper-puppeteer/src ./src
COPY config ./config
COPY services/scraper-puppeteer/tsconfig.json ./

# Build TypeScript
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/src/server.js"]
