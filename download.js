'use strict';

const fs = require('fs-extra');
const path = require('path');
const log4js = require('log4js');
log4js.configure('./config/dl-log-config.json');
const req = require('./lib/req.js');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const walk = require('./lib/walk.js');
const appConfig = require('./config/app-config.json');

exports.dlPosts = async () => {
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
    const priorDlQueUrl = appConfig.sqs.priorDlQueUrl;
    const recvParams = {
      QueueUrl: priorDlQueUrl,
    };

    let tagMsg;
    try {
      tagMsg = await sqs.recvMsg(recvParams);
    } catch(err) {
      console.log(err);
    }

    // 通常キューからメッセージを取得
    const dlQueUrl = appConfig.sqs.dlQueUrl;
    if (tagMsg === undefined) {
      const recvParams = {
        QueueUrl: dlQueUrl,
      };

      try {
        tagMsg = await sqs.recvMsg(recvParams);
      } catch(err) {
        console.log(err);
      }
    }

    const dlTable = appConfig.ddb.dlTable;
    if (tagMsg === undefined) {
      // 取得できなかった場合は通常キューにメッセージを補充

      // DBスキャン
      const searchParams = {
        TableName: dlTable,
      };

      let tagItems = [];
      try {
        tagItems = await ddb.scanAll(searchParams);
      } catch(err) {
        console.log(err.message);
      }

      // 通常キューにメッセージを送信
      for (let items of tagItems) {
        const item = JSON.stringify(items);
        const sendParams = {
          MessageBody: item,
          QueueUrl: dlQueUrl,
          DelaySeconds: 0,
        };
        sqs.sendMsg(sendParams);
      }
    } else {
      // DB整合性チェック
      const tagAttr = appConfig.ddb.tagAttr;
      const tagKey = tagMsg.tag;
      const checkParams = {
        TableName: dlTable,
        ExpressionAttributeNames:{'#d': tagAttr},
        ExpressionAttributeValues:{':val': tagKey},
        KeyConditionExpression: '#d = :val'
      };
      let itemCheck;
      try {
        itemCheck = await ddb.queryItem(checkParams);
      } catch(err) {
        console.log(JSON.stringify(err));
        continue;
      }

      if (itemCheck.Items.length === 0) {
        console.log('Skipped:' + tagKey);
        continue;
      }

      // 最終更新の取得
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
              logger.debug(tagKey);
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

            // ファイル名の整形
            const fileUrl = searchRes[i].file_url;
            const extension = fileUrl.split('/').pop().split('?').shift()
                .split('.').pop();
            const fileName = postId + '.' + extension;
            const tagDir = path.join(appConfig.fs.dlDir, tagKey)
                .replace(/\.+$/,'');  // Winフォルダ禁止文字への対応
            const histDir = path.join(appConfig.fs.histDir, tagKey)
                .replace(/\.+$/,'');  // Winフォルダ禁止文字への対応
            const filePath = path.join(tagDir, fileName);

            // ファイルの存在チェック
            if (!await walk.walkExistsSync(tagDir, fileName) &&
                !await walk.walkExistsSync(histDir, fileName)) {

              // ディレクトリの作成
              fs.ensureDirSync(tagDir);

              // テンプレートファイルの配布
              const toolDir = appConfig.fs.toolDir;
              const orderFile = appConfig.fs.orderFile;
              const listFile = appConfig.fs.listFile;
              const orderFrom = path.join(toolDir, orderFile);
              const orderTo = path.join(tagDir, orderFile);
              const listFrom = path.join(toolDir, listFile);
              const listTo = path.join(tagDir, listFile);

              if (!fs.pathExistsSync(orderTo)) {
                fs.copySync(orderFrom, orderTo);
              }

              if (!fs.pathExistsSync(listTo)) {
                fs.copySync(listFrom, listTo);
              }

              // ダウンロード リクエスト
              const refererUrl = appConfig.req.dl.refererUrl + postId;
              try {
                await req.dlContent(filePath, fileUrl, refererUrl);
                console.log(postId);
              } catch(err) {
                switch(err.statusCode) {
                  case 404:
                    break;
                  default:
                    console.log(err.message);
                    continue page_loop;
                }
              }
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
          TableName: dlTable,
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

const concurrency = 1;

for (let i = 0; i < concurrency; i++) {
  exports.dlPosts();
}
