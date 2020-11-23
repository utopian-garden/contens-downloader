'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const log4js = require('log4js');
const path = require('path');
const sanitize = require('sanitize-filename');

// ライブラリ
const ddb = require('./ddb');
const req = require('./req');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// DB のディレクトリの修正処理
exports.dbConfirm = async (confirmType) => {
  const dlTab = appConfig.db.tab.dlTable;
  const favTab = appConfig.db.tab.favTable;

  let queUrl;
  let quePoll;
  let tabName;
  let conDir;
  let conHistDir;
  switch (confirmType) {
    case dlTab:
      log4js.configure('./config/dl-log-config.json');
      queUrl = appConfig.mq.url.dlQueUrl;
      quePoll = appConfig.mq.poll.dlQuePoll;
      tabName  = appConfig.db.tab.dlTable;
      conDir = appConfig.fs.dlDir
      conHistDir = appConfig.fs.dlHistDir
      break;
    case favTab:
      log4js.configure('./config/fav-log-config.json');
      queUrl = appConfig.mq.url.favQueUrl;
      quePoll = appConfig.mq.poll.favQuePoll;
      tabName = appConfig.db.tab.favTable;
      conDir = appConfig.fs.igDir
      conHistDir = appConfig.fs.igHistDir
      break;
  }

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
    // 通常キューからメッセージを取得
    if (tagMsg === undefined) {
      const recvParams = {
        QueueUrl: queUrl,
      };

      try {
        tagMsg = await sqs.recvMsg(recvParams);
      } catch(err) {
        logger.error(err.message);
      }
    }

    // メッセージが取得できない場合は待機
    if (tagMsg === undefined) {
      const waitingMsg = appConfig.mq.msg.waitingMsg;
      console.log(waitingMsg);
      const waitMsg = (quePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, quePoll * 1000);
        });
      };
      await waitMsg(quePoll);
    } else {
      const conSearchParam = appConfig.req.search.conSearchParam;
      const tagKey = tagMsg.tag;
      let pageNum = 1;

      // 半角のみの場合はスキップ
      if (tagKey.match(/^[\x20-\x7e]*$/)) {
        continue;
      }

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
                logger.error(tagKey, err.message);
              }
              continue;

            case 400:
            case 408:
              logger.error(tagKey, err.message);
              break page_loop;

            default:
              logger.error(tagKey, err.message);
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
                const lastAttr = appConfig.db.attr.lastAttr;
                const updParams = {
                  TableName: tabName,
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
                  logger.error(JSON.stringify(err));
                }

                // フォルダのリネーム
                const enDir = path.join(conDir, sanitize(tag.name_en));
                const enHistDir = path.join(conHistDir, sanitize(tag.name_en));
                const jaDir = path.join(conDir, sanitize(tag.name_ja));
                const jaHistDir = path.join(conHistDir, sanitize(tag.name_ja));

                if (fs.pathExistsSync(jaDir)) {
                  fs.moveSync(jaDir, enDir, { overwrite: true });
                }

                if (fs.pathExistsSync(jaHistDir)) {
                  fs.moveSync(jaHistDir, enHistDir, { overwrite: true });
                }

                // DB から削除
                const delParams = {
                  TableName: tabName,
                  Key: {
                    'tag': tag.name_ja
                  }
                };

                try {
                  await ddb.deleteItem(delParams);
                } catch(err) {
                  logger.error(JSON.stringify(err));
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

// メイン処理の起動
const concurrency = 1;
const confirmType = process.argv[2];

if (confirmType !== undefined && confirmType) {
  for (let i = 0; i < concurrency; i++) {
    exports.dbConfirm(confirmType);
  }
} else {
  console.log('Usage: node ' + path.basename(process.argv[1]) + ' <confirmType (Download/Favorite)>');
}
