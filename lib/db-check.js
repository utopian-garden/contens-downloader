'use strict';

const ddb = require('./ddb.js');

exports.dbCheck = async (tagKey) => {
  const dlParams = {
    TableName: 'Download',
    ExpressionAttributeNames:{'#d': 'tag'},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#d = :val'
  };
  let dlItem = await ddb.queryItem(dlParams);
  if (dlItem.Items.length > 0) {
    console.log('Download');
  }

  const favParams = {
    TableName: 'Favorite',
    ExpressionAttributeNames:{'#f': 'tag'},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#f = :val'
  };
  let favItem = await ddb.queryItem(favParams);
  if (favItem.Items.length > 0) {
    console.log('Favorite');
  }
};

const tagKey = process.argv[2];
exports.dbCheck(tagKey);
