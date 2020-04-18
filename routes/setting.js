const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
require('dotenv').config();

module.exports = (Models, router) => {
  router.get('/setting/signup', async ctx => {
    const settings = await Models.Setting.findOne({
      attributes: ['signUp']
    });

    ctx.body = { signUp: settings.signUp };
  });
  router.post('/setting/signup/toggle', async ctx => {
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload && payload.admin) {
      const settings = await Models.Setting.findOne();

      if (settings) {
        settings.signUp = !settings.signUp;
        await settings.save();

        ctx.body = settings;
      } else {
        ctx.throw(501, 'No settings found');
      }
    } else {
      ctx.throw(401, 'Unauthorized request.');
    }
  });
};
