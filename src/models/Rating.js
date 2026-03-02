module.exports = (sequelize, DataTypes) => {
  const Rating = sequelize.define('Rating', {
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 5 }
    },
    review: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'ratings',
    underscored: true
  });

  Rating.associate = (models) => {
    Rating.belongsTo(models.User, { foreignKey: 'user_id' });
    Rating.belongsTo(models.MenuItem, { foreignKey: 'menu_item_id' });
  };

  return Rating;
};