'use strict';
module.exports = (sequelize, DataTypes) => {
  const Post = sequelize.define(
    'Post',
    {
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id'
        }
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      height: DataTypes.INTEGER,
      width: DataTypes.INTEGER,
      source: DataTypes.STRING,
      url: DataTypes.STRING,
      thumbUrl: DataTypes.STRING
    },
    {}
  );
  Post.associate = function(models) {
    Post.belongsToMany(models.Tag, {
      through: 'TaggedPost',
      as: 'tag',
      foreignKey: 'postId'
    });
    Post.belongsToMany(models.User, {
      through: 'FavoritedPost',
      as: 'userFavorited',
      foreignKey: 'postId'
    });
    Post.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    });
  };
  return Post;
};
