'use strict';

const log4js = require('log4js');
log4js.configure('./config/fav-log-config.json');
const req = require('./lib/req.js');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const config = require('./config/app-config.json');

// 無名非同期関数によるメイン処理
exports.favPosts = async () => {
  // log4js のイニシャライズ
  const logger = log4js.getLogger('system');

  // ループ処理開始
  while (true) {
    // 優先メッセージ取得
    const priorFavQueueUrl = config.sqs.priorFavQueueUrl;
    const receiveParams = {
      QueueUrl: priorFavQueueUrl,
    };
    let message = await sqs.recvMsg(receiveParams);

    // メッセージ取得
    const favQueueUrl = config.sqs.favQueueUrl;
    if (message === undefined) {
      const receiveParams = {
        QueueUrl: favQueueUrl,
      };
      message = await sqs.recvMsg(receiveParams);
    }
  
    const favTable = config.ddb.favTable;
    if (message === undefined) {
      // 取得できなかった場合はメッセージを補充

      // DBスキャン
      const searchParams = {
        TableName: favTable,
      };

      let favItems = [];
      try {
        favItems = await ddb.scanAll(searchParams);
      } catch(err) {
        console.log(JSON.stringify(err));
      }
  
      // メッセージ送信
      for (let items of favItems) {
        const item = JSON.stringify(items);
        const sendParams = {
          MessageBody: item,
          QueueUrl: favQueueUrl,
          DelaySeconds: 0,
        };
        sqs.sendMsg(sendParams);
      }
    } else {
      // 認証リクエスト
      let authToken;
      try {
        authToken = await req.getToken();
      } catch(err) {
        console.log(err.message);
      }

      // 最終更新の取得
      const tag = message.tag;
      let last = message.last;
      if (last === undefined) {
        last = 0;
      }

      let page = 1;
      let newLast = 0;

      // ページでループ
      page_loop:
      while (true) {
        console.log(tag, page);

        // 検索リクエスト
        let jsonSearch;
        try {
          jsonSearch = await req.searchPost(tag, page, authToken);
        } catch(err) {
          console.log(err.message);
          continue page_loop;
        }
        
        let promiseArray = [];

        if (jsonSearch !== undefined) {
          if (jsonSearch.length === 0) {
            if (page === 1) {
              logger.debug(tag, encodeURI(tag));
            }
            
            break;
          }

          if (page === 1) {
            // 最新Post番号の取得
            newLast = jsonSearch[0].id;
          }

          // 検索結果でループ
          for (let i = 0; i < jsonSearch.length; i++) {
            const post_id = jsonSearch[i].id;
            if (last > post_id) {
              break page_loop;
            }

            // お気に入りリクエスト
            const is_favorited = jsonSearch[i].is_favorited;
            if (!is_favorited) {
              promiseArray.push(req.favPost(post_id, authToken));
            }
            
            // 投票リクエスト
            let user_vote = jsonSearch[i].user_vote;
            if (user_vote === undefined) {
              user_vote = 0;
            }
            if (user_vote > 0) {
              promiseArray.push(req.votePost(post_id, authToken));
            }
          }
        }
        
        await Promise.all(promiseArray)
          .then(() => {
            page++;
          })
          .catch((err) => {
            console.log(err);
          });
      }

      // 最新Postを更新
      if (newLast > last) {
        const lastAttr = config.ddb.lastAttr;
        const updateParams = {
          TableName: favTable,
          Key: {
            'tag': tag
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
          await ddb.updateItem(updateParams);
        } catch(err) {
          console.log(JSON.stringify(err));
        }
      }
    }
  }
}

const concurrency = 1;

for (let i = 0; i < concurrency; i++) {
  exports.favPosts();
}
