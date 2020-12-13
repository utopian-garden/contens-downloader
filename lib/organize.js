'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');
const sanitize = require('sanitize-filename');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ライブラリ
const ddb = require('./ddb');
const walk = require('./walk');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// ファイルの仕分け
exports.fileOrganize = async () => {
  // DB スキャン
  let tagItems = [];
  const dlTable = appConfig.db.tab.dlTable;
  try {
    tagItems = await ddb.scanAll(dlTable);
  } catch(err) {
    throw err;
  }

  // スキャン結果でループ
  const startMsg = appConfig.organize.msg.startMsg;
  console.info(startMsg);

  for (let tagItem of tagItems) {
    const tagDir = path.join(appConfig.fs.dlDir, sanitize(tagItem.tag));
    const tagSubDirFiles = await walk.walkFileSync(tagDir);

    // 続行条件のチェック
    const fileThre = appConfig.organize.fileThre;
    if (tagSubDirFiles.length > fileThre) {
      // ファイル名でループ
      const tagDirFiles = fs.readdirSync(tagDir);
      for (let tagDirFile of tagDirFiles) {
        // 仕分けルールでループ
        const assortRule = appConfig.organize.assortRule;
        for (let type of assortRule) {
          // ファイルタイプ毎に合致するサブディレクトリに移動
          if (path.extname(tagDirFile) === type.fileExt) {
            const fromFile = path.join(tagDir, tagDirFile);
            const toDir = path.join(tagDir, type.fileType);
            const toFile = path.join(toDir, tagDirFile);
            fs.ensureDirSync(toDir);
            fs.moveSync(fromFile , toFile);
            break;
          }
        }
      }
    }
  }

  const finMsg = appConfig.organize.msg.finMsg;
  console.info(finMsg);
}
