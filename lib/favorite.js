'use strict';

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
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    logger.error(err.message);
  }

  // ループ処理開始
  while (true) {
    // 優先キューからメッセージを取得
    const priorFavQueUrl = appConfig.mq.url.priorFavQueUrl;
    const recvParams = {
      QueueUrl: priorFavQueUrl,
    };

    let tagMsg;
    try {
      tagMsg = await sqs.recvMsg(recvParams);
    } catch(err) {
      logger.error(err);
    }

    // 通常キューからメッセージを取得
    const favQueUrl = appConfig.mq.url.favQueUrl;
    if (tagMsg === undefined) {
      const recvParams = {
        QueueUrl: favQueUrl,
      };
      try {
        tagMsg = await sqs.recvMsg(recvParams);
      } catch(err) {
        logger.error(err);
      }
    }

    // メッセージが取得できない場合は待機
    if (tagMsg === undefined) {
      const waitingMsg = appConfig.mq.msg.waitingMsg;
      console.log(waitingMsg);

      const waitMsg = (favQuePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, favQuePoll * 1000);
        });
      };
      const favQuePoll = appConfig.mq.poll.favQuePoll;
      await waitMsg(favQuePoll);
    } else {
      // DB 整合性チェック
      const favTable = appConfig.db.tab.favTable;
      const tagAttr = appConfig.db.attr.tagAttr;
      const tagKey = tagMsg.tag;
      const checkParams = {
        TableName: favTable,
        ExpressionAttributeNames:{'#t': tagAttr},
        ExpressionAttributeValues:{':val': tagKey},
        KeyConditionExpression: '#t = :val'
      };
      let itemCheck;
      try {
        itemCheck = await ddb.queryItem(checkParams);
      } catch(err) {
        logger.error(JSON.stringify(err));
        continue;
      }

      if (itemCheck.Items.length === 0) {
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
        console.log(tagKey, pageNum);

        // 検索リクエスト
        const searchParam = appConfig.req.search.searchParam;
        let searchRes;
        try {
          searchRes = await req.searchPost(encodeURIComponent(tagKey), pageNum,
              searchParam, authToken);
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
              logger.error(err.message);
              break page_loop;

            case 502:
              continue;

            default:
              logger.error(err.message);
              continue;
          }
        }

        // 続行条件のチェック
        if (searchRes !== undefined) {
          if (searchRes.length === 0) {
            if (pageNum === 1) {
              logger.debug(tagKey);
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
        }

        pageNum++;
      }

      // 最新ポスト番号を DB に反映
      if (newLast > curLast) {
        const lastAttr = appConfig.db.attr.lastAttr;
        const updParams = {
          TableName: favTable,
          Key: {
            'tag': tagKey
          },
          ExpressionAttributeNames: {
            '#l': lastAttr
          },
          ExpressionAttributeValues: {
            ':newLast': newLast
          },
          UpdateExpression: 'SET #l = :newLast'
        };

        try {
          await ddb.updateItem(updParams);
        } catch(err) {
          logger.error(JSON.stringify(err));
        }
      }
    }
  }
}

const concurrency = 1;

for (let i = 0; i < concurrency; i++) {
  exports.favPosts();
}
