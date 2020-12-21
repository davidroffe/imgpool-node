const path = require('path');
const fs = require('fs');
const rootPath = path.dirname(require.main.filename);
const asyncBusboy = require('async-busboy');
const multer = require('@koa/multer');
const sizeOf = require('image-size');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const jwtSecret = process.env.JWT_SECRET;
const s3Bucket = process.env.S3_BUCKET;
const s3ImageDir = process.env.S3_IMAGE_DIR;
const s3ThumbDir = process.env.S3_THUMB_DIR;
const imageUrl = process.env.IMAGE_URL;
const thumbUrl = process.env.THUMB_URL;
const localUploadPath = rootPath + process.env.LOCAL_UPLOAD_PATH;
const localThumbPath = rootPath + process.env.LOCAL_THUMB_PATH;
const storageConfig = process.env.STORAGE;
let upload, storage, s3;

if (storageConfig === 's3') {
  AWS.config.loadFromPath('./aws.json');
  s3 = new AWS.S3();
} else {
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, localUploadPath);
    },
    filename: function (req, file, cb) {
      cb(
        null,
        `${file.fieldname}-${Date.now()}.${file.mimetype.split('/')[1]}`
      );
    },
  });
  upload = multer({ storage: storage });
}

module.exports = (Models, router) => {
  router.get('/post/list', async function getPostList(ctx) {
    const postsPerPage = ctx.query.postsPerPage || 18;
    const offset = (ctx.query.page - 1) * postsPerPage;
    const allPosts = await Models.Post.findAll({
      where: { active: true },
      offset,
      limit: postsPerPage,
      order: [['createdAt', 'DESC']],
      include: {
        model: Models.Tag,
        as: 'tag',
        required: false,
        attributes: ['id', 'name'],
      },
    });

    const count = await Models.Post.count({
      where: { active: true },
    });

    ctx.body = { list: allPosts, totalCount: count };
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

  router.post(
    '/post/create',
    storageConfig !== 's3'
      ? upload.single('image')
      : (ctx, next) => Promise.resolve(ctx).then(next),
    async (ctx) => {
      const sessionToken = ctx.cookies.get('auth');
      const secret = process.env.JWT_SECRET;
      const payload = jwt.verify(sessionToken, secret);
      const tags =
        typeof ctx.query.tags !== 'undefined' ? ctx.query.tags.split(' ') : [];
      const source =
        typeof ctx.query.source !== 'undefined' ? ctx.query.source : '';
      const errorRes = { status: 401, message: [] };
      if (!tags.length) {
        errorRes.message.push(
          'Minimum 4 space separated tags. ie: red race_car bmw m3'
        );
      }
      if (storageConfig === 's3') {
        const uploadParams = { Bucket: s3Bucket, Key: '', Body: '' };
        const { files } = await asyncBusboy(ctx.req);
        const fileStream = fs.createReadStream(files[0].path);
        const dimensions = sizeOf(files[0].path);
        const uniqueFileName = `${files[0].fieldname}-${Date.now()}.${
          files[0].mimeType.split('/')[1]
        }`;

        fileStream.on('error', function (err) {
          errorRes.message.push('File Error');
        });
        if (!files[0].filename) {
          errorRes.message.push('Please select a file.');
        }
        if (errorRes.message.length) {
          ctx.throw(errorRes.status, errorRes.message.join('\n'));
        }
        uploadParams.Body = fileStream;

        uploadParams.Key = `${s3ImageDir}${uniqueFileName}`;

        return new Promise((resolve) => {
          s3.upload(uploadParams, async function (err, data) {
            if (err) {
              console.log('Error', err);
            }
            if (data) {
              console.log('Upload Success', data.Location);

              const newPost = await Models.Post.create({
                userId: payload.id,
                height: dimensions.height,
                width: dimensions.width,
                source: source,
                url: imageUrl + uniqueFileName,
                thumbUrl: thumbUrl + uniqueFileName,
              });

              for (let i = 0; i < tags.length; i++) {
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

              uploadParams.Key = `${s3ThumbDir}${uniqueFileName}`;
              uploadParams.Body = await sharp(files[0].path)
                .jpeg({ quality: 100, progressive: true })
                .resize(200, 200, {
                  fit: 'cover',
                });

              s3.upload(uploadParams, function (err, data) {
                if (err) {
                  console.log('Error', err);
                }
                if (data) {
                  console.log('Upload Success', data.Location);
                  ctx.body = { status: 'success' };
                  resolve();
                }
              });
            }
          });
        });
      } else {
        if (!ctx.file) {
          errorRes.message.push('Please select a file.');
        }
        if (errorRes.message.length) {
          ctx.throw(errorRes.status, errorRes.message.join('\n'));
        }
        const dimensions = sizeOf(ctx.file.path);
        const newPost = await Models.Post.create({
          userId: payload.id,
          height: dimensions.height,
          width: dimensions.width,
          source: source,
          url: imageUrl + ctx.file.filename,
          thumbUrl: thumbUrl + ctx.file.filename,
        });

        for (let i = 0; i < tags.length; i++) {
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
          .toFile(localThumbPath + ctx.file.filename);

        ctx.body = { status: 'success' };
      }
    }
  );

  router.get('/post/search', async (ctx) => {
    const postsPerPage = ctx.query.postsPerPage || 18;
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

    if (searchQuery.length === 0) {
      getPostList(ctx);
      return;
    }

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
      if (user) {
        where.postId = user.favoritedPosts.map((post) => {
          return post.id;
        });
      } else {
        ctx.body = [];
        return;
      }
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
      limit: postsPerPage,
      order: [['createdAt', 'DESC']],
      include: {
        model: Models.Tag,
        as: 'tag',
        required: false,
        attributes: ['id', 'name'],
      },
    });

    const count = await Models.Post.count({ where });

    ctx.body = { list: posts, totalCount: count };
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
