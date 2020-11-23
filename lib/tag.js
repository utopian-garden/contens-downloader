'use strict';

// 依存パッケージ
const log4js = require('log4js');
const path = require('path');

// ライブラリ
const req = require('./req');

// 設定ファイル
const appConfig = require('../config/app-config.json');
log4js.configure('../config/tag-log-config.json');

// ポストのお気に入り処理
exports.tagPosts = async (tagKey, searchKey, pageFeed) => {
  const logger = log4js.getLogger('system');

  // 認証リクエスト
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    logger.error(err.message);
  }

  let pageNum = 1;
  const searchParam = appConfig.req.search.searchParam;

  // ページ数でループ
  page_loop:
  while (true) {
    console.log(tagKey, searchKey, pageNum);

    // 検索リクエスト
    let searchRes;
    try {
      searchRes = await req.searchPost(encodeURI(searchKey), pageNum,
          searchParam, authToken);
    } catch(err) {
      switch (err.statusCode) {
        case 401:
          try {
            authToken = await req.getToken();
          } catch(err) {
            logger.error(err.message);
          }
          break;
        default:
          logger.error(err.message);
          continue page_loop;
      }
    }

    // 続行条件のチェック
    if (searchRes !== undefined) {
      if (searchRes.length === 0) {
        if (pageNum === 1) {
          logger.debug(searchKey);
        }

        break;
      }

      // 検索結果でループ
      for (let item of searchRes) {
        const postId = item.id;
        const parentId = item.parent_id;
        const rating = item.rating;
        const source = item.source;
        const tags = item.tags;

        console.log(postId);

        let newTags = [];
        tags.map((row) => {
          newTags.push({"name": row["name"]});
        });
        newTags.push({"name": tagKey});

        const reqJson = {
          "id": postId,
          "post": {
            "lang": "en",
            "parent_id": parentId,
            "rating": rating,
            "source": source,
            "tags": newTags
          }
        };

        const refererUrl = appConfig.req.tag.refererUrl + postId;

        // お気に入りリクエスト
        try {
          await req.tagPut(postId, reqJson, authToken, refererUrl);
        } catch(err) {
          switch (err.statusCode) {
            case 401:
              try {
                authToken = await req.getToken();
              } catch(err) {
                logger.error(err.message);
              }
              break;
            default:
              logger.error(err.message);
              continue page_loop;
          }
        }
      }
    }

    if (pageFeed === "on") {
      pageNum++;
    }
  }
}

const tagKey = process.argv[2];
const searchKey = process.argv[3];
const pageFeed = process.argv[4];

if (tagKey !== undefined && tagKey && searchKey !== undefined && searchKey && pageFeed !== undefined && pageFeed) {
  exports.tagPosts(tagKey, searchKey);
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' <tagKey> <searchKey> <feed(on/off)>');
}
