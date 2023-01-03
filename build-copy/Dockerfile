FROM node:lts
WORKDIR .
RUN npm install -g pm2
COPY . .
EXPOSE 8080
CMD ["pm2-runtime", "pm2.json"]
