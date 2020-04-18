'use strict';
module.exports = (sequelize, DataTypes) => {
  const Flag = sequelize.define(
    'Flag',
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
      },
      reason: DataTypes.STRING
    },
    {}
  );
  Flag.associate = function(models) {
    Flag.belongsTo(models.Post, {
      as: 'post',
      foreignKey: 'postId'
    });
    Flag.belongsTo(models.User, {
      as: 'user',
      foreignKey: 'userId'
    });
  };
  return Flag;
};
