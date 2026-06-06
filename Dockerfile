FROM node:18-slim

# Instala o Git necessário para o Baileys
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos de configuração de pacotes primeiro
COPY package*.json ./

# Instala as dependências de forma limpa
RUN npm install --omit=dev

# Copia o restante dos arquivos do projeto
COPY . .

# Expõe a porta padrão que o Express está usando
EXPOSE 3000

# Comando definitivo de inicialização utilizando o script do package.json
CMD ["npm", "start"]
