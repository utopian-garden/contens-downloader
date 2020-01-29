'use strict';

const path = require('path');
const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

exports.dbCheck = async (tagKey) => {
  const dlTable = appConfig.ddb.dlTable;
  const tagAttr = appConfig.ddb.tagAttr;
  const dlParams = {
    TableName: dlTable,
    ExpressionAttributeNames:{'#d': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#d = :val'
  };
  let dlItem = await ddb.queryItem(dlParams);
  if (dlItem.Items.length > 0) {
    console.log(dlTable);
  }

  const favTable = appConfig.ddb.favTable;
  const favParams = {
    TableName: favTable,
    ExpressionAttributeNames:{'#f': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#f = :val'
  };
  let favItem = await ddb.queryItem(favParams);
  if (favItem.Items.length > 0) {
    console.log(favTable);
  }
};

const tagKey = process.argv[2];

if (tagKey !== undefined && tagKey) {
  exports.dbCheck(tagKey);
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' <tagKey>');
}
