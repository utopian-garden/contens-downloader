'use strict';

const path = require('path');
const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

// 無名非同期関数によるメイン処理
exports.resetLast = async (resetTab) => {
  // DBスキャン
  const scanParams = {
    TableName: resetTab,
  };

  let tabItems = [];
  try {
    tabItems = await ddb.scanAll(scanParams);
  } catch(err) {
    console.log(JSON.stringify(err));
  }

  // DB更新
  const lastAttr = appConfig.db.attr.lastAttr;
  for (let item of tabItems) {
    const tagKey = item.tag;

    const updParams = {
      TableName: resetTab,
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

const resetTab = process.argv[2];

if (resetTab !== undefined && resetTab) {
  exports.resetLast(resetTab);
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' <tabName>');
}
