'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.tagDemote = async () => {
  const dlNgDir = appConfig.fs.dlNgDir;
  fs.readdirSync(dlNgDir).forEach(reqTag => {
    console.log(reqTag);

    const dlTable = appConfig.db.tab.dlTable;
    const favTable = appConfig.db.tab.favTable;
    const dlHistTagDir = path.join(appConfig.fs.dlHistDir, reqTag);
    const dlNgTagDir = path.join(dlNgDir, reqTag);

    try {
      ddbUpdate(favTable, reqTag);
      ddbDelete(dlTable, reqTag);
      fs.removeSync(dlHistTagDir);
      fs.removeSync(dlNgTagDir);
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

exports.tagDemote();
