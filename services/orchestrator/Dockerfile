FROM node:18-alpine

WORKDIR /app

# Copy shared types
COPY shared/types /app/shared/types

# Copy service files
COPY services/orchestrator/package*.json ./
RUN npm install

COPY services/orchestrator/src ./src
COPY services/orchestrator/tsconfig.json ./

# Build TypeScript
RUN npm run build

EXPOSE 8080

CMD ["node", "dist/src/server.js"]
