'use strict';

const fs = require('fs-extra');
const path = require('path');
const sanitize = require('sanitize-filename');
const log4js = require('log4js');
log4js.configure('./config/fav-log-config.json');
const req = require('./lib/req');
const ddb = require('./lib/ddb');
const sqs = require('./lib/sqs');
const appConfig = require('./config/app-config.json');

// Fav DB の修正処理
exports.favConfirm = async () => {
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
      // *
      const tagKey = tagMsg.tag;

      let pageNum = 1;
      const conSearchParam = appConfig.req.search.conSearchParam;

      // ページ数でループ
      page_loop:
      while (2 > pageNum) {
        console.log(tagKey, pageNum);

        // 検索リクエスト
        let searchRes;
        try {
          searchRes = await req.searchPost(encodeURIComponent(tagKey), pageNum,
              conSearchParam, authToken);
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
            case 408:
                console.log(err.message);
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

          // 検索結果でループ
          for (let item of searchRes) {
            for (let tag of item.tags) {
              if (tag.name_ja === tagKey && tag.name_en !== tagKey && tag.name_en !== null) {

                // DB に追加
                const favTable = appConfig.db.tab.favTable;
                const lastAttr = appConfig.db.attr.lastAttr;
                const updParams = {
                  TableName: favTable,
                  Key: {
                    'tag': tag.name_en
                  },
                  ExpressionAttributeNames: {
                    '#l': lastAttr
                  },
                  ExpressionAttributeValues: {
                    ':newLast': 0
                  },
                  UpdateExpression: 'SET #l = :newLast'
                };

                try {
                  await ddb.updateItem(updParams);
                } catch(err) {
                  console.log(JSON.stringify(err));
                }

                // フォルダのリネーム
                const enIgDir = path.join(appConfig.fs.igDir, sanitize(tag.name_en));
                const enIgHistDir = path.join(appConfig.fs.igHistDir, sanitize(tag.name_en));
                const jaIgDir = path.join(appConfig.fs.igDir, sanitize(tag.name_ja));
                const jaIgHistDir = path.join(appConfig.fs.igHistDir, sanitize(tag.name_ja));

                if (fs.pathExistsSync(jaIgDir)) {
                  fs.moveSync(jaIgDir, enIgDir, { overwrite: true });
                }

                if (fs.pathExistsSync(jaIgHistDir)) {
                  fs.moveSync(jaIgHistDir, enIgHistDir, { overwrite: true });
                }

                // DB から削除
                const delParams = {
                  TableName: favTable,
                  Key: {
                    'tag': tag.name_ja
                  }
                };

                try {
                  await ddb.deleteItem(delParams);
                } catch(err) {
                  console.log(JSON.stringify(err));
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
  exports.favConfirm();
}
