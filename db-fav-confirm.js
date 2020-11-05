'use strict';

const fs = require('fs-extra');
const path = require('path');
const sanitize = require('sanitize-filename');
const log4js = require('log4js');
log4js.configure('./config/fav-log-config.json');
const req = require('./lib/req');
const ddb = require('./lib/ddb');
const sqs = require('./lib/sqs');
const walk = require('./lib/walk');
const appConfig = require('./config/app-config.json');

// ポストのダウンロード処理
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

          // 検索結果でループ
          for (let item of searchRes) {
            for (let tag of item.tags) {
              if (tag.name_en === tagKey && tag.name_ja !== tagKey && tag.name_ja !== "null") {
                logger.debug(tag.name_en, tag.name_ja);
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
