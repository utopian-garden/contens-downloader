'use strict';

const fs = require('fs-extra');
const path = require('path');
const ddb =  require('./ddb.js');
const walk = require('./walk.js');
const appConfig = require('../config/app-config.json');

exports.assortFiles = async (threshold) => {
  // DBスキャン
  const dlTable = appConfig.db.tab.dlTable;
  const searchParams = {
    TableName: dlTable,
  };

  let tagItems = [];
  try {
    tagItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(err.message);
  }

  // スキャン結果でループ
  for (let Item of tagItems) {
    console.log(Item.tag);
    const tagDir = path.join(appConfig.fs.dlDir, Item.tag);
    const tagFiles = await walk.walkDirSync(tagDir);

    if (tagFiles.length > threshold) {
      const assortRule = appConfig.assort.assortRule;

      // 仕訳ルールでループ
      for (let type of assortRule) {
        const tagFiles = fs.readdirSync(tagDir);

        // ファイルタイプ毎に合致するサブディレクトリに移動
        for (let File of tagFiles) {
          if (path.extname(File) === type.fileExt) {
            const destDir = path.join(tagDir, type.fileType);
            fs.ensureDirSync(destDir);
            fs.moveSync(path.join(tagDir, File), path.join(destDir, File));
            console.log(File);
          }
        }
      }
    }
  }
}

exports.assortFiles(500);
