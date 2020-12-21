const jwt = require('jsonwebtoken');

module.exports = async (ctx, next) => {
  const sessionToken = ctx.cookies.get('auth');
  const secret = process.env.JWT_SECRET;

  if (sessionToken) {
    try {
      const payload = jwt.verify(sessionToken, secret);
      if (payload) {
        const newPayload = {
          ...payload,
        };
        delete newPayload.iat;
        delete newPayload.exp;
        const options = { expiresIn: '1h' };
        const sessionToken = jwt.sign(newPayload, secret, options);

        ctx.cookies.set('auth', sessionToken, { httpOnly: true });
      }
    } catch (error) {
      console.log(error);

      ctx.cookies.set('auth');
    }
  }
  await next();
};
