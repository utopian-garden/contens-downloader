'use strict';

const AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws-config.json');
const SQS = new AWS.SQS({ apiVersion: '2012-11-05' });

// MQへのメッセージ送信
exports.sendMsg = async (sendParams) => {
  try {
    return await SQS.sendMessage(sendParams).promise();
  } catch(err) {
    throw err;
  }
};

// MQからのメッセージ取得と削除
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
