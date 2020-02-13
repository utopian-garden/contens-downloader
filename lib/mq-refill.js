'use strict';

const ddb = require('./ddb');
const sqs = require('./sqs');
const dbCorrect = require('./db-correct');
const appConfig = require('../config/app-config.json');

// MQのメッセージ補充
exports.mqRefill = async(queType) => {
  // DBの重複修正
  dbCorrect.dupCorrect();
  const dlTable = appConfig.db.tab.dlTable;
  const favTable = appConfig.db.tab.favTable;

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
  }

  // DBスキャン
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
