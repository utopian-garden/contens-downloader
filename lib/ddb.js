'use strict';

// 依存パッケージ
const AWS = require('aws-sdk');

// 設定ファイル
AWS.config.loadFromPath('./config/aws-config.json');

// オブジェクト化
const docClient = new AWS.DynamoDB.DocumentClient();

// DBスキャン
exports.scanAll = async (scanParams) => {
  let resItems = [];

  // DynamoDB のスキャン制限に対応するために、最後のキーになるまでスキャンを繰り返す
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
  } catch (err) {
    throw err;
  };
}

// DB更新
exports.updateItem = async (updParams) => {
  try {
    return await docClient.update(updParams).promise();
  } catch (err) {
    throw err;
  }
}

// DB削除
exports.deleteItem = async (delParams) => {
  try {
    return await docClient.delete(delParams).promise();
  } catch (err) {
    throw err;
  }
}

// DBクエリ
exports.queryItem = async (queryParams) => {
  try {
    return await docClient.query(queryParams).promise();
  } catch (err) {
    throw err;
  }
}
