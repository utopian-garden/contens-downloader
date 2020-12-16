'use strict';

// 依存パッケージ
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ライブラリ
const ddb = require('./ddb');
const log4js = require('log4js');
const req = require('./req');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// ポストのお気に入り処理
exports.favPosts = async () => {
  // 初期化
  log4js.configure('./config/favorite-log-config.json');
  const logger = log4js.getLogger('system');

  // 認証リクエスト
  const reqPoll = appConfig.req.poll.reqPoll;
  let authToken;
  while (!authToken) {
    try {
      authToken = await req.getToken();
    } catch(err) {
      logger.error('getToken', err.message);
      await waitTimer(reqPoll);
    }
  }

  // ループ処理開始
  while (true) {
    // 優先キューからメッセージを取得
    const priorFavQueUrl = appConfig.mq.url.priorFavQueUrl;
    const favQuePoll = appConfig.mq.poll.favQuePoll;
    let tagMsg;
    try {
      tagMsg = await sqs.recvMsg(priorFavQueUrl);
    } catch(err) {
      logger.error('recvMsg', err);
      await waitTimer(favQuePoll);
    }

    // 通常キューからメッセージを取得
    const favQueUrl = appConfig.mq.url.favQueUrl;
    if (tagMsg === undefined) {
      try {
        tagMsg = await sqs.recvMsg(favQueUrl);
      } catch(err) {
        logger.error('recvMsg', err);
        await waitTimer(favQuePoll);
      }
    }

    // メッセージが取得できない場合は待機
    if (tagMsg === undefined) {
      const waitingMsg = appConfig.mq.msg.waitingMsg;
      console.info(waitingMsg);
      await waitTimer(favQuePoll);
    } else {
      // DB 整合性チェック
      const favTable = appConfig.db.tab.favTable;
      const tagAttr = appConfig.db.attr.tagAttr;
      const tagKey = tagMsg.tag;
      let tabItems;
      try {
        tabItems = await ddb.queryItem(favTable, tagAttr, tagKey);
      } catch(err) {
        logger.error('queryItem', JSON.stringify(err));
        continue;
      }

      if (tabItems.Items.length === 0) {
        continue;
      }

      // 最終更新の取得
      let curLast = tagMsg.last;
      if (curLast === undefined) {
        curLast = 0;
      }

      // ページ数でループ
      let pageNum = 1;
      let newLast = 0;

      page_loop:
      while (true) {
        console.info(tagKey, pageNum);

        // 検索リクエスト
        const searchParam = appConfig.req.search.searchParam;
        let searchRes;
        try {
          searchRes = await req.searchPost(encodeURIComponent(tagKey), pageNum,
              searchParam, authToken);
        } catch(err) {
          if (err.response) {
            switch (err.response.status) {
              case 401:
                console.error('searchPost', tagKey, pageNum, err.response.status);
                try {
                  authToken = await req.getToken();
                } catch(err) {
                  logger.error('getToken', err.message);
                }
                continue page_loop;

              case 400:
              case 408:
              case 504:
                logger.error('searchPost', tagKey, pageNum, err.response.status);
                break page_loop;

              case 502:
                console.error('searchPost', tagKey, pageNum, err.response.status);
                await waitTimer(reqPoll);
                continue page_loop;

              default:
                logger.error('searchPost', tagKey, pageNum, err.response.status);
                continue page_loop;
            }
          } else {
            logger.error('searchPost', tagKey, pageNum, err.message);
            continue page_loop;
          }
        }

        // 続行条件のチェック
        if (searchRes) {
          if (searchRes.length === 0) {
            if (pageNum === 1) {
              try {
                ddb.deleteItem(favTable, tagKey);
                logger.debug(tagKey);
              } catch(err) {
                logger.error('deleteItem', err.message);
              }
            }

            break;
          }

          // 最新 Post 番号の取得
          if (pageNum === 1) {
            newLast = searchRes[0].id;
          }

          // 検索結果でループ
          for (let item of searchRes) {
            const postId = item.id;
            if (curLast > postId) {
              break page_loop;
            }

            // お気に入りリクエスト
            const isFaved = item.is_favorited;
            if (!isFaved) {
              try {
                await req.favPost(postId, authToken);
              } catch(err) {
                if (err.response) {
                  switch (err.response.status) {
                    case 401:
                      console.error('favPost', postId, err.response.status);
                      try {
                        authToken = await req.getToken();
                      } catch(err) {
                        logger.error('getToken', err.message);
                      }
                      continue page_loop;
                    default:
                      logger.error('favPost', postId, err.response.status);
                      continue page_loop;
                  }
                } else {
                  logger.error('favPost', postId, err.message);
                  continue page_loop;
                }
              }
            }
          }
        }

        pageNum++;
      }

      // 最新ポスト番号を DB に反映
      if (newLast > curLast) {
        const lastAttr = appConfig.db.attr.lastAttr;
        try {
          await ddb.updateItem(favTable, lastAttr, tagKey, newLast);
        } catch(err) {
          logger.error('updateItem', JSON.stringify(err));
        }
      }
    }
  }
}

// Wait 処理
const waitTimer = (quePoll) => {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, quePoll * 1000);
  });
};

const concurrency = 1;

for (let i = 0; i < concurrency; i++) {
  exports.favPosts();
}
