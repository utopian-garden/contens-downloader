'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.tagPromote = async () => {
  const igOkDir = appConfig.fs.igOkDir;
  const startMsg = appConfig.db.promote.msg.startMsg;
  console.log(startMsg);

  fs.readdirSync(igOkDir).forEach(reqTag => {
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
      throw err;
    }
  });

  const finMsg = appConfig.db.promote.msg.finMsg;
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
