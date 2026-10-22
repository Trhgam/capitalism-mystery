FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install dependencies for all npm workspaces, then build the React client.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci

COPY client ./client
COPY server ./server
RUN npm run build

FROM node:22-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app

# Keep workspace manifests so npm can install the server's production dependencies.
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev

# The server serves this build from ../../client/dist relative to server/src.
COPY --from=build /app/client/dist ./client/dist
COPY server/src ./server/src

EXPOSE 3000
CMD ["npm", "start", "--workspace=server"]
