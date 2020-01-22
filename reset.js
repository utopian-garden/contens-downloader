'use strict';

const log4js = require('log4js');
log4js.configure('./config/fav-log-config.json');
const ddb = require('./lib/ddb.js');
const config = require('./config/app-config.json');

// 無名非同期関数によるメイン処理
exports.favPosts = async () => {
  // DBスキャン
  const tagTable = config.ddb.tagTable;
  const searchParams = {
    TableName: tagTable,
  };

  let favItems = [];
  try {
    favItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(JSON.stringify(err));
  }

  // DB更新
  const lastAttr = config.ddb.lastAttr;
  for (let items of favItems) {
    const tag = items.tag;

    const updateParams = {
      TableName: tagTable,
      Key: {
        'tag': tag
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
      await ddb.updateItem(updateParams);
    } catch(err) {
      console.log(JSON.stringify(err));
    }
  }
}

exports.favPosts();
