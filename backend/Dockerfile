FROM node:24-bullseye-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build TypeScript
RUN npm run build

# Expose backend port
EXPOSE 3000

# Run app
CMD ["npm", "run", "start"]
