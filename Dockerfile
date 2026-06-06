FROM node:18-slim

# Instala o Git que a biblioteca do WhatsApp exige para compilar
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "index.js"]
