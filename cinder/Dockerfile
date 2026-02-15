FROM node:22-alpine

WORKDIR /app

# Use pnpm (repo already has pnpm-lock.yaml)
RUN corepack enable

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "dev", "--", "--port", "5173", "--strictPort"]

# COPY package.json pnpm-lock.yaml ./
# RUN pnpm install --no-frozen-lockfile

# COPY . .

# CMD ["pnpm", "dev"]