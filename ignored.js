'use strict';

const fs = require('fs-extra');
const path = require('path');
const sanitize = require('sanitize-filename');
const log4js = require('log4js');
log4js.configure('./config/ig-log-config.json');
const req = require('./lib/req');
const ddb = require('./lib/ddb');
const sqs = require('./lib/sqs');
const walk = require('./lib/walk');
const appConfig = require('./config/app-config.json');

// ポストのダウンロード処理
exports.igPosts = async () => {
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
    const priorIgQueUrl = appConfig.mq.url.priorIgQueUrl;
    const recvParams = {
      QueueUrl: priorIgQueUrl,
    };

    let tagMsg;
    try {
      tagMsg = await sqs.recvMsg(recvParams);
    } catch(err) {
      console.log(err);
    }

    // 通常キューからメッセージを取得
    const igQueUrl = appConfig.mq.url.igQueUrl;
    if (tagMsg === undefined) {
      const recvParams = {
        QueueUrl: igQueUrl,
      };

      try {
        tagMsg = await sqs.recvMsg(recvParams);
      } catch(err) {
        console.log(err);
      }
    }

    // メッセージが取得できない場合は待機
    const favTable = appConfig.db.tab.favTable;
    const igQuePoll = appConfig.mq.poll.igQuePoll;
    if (tagMsg === undefined) {
      console.log('Waiting for message...');
      const waitMsg = (igQuePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, igQuePoll * 1000);
        });
      };
      await waitMsg(igQuePoll);
    } else {
      // DBの整合性チェック
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
      let curLast = 0;
      /*if (curLast === undefined) {
        curLast = 0;
      }*/

      let pageNum = 1;
      let newLast = 0;
      const searchParam = appConfig.req.search.igSearchParam;

      // ページ数でループ
      page_loop:
      while (2 > pageNum) {
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

          // 最新Post番号の取得
          if (pageNum === 1) {
            newLast = searchRes[0].id;
          }

          // 検索結果でループ
          for (let item of searchRes) {
            const postId = item.id;
            if (curLast > postId) {
              break page_loop;
            }

            // ファイル名の整形
            const fileUrl = item.file_url;
            const extension = fileUrl.split('/').pop().split('?').shift()
                .split('.').pop();
            const fileName = postId + '.' + extension;
            const igDir = path.join(appConfig.fs.igDir, sanitize(tagKey));
            const igHistDir = path.join(appConfig.fs.igHistDir, sanitize(tagKey));
            const filePath = path.join(igDir, fileName);

            // ファイルの存在チェック
            if (!await walk.walkExistsSync(igDir, fileName) &&
                !await walk.walkExistsSync(igHistDir, fileName)) {

              // ディレクトリの作成
              fs.ensureDirSync(igDir);

              // テンプレートファイルの配布
              const toolDir = appConfig.fs.toolDir;
              const orderBat = appConfig.fs.orderBat;
              const orderPs1 = appConfig.fs.orderPs1;
              const orderLst = appConfig.fs.orderLst;
              const batFrom = path.join(toolDir, orderBat);
              const batTo = path.join(igDir, orderBat);
              const ps1From = path.join(toolDir, orderPs1);
              const ps1To = path.join(igDir, orderPs1);
              const lstFrom = path.join(toolDir, orderLst);
              const lstTo = path.join(igDir, orderLst);

              if (!fs.pathExistsSync(batTo)) {
                fs.copySync(batFrom, batTo);
              }

              if (!fs.pathExistsSync(ps1To)) {
                fs.copySync(ps1From, ps1To);
              }
              if (!fs.pathExistsSync(lstTo)) {
                fs.copySync(lstFrom, lstTo);
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
          }
        }

        pageNum++;
      }
    }
  }
}

const concurrency = 1;

for (let i = 0; i < concurrency; i++) {
  exports.igPosts();
}
