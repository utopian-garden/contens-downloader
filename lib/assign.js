'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.tagAssign = async () => {
  let params = [];

  // Ignored Promote
  params.push({
    fromOkNgDir: appConfig.fs.igOkDir,
    oppoOkNgDir: appConfig.fs.igNgDir,
    fromTable: appConfig.db.tab.favTable,
    toTable: appConfig.db.tab.dlTable
  });

  // Download Demote
  params.push({
    fromOkNgDir: appConfig.fs.artNgDir,
    oppoOkNgDir: appConfig.fs.artOkDir,
    fromTable: appConfig.db.tab.dlTable,
    toTable: appConfig.db.tab.favTable
  });

  // Artist Download
  params.push({
    fromOkNgDir: appConfig.fs.artNgDir,
    oppoOkNgDir: appConfig.fs.artOkDir,
    fromTable: appConfig.db.tab.artTable,
    toTable: appConfig.db.tab.dlTable
  });

  // Artist Favorite
  params.push({
    fromOkNgDir: appConfig.fs.artOkDir,
    oppoOkNgDir: appConfig.fs.artNgDir,
    fromTable: appConfig.db.tab.artTable,
    toTable: appConfig.db.tab.favTable
  });

  // Studio Download
  params.push({
    fromOkNgDir: appConfig.fs.stuOkDir,
    oppoOkNgDir: appConfig.fs.stuNgDir,
    fromTable: appConfig.db.tab.stuTable,
    toTable: appConfig.db.tab.dlTable
  });

  // Studio Favorite
  params.push({
    fromOkNgDir: appConfig.fs.stuNgDir,
    oppoOkNgDir: appConfig.fs.stuOkDir,
    fromTable: appConfig.db.tab.stuTable,
    toTable: appConfig.db.tab.favTable
  });

  // DB 移動とフォルダの削除
  const startMsg = appConfig.assign.msg.startMsg;
  console.log(startMsg);

  for (let param of params) {
    const fromOkNgDir = param.fromOkNgDir;
    const oppoOkNgDir = param.oppoOkNgDir;
    const fromTable = param.fromTable;
    const toTable = param.toTable;

    fs.readdirSync(fromOkNgDir).forEach(reqTag => {
      const fromOkNgTagDir = path.join(fromOkNgDir, reqTag);
      const oppoOkNgTagDir = path.join(oppoOkNgDir, reqTag);
      try {
        await ddbUpdate(toTable, reqTag);
        await ddbDelete(fromTable, reqTag);
        fs.removeSync(fromOkNgTagDir);
        fs.removeSync(oppoOkNgTagDir);
      } catch(err) {
        throw err;
      }
    });
  }

  const finMsg = appConfig.assign.msg.finMsg;
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
