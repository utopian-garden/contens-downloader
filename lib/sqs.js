'use strict';

// 依存パッケージ
const AWS = require('aws-sdk');

// 設定ファイル
AWS.config.loadFromPath('./config/aws-config.json');

// オブジェクト化
const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });

// MQ へのメッセージ送信
exports.sendMsg = async (queueUrl, reqTag) => {
  const sendParams = {
    MessageBody: JSON.stringify({"tag": reqTag, "last":"0"}),
    QueueUrl: queueUrl,
    DelaySeconds: 0,
  };

  try {
    await SQS.sendMessage(sendParams).promise();
  } catch(err) {
    throw err;
  }
}

// MQ からのメッセージ取得と削除
exports.recvMsg = async (recvParams) => {
  let resRecv;
  try {
    resRecv = await SQS.receiveMessage(recvParams).promise();
  } catch(err) {
    throw err;
  }

  if (!resRecv.hasOwnProperty('Messages')) {
    return;
  }

  const message = resRecv['Messages'].pop();
  const delParams = {
    QueueUrl: recvParams.QueueUrl,
    ReceiptHandle: message.ReceiptHandle
  };
  try {
    await SQS.deleteMessage(delParams).promise();
  } catch(err) {
    throw err;
  }

  return JSON.parse(message.Body);
};
