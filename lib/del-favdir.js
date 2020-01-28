'use strict';

const ddb = require('./ddb.js');
const fs = require('fs-extra');
const path = require('path');

(async () => {
  const favParams = {
    TableName: 'Favorite',
  };
  let favItems = await ddb.scanAll(favParams);

  for (let favItem of favItems) {
    let dlDir = 'E:/Projects/Sankaku/downloads';
    let histDir = 'E:/Projects/Sankaku/downloads/_history';

    fs.removeSync(path.join(dlDir, favItem.tag));    
    fs.removeSync(path.join(histDir, favItem.tag));    
  }
})();
