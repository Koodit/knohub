FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build:widget

EXPOSE 3000

CMD ["npx", "tsx", "src/server.ts"]
