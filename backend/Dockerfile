FROM node:20-bookworm

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "dev"]
