'use strict';

// ライブラリ
const req = require('./req');
const ddb = require('./ddb');
const log4js = require('log4js');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// タグの DB レコードインポート
exports.importCreator = async(creatorType) => {
  const dlTab = appConfig.db.tab.dlTable;
  const favTab = appConfig.db.tab.favTable;
  const artTab = appConfig.db.tab.artTable;
  const stuTab = appConfig.db.tab.stuTable;
  let tabName;
  let typeCode;
  switch (creatorType) {
    case artTab:
      log4js.configure('./config/imp-art-log-config.json');
      tabName = appConfig.db.tab.artTable;
      typeCode = appConfig.req.search.artistCode;
      break;
    case stuTab:
      log4js.configure('./config/imp-stu-log-config.json');
      tabName = appConfig.db.tab.stuTable;
      typeCode = appConfig.req.search.studioCode;
      break;
  }

  // 初期化
  const logger = log4js.getLogger('system');

  // DB スキャン
  let existTags = [];
  let scanTabs = [dlTab, favTab, tabName];
  for (let scanTab of scanTabs) {
    let tabItems = [];
    try {
      const searchParams = {
        TableName: scanTab,
      };
      tabItems = await ddb.scanAll(searchParams);
    } catch(err) {
      console.log(err);
      throw err;
    }

    for (let tabItem of tabItems) {
      existTags.push(tabItem.tag);
    }
  }

  // 認証リクエスト
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    logger.error(err.message);
  }

  // ページ数でループ
  let pageNum = 1;
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
            logger.error(err.message);
          }
          continue;

        case 400:
        case 408:
          logger.error(pageNum, err.message);
          pageNum++;
          continue;

        default:
          logger.error(pageNum, err.message);
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
      let putRequest = [];
      for (let searchItem of searchRes) {
        if (existTags.includes(searchItem.name)) {
          //
        } else {
          let tagObj = {
            PutRequest: {
              Item: { tag: searchItem.name }
            }
          };
          putRequest.push(tagObj);
        };
      }

      for (let i = 0; i < putRequest.length; i = i + 25) {
        try {
          let reqSlice = putRequest.slice(i, i + 24);
          if (reqSlice.length > 0) {
            await ddbWrite(tabName, reqSlice);
          }
        } catch(err) {
          logger.error(err.message);
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
