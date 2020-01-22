# contens-downloader
Contents Download System with DynamoDB and ElasticMQ (For my study)

[Description]
 The API server receives the keyword request from the Chrome extension.
 The API server gets the keyword from it and puts it into the DB and MQ.

 Downloader gets keywords from DB and puts them into MQ. (If MQ is empty)
 Downloader gets the keyword from MQ again, and searches on the contents site.
 Downloader downloads search result contents. (When the content is not duplicated)

 Even if Downloader run multiply, requests are processed sequentially because of the benefits of MQ.

[Environment]
 Node.js (12.14.0)
 DynamoDB Local (1.11.477)
 ElasticMQ (0.7.1)
