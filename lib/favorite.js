'use strict';

// ライブラリ
const ddb = require('./ddb');
const log4js = require('log4js');
const req = require('./req');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');
log4js.configure('./config/fav-log-config.json');

// ポストのお気に入り処理
exports.favPosts = async () => {
  const logger = log4js.getLogger('system');

  // 認証リクエスト
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    console.log(err.message);
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
      console.log(err);
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
        console.log(err);
      }
    }

    // メッセージが取得できない場合は待機
    const favTable = appConfig.db.tab.favTable;
    const favQuePoll = appConfig.mq.poll.favQuePoll;
    if (tagMsg === undefined) {
      console.log('Waiting for message...');

      const waitMsg = (favQuePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, favQuePoll * 1000);
        });
      };
      await waitMsg(favQuePoll);
    } else {
      // DB 整合性チェック
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
        console.log(JSON.stringify(err));
        continue;
      }

      if (itemCheck.Items.length === 0) {
        console.log('Skipped: ' + tagKey);
        continue;
      }

      // 最終更新の取得
      let curLast = tagMsg.last;
      if (curLast === undefined) {
        curLast = 0;
      }

      let pageNum = 1;
      let newLast = 0;
      const searchParam = appConfig.req.search.searchParam;

      // ページ数でループ
      page_loop:
      while (true) {
        console.log(tagKey, pageNum);

        // 検索リクエスト
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
                console.log(err.message);
              }
              break;

            case 400:
              console.log(err.message);
              break page_loop;

            case 408:
              logger.debug(tagKey, err.message);
              break page_loop;

            default:
              console.log(err.message);
              continue page_loop;
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
                      console.log(err.message);
                    }
                    break;
                  default:
                    console.log(err.message);
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
          console.log(JSON.stringify(err));
        }
      }
    }
  }
}

const paraDeg = 1;

for (let i = 0; i < paraDeg; i++) {
  exports.favPosts();
}
