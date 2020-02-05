'use strict';

const ddb = require('./ddb');
const sqs = require('./sqs');
const dbCorrect = require('./db-correct');
const appConfig = require('../config/app-config.json');

// MQのメッセージ補充
exports.mqRefill = async(queType) => {
  // DBの重複修正
  dbCorrect.dupCorrect();

  let tabName;
  let queUrl;
  switch (queType) {
    case 'Download':
      tabName = appConfig.db.tab.dlTable;
      queUrl = appConfig.mq.url.dlQueUrl;
      break;
    case 'Favorite':
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
  for (let item of tabItems) {
    const msgItem = JSON.stringify(item);
    const sendParams = {
      MessageBody: msgItem,
      QueueUrl: queUrl,
      DelaySeconds: 0,
    };
    sqs.sendMsg(sendParams);
  }
}
