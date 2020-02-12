'use strict';

const fs = require('fs-extra');
const path = require('path');
const sanitize = require('sanitize-filename');
const ddb = require('./ddb');
const walk = require('./walk');
const appConfig = require('../config/app-config.json');

// ファイルの仕分け
exports.fileOrganize = async (fileThre) => {
  // DBスキャン
  let tagItems = [];
  const dlTable = appConfig.db.tab.dlTable;
  const searchParams = {
    TableName: dlTable,
  };
  try {
    tagItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(err.message);
  }

  // スキャン結果でループ
  for (let Item of tagItems) {
    const tagDir = path.join(appConfig.fs.dlDir, sanitize(Item.tag));
    const tagFiles = await walk.walkDirSync(tagDir);

    // 続行条件のチェック
    if (tagFiles.length > fileThre) {
      const assortRule = appConfig.assort.assortRule;

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
}
