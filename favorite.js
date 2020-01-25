'use strict';

const log4js = require('log4js');
log4js.configure('./config/fav-log-config.json');
const req = require('./lib/req.js');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const appConfig = require('./config/app-config.json');

// 無名非同期関数によるメイン処理
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
    // 優先メッセージ取得
    const priorFavQueUrl = appConfig.sqs.priorFavQueUrl;
    const recvParams = {
      QueueUrl: priorFavQueUrl,
    };

    let tagMsg;
    try {
      tagMsg = await sqs.recvMsg(recvParams);
    } catch(err) {
      console.log(err);
    }

    // メッセージ取得
    const favQueUrl = appConfig.sqs.favQueUrl;
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
  
    const favTable = appConfig.ddb.favTable;
    if (tagMsg === undefined) {
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
      for (let item of favItems) {
        const msgItem = JSON.stringify(item);
        const sendParams = {
          MessageBody: msgItem,
          QueueUrl: favQueUrl,
          DelaySeconds: 0,
        };
        sqs.sendMsg(sendParams);
      }
    } else {
      // 最終更新の取得
      const tagKey = tagMsg.tag;
      let curLast = tagMsg.last;
      if (curLast === undefined) {
        curLast = 0;
      }

      let pageNum = 1;
      let newLast = 0;

      // ページでループ
      page_loop:
      while (true) {
        console.log(tagKey, pageNum);

        // 検索リクエスト
        let searchRes;
        try {
          searchRes = await req.searchPost(tagKey, pageNum, authToken);
        } catch(err) {
          console.log(err.message);
          continue;
        }
        
        let promiseArray = [];

        if (searchRes !== undefined) {
          if (searchRes.length === 0) {
            if (pageNum === 1) {
              logger.debug(tagKey, encodeURI(tagKey));
            }
            
            break;
          }

          if (pageNum === 1) {
            // 最新Post番号の取得
            newLast = searchRes[0].id;
          }

          // 検索結果でループ
          for (let i = 0; i < searchRes.length; i++) {
            const postId = searchRes[i].id;
            if (curLast > postId) {
              break page_loop;
            }

            // お気に入りリクエスト
            const isFaved = searchRes[i].is_favorited;
            if (!isFaved) {
              //promiseArray.push(req.favPost(postId, authToken));
              try {
                await req.favPost(postId, authToken);
              } catch(err) {
                console.log(err);
              }
            }
            
            // 投票リクエスト
            let userVote = searchRes[i].user_vote;
            if (userVote === undefined) {
              userVote = 0;
            }
            if (userVote > 0) {
              //promiseArray.push(req.votePost(postId, authToken));
              try {
                await req.votePost(postId, authToken);
              } catch(err) {
                console.log(err);
              }
            }
          }
        }
        
        await Promise.all(promiseArray)
          .then(() => {
            pageNum++;
          })
          .catch((err) => {
            console.log(err);
          });
      }

      // 最新Postを更新
      if (newLast > curLast) {
        const lastAttr = appConfig.ddb.lastAttr;
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

const paraDeg = 2;

for (let i = 0; i < paraDeg; i++) {
  exports.favPosts();
}
