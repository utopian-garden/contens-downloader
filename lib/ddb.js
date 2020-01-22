'use strict';

const AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws-config.json');
const docClient = new AWS.DynamoDB.DocumentClient();

exports.scanAll = async (scanParams) => {
  let items = [];

  // DynamoDB のスキャン制限(1MB)に対応するために、最後のキーになるまでスキャンを繰り返す
  const scan = async () => {
    const result = await docClient.scan(scanParams).promise();
    items.push(...result.Items);

    // 結果が途中である限り最終行を開始行に代入して繰り返し実行
    if (result.LastEvaluatedKey) {
      scanParams.ExclusiveStartKey = result.LastEvaluatedKey;
      await scan();
    }
  }

  try {
    await scan();
    return items;
  } catch (err) {
    throw err;
  };
}

exports.updateItem = async (updateParams) => {
  try {
    return await docClient.update(updateParams).promise();
  } catch (err) {
    throw err;
  }
}

exports.deleteItem = async (deleteParams) => {
  try {
    return await docClient.delete(deleteParams).promise();
  } catch (err) {
    throw err;
  }
}
