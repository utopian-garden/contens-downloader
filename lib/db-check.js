'use strict';

const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

exports.checkTag = async (tagKey) => {
  const dlTable = appConfig.db.tab.dlTable;
  const tagAttr = appConfig.db.attr.tagAttr;
  const dlParams = {
    TableName: dlTable,
    ExpressionAttributeNames:{'#d': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#d = :val'
  };
  let dlItem = await ddb.queryItem(dlParams);
  if (dlItem.Items.length > 0) {
    return dlTable;
  }

  const favTable = appConfig.db.tab.favTable;
  const favParams = {
    TableName: favTable,
    ExpressionAttributeNames:{'#f': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#f = :val'
  };
  let favItem = await ddb.queryItem(favParams);
  if (favItem.Items.length > 0) {
    return favTable;
  }
};
