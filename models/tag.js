'use strict';
module.exports = (sequelize, DataTypes) => {
  const Tag = sequelize.define(
    'Tag',
    {
      name: DataTypes.STRING,
      description: DataTypes.STRING,
      active: DataTypes.BOOLEAN
    },
    {}
  );
  Tag.associate = function(models) {
    Tag.belongsToMany(models.Post, {
      through: 'TaggedPost',
      as: 'post',
      foreignKey: 'tagId',
      onDelete: 'cascade',
      hooks: true
    });
  };
  return Tag;
};
