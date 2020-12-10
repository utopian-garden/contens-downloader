'use strict';

// 依存パッケージ
const AWS = require('aws-sdk');

// 設定ファイル
AWS.config.loadFromPath('./config/aws-config.json');
const appConfig = require('../config/app-config.json');

// オブジェクト化
const docClient = new AWS.DynamoDB.DocumentClient();

// DBスキャン
exports.scanAll = async (reqTable) => {
  // DynamoDB のスキャン制限に対応するために、最後のキーになるまでスキャンを繰り返す
  const scanParams = {
    TableName: reqTable,
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
exports.queryItem = async (reqTable, reqAttr, reqKey) => {
  const queryParams = {
    TableName: reqTable,
    ExpressionAttributeNames:{'#t': reqAttr},
    ExpressionAttributeValues:{':val': reqKey},
    KeyConditionExpression: '#t = :val'
  };

  try {
    let dbItems = await docClient.query(queryParams).promise();
    return dbItems;
  } catch(err) {
    throw err;
  }
};

// DB 追加
exports.addItem = async (reqTable, reqTag) => {
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

// DB 更新
exports.updateItem = async (reqTable, reqAttr, reqKey, reqValue) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqKey
    },
    ExpressionAttributeNames: {
      '#l': reqAttr
    },
    ExpressionAttributeValues: {
      ':newLast': reqValue
    },
    UpdateExpression: 'SET #l = :newLast'
  };

  try {
    await docClient.update(updParams).promise();
  } catch(err) {
    throw err;
  }
}

// DB 削除
exports.deleteItem = async (reqTable, reqTag) => {
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
exports.writeItems = async (reqTable, reqTags) => {
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
