'use strict';

const ddb = require('./ddb.js');

(async () => {
  const dlParams = {
    TableName: 'Download',
  };
  let dlItems = await ddb.scanAll(dlParams);

  const favParams = {
    TableName: 'Favorite',
  };
  let favItems = await ddb.scanAll(favParams);

  for (let dlItem of dlItems) {
    for (let favItem of favItems) {
      if (dlItem.tag === favItem.tag) {
        console.log(dlItem.tag);
      }
    }
  }
})();
