'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');

// ライブラリ
const req = require('./req');
const ddb = require('./ddb');
const log4js = require('log4js');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// タグの DB レコードインポート
exports.importCreator = async(creatorType) => {
  const artTab = appConfig.db.tab.artTable;
  const stuTab = appConfig.db.tab.stuTable;
  let tabName;
  let typeCode;
  let exDir;
  switch (creatorType) {
    case artTab:
      log4js.configure('./config/imp-art-log-config.json');
      tabName = appConfig.db.tab.artTable;
      typeCode = appConfig.req.search.artistCode;
      exDir = appConfig.fs.artDir;
      break;
    case stuTab:
      log4js.configure('./config/imp-stu-log-config.json');
      tabName = appConfig.db.tab.stuTable;
      typeCode = appConfig.req.search.studioCode;
      exDir = appConfig.fs.stuDir;
      break;
  }

  // 初期化
  const logger = log4js.getLogger('system');

  // 既存 テーブルスキャン
  let extraTags = [];
  let extraItems = [];
  try {
    const searchParams = {
      TableName: tabName,
    };
    extraItems = await ddb.scanAll(searchParams);
  } catch(err) {
    console.log(err);
    throw err;
  }

  for (let extraItem of extraItems) {
    extraTags.push(extraItem.tag);
  }

  // Download/Favorite テーブルをスキャン
  const dlTab = appConfig.db.tab.dlTable;
  const favTab = appConfig.db.tab.favTable;
  let existTags = [];
  let scanTabs = [dlTab, favTab];
  for (let scanTab of scanTabs) {
    let existItems = [];
    try {
      const searchParams = {
        TableName: scanTab,
      };
      existItems = await ddb.scanAll(searchParams);
    } catch(err) {
      console.log(err);
      throw err;
    }

    for (let existItem of existItems) {
      existTags.push(existItem.tag);
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
      let batchRequest = [];
      for (let searchItem of searchRes) {
        const searchItemName = searchItem.name;
        if (extraTags.includes(searchItemName) &&
            existTags.includes(searchItemName)) {

          // Artist/Studio テーブルと Download/Favorite テーブルに存在する場合
          // フォルダを削除しテーブルから削除するタグとして push
          const exTagDir = path.join(exDir, searchItemName);
          try {
            fs.removeSync(exTagDir);
          } catch(err) {
            logger.error(err.message);
          }
          let tagObj = {
            DeleteRequest: {
              Key: { tag: searchItemName }
            }
          };
          batchRequest.push(tagObj);
        }

        if (!extraTags.includes(searchItemName) &&
            !existTags.includes(searchItemName)) {

          // どちらにも存在しない場合はテーブルにインポートするタグとして push
          let tagObj = {
            PutRequest: {
              Item: { tag: searchItemName }
            }
          };
          batchRequest.push(tagObj);
        };
      }

      for (let i = 0; i < batchRequest.length; i = i + 25) {
        try {
          let reqSlice = batchRequest.slice(i, i + 24);
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

// DB 削除
const ddbDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.deleteItem(delParams);
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
