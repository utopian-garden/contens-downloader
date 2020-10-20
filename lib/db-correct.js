'use strict';

const ddb = require('./ddb');
const appConfig = require('../config/app-config.json');

// DB修正
exports.dupCorrect = async () => {
  // Download のスキャン
  const dlTable = appConfig.db.tab.dlTable;
  const dlParams = {
    TableName: dlTable,
  };
  let dlItems = await ddb.scanAll(dlParams);

  // Favorite のスキャン
  const favTable = appConfig.db.tab.favTable;
  const favParams = {
    TableName: favTable,
  };
  let favItems = await ddb.scanAll(favParams);

  // 内容比較で重複があった場合は Favorite から削除
  for (let dlItem of dlItems) {
    for (let favItem of favItems) {
      if (dlItem.tag === favItem.tag) {
        const delParams = {
          TableName: favTable,
          Key: {
            'tag': favItem.tag
          }
        };
        await ddb.deleteItem(delParams);
        console.log(favItem.tag);
      }
    }
  }
}
