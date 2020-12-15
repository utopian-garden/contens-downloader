'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const log4js = require('log4js');
const path = require('path');
const sanitize = require('sanitize-filename');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

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
  let conOkNgDir;
  switch (confirmType) {
    case dlTab:
      log4js.configure('./config/con-dl-log-config.json');
      queUrl = appConfig.mq.url.dlQueUrl;
      quePoll = appConfig.mq.poll.dlQuePoll;
      tabName  = appConfig.db.tab.dlTable;
      conDir = appConfig.fs.dlDir
      conOkNgDir = appConfig.fs.dlOkDir
      break;
    case favTab:
      log4js.configure('./config/con-fav-log-config.json');
      queUrl = appConfig.mq.url.favQueUrl;
      quePoll = appConfig.mq.poll.favQuePoll;
      tabName = appConfig.db.tab.favTable;
      conDir = appConfig.fs.igDir
      conOkNgDir = appConfig.fs.igNgDir
      break;
  }

  // 初期化
  const logger = log4js.getLogger('system');

  // 認証リクエスト
  let authToken;
  try {
    authToken = await req.getToken();
  } catch(err) {
    logger.error('getToken', err.message);
  }

  // ループ処理開始
  while (true) {
    // 通常キューからメッセージを取得
    if (tagMsg === undefined) {
      try {
        tagMsg = await sqs.recvMsg(queUrl);
      } catch(err) {
        logger.error('recvMsg', err.message);
      }
    }

    // メッセージが取得できない場合は待機
    if (tagMsg === undefined) {
      const waitingMsg = appConfig.mq.msg.waitingMsg;
      console.info(waitingMsg);
      const waitMsg = (quePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, quePoll * 1000);
        });
      };
      await waitMsg(quePoll);
    } else {
      // 半角のみの場合はスキップ
      const tagKey = tagMsg.tag;
      if (tagKey.match(/^[\x20-\x7e]*$/)) {
        continue;
      }

      // ページ数でループ
      let pageNum = 1;

      page_loop:
      while (2 > pageNum) {
        console.info(tagKey, pageNum);

        // 検索リクエスト
        const conSearchParam = appConfig.req.search.conSearchParam;
        let searchRes;
        try {
          searchRes = await req.searchPost(encodeURIComponent(tagKey), pageNum,
              conSearchParam, authToken);
        } catch(err) {
          if (err.response) {
            switch (err.response.status) {
              case 401:
                console.error('searchPost', tagKey, pageNum, err.response.status);
                try {
                  authToken = await req.getToken();
                } catch(err) {
                  logger.error('getToken', err.message);
                }
                continue page_loop;

              case 400:
              case 408:
              case 504:
                logger.error('searchPost', tagKey, pageNum, err.response.status);
                break page_loop;

              case 502:
                console.error('searchPost', tagKey, pageNum, err.response.status);
                continue page_loop;

              default:
                logger.error('searchPost', tagKey, pageNum, err.response.status);
                continue page_loop;
            }
          } else {
            logger.error('searchPost', tagKey, pageNum, err.message);
            continue page_loop;
          }
        }

        // 続行条件のチェック
        if (searchRes) {
          if (searchRes.length === 0) {
            break;
          }

          // 検索結果でループ
          for (let item of searchRes) {
            for (let tag of item.tags) {
              if (tag.name_ja === tagKey && tag.name_en !== tagKey &&
                  tag.name_en !== null) {

                // DB に追加
                const lastAttr = appConfig.db.attr.lastAttr;
                try {
                  await ddb.updateItem(tabName, lastAttr, tag.name_en, 0);
                } catch(err) {
                  logger.error('updateItem', JSON.stringify(err));
                }

                // フォルダのリネーム
                const enDir = path.join(conDir, sanitize(tag.name_en));
                const jaDir = path.join(conDir, sanitize(tag.name_ja));
                if (fs.pathExistsSync(jaDir)) {
                  fs.moveSync(jaDir, enDir, { overwrite: true });
                }

                const enOkNgDir = path.join(conOkNgDir, sanitize(tag.name_en));
                const jaOkNgDir = path.join(conOkNgDir, sanitize(tag.name_ja));
                if (fs.pathExistsSync(jaOkNgDir)) {
                  fs.moveSync(jaOkNgDir, enOkNgDir, { overwrite: true });
                }

                // DB から削除
                try {
                  await ddb.deleteItem(tabName, tag.name_ja);
                } catch(err) {
                  logger.error('deleteItem', JSON.stringify(err));
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

if (confirmType) {
  for (let i = 0; i < concurrency; i++) {
    exports.dbConfirm(confirmType);
  }
} else {
  console.info('Usage: node ' + path.basename(process.argv[1]) +
      ' <confirmType (Download/Favorite)>');
}
