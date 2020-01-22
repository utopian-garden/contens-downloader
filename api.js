'use strict';

const http = require('http');
var url = require('url');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const config = require('./config/app-config.json');

const server = http.createServer(async (req, res) => {
  const uri = url.parse(req.url).pathname;
  const addItemUri = config.api.addItemUri;

  if (req.method === 'OPTIONS') {
    // Chrome の CORS 回避
    res.writeHead(200, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST',
      'Access-Control-Allow-Headers':'content-type'
    });
    res.end();
  } else if (req.method === 'POST' && uri === addItemUri) {
    let body = '';
    req.on('data', data => {
      body += data;
    });
    req.on('end', async () => {
      const reqJson = JSON.parse(body);
      const reqTable = reqJson.table;
      const reqTag = reqJson.tag;

      // レスポンスヘッダ
      res.writeHead(200, {'Content-Type': 'application/json;charset=utf-8'});

      // DB更新
      const ddbUpdate = async (reqTable, reqTag) => {
        const updateParams = {
          TableName: reqTable,
          Key: {
            'tag': reqTag
          }
        };
        await ddb.updateItem(updateParams)
          .then(() => {
            // レスポンスボディ
            res.write(JSON.stringify({'success': true, 'table': reqTable, 'tag': reqTag}));
            console.log(updateParams);
          })
          .catch(err => {
            // エラー時のレスポンスボディ
            res.write(JSON.stringify({'success': false, 'table': reqTable, 'tag': reqTag}));
            console.log(JSON.stringify(err));
          });
      }

      // 入力チェックして実行
      const tagTable = config.ddb.tagTable;
      const favTable = config.ddb.favTable;
      switch (reqTable) {
        case tagTable:
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
        case tagTable:
          const priorTagQueueUrl = config.sqs.priorTagQueueUrl;
          await sendMessage(priorTagQueueUrl, reqTag);
          break;
        case favTable:
          const priorFavQueueUrl = config.sqs.priorFavQueueUrl;
          await sendMessage(priorFavQueueUrl, reqTag);
          break;
        default:
          break;
      }

      res.end();
    });
  } else {
    // リクエストの例外処理
    const exceptionMsg = config.api.exceptionMsg;
    res.writeHead(400, {'Content-Type': 'application/json;charset=utf-8'});
    res.write(JSON.stringify({'success': false, 'status': exceptionMsg}));
    res.end();
  }
});

server.listen(3000);
console.log('API Server started.');
