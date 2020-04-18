const axios = require('axios');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
const sessionExp = process.env.SESSION_EXP;
const recaptchaSecret = process.env.RECAPTCHA_SECRET;
require('dotenv').config();

module.exports = (Models, router) => {
  router.post('/user/signup', async ctx => {
    const {
      email,
      username,
      password,
      passwordConfirm,
      recaptchaResponse
    } = ctx.query;
    const recaptchaUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const emailRegEx = /[\w.]+@[\w.]+/;
    let errorMessage = [];

    if (!emailRegEx.test(email)) {
      errorMessage.push('Please enter a valid email.');
    }
    if (password === '') {
      errorMessage.push('Please enter a password.');
    }
    if (password !== passwordConfirm) {
      errorMessage.push('Please enter a matching password confirmation.');
    }
    if (!recaptchaResponse) {
      errorMessage.push('Invalid reCAPTCHA token.');
    }
    if (errorMessage.length > 0) {
      ctx.throw(401, errorMessage.join('\n'));
    } else {
      const response = await axios({
        url: recaptchaUrl,
        method: 'post',
        params: {
          secret: recaptchaSecret,
          response: recaptchaResponse
        }
      });
      console.log(response.data);

      if (response.data.success) {
        const user = await Models.User.findOrCreate({
          where: { email: email },
          defaults: {
            username: username,
            admin: false,
            active: true,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(8), null)
          }
        });
        if (!user[1]) {
          ctx.throw(401, 'Sorry, that email is taken.');
        } else {
          const payload = { id: user[0].id, admin: user[0].admin };
          const options = { expiresIn: sessionExp };
          const sessionToken = jwt.sign(payload, jwtSecret, options);

          user[0].save();

          ctx.cookies.set('auth', sessionToken, { httpOnly: true });
          ctx.status = 200;
          ctx.body = {
            username: user[0].username,
            email: user[0].email,
            admin: user[0].admin
          };
        }
      } else {
        ctx.throw(400, 'Failed to verify reCAPTCHA.');
      }
    }
  });
  router.post('/user/login', async ctx => {
    const { email, password } = ctx.query;
    const emailRegEx = /[\w.]+@[\w.]+/;

    if (email === '' || !emailRegEx.test(email) || password === '') {
      ctx.throw(401, 'Invalid email or password');
    } else {
      const user = await Models.User.findOne({ where: { email: email } });
      if (!user || !user.active) {
        ctx.throw(401, 'Invalid email or password');
      } else if (bcrypt.compareSync(password, user.password)) {
        const payload = { id: user.id, admin: user.admin };
        const options = { expiresIn: sessionExp };
        const sessionToken = jwt.sign(payload, jwtSecret, options);

        ctx.cookies.set('auth', sessionToken, { httpOnly: true });
        ctx.status = 200;
        ctx.body = {
          username: user.username,
          email: user.email,
          admin: user.admin
        };
      } else {
        ctx.throw(401, 'Invalid email or password');
      }
    }
  });
  router.post('/user/logout', async ctx => {
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload) {
      const user = await Models.User.findOne({
        where: { id: payload.id }
      });
      if (user) {
        ctx.cookies.set('auth');
      }
    }
    ctx.status = 200;
  });
  router.post('/user/edit', async ctx => {
    const {
      editField,
      email,
      username,
      bio,
      password,
      passwordConfirm
    } = ctx.query;
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;
    const emailRegEx = /[\w.]+@[\w.]+/;

    if (payload) {
      const user = await Models.User.findOne({ where: { id: payload.id } });
      if (!user) {
        ctx.throw(401, 'Invalid session');
      } else {
        if (editField === 'edit-email') {
          if (email === '' || !emailRegEx.test(email)) {
            ctx.throw(401, 'Invalid email');
          } else {
            const userWithEmail = await Models.User.findOne({
              where: { email }
            });
            if (userWithEmail) {
              ctx.throw(401, 'Sorry, that email is taken.');
            } else {
              user.email = email;
            }
          }
        } else if (editField === 'edit-username') {
          if (username === '') {
            ctx.throw(401, 'Invalid username');
          } else {
            user.username = username;
          }
        } else if (editField === 'edit-bio') {
          if (typeof bio === undefined) {
            ctx.throw(401, 'Invalid bio');
          } else {
            user.bio = bio;
          }
        } else if (editField === 'edit-password') {
          if (
            password === '' ||
            passwordConfirm === '' ||
            password !== passwordConfirm
          ) {
            ctx.throw(401, 'Invalid password');
          } else {
            user.password = bcrypt.hashSync(
              password,
              bcrypt.genSaltSync(12),
              null
            );
          }
        }
        user.save();
        ctx.status = 200;
        ctx.body = {
          status: 'success',
          username: user.username,
          email: user.email,
          bio: user.bio
        };
      }
    } else {
      ctx.throw(401, 'Invalid session');
    }
  });
  router.post('/user/edit/:id', async ctx => {
    const { editField, email, username, bio } = ctx.query;
    const userId = ctx.params.id;
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;
    const emailRegEx = /[\w.]+@[\w.]+/;

    if (payload && payload.admin) {
      const user = await Models.User.findOne({ where: { id: userId } });
      if (!user) {
        ctx.throw(401, 'Invalid user');
      } else {
        if (editField === 'edit-email') {
          if (email === '' || !emailRegEx.test(email)) {
            ctx.throw(401, 'Invalid email');
          } else {
            const userWithEmail = await Models.User.findOne({
              where: { email }
            });
            if (userWithEmail) {
              ctx.throw(401, 'Sorry, that email is taken.');
            } else {
              user.email = email;
            }
          }
        } else if (editField === 'edit-username') {
          if (username === '') {
            ctx.throw(401, 'Invalid username');
          } else {
            user.username = username;
          }
        } else if (editField === 'edit-bio') {
          if (typeof bio === undefined) {
            ctx.throw(401, 'Invalid bio');
          } else {
            user.bio = bio;
          }
        }
        await user.save();
        ctx.status = 200;
        ctx.body = {
          status: 'success',
          username: user.username,
          email: user.email,
          bio: user.bio
        };
      }
    } else {
      ctx.throw(401, 'Unauthorized request.');
    }
  });
  router.post('/user/delete/self', async ctx => {
    const sessionToken = ctx.cookies.get('auth');
    const password = ctx.query.password || '';
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload) {
      const user = await Models.User.findOne({ where: { id: payload.id } });
      if (!user) {
        ctx.throw(401, 'Invalid session');
      } else {
        if (password === '' || !bcrypt.compareSync(password, user.password)) {
          ctx.throw(401, 'Invalid password');
        } else {
          user.destroy();
          ctx.cookies.set('auth');
          ctx.status = 200;
        }
      }
    } else {
      ctx.throw(401, 'Invalid session');
    }
  });
  router.post(['/user/disable/:id', '/user/enable/:id'], async ctx => {
    const id = ctx.params.id;
    const action = ctx.url.split('/')[3];
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload && payload.admin) {
      const user = await Models.User.findOne({ where: { id } });
      if (user) {
        user.active = action === 'disable' ? false : true;
        await user.save();
        ctx.body = { active: user.active };
        ctx.status = 200;
      } else {
        ctx.throw(401, 'Invalid user');
      }
    } else {
      ctx.throw(401, 'Invalid session.');
    }
  });
  router.post('/user/get/current', async ctx => {
    const sessionToken = ctx.cookies.get('auth');

    if (sessionToken) {
      try {
        const payload = jwt.verify(sessionToken, jwtSecret);
        if (payload) {
          const user = await Models.User.findOne({
            where: { id: payload.id },
            include: {
              model: Models.Post,
              as: 'favoritedPosts',
              required: false
            }
          });

          if (user && user.active) {
            ctx.body = {
              id: user.id,
              username: user.username,
              email: user.email,
              bio: user.bio,
              admin: user.admin,
              favorites: user.favoritedPosts,
              valid: true
            };
          } else {
            ctx.body = {
              username: '',
              email: '',
              admin: false,
              valid: false
            };
            ctx.cookies.set('auth');
          }
        }
      } catch (error) {
        ctx.body = {
          username: '',
          email: '',
          admin: false,
          valid: false
        };
        ctx.cookies.set('auth');
      }
    } else {
      ctx.body = {
        username: '',
        email: '',
        admin: false,
        valid: false
      };
    }
    ctx.status = 200;
  });
  router.get('/user/get', async ctx => {
    const sessionToken = ctx.cookies.get('auth') || '';
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload.admin) {
      const users = await Models.User.findAll({
        attributes: ['id', 'username', 'active']
      });
      ctx.body = users;
    } else {
      ctx.throw(401, 'Unauthorized request.');
    }
    ctx.status = 200;
  });
  router.get('/user/get/:id', async ctx => {
    const sessionToken = ctx.cookies.get('auth') || '';
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;
    const userId = ctx.params.id;
    let attributes;

    if (payload && payload.admin) {
      attributes = [
        'id',
        'username',
        'bio',
        'email',
        'active',
        ['createdAt', 'joinDate']
      ];
    } else {
      attributes = [
        'id',
        'username',
        'bio',
        'active',
        ['createdAt', 'joinDate']
      ];
    }

    if (userId) {
      const user = await Models.User.findOne({
        where: { id: userId },
        attributes,
        include: [
          {
            model: Models.Post,
            as: 'post'
          },
          {
            model: Models.Post,
            as: 'favoritedPosts'
          }
        ]
      });
      if (user) {
        ctx.body = {
          ...user.dataValues,
          valid: true
        };
      } else {
        ctx.throw(404, 'User not found.');
      }
    } else {
      ctx.throw(404, 'User not found.');
    }
    ctx.status = 200;
  });
  router.post('/user/password-reset/', async ctx => {
    const email = ctx.query.email || '';
    const password = ctx.query.password || '';
    const passwordResetToken = ctx.query.passwordResetToken;

    if (passwordResetToken) {
      try {
        const payload = jwt.verify(passwordResetToken, jwtSecret);

        if (payload) {
          const user = await Models.User.findOne({
            where: { email: payload.email }
          });

          if (
            user &&
            bcrypt.compareSync(passwordResetToken, user.passwordResetToken)
          ) {
            if (password.length < 8) {
              ctx.throw(401, 'Invalid password length.');
            } else {
              user.password = bcrypt.hashSync(
                password,
                bcrypt.genSaltSync(12),
                null
              );
              user.save();

              const payload = { id: user.id, admin: user.admin };
              const options = { expiresIn: sessionExp };
              const sessionToken = jwt.sign(payload, jwtSecret, options);

              ctx.cookies.set('auth', sessionToken, { httpOnly: true });
              ctx.status = 200;
              ctx.body = {
                username: user.username,
                email: user.email
              };
            }
          } else {
            ctx.throw(401, 'Invalid Token.');
          }
        }
      } catch (e) {
        ctx.throw(401, e.message);
      }
    } else {
      const user = await Models.User.findOne({
        where: { email }
      });

      if (user) {
        const payload = { email };
        const options = { expiresIn: sessionExp };
        const token = jwt.sign(payload, jwtSecret, options);

        user.passwordResetToken = bcrypt.hashSync(
          token,
          bcrypt.genSaltSync(8),
          null
        );
        user.save();
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
          }
        });

        transporter.sendMail({
          from: '"Imgpool Support" <support@imgpool.app>', // sender address
          to: user.email,
          subject: 'Password Reset', // Subject line
          html: `<div style="width: 825px;max-width: 100%;">
          <h1 style="margin:0 auto 35px;color:#333;font-size:55px;font-family: sans-serif;font-weight: 600;">
          <span style="padding-right:15px;border-right:1px solid #333;">Password Reset</span>
          </h1>
          <p style="margin:10px 0;color:#333;font-weight: 600;font-size: 14px;line-height: 20px;">
          If you requested a password reset for ${user.username}, click the button below. If you didn't make this request, ignore this email.
          </p>
          <a href="https://imgpool.app/password-reset/${token}" style="display:block; margin-top:50px;border:2px solid #333;padding:15px 14px 20px;box-sizing:border-box;width:326px;height:50px;background:none;text-align:center;text-transform:uppercase;text-decoration:none;color:#333;font-family:sans-serif;font-size:12px;font-weight:600;display:block;cursor:pointer;outline:none;">Reset Password</a>
          </div>`
        });
      }
    }
  });
  router.post('/user/password-reset/:id', async ctx => {
    const id = ctx.params.id;
    const sessionToken = ctx.cookies.get('auth') || '';
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload.admin) {
      const user = await Models.User.findOne({
        where: { id }
      });

      if (user) {
        const payload = { email: user.email };
        const options = { expiresIn: sessionExp };
        const token = jwt.sign(payload, jwtSecret, options);

        user.passwordResetToken = bcrypt.hashSync(
          token,
          bcrypt.genSaltSync(8),
          null
        );
        user.save();
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
          }
        });

        transporter.sendMail({
          from: '"Imgpool Support" <support@imgpool.app>', // sender address
          to: user.email,
          subject: 'Password Reset', // Subject line
          html: `<div style="width: 825px;max-width: 100%;">
          <h1 style="margin:0 auto 35px;color:#333;font-size:55px;font-family: sans-serif;font-weight: 600;">
          <span style="padding-right:15px;border-right:1px solid #333;">Password Reset</span>
          </h1>
          <p style="margin:10px 0;color:#333;font-weight: 600;font-size: 14px;line-height: 20px;">
          If you requested a password reset for ${user.username}, click the button below. If you didn't make this request, ignore this email.
          </p>
          <a href="https://imgpool.app/password-reset/${token}" style="display:block; margin-top:50px;border:2px solid #333;padding:15px 14px 20px;box-sizing:border-box;width:326px;height:50px;background:none;text-align:center;text-transform:uppercase;text-decoration:none;color:#333;font-family:sans-serif;font-size:12px;font-weight:600;display:block;cursor:pointer;outline:none;">Reset Password</a>
          </div>`
        });
      } else {
        ctx.throw(401, 'User not found.');
      }
    } else {
      ctx.throw(401, 'Unauthorized request.');
    }
  });
};
