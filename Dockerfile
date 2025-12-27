FROM node:22-alpine

WORKDIR /app

# Use pnpm (repo already has pnpm-lock.yaml)
RUN corepack enable

COPY react-app/package.json react-app/pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY react-app/ .

CMD ["pnpm", "dev"]