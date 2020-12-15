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
  let favTags = [];
  for (let favItem of favItems) {
    favTags.push(favItem.tag);
  }

  // 内容比較で重複があった場合は Favorite から削除
  for (let dlItem of dlItems) {
    if (favTags.includes(dlItem.tag)) {
      try {
        await ddb.deleteItem(favTable, dlItem.tag);
      } catch(err) {
        throw err;
      }
    }
  }
}
