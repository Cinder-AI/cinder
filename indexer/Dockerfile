FROM node:20-bookworm

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

CMD ["sh", "-c", "pnpm install --no-frozen-lockfile && pnpm codegen && cd generated && pnpm install --no-frozen-lockfile && pnpm run build && pnpm run db-setup && cd /app && TUI_OFF=true pnpm start"]
