FROM node:24-alpine

WORKDIR /app

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
