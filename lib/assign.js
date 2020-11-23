'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// 初期化
const logger = log4js.getLogger('system');

exports.tagAssign = async (assignType) => {
  let fromOkNgDir;
  let fromTable;
  let toTable;
  let fromHistTagDir
  switch (assignType) {
    case 'Demote':
      log4js.configure('./config/dem-log-config.json');
      fromOkNgDir = appConfig.fs.dlNgDir;
      fromTable = appConfig.db.tab.dlTable;
      toTable = appConfig.db.tab.favTable;
      fromHistTagDir = path.join(appConfig.fs.dlHistDir, reqTag);
      break;
    case 'Promote':
      log4js.configure('./config/prom-log-config.json');
      fromOkNgDir = appConfig.fs.igOkDir;
      fromTable = appConfig.db.tab.favTable;
      toTable = appConfig.db.tab.dlTable;
      fromHistTagDir = path.join(appConfig.fs.igHistDir, reqTag);
      break;
  }

  const startMsg = appConfig.db.msg.startMsg;
  console.log(startMsg);

  fs.readdirSync(fromOkNgDir).forEach(reqTag => {
    const fromTagDir = path.join(fromOkNgDir, reqTag);
    try {
      ddbUpdate(toTable, reqTag);
      ddbDelete(fromTable, reqTag);
      fs.removeSync(fromHistTagDir);
      fs.removeSync(fromTagDir);
    } catch(err) {
      logger.error(err.message);
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
    logger.error(JSON.stringify(err));
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
    logger.error(JSON.stringify(err));
    throw err;
  }
}
