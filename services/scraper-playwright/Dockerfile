FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app

# Copy shared types
COPY shared/types /app/shared/types

# Copy service files
COPY services/scraper-playwright/package*.json ./
RUN npm install

COPY services/scraper-playwright/src ./src
COPY services/scraper-playwright/tsconfig.json ./

# Build TypeScript
RUN npm run build

EXPOSE 3002

CMD ["node", "dist/src/server.js"]
