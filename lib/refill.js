'use strict';

// ライブラリ
const dbCorrect = require('./correct');
const ddb = require('./ddb');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// MQ のメッセージ補充
exports.mqRefill = async(queType) => {
  // DB の重複修正
  dbCorrect.dupCorrect();
  const dlTable = appConfig.db.tab.dlTable;
  const favTable = appConfig.db.tab.favTable;
  const igTable = appConfig.db.tab.igTable;
  const artTable = appConfig.db.tab.artTable;
  const stuTable = appConfig.db.tab.stuTable;

  let tabName;
  let queUrl;
  switch (queType) {
    case dlTable:
      tabName = appConfig.db.tab.dlTable;
      queUrl = appConfig.mq.url.dlQueUrl;
      break;
    case favTable:
      tabName = appConfig.db.tab.favTable;
      queUrl = appConfig.mq.url.favQueUrl;
      break;
    case igTable:
      tabName = appConfig.db.tab.favTable;
      queUrl = appConfig.mq.url.igQueUrl;
      break;
    case artTable:
      tabName = appConfig.db.tab.artTable;
      queUrl = appConfig.mq.url.artQueUrl;
      break;
    case stuTable:
      tabName = appConfig.db.tab.stuTable;
      queUrl = appConfig.mq.url.stuQueUrl;
      break;
  }

  // DB スキャン
  let tabItems = [];
  try {
    const searchParams = {
      TableName: tabName,
    };
    tabItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(JSON.stringify(err));
  }

  // スキャン結果でループしてメッセージを送信
  const startMsg = appConfig.mq.msg.startMsg;
  console.log(startMsg + queType);

  for (let item of tabItems) {
    const msgItem = JSON.stringify(item);
    const sendParams = {
      MessageBody: msgItem,
      QueueUrl: queUrl,
      DelaySeconds: 0,
    };
    await sqs.sendMsg(sendParams);
  }

  const finMsg = appConfig.mq.msg.finMsg;
  console.log(finMsg + queType);
}
