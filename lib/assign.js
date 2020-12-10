'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ライブラリ
const ddb = require('./ddb');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');

exports.tagAssign = async () => {
  let params = [];

  // Ignored Promote
  params.push({
    fromOkNgDir: appConfig.fs.igOkDir,
    oppoOkNgDir: appConfig.fs.igNgDir,
    fromTable: appConfig.db.tab.favTable,
    toTable: appConfig.db.tab.dlTable,
    priorQueUrl: appConfig.mq.url.priorDlQueUrl
  });

  // Download Demote
  params.push({
    fromOkNgDir: appConfig.fs.artNgDir,
    oppoOkNgDir: appConfig.fs.artOkDir,
    fromTable: appConfig.db.tab.dlTable,
    toTable: appConfig.db.tab.favTable,
    priorQueUrl: appConfig.mq.url.priorFavQueUrl
  });

  // Artist Download
  params.push({
    fromOkNgDir: appConfig.fs.artNgDir,
    oppoOkNgDir: appConfig.fs.artOkDir,
    fromTable: appConfig.db.tab.artTable,
    toTable: appConfig.db.tab.dlTable,
    priorQueUrl: appConfig.mq.url.priorDlQueUrl
  });

  // Artist Favorite
  params.push({
    fromOkNgDir: appConfig.fs.artOkDir,
    oppoOkNgDir: appConfig.fs.artNgDir,
    fromTable: appConfig.db.tab.artTable,
    toTable: appConfig.db.tab.favTable,
    priorQueUrl: appConfig.mq.url.priorFavQueUrl
  });

  // Studio Download
  params.push({
    fromOkNgDir: appConfig.fs.stuOkDir,
    oppoOkNgDir: appConfig.fs.stuNgDir,
    fromTable: appConfig.db.tab.stuTable,
    toTable: appConfig.db.tab.dlTable,
    priorQueUrl: appConfig.mq.url.priorDlQueUrl
  });

  // Studio Favorite
  params.push({
    fromOkNgDir: appConfig.fs.stuNgDir,
    oppoOkNgDir: appConfig.fs.stuOkDir,
    fromTable: appConfig.db.tab.stuTable,
    toTable: appConfig.db.tab.favTable,
    priorQueUrl: appConfig.mq.url.priorFavQueUrl
  });

  // 各フォルダに対する処理のループ
  const startMsg = appConfig.assign.msg.startMsg;
  console.info(startMsg);

  for (let param of params) {
    const fromOkNgDir = param.fromOkNgDir;
    const oppoOkNgDir = param.oppoOkNgDir;
    const fromTable = param.fromTable;
    const toTable = param.toTable;

    // 既存 テーブルスキャン
    let existTags = [];
    let existItems = [];
    try {
      const searchParams = {
        TableName: fromTable,
      };
      existItems = await ddb.scanAll(searchParams);
    } catch(err) {
      throw err;
    }

    for (let extraItem of existItems) {
      existTags.push(extraItem.tag);
    }

    // 各サブフォルダに対する処理のループ
    const reqTags = fs.readdirSync(fromOkNgDir);
    for (let reqTag of reqTags) {
      const fromOkNgTagDir = path.join(fromOkNgDir, reqTag);
      const oppoOkNgTagDir = path.join(oppoOkNgDir, reqTag);
      let fixedTag;
      if (existTags.includes(reqTag)) {
        fixedTag = reqTag;
      } else if (existTags.includes(reqTag + '.')) {
        fixedTag = reqTag + '.';
      }

      if (fixedTag !== undefined) {
        try {
          // DB レコードの移動
          await ddb.itemUpdate(toTable, fixedTag);
          await ddb.itemDelete(fromTable, fixedTag);

          // サブフォルダの削除
          fs.removeSync(fromOkNgTagDir);
          fs.removeSync(oppoOkNgTagDir);

          // MQ のリクエストキューにメッセージを送信
          await sqs.sendMsg(priorQueUrl, reqTag);
        } catch(err) {
          throw err;
        }
      }
    }
  }

  const finMsg = appConfig.assign.msg.finMsg;
  console.info(finMsg);
}
