'use strict';
module.exports = (sequelize, DataTypes) => {
  const FavoritedPost = sequelize.define(
    'FavoritedPost',
    {
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Post',
          key: 'id'
        }
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'User',
          key: 'id'
        }
      }
    },
    {}
  );
  return FavoritedPost;
};
