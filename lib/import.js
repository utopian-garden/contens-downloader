'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const path = require('path');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

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
    extraItems = await ddb.scanAll(tabName);
  } catch(err) {
    logger.error('scanAll', err);
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
      existItems = await ddb.scanAll(scanTab);
    } catch(err) {
      logger.error('scanAll', err);
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
    logger.error('getToken', err.message);
  }

  // ページ数でループ
  let pageNum = 1;

  page_loop:
  while (true) {
    console.info(tabName, pageNum);

    // 検索リクエスト
    let searchRes;
    try {
      searchRes = await req.searchTag(typeCode, pageNum, authToken);
    } catch(err) {
      if (err.response) {
        switch (err.response.status) {
          case 401:
            console.error('searchTag', err.response.status, tabName, pageNum);
            try {
              authToken = await req.getToken();
            } catch(err) {
              logger.error('getToken', err.message);
            }
            continue;

          case 400:
          case 408:
            logger.error('searchTag', err.response.status, tabName, pageNum);
            break page_loop;

          case 502:
            console.error('searchTag', err.response.status, tabName, pageNum);
            continue;

          default:
            logger.error('searchTag', err.response.status, tabName, pageNum);
            continue;
        }
      } else {
        logger.error('searchPost', err.message);
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
            logger.error('removeSync', err.message);
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
            await ddb.writeItems(tabName, reqSlice);
          }
        } catch(err) {
          logger.error('ddbWrite', err.message);
        }
      }
    }

    pageNum++;
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
  console.info('Usage: node ' + path.basename(process.argv[1]) +
      ' <creatorType(Artist/Studio)>');
}
