'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.tagAssign = async (assignType) => {
  let fromOkNgDir;
  let oppoOkNgDir;
  let fromTable;
  let toTable;
  switch (assignType) {
    case 'Demote':
      fromOkNgDir = appConfig.fs.dlNgDir;
      oppoOkNgDir = appConfig.fs.dlOkDir;
      fromTable = appConfig.db.tab.dlTable;
      toTable = appConfig.db.tab.favTable;
      break;
    case 'Promote':
      fromOkNgDir = appConfig.fs.igOkDir;
      oppoOkNgDir = appConfig.fs.igNgDir;
      fromTable = appConfig.db.tab.favTable;
      toTable = appConfig.db.tab.dlTable;
      break;
  }

  // DB 移動とフォルダの削除
  const startMsg = appConfig.db.msg.startMsg;
  console.log(startMsg + reqTable);

  fs.readdirSync(fromOkNgDir).forEach(reqTag => {
    const fromOkNgTagDir = path.join(fromOkNgDir, reqTag);
    const oppoOkNgTagDir = path.join(oppoOkNgDir, reqTag);
    try {
      ddbUpdate(toTable, reqTag);
      ddbDelete(fromTable, reqTag);
      fs.removeSync(fromOkNgTagDir);
      fs.removeSync(oppoOkNgTagDir);
    } catch(err) {
      throw err;
    }
  });

  const finMsg = appConfig.db.msg.finMsg;
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
    throw err;
  }
}
