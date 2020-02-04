'use strict';

const path = require('path');
const ddb = require('./ddb');
const sqs =  require('./sqs');
const appConfig = require('../config/app-config.json');

exports.mqRefill = async(queType) => {
  let tabName;
  let queUrl;

  switch (queType) {
    case 'dl':
      tabName = appConfig.db.tab.dlTable;
      queUrl = appConfig.mq.url.dlQueUrl;
      break;
    case 'fav':
      tabName = appConfig.db.tab.favTable;
      queUrl = appConfig.mq.url.favQueUrl;
      break;
  }

  // DBスキャン
  const searchParams = {
    TableName: tabName,
  };

  let tabItems = [];
  try {
    tabItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(JSON.stringify(err));
  }

  // メッセージ送信
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

const queType = process.argv[2];

if (queType !== undefined && queType) {
  exports.mqRefill(queType);
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' dl/fav');
}
