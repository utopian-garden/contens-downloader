'use strict';

// 依存パッケージ
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// DB修正
exports.dupCorrect = async () => {
  // Download のスキャン
  const dlTable = appConfig.db.tab.dlTable;
  let dlItems = await ddb.scanAll(dlTable);

  // Favorite のスキャン
  const favTable = appConfig.db.tab.favTable;
  let favItems = await ddb.scanAll(favTable);

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

        try {
          await ddb.deleteItem(delParams);
          console.info(favItem.tag);
        } catch(err) {
          throw err;
        }
      }
    }
  }
}
