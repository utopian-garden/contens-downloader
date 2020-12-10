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

  for (let Item of tagItems) {
    const tagDir = path.join(appConfig.fs.dlDir, sanitize(Item.tag));
    const tagFiles = await walk.walkDirSync(tagDir);

    // 続行条件のチェック
    const fileThre = appConfig.organize.fileThre;
    if (tagFiles.length > fileThre) {
      const assortRule = appConfig.organize.assortRule;

      // 仕分けルールでループ
      for (let type of assortRule) {
        const tagFiles = fs.readdirSync(tagDir);

        // ファイルタイプ毎に合致するサブディレクトリに移動
        for (let File of tagFiles) {
          if (path.extname(File) === type.fileExt) {
            const destDir = path.join(tagDir, type.fileType);
            fs.ensureDirSync(destDir);
            fs.moveSync(path.join(tagDir, File), path.join(destDir, File));
          }
        }
      }
    }
  }

  const finMsg = appConfig.organize.msg.finMsg;
  console.info(finMsg);
}
