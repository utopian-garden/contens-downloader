'use strict';

// 依存パッケージ
const AWS = require('aws-sdk');

// 設定ファイル
AWS.config.loadFromPath('./config/aws-config.json');
const appConfig = require('../config/app-config.json');

// オブジェクト化
const docClient = new AWS.DynamoDB.DocumentClient();

// DBスキャン
exports.scanAll = async (scanTable) => {
  // DynamoDB のスキャン制限に対応するために、最後のキーになるまでスキャンを繰り返す
  const scanParams = {
    TableName: scanTable,
  };
  let resItems = [];
  const scan = async () => {
    const result = await docClient.scan(scanParams).promise();
    resItems.push(...result.Items);

    // 結果が途中である限り最終行を開始行に代入して繰り返し実行
    if (result.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = result.LastEvaluatedKey;
      await scan();
    }
  }

  try {
    await scan();
    return resItems;
  } catch(err) {
    throw err;
  };
}

// DB 検索
exports.itemCount = async (tagKey, reqTable) => {
  const tagAttr = appConfig.db.attr.tagAttr;
  const queryParams = {
    TableName: reqTable,
    ExpressionAttributeNames:{'#t': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#t = :val'
  };

  try {
    let dbItems = await docClient.query(queryParams).promise();
    return dbItems.Items.length;
  } catch(err) {
    throw err;
  }
};

// DB 更新
exports.itemUpdate = async (reqTable, reqTag) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await docClient.update(updParams).promise();
  } catch(err) {
    throw err;
  }
}

// DB 削除
exports.itemDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await docClient.delete(delParams).promise();
  } catch(err) {
    throw err;
  }
}

// DB 一括更新
exports.itemsWrite = async (reqTable, reqTags) => {
  const writeParams = {
    RequestItems: {
      [reqTable]: reqTags
    }
  };

  try {
    await docClient.batchWrite(writeParams).promise();
  } catch(err) {
    throw err;
  }
}
