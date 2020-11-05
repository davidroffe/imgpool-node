const fs = require('fs');
const Koa = require('koa');
const send = require('koa-send');
const Router = require('@koa/router');
const logger = require('koa-logger');
const routes = require('./routes');
const validate = require('./utility/validate');
require('dotenv').config();
const app = new Koa();
const apiRouter = new Router({
  prefix: '/api',
});

app.use(logger());
app.use(async (ctx, next) => {
  await next();
  if (ctx.status === 404) {
    ctx.set('Cache-Control', 'public');
    ctx.body = { status: 404 };
  }
});
app.use(validate);
routes(apiRouter);
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());
const server = app.listen(process.env.PORT);
module.exports = server;
