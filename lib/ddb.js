'use strict';

const AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws-config.json');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.scanAll = async (scanParams) => {
  let resItems = [];

  // DynamoDB のスキャン制限(1MB)に対応するために、最後のキーになるまでスキャンを繰り返す
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

exports.updateItem = async (updParams) => {
  try {
    return await docClient.update(updParams).promise();
  } catch (err) {
    throw err;
  }
}

exports.deleteItem = async (delParams) => {
  try {
    return await docClient.delete(delParams).promise();
  } catch (err) {
    throw err;
  }
}

exports.queryItem = async (queryParams) => {
  try {
    return await docClient.query(queryParams).promise();
  } catch (err) {
    throw err;
  }
}
