FROM node:22-alpine

WORKDIR /app

COPY react-app/package*.json .
RUN npm install -g npm@11.6.3
RUN npm install
COPY react-app/ .

CMD ["npm", "run", "dev"]