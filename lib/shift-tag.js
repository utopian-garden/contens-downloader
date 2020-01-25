'use strict';

const fs = require('fs-extra');
const path = require('path');
const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

exports.shiftTab = async (tagKey, fromTab, toTab, delOpt) => {
  const updParams = {
    TableName: fromTab,
    Key:{
      'tag': tagKey
    }
  }
  try {
    console.log(JSON.stringify(await ddb.updateItem(updParams)));
  } catch(err) {
    console.log(err);
  };

  const delParams = {
    TableName: toTab,
    Key:{
      'tag': tagKey
    }
  }
  try {
    console.log(JSON.stringify(await ddb.deleteItem(delParams)));
  } catch(err) {
    console.log(err);
  };

  if (delOpt === 'delete') {
    const dlDir = appConfig.fs.dlDir;
    try {
      fs.removeSync(path.join(dlDir, tagKey));
    } catch(err) {
      console.log(err);
    }
  }
}

const tagKey = process.argv[2];
const fromTab = process.argv[3];
const toTab = process.argv[4];

if (tagKey !== undefined && tagKey &&
    fromTab !== undefined && fromTab && toTab !== undefined && toTab) {
  
  exports.shiftTab(tagKey, fromTab, toTab, delOpt);
}
