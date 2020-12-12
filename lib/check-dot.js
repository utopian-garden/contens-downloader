'use strict';

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.checkDot = async () => {
  let params = [];

  // Artist Download
  params.push({
    toTable: appConfig.db.tab.dlTable,
  });

  // 各フォルダに対する処理のループ
  for (let param of params) {
    // 既存 テーブルスキャン
    const toTable = param.toTable;
    let extraTags = [];
    let extraItems = [];
    try {
      extraItems = await ddb.scanAll(toTable);
    } catch(err) {
      throw err;
    }

    for (let extraItem of extraItems) {
      extraTags.push(extraItem.tag);
    }

    // 各サブフォルダに対する処理のループ
    for (let extraTag of extraTags) {
      if (extraTags.includes(extraTag + '.')) {
        console.log(extraTag);
      }
    }
  }
}

(async () => {
  await exports.checkDot();
})();
