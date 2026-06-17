FROM ghcr.io/puppeteer/puppeteer:22

USER root

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8080
CMD ["npm", "start"]
