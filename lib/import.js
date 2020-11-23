'use strict';

// ライブラリ
const req = require('./req');
const ddb = require('./ddb');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// タグの DB レコードインポート
exports.importCreator = async(creatorType) => {
  const artTab = appConfig.db.tab.artTable;
  const stuTab = appConfig.db.tab.stuTable;

  let tabName;
  let typeCode;
  switch (creatorType) {
    case artTab:
      tabName = appConfig.db.tab.artTable;
      typeCode = appConfig.req.search.artistCode;
      break;
    case stuTab:
      tabName = appConfig.db.tab.stuTable;
      typeCode = appConfig.req.search.studioCode;
      break;
  }

  // 認証リクエスト
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    console.log(err.message);
  }

  let pageNum = 1;

  // ページ数でループ
  while (true) {
    console.log(tabName, pageNum);

    // 検索リクエスト
    let searchRes;
    try {
      searchRes = await req.searchTag(typeCode, pageNum, authToken);
    } catch(err) {
      switch (err.statusCode) {
        case 401:
          try {
            authToken = await req.getToken();
          } catch(err) {
            console.log(err.message);
          }
          continue;

        case 400:
          console.log(err.message);
          pageNum++;
          continue;

        case 408:
          logger.debug(tagKey, err.message);
          pageNum++;
          continue;

        default:
          console.log(err.message);
          pageNum++;
          continue;
      }
    }

    // 続行条件のチェック
    if (searchRes !== undefined) {
      if (searchRes.length === 0) {
        break;
      }

      // 検索結果でループ
      let reqTags = [];
      for (let item of searchRes) {
        let obj = {
          PutRequest: {
            Item: { tag: item.name }
          }
        };
        reqTags.push(obj);
      }

      for (let i = 0; i < 4; i++) {
        try {
          await ddbWrite(tabName, reqTags.slice(i * 25, (i + 1) * 25));
        } catch(err) {
          console.log(err.message);
          throw err;
        }
      }
    }

    pageNum++;
  }
}

// DB 一括更新
const ddbWrite = async (reqTable, reqTags) => {
  const writeParams = {
    RequestItems: {
      [reqTable]: reqTags
    }
  };

  try {
    await ddb.writeItems(writeParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

// メイン処理の起動
const concurrency = 1;
const creatorType = process.argv[2];

if (creatorType !== undefined && creatorType) {
  for (let i = 0; i < concurrency; i++) {
    exports.importCreator(creatorType);
  }
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' <creatorType(Artist/Studio)>');
}
