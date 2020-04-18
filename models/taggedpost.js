'use strict';
module.exports = (sequelize, DataTypes) => {
  const TaggedPost = sequelize.define(
    'TaggedPost',
    {
      postId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Post',
          key: 'id'
        }
      },
      tagId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Tag',
          key: 'id'
        }
      },
      tagName: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
          model: 'Tag',
          key: 'name'
        }
      }
    },
    {}
  );
  TaggedPost.associate = function(models) {
    TaggedPost.belongsTo(models.Post, {
      as: 'post',
      foreignKey: 'postId'
    });
  };
  return TaggedPost;
};
