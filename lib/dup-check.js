'use strict';

const ddb = require('./ddb.js');
const appConfig = require('../config/app-config.json');

exports.dupCheck = async () => {
  const dlParams = {
    TableName: appConfig.db.tab.dlTable,
  };
  let dlItems = await ddb.scanAll(dlParams);

  const favParams = {
    TableName: appConfig.db.tab.favTable,
  };
  let favItems = await ddb.scanAll(favParams);

  for (let dlItem of dlItems) {
    for (let favItem of favItems) {
      if (dlItem.tag === favItem.tag) {
        console.log(dlItem.tag);
      }
    }
  }
}

exports.dupCheck();
