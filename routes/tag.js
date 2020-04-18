module.exports = (Models, router) => {
  router.get('/tag/get', async ctx => {
    const allTags = await Models.Tag.findAll();

    ctx.body = allTags;
  });
  router.post('/tag/create', async ctx => {
    const allTags = await Models.Tag.findAll();

    ctx.body = allTags;
  });

  router.post(['/tag/toggle', '/tag/delete'], async ctx => {
    const sessionId = ctx.cookies.get('auth');
    const tagIds = ctx.query['tagIds[]'];

    if (sessionId) {
      const user = await Models.User.findOne({
        where: { sessionId: sessionId }
      });

      if (user.admin) {
        if (ctx.url.indexOf('/api/tag/toggle') > -1) {
          const tags = await Models.Tag.findAll({
            where: { id: tagIds }
          });
          for (var i = 0; i < tags.length; i++) {
            tags[i].active = !tags[i].active;
            tags[i].save();
          }
        } else {
          await Models.Tag.destroy({
            where: { id: tagIds }
          });
        }
      } else {
        ctx.throw(401, 'Unauthorized request.');
      }
    } else {
      ctx.throw(401, 'Unauthorized request.');
    }
  });
};
