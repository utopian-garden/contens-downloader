'use strict';

const fs = require('fs-extra');
const ddb = require('./ddb');
const appConfig = require('../config/app-config.json');

exports.dbAdd = async (promoteJson) => {
  fs.readFile(promoteJson, "utf-8", (err, data) => {
    if (err) throw err;

    for (const reqTag of JSON.parse(data)) {
      console.log(reqTag);

      const dlTable = appConfig.db.tab.dlTable;
      const favTable = appConfig.db.tab.favTable;

      try {
        ddbUpdate(dlTable, reqTag);
        ddbDelete(favTable, reqTag);
      } catch(err) {
        console.log(err.message);
      }
    }
  });
}

exports.dbAdd("./config/db-promote-config.json");

// DB更新
const ddbUpdate = async (reqTable, reqTag) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.updateItem(updParams);
    console.log('update:' ,updParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

// DB削除
const ddbDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.deleteItem(delParams);
    console.log('delete:', delParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}
