FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the application code
COPY . .

# Compile TypeScript during build
RUN npm run build

# Copy country flags SVGs from node module to public folder
RUN cp node_modules/svg-country-flags/svg/*.svg public/resources/imgs/svg/flags/

# Expose the application port
EXPOSE 8080

# Start the Fastify server
CMD ["npm", "run", "start"]
