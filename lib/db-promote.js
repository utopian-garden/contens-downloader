'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.dbPromote = async () => {
  const igOkDir = appConfig.fs.igOkDir;
  fs.readdirSync(igOkDir).forEach(reqTag => {
    console.log(reqTag);

    const dlTable = appConfig.db.tab.dlTable;
    const favTable = appConfig.db.tab.favTable;
    const igHistTagDir = path.join(appConfig.fs.igHistDir, reqTag);
    const igOkTagDir = path.join(igOkDir, reqTag);

    try {
      ddbUpdate(dlTable, reqTag);
      ddbDelete(favTable, reqTag);
      fs.removeSync(igHistTagDir);
      fs.removeSync(igOkTagDir);
    } catch(err) {
      console.log(err.message);
    }
  });
}

// DB 更新
const ddbUpdate = async (reqTable, reqTag) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.updateItem(updParams);
    console.log('update:' ,updParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

// DB 削除
const ddbDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.deleteItem(delParams);
    console.log('delete:', delParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

exports.dbPromote();
