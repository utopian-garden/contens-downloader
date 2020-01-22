'use strict';

const fs = require('fs-extra');
const path = require('path');
const log4js = require('log4js');
log4js.configure('./config/dl-log-config.json');
const req = require('./lib/req.js');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const walk = require('./lib/walk.js');
const config = require('./config/app-config.json');

exports.dlPosts = async () => {
  // log4js のイニシャライズ
  const logger = log4js.getLogger('system');

  // ループ処理開始
  while (true) {
    // 優先キューからメッセージを取得
    const priorTagQueueUrl = config.sqs.priorTagQueueUrl;
    const recvParams = {
      QueueUrl: priorTagQueueUrl,
    };
    let message = await sqs.recvMsg(recvParams);

    // 通常キューからメッセージを取得
    const tagQueueUrl = config.sqs.tagQueueUrl;
    if (message === undefined) {
      const recvParams = {
        QueueUrl: tagQueueUrl,
      };
      message = await sqs.recvMsg(recvParams);
    }
  
    const tagTable = config.ddb.tagTable;
    if (message === undefined) {
      // 取得できなかった場合は通常キューにメッセージを補充

      // DBスキャン
      const searchParams = {
        TableName: tagTable,
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
          QueueUrl: tagQueueUrl,
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
          continue;
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

            // ファイル名の整形
            const file_url = jsonSearch[i].file_url;
            const extension = file_url.split('/').pop().split('?').shift()
                .split('.').pop();
            const file_name = post_id + '.' + extension;
            const tag_dir = path.join(config.fs.dlDir, tag);
            const hist_dir = path.join(config.fs.histDir, tag);
            const file_path = path.join(tag_dir, file_name);

            // ファイルの存在チェック
            if (!await walk.walkExistsSync(tag_dir, file_name) &&
                !await walk.walkExistsSync(hist_dir, file_name)) {

              // ディレクトリの作成
              fs.ensureDirSync(tag_dir);

              // テンプレートファイルの配布
              const toolDir = config.fs.toolDir;
              const orderFile = config.fs.orderFile;
              const listFile = config.fs.listFile;
              const order_from = path.join(toolDir, orderFile);
              const order_to = path.join(tag_dir, orderFile);
              const list_from = path.join(toolDir, listFile);
              const list_to = path.join(tag_dir, listFile);

              if (!fs.pathExistsSync(order_to)) {
                fs.copySync(order_from, order_to);
              }

              if (!fs.pathExistsSync(list_to)) {
                fs.copySync(list_from, list_to);
              }

              // ダウンロード リクエスト
              const referrerUrl = config.req.dl.referrerUrl;
              const referrer = referrerUrl + post_id;
              
              try {
                await req.dlContent(file_path, file_url, referrer);
                console.log(post_id);
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
          TableName: tagTable,
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
  exports.dlPosts();
}
