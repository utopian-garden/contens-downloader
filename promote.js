'use strict';

const ddb = require('./lib/ddb.js');
const config = require('./config/app-config.json');

exports.promote = async (tag) => {
  const tagTable = config.ddb.tagTable;
  const updateParams = {
    TableName: tagTable,
    'Key':{
      tag: tag
    }
  }
  
  try {
    console.log(JSON.stringify(await ddb.updateItem(updateParams)));
  } catch(err) {
    console.log(err);
  }

  const favTable = config.ddb.favTable;
  const deleteParams = {
    TableName: favTable,
    'Key':{
      tag: tag
    }
  }
    
  try {
    console.log(JSON.stringify(await ddb.deleteItem(deleteParams)));
  } catch(err) {
    console.log(err);
  }
}

const tag = process.argv[2];

if (tag !== undefined && tag) {
  exports.promote(tag);
}
