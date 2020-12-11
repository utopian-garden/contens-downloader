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
const walk = require('./walk');

// 設定ファイル
const appConfig = require('../config/app-config.json');

// ポストのダウンロード処理
exports.extraDlPosts = async (dlType) => {
  const igTab = appConfig.db.tab.igTable;
  const artTab = appConfig.db.tab.artTable;
  const stuTab = appConfig.db.tab.stuTable;

  let quePoll;
  let queUrl;
  let tabName;
  let typeDir;
  let typeOkDir;
  let typeNgDir;
  let tagMsg;
  switch (dlType) {
    case igTab:
      log4js.configure('./config/dl-ig-log-config.json');
      tabName = appConfig.db.tab.favTable;
      queUrl = appConfig.mq.url.igQueUrl;
      quePoll = appConfig.mq.poll.igQuePoll;
      typeDir = appConfig.fs.igDir;
      typeOkDir = appConfig.fs.igOkDir;
      typeNgDir = appConfig.fs.igNgDir;
      break;
    case artTab:
      log4js.configure('./config/dl-art-log-config.json');
      tabName = appConfig.db.tab.artTable;
      queUrl = appConfig.mq.url.artQueUrl;
      quePoll = appConfig.mq.poll.artQuePoll;
      typeDir = appConfig.fs.artDir;
      typeOkDir = appConfig.fs.artOkDir;
      typeNgDir = appConfig.fs.artNgDir;
      break;
    case stuTab:
      log4js.configure('./config/dl-stu-log-config.json');
      tabName = appConfig.db.tab.stuTable;
      queUrl = appConfig.mq.url.stuQueUrl;
      quePoll = appConfig.mq.poll.stuQuePoll;
      typeDir = appConfig.fs.stuDir;
      typeOkDir = appConfig.fs.stuOkDir;
      typeNgDir = appConfig.fs.stuNgDir;
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
    try {
      tagMsg = await sqs.recvMsg(queUrl);
    } catch(err) {
      logger.error('recvMsg', err);
    }

    // メッセージが取得できない場合は待機
    const waitingMsg = appConfig.mq.msg.waitingMsg;
    if (tagMsg === undefined) {
      console.info(waitingMsg);
      const waitMsg = (quePoll) => {
        return new Promise((resolve, reject) => {
          setTimeout(resolve, quePoll * 1000);
        });
      };
      await waitMsg(quePoll);
    } else {
      // DB の整合性チェック
      const tagAttr = appConfig.db.attr.tagAttr;
      const tagKey = tagMsg.tag;
      let tabItems;
      try {
        tabItems = await ddb.queryItem(tabName, tagAttr, tagKey);
      } catch(err) {
        logger.error('queryItem', JSON.stringify(err));
        continue;
      }

      if (tabItems.Items.length === 0) {
        continue;
      }

      // ページ数でループ
      let pageNum = 1;
      const searchParam = appConfig.req.search.exSearchParam;
      const exDir = path.join(typeDir, sanitize(tagKey));
      const exOkDir = path.join(typeOkDir, sanitize(tagKey));
      const exNgDir = path.join(typeNgDir, sanitize(tagKey));
      const exFiles = await walk.walkFileSync(exDir);
      const exOkFiles = await walk.walkFileSync(exOkDir);
      const exNgFiles = await walk.walkFileSync(exNgDir);

      page_loop:
      while (2 > pageNum) {
        console.info(tagKey, pageNum);

        // 検索リクエスト
        let searchRes;
        try {
          searchRes = await req.searchPost(encodeURIComponent(tagKey), pageNum,
              searchParam, authToken);
        } catch(err) {
          if ('response.status' in err) {
            switch (err.response.status) {
              case 401:
                console.error('searchPost', err.message);
                try {
                  authToken = await req.getToken();
                } catch(err) {
                  logger.error('searchPost', err.message);
                }
                continue;

              case 400:
              case 408:
                logger.error('searchPost', err.message);
                break page_loop;

              case 502:
                console.error('searchPost', err.message);
                continue;

              default:
                logger.error('searchPost', err.message);
                continue;
            }
          } else {
            logger.error('searchPost', err.message);
            continue;
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
            const postId = item.id;

            // ファイル名の整形
            const fileUrl = item.file_url;
            const extension = fileUrl.split('/').pop().split('?').shift()
                .split('.').pop();
            const fileName = postId + '.' + extension;
            const filePath = path.join(exDir, fileName);

            // ファイルの存在と NG チェック
            const ngId = appConfig.ng.ngId;
            if (ngId.includes(postId) ||
                exFiles.includes(fileName) ||
                exOkFiles.includes(fileName) ||
                exNgFiles.includes(fileName)) {

              continue;
            }

            // ディレクトリの作成
            fs.ensureDirSync(exDir);

            // ダウンロード リクエスト
            const refererUrl = appConfig.req.dl.refererUrl + postId;
            try {
              await req.dlContent(filePath, fileUrl, refererUrl);
            } catch(err) {
              if ('response.status' in err) {
                switch (err.response.status) {
                  case 404:
                    break;
                  default:
                    logger.error('dlContent', err.message);
                    continue page_loop;
                }
              } else {
                logger.error('dlContent', err.message);
                continue;
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
const dlType = process.argv[2];

if (dlType !== undefined && dlType) {
  for (let i = 0; i < concurrency; i++) {
    exports.extraDlPosts(dlType);
  }
} else {
  console.info('Usage: node ' + path.basename(process.argv[1]) +
      ' <Download Type (Ignore/Artist/Studio)>');
}
