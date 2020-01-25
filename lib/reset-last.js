'use strict';

const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

// 無名非同期関数によるメイン処理
exports.resetLast = async (targetTab) => {
  // DBスキャン
  const scanParams = {
    TableName: targetTab,
  };

  let tabItems = [];
  try {
    tabItems = await ddb.scanAll(scanParams);
  } catch(err) {
    console.log(JSON.stringify(err));
  }

  // DB更新
  const lastAttr = appConfig.ddb.lastAttr;
  for (let item of tabItems) {
    const tagKey = item.tag;

    const updParams = {
      TableName: targetTab,
      Key: {
        'tag': tagKey
      },
      ExpressionAttributeNames: {
        '#l': lastAttr
      },
      ExpressionAttributeValues: {
        ':newLast': 0
      },
      UpdateExpression: 'SET #l = :newLast'
    };

    try {
      await ddb.updateItem(updParams);
    } catch(err) {
      console.log(JSON.stringify(err));
    }
  }
}

const targetTab = 'Download';
exports.resetLast(targetTab);
