'use strict';

const http = require('http');
var url = require('url');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const appConfig = require('./config/app-config.json');

const server = http.createServer(async (req, res) => {
  const reqUri = url.parse(req.url).pathname;
  const addItemUri = appConfig.api.addItemUri;

  if (req.method === 'OPTIONS') {
    // Chrome の CORS 回避
    res.writeHead(200, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST',
      'Access-Control-Allow-Headers':'content-type'
    });
    res.end();
  } else if (req.method === 'POST' && reqUri === addItemUri) {
    let body = '';
    req.on('data', data => {
      body += data;
    });
    req.on('end', async () => {
      const reqBody = JSON.parse(body);
      const reqTable = reqBody.table;
      const reqTag = reqBody.tag;

      // レスポンスヘッダ
      res.writeHead(200, {'Content-Type': 'application/json;charset=utf-8'});

      // DB更新
      const ddbUpdate = async (reqTable, reqTag) => {
        const updParams = {
          TableName: reqTable,
          Key: {
            'tag': reqTag
          }
        };
        await ddb.updateItem(updParams)
          .then(() => {
            // レスポンスボディ
            res.write(JSON.stringify({'success': true, 'table': reqTable, 'tag': reqTag}));
            console.log(updParams);
          })
          .catch(err => {
            // エラー時のレスポンスボディ
            res.write(JSON.stringify({'success': false, 'table': reqTable, 'tag': reqTag}));
            console.log(JSON.stringify(err));
          });
      }

      // 入力チェックして実行
      const dlTable = appConfig.ddb.dlTable;
      const favTable = appConfig.ddb.favTable;
      switch (reqTable) {
        case dlTable:
        case favTable:
          await ddbUpdate(reqTable, reqTag);
        default:
          break;
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

      // 入力チェックして実行
      switch (reqTable) {
        case dlTable:
          const priorDlQueUrl = appConfig.sqs.priorDlQueUrl;
          await sendMessage(priorDlQueUrl, reqTag);
          break;
        case favTable:
          const priorFavQueUrl = appConfig.sqs.priorFavQueUrl;
          await sendMessage(priorFavQueUrl, reqTag);
          break;
        default:
          break;
      }

      res.end();
    });
  } else {
    // リクエストの例外処理
    const exceptMsg = appConfig.api.exceptMsg;
    res.writeHead(400, {'Content-Type': 'application/json;charset=utf-8'});
    res.write(JSON.stringify({'success': false, 'status': exceptMsg}));
    res.end();
  }
});

server.listen(3000);
console.log('API Server started.');
