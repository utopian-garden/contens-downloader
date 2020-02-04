'use strict';

const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const url = require('url');
const qs = require('querystring')
const ddb = require('./lib/ddb.js');
const dbCheck = require('./lib/db-check.js')
const sqs = require('./lib/sqs.js');
const appConfig = require('./config/app-config.json');

const server = http.createServer(async (req, res) => {
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
    const chkDbUri = appConfig.api.chkDbUri;
    reqTag = reqQuery.tag;

    switch (reqApi) {
      // DBチェックの処理
      case chkDbUri:
        try {
          const resTable = await dbCheck.checkTag(reqTag);

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

      default:
        // リクエストの例外処理
        const exceptMsg = appConfig.api.exceptMsg;
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
      const addItemUri = appConfig.api.addItemUri;
      reqTable = reqBody.table;
      reqTag = reqBody.tag;

      switch (reqApi) {
        // アイテムの追加/削除処理
        case addItemUri:
          // 入力チェック
          let oppTable;

          switch (reqTable) {
            case favTable:
              // DBの更新/削除
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

              // MQのリクエストキューに送信
              const priorFavQueUrl = appConfig.mq.url.priorFavQueUrl;
              await sendMessage(priorFavQueUrl, reqTag);

              // Favorite に登録する場合は既存のDLフォルダを削除
              const dlDir = appConfig.fs.dlDir;
              const histDir = appConfig.fs.histDir;
              try {
                fs.removeSync(path.join(dlDir, reqTag));
                fs.removeSync(path.join(histDir, reqTag));
              } catch(err) {
                console.log(err);
              }

              break;

            case dlTable:
              // DBの更新/削除
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

              // MQのリクエストキューに送信
              const priorDlQueUrl = appConfig.mq.url.priorDlQueUrl;
              await sendMessage(priorDlQueUrl, reqTag);

              break;
          }

          break;

        default:
          // リクエストの例外処理
          const exceptMsg = appConfig.api.exceptMsg;
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
    const exceptMsg = appConfig.api.exceptMsg;
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
console.log('API Server started.');
