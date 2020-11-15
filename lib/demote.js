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
  const startMsg = appConfig.db.demote.msg.startMsg;
  console.log(startMsg);

  fs.readdirSync(dlNgDir).forEach(reqTag => {
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
      throw err;
    }
  });

  const finMsg = appConfig.db.demote.msg.finMsg;
  console.log(finMsg);
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
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}
