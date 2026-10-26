FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV HOST=0.0.0.0 PORT=8787 NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY server.js server-relay.js server-fonts.js server-render.js index.html styles.css LICENSE THIRD_PARTY_NOTICES.md LICENSE-THIRD-PARTY-pystitch.txt LICENSE-THIRD-PARTY-polygon-clipping.txt ./
COPY src ./src
COPY fonts ./fonts
RUN mkdir -p var/artifacts && chown -R node:node var
USER node
EXPOSE 8787
CMD ["node","server.js"]
