# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --production

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"] 