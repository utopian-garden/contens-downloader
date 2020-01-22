'use strict';

const fs = require('fs-extra');
const path = require('path');
const ddb = require('./lib/ddb.js');
const config = require('./config/app-config.json');

exports.relegate = async (tag) => {
  const favTable = config.ddb.favTable;
  const updateParams = {
    TableName: favTable,
    Key:{
      'tag': tag
    }
  }

  try {
    console.log(JSON.stringify(await ddb.updateItem(updateParams)));
  } catch(err) {
    console.log(err);
  };

  const tagTable = config.ddb.tagTable;
  const deleteParams = {
    TableName: tagTable,
    Key:{
      'tag': tag
    }
  }
  
  const dlDir = config.fs.dlDir;
  try {
    fs.removeSync(path.join(dlDir, tag));
    console.log(JSON.stringify(await ddb.deleteItem(deleteParams)));
  } catch(err) {
    console.log(err);
  }
}

const tag = process.argv[2];

if (tag !== undefined && tag) {
  exports.relegate(tag);
}
