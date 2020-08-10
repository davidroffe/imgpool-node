const path = require('path');
const rootPath = path.dirname(require.main.filename);
const multer = require('@koa/multer');
const sizeOf = require('image-size');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.JWT_SECRET;
const clientUploadsPath = `${process.env.CLIENT}/uploads`;

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, rootPath + clientUploadsPath);
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + '-' + Date.now() + '.' + file.mimetype.split('/')[1]
    );
  },
});
const upload = multer({ storage: storage });

module.exports = (Models, router) => {
  router.get('/post/list', async (ctx) => {
    const offset = ctx.query.offset;
    const allPosts = await Models.Post.findAll({
      where: { active: true },
      offset,
      limit: 18,
      order: [['createdAt', 'DESC']],
      include: {
        model: Models.Tag,
        as: 'tag',
        required: false,
        attributes: ['id', 'name'],
      },
    });

    ctx.body = allPosts;
  });
  router.get('/post/flag/list', async (ctx) => {
    const allFlags = await Models.Flag.findAll({
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Models.Post,
          as: 'post',
          attributes: ['active'],
        },
        {
          model: Models.User,
          as: 'user',
          attributes: ['username'],
        },
      ],
    });

    ctx.body = allFlags;
  });
  router.get('/post/single', async (ctx) => {
    const postId = ctx.query.id;
    const post = await Models.Post.findOne({
      where: { id: postId },
      include: [
        {
          model: Models.Tag,
          as: 'tag',
          required: false,
          attributes: ['id', 'name'],
        },
        {
          model: Models.User,
          as: 'user',
          required: true,
          attributes: ['id', 'username'],
        },
      ],
    });

    if (post) {
      ctx.body = post;
    } else {
      ctx.throw(404, 'Post not found.');
    }
  });

  router.post('/post/favorite', async (ctx) => {
    const sessionToken = ctx.cookies.get('auth');
    const postId = ctx.query.postId;
    const secret = process.env.JWT_SECRET;

    if (sessionToken) {
      const payload = jwt.verify(sessionToken, secret);
      const post = await Models.FavoritedPost.findOrCreate({
        where: { postId, userId: payload.id },
        defaults: {
          postId,
          userId: payload.id,
        },
      });
      if (!post[1]) {
        await post[0].destroy();
      }
      await post[0].save();
      const user = await Models.User.findOne({
        where: { id: payload.id },
        include: {
          model: Models.Post,
          as: 'favoritedPosts',
          required: false,
        },
      });
      ctx.body = {
        favorites: user.favoritedPosts,
      };
    } else {
      ctx.throw(401, 'Invalid session');
    }
  });

  router.post('/post/flag/create', async (ctx) => {
    const sessionToken = ctx.cookies.get('auth');
    const { postId, reason } = ctx.query;
    const secret = process.env.JWT_SECRET;

    if (sessionToken) {
      const payload = jwt.verify(sessionToken, secret);
      const flag = await Models.Flag.create({
        postId,
        userId: payload.id,
        reason,
      });

      await flag.save();
      ctx.body = { status: 'success' };
    } else {
      ctx.throw(401, 'Invalid session');
    }
  });

  router.post('/post/create', upload.single('image'), async (ctx) => {
    const sessionToken = ctx.cookies.get('auth');
    const secret = process.env.JWT_SECRET;
    const payload = jwt.verify(sessionToken, secret);
    const tags =
      typeof ctx.query.tags !== 'undefined' ? ctx.query.tags.split(' ') : [];
    const source =
      typeof ctx.query.source !== 'undefined' ? ctx.query.source : '';

    let errorRes = {
      status: 401,
      message: [],
    };

    if (!ctx.file) {
      errorRes.message.push('Please select a file.');
    }
    if (!tags.length) {
      errorRes.message.push(
        'Minimum 4 space separated tags. ie: red race_car bmw m3'
      );
    }

    if (!errorRes.message.length) {
      const dimensions = sizeOf(ctx.file.path);
      const newPost = await Models.Post.create({
        userId: payload.id,
        height: dimensions.height,
        width: dimensions.width,
        source: source,
        url: '/uploads/' + ctx.file.filename,
        thumbUrl: '/uploads/thumbnails/' + ctx.file.filename,
      });

      for (var i = 0; i < tags.length; i++) {
        const [tag] = await Models.Tag.findOrCreate({
          where: { name: tags[i] },
          defaults: { active: true },
        });

        await Models.TaggedPost.create({
          postId: newPost.id,
          tagId: tag.id,
          tagName: tag.name,
        });
      }

      await sharp(ctx.file.path)
        .resize(200, 200, {
          fit: 'cover',
        })
        .toFile(ctx.file.destination + '/thumbnails/' + ctx.file.filename);

      ctx.body = { status: 'success' };
    } else {
      ctx.throw(errorRes.status, 'Invalid file or tags');
    }
  });

  router.get('/post/search', async (ctx) => {
    const searchQuery = ctx.query.searchQuery.split(' ');
    const favUserIdIndex = searchQuery.findIndex((value) => {
      return /fp:\d+/.test(value);
    });
    const postsByUserIdIndex = searchQuery.findIndex((value) => {
      return /user:\d+/.test(value);
    });
    let favoritedPostsUserId = false;
    let postsByUserId = false;
    let favoritedPostIds = [];
    let where = {};
    let having = {};

    if (favUserIdIndex > -1) {
      favoritedPostsUserId = searchQuery[favUserIdIndex].split(':')[1];
      searchQuery.splice(favUserIdIndex, 1);
    }
    if (postsByUserIdIndex > -1) {
      postsByUserId = searchQuery[postsByUserIdIndex].split(':')[1];
      searchQuery.splice(postsByUserIdIndex, 1);
    }

    if (favoritedPostsUserId) {
      const user = await Models.User.findOne({
        where: { id: favoritedPostsUserId },
        include: {
          model: Models.Post,
          as: 'favoritedPosts',
          required: false,
          attributes: ['id'],
        },
      });

      favoritedPostIds = user.favoritedPosts.map((post) => {
        return post.id;
      });
    }

    if (favoritedPostsUserId) {
      where.postId = favoritedPostIds;
    }

    if (searchQuery.length > 0) {
      where.tagName = searchQuery;
      having = Models.sequelize.literal(
        `count("postId") = ${searchQuery.length}`
      );
    }

    const postIds = await Models.TaggedPost.findAll({
      where,
      attributes: ['postId'],
      group: ['postId'],
      having,
    }).map((x) => x.postId);

    where = {
      active: true,
      id: postIds,
    };

    if (postsByUserId) {
      where.userId = postsByUserId;
    }

    const posts = await Models.Post.findAll({
      where,
      limit: 18,
      order: [['createdAt', 'DESC']],
      include: {
        model: Models.Tag,
        as: 'tag',
        required: false,
        attributes: ['id', 'name'],
      },
    });

    ctx.body = posts;
  });

  router.post('/post/delete/:id', async (ctx) => {
    const id = ctx.params.id;
    const sessionToken = ctx.cookies.get('auth');
    const payload = sessionToken ? jwt.verify(sessionToken, jwtSecret) : false;

    if (payload) {
      const post = await Models.Post.findOne({ where: { id } });
      if (payload.admin || post.userId === payload.id) {
        post.active = false;
        await post.save();
      }
    }
    ctx.body = { status: 'success' };
  });
  router.post('/post/addTag', async (ctx) => {
    const allPosts = await Models.Post.findAll({
      order: [['createdAt', 'DESC']],
    });

    ctx.body = allPosts;
  });
};
