FROM node:18
WORKDIR .
RUN npm install -g pm2
COPY . .
EXPOSE 8080
CMD ["pm2-runtime", "pm2.json"]
