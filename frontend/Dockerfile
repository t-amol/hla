FROM node:20-alpine
WORKDIR /usr/src/app

# ensure dev deps are installed in the image
ENV NODE_ENV=development

COPY package*.json ./
RUN npm install

COPY . ./

EXPOSE 5173
CMD ["npm","run","dev","--","--host","0.0.0.0"]
