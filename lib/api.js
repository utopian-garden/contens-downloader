'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const http = require('http');
const log4js = require('log4js');
const path = require('path');
const qs = require('querystring');
const sanitize = require('sanitize-filename');
const url = require('url');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// ライブラリ
const ddb = require('./ddb');
const organize = require('./organize');
const refill = require('./refill');
const sqs = require('./sqs');
const assign = require('./assign');

// 設定ファイル
const appConfig = require('../config/app-config.json');

const server = http.createServer(async (req, res) => {
  // 初期化
  log4js.configure('./config/api-log-config.json');
  const logger = log4js.getLogger('system');

  const reqUri = url.parse(req.url);
  const reqApi = reqUri.pathname;
  const dlTable = appConfig.db.tab.dlTable;
  const favTable = appConfig.db.tab.favTable;
  let reqTag;
  let reqTable;

  if (req.method === 'OPTIONS') {
    // Chrome の CORS 回避
    res.writeHead(200, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET,POST',
      'Access-Control-Allow-Headers':'content-type'
    });
    res.end();
  } else if (req.method === 'GET') {
    const chkDbUri = appConfig.api.uri.chkDbUri;
    const reqQuery = qs.parse(reqUri.query);
    reqTag = reqQuery.tag;

    switch (reqApi) {
      // DB チェックの処理
      case chkDbUri:
        const tagAttr = appConfig.db.attr.tagAttr;
        try {
          const dlItems = await ddb.queryItem(dlTable, tagAttr, reqTag);
          const favItems = await ddb.queryItem(favTable, tagAttr, reqTag);
          let resTable;

          if (dlItems.Items.length > favItems.Items.length) {
            resTable = dlTable;
          } else if (favItems.Items.length > dlItems.Items.length) {
            resTable = favTable;
          } else {
            resTable = 'None'
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'success': true, 'table': resTable, 'tag': reqTag
          }));
        } catch(err) {
          console.error('chkDbUri', err.message);
          logger.error('chkDbUri', err.message);

          res.writeHead(503, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'success': false, 'tag': reqTag
          }));
        }

        break;

      // リクエストの例外処理
      default:
        const exceptMsg = appConfig.api.uri.exceptMsg;
        res.writeHead(400, {
          'Access-Control-Allow-Origin':'*',
          'Content-Type': 'application/json;charset=utf-8'
        });
        res.write(JSON.stringify({
          'success': false, 'status': exceptMsg
        }));
        res.end();

        break;
    }

    res.end();
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', data => {
      body += data;
    });
    req.on('end', async () => {
      let reqBody;
      try {
        reqBody = JSON.parse(body);
      } catch(err) {
        reqBody = '';
      }
      const addItemUri = appConfig.api.uri.addItemUri;
      const refillUri = appConfig.api.uri.refillUri;
      const assignUri = appConfig.api.uri.assignUri;
      const organizeUri = appConfig.api.uri.organizeUri;
      const getLinkUri = appConfig.api.uri.getLinkUri;
      let msgBody;

      switch (reqApi) {
        // アイテムの追加/削除処理
        case addItemUri:
          let oppTable;
          reqTable = reqBody.table;
          reqTag = reqBody.tag;

          // 入力チェック
          switch (reqTable) {
            // Favorite テーブルの更新と Download テーブルの削除
            case favTable:
              oppTable = dlTable;
              try {
                await ddb.addItem(reqTable, reqTag);
                await ddb.deleteItem(oppTable, reqTag);

                res.writeHead(200, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': true, 'table': reqTable, 'tag': reqTag
                }));
              } catch(err) {
                console.error('addItemUri', err.message);
                logger.error('addItemUri', err.message);

                res.writeHead(503, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': false, 'tag': reqTag
                }));
              }

              // MQ のリクエストキューにメッセージを送信
              const priorFavQueUrl = appConfig.mq.url.priorFavQueUrl;
              msgBody = JSON.stringify({"tag": reqTag, "last":"0"});
              await sqs.sendMsg(priorFavQueUrl, msgBody);

              // Favorite に登録する場合は既存の DL フォルダを削除
              const tagDir = path.join(appConfig.fs.dlDir, sanitize(reqTag));
              const tagOkDir = path.join(appConfig.fs.dlOkDir, sanitize(reqTag));
              try {
                fs.removeSync(tagDir);
                fs.removeSync(tagOkDir);
              } catch(err) {
                console.error('addItemUri', err.message);
                logger.error('addItemUri', err.message);
              }

              break;

            // Download テーブルの更新と Favorite テーブルの削除
            case dlTable:
              oppTable = favTable;
              try {
                await ddb.addItem(reqTable, reqTag);
                await ddb.deleteItem(oppTable, reqTag);

                res.writeHead(200, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': true, 'table': reqTable, 'tag': reqTag
                }));
              } catch(err) {
                console.error('addItemUri', err.message);
                logger.error('addItemUri', err.message);

                res.writeHead(503, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': false, 'tag': reqTag
                }));
              }

              // MQ のリクエストキューにメッセージを送信
              const priorDlQueUrl = appConfig.mq.url.priorDlQueUrl;
              msgBody = JSON.stringify({"tag": reqTag, "last":"0"});
              await sqs.sendMsg(priorDlQueUrl, msgBody);

              // Download に登録する場合は既存の Ignored フォルダを削除
              const igDir = path.join(appConfig.fs.igDir, sanitize(reqTag));
              const igNgDir = path.join(appConfig.fs.igNgDir, sanitize(reqTag));
              try {
                fs.removeSync(igDir);
                fs.removeSync(igNgDir);
              } catch(err) {
                console.error('addItemUri', err.message);
                logger.error('addItemUri', err.message);
              }

              break;
          }

          break;

        // MQ のリクエストキューにメッセージを補充
        case refillUri:
          reqTable = reqBody.table;
          try {
            await refill.mqRefill(reqTable);
          } catch(err) {
            console.error('refillUri', err.message);
            logger.error('refillUri', err.message);
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true, 'table': reqTable
          }));

          break;

        // タグの昇格/降格
        case assignUri:
          try {
            await assign.tagAssign();
          } catch(err) {
            console.error('assignUri', err.message);
            logger.error('assignUri', err.message);
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true
          }));

          break;

        // ファイルの整理
        case organizeUri:
          try {
            await organize.fileOrganize();
          } catch(err) {
            console.error('organizeUri', err.message);
            logger.error('organizeUri', err.message);
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true
          }));

          break;

        // リンク URL の一括取得
        case getLinkUri:
          const linkUrl = reqBody.url;
          logger.debug(linkUrl);

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true
          }));

          break;

        // リクエストの例外処理
        default:
          const exceptMsg = appConfig.api.msg.exceptMsg;
          res.writeHead(400, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'success': false, 'status': exceptMsg
          }));
          res.end();

          break;
      }

      res.end();
    });
  } else {
    // リクエストの例外処理
    const exceptMsg = appConfig.api.msg.exceptMsg;
    res.writeHead(400, {
      'Access-Control-Allow-Origin':'*',
      'Content-Type': 'application/json;charset=utf-8'
    });
    res.write(JSON.stringify({
      'success': false, 'status': exceptMsg
    }));
    res.end();
  }
});

// サーバ起動
server.listen(3000);
const startMsg = appConfig.api.msg.startMsg;
console.info(startMsg);
