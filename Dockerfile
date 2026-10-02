# syntax=docker/dockerfile:1

###############################################################################
# Base - shared by every stage
###############################################################################
FROM node:22-alpine AS base
WORKDIR /usr/src/app
# `dumb-init` gives PID 1 proper signal handling so the container stops cleanly.
RUN apk add --no-cache dumb-init

###############################################################################
# Dependencies - installs the full dependency tree (including devDependencies)
###############################################################################
FROM base AS deps
COPY package*.json ./
RUN npm ci

###############################################################################
# Development - hot reload, source mounted from the host by docker compose
###############################################################################
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
EXPOSE 3000 9229
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:dev"]

###############################################################################
# Build - compiles TypeScript, then drops devDependencies
###############################################################################
FROM base AS build
ENV NODE_ENV=development
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .
# Belt and braces: a stale incremental cache would silently skip emitting files.
RUN rm -rf dist *.tsbuildinfo && npm run build && npm prune --omit=dev

###############################################################################
# Production - minimal runtime image
###############################################################################
FROM base AS production
ENV NODE_ENV=production
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node package.json ./
RUN mkdir -p /usr/src/app/uploads && chown node:node /usr/src/app/uploads
VOLUME ["/usr/src/app/uploads"]
USER node
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
