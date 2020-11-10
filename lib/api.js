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
const organize = require('./file-organize');
const refill = require('./mq-refill');
const sqs = require('./sqs');

// 設定ファイル
const appConfig = require('../config/app-config.json');
log4js.configure('./config/api-log-config.json');

const server = http.createServer(async (req, res) => {
  const logger = log4js.getLogger('system');
  const reqUri = url.parse(req.url);
  const reqApi = reqUri.pathname;
  const reqQuery = qs.parse(reqUri.query);
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
    reqTag = reqQuery.tag;

    switch (reqApi) {
      // DBチェックの処理
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
      const reqBody = JSON.parse(body);
      const addItemUri = appConfig.api.uri.addItemUri;
      const refillUri = appConfig.api.uri.refillUri;
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

                res.writeHead(503, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': false, 'tag': reqTag
                }));
              }

              // MQのリクエストキューにメッセージを送信
              const priorFavQueUrl = appConfig.mq.url.priorFavQueUrl;
              await sendMessage(priorFavQueUrl, reqTag);

              // Favorite に登録する場合は既存のDLフォルダを削除
              const tagDir = path.join(appConfig.fs.dlDir, sanitize(reqTag));
              const tagHistDir = path.join(appConfig.fs.dlHistDir, sanitize(reqTag));
              try {
                fs.removeSync(tagDir);
                fs.removeSync(tagHistDir);
              } catch(err) {
                console.log(err);
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

                res.writeHead(503, {
                  'Access-Control-Allow-Origin':'*',
                  'Content-Type': 'application/json;charset=utf-8'
                });
                res.write(JSON.stringify({
                  'success': false, 'tag': reqTag
                }));
              }

              // MQのリクエストキューにメッセージを送信
              const priorDlQueUrl = appConfig.mq.url.priorDlQueUrl;
              await sendMessage(priorDlQueUrl, reqTag);

              // Download に登録する場合は既存の Ignored フォルダを削除
              const igDir = path.join(appConfig.fs.igDir, sanitize(reqTag));
              const igHistDir = path.join(appConfig.fs.igHistDir, sanitize(reqTag));
              try {
                fs.removeSync(igDir);
                fs.removeSync(igHistDir);
              } catch(err) {
                console.log(err);
              }

              break;
          }

          break;

        // MQのリクエストキューにメッセージを補充
        case refillUri:
          reqTable = reqBody.table;
          refill.mqRefill(reqTable)
            .catch(err => {
              console.log(err);
            });

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true, 'table': reqTable
          }));

          break;

        // ファイルの整理
        case organizeUri:
          organize.fileOrganize()
            .catch(err => {
              console.log(err);
            });

          res.writeHead(200, {
            'Access-Control-Allow-Origin':'*',
            'Content-Type': 'application/json;charset=utf-8'
          });
          res.write(JSON.stringify({
            'accept': true
          }));

          break;

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

// DB検索
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
    console.log(JSON.stringify(err));
    throw err;
  }
};

// DB更新
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
    console.log(JSON.stringify(err));
    throw err;
  }
}

// DB削除
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
    console.log(JSON.stringify(err));
    throw err;
  }
}

// MQ送信
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
    console.log(err);
  }
}

// サーバ起動
server.listen(3000);
const startMsg = appConfig.api.msg.startMsg;
console.log(startMsg);