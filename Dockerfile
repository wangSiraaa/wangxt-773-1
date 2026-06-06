FROM node:18-alpine

WORKDIR /app

COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

RUN cd backend && npm install --production
RUN cd frontend && npm install

COPY backend ./backend
COPY frontend ./frontend

RUN cd frontend && npm run build

RUN mkdir -p /app/backend/public && cp -r /app/frontend/dist/* /app/backend/public/

EXPOSE 3001

ENV NODE_ENV=production

WORKDIR /app/backend

CMD ["node", "server.js"]
