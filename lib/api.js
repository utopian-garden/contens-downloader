'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const http = require('http');
const log4js = require('log4js');
const path = require('path');
const qs = require('querystring');
const sanitize = require('sanitize-filename');
const url = require('url');

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
        try {
          const dlCount = await ddbCount(reqTag, dlTable);
          const favCount = await ddbCount(reqTag, favTable);
          let resTable = 'None';

          if (dlCount > favCount) {
            resTable = dlTable;
          } else if (favCount > dlCount) {
            resTable = favTable;
          }

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'success': true, 'table': resTable, 'tag': reqTag
          }));
        } catch(err) {
          console.log(err.message);
          logger.error(err.message);

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
                await ddbUpdate(reqTable, reqTag);
                await ddbDelete(oppTable, reqTag);

                res.writeHead(200, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': true, 'table': reqTable, 'tag': reqTag
                }));
              } catch(err) {
                console.log(err.message);
                logger.error(err.message);

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
              await sendMessage(priorFavQueUrl, reqTag);

              // Favorite に登録する場合は既存の DL フォルダを削除
              const tagDir = path.join(appConfig.fs.dlDir, sanitize(reqTag));
              const tagOkDir = path.join(appConfig.fs.dlOkDir, sanitize(reqTag));
              try {
                fs.removeSync(tagDir);
                fs.removeSync(tagOkDir);
              } catch(err) {
                console.log(err.message);
                logger.error(err.message);
              }

              break;

            // Download テーブルの更新と Favorite テーブルの削除
            case dlTable:
              oppTable = favTable;
              try {
                await ddbUpdate(reqTable, reqTag);
                await ddbDelete(oppTable, reqTag);

                res.writeHead(200, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': true, 'table': reqTable, 'tag': reqTag
                }));
              } catch(err) {
                console.log(err.message);
                logger.error(err.message);

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
              await sendMessage(priorDlQueUrl, reqTag);

              // Download に登録する場合は既存の Ignored フォルダを削除
              const igDir = path.join(appConfig.fs.igDir, sanitize(reqTag));
              const igNgDir = path.join(appConfig.fs.igNgDir, sanitize(reqTag));
              try {
                fs.removeSync(igDir);
                fs.removeSync(igNgDir);
              } catch(err) {
                console.log(err.message);
                logger.error(err.message);
              }

              break;
          }

          break;

        // MQ のリクエストキューにメッセージを補充
        case refillUri:
          reqTable = reqBody.table;
          refill.mqRefill(reqTable)
            .catch(err => {
              console.log(err.message);
              logger.error(err.message);
            });

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
          assign.tagAssign()
            .catch(err => {
              console.log(err.message);
              logger.error(err.message);
            });

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
          organize.fileOrganize()
            .catch(err => {
              console.log(err.message);
              logger.error(err.message);
            });

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

// DB 検索
const ddbCount = async (tagKey, reqTable) => {
  const tagAttr = appConfig.db.attr.tagAttr;
  const cntParams = {
    TableName: reqTable,
    ExpressionAttributeNames:{'#t': tagAttr},
    ExpressionAttributeValues:{':val': tagKey},
    KeyConditionExpression: '#t = :val'
  };

  try {
    let dbItems = await ddb.queryItem(cntParams);
    return dbItems.Items.length;
  } catch(err) {
    throw err;
  }
};

// DB 更新
const ddbUpdate = async (reqTable, reqTag) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.updateItem(updParams);
    console.log('update:' ,updParams);
  } catch(err) {
    throw err;
  }
}

// DB 削除
const ddbDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.deleteItem(delParams);
    console.log('delete:', delParams);
  } catch(err) {
    throw err;
  }
}

// MQ 送信
const sendMessage = async (queueUrl, reqTag) => {
  const sendParams = {
    MessageBody: JSON.stringify({"tag": reqTag, "last":"0"}),
    QueueUrl: queueUrl,
    DelaySeconds: 0,
  };

  try {
    await sqs.sendMsg(sendParams);
    console.log(sendParams);
  } catch(err) {
    throw err;
  }
}

// サーバ起動
server.listen(3000);
const startMsg = appConfig.api.msg.startMsg;
console.log(startMsg);
