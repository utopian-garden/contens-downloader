'use strict';

const fs = require('fs-extra');
const rp = require('request-promise');
const config = require('../config/app-config.json');

exports.getToken = async () => {
  const userAgent = config.req.common.userAgent;
  const authUrl = config.req.auth.authUrl;
  const username = config.req.auth.username;
  const password = config.req.auth.password;
  const authPrefix = config.req.auth.authPrefix;

  const authOptions = {
    method: 'POST',
    uri: authUrl,
    headers: {
      'User-Agent': userAgent
    },
    json: {
      login: username,
      password: password
    }
  };

  try {
    return authPrefix + (await rp(authOptions)).access_token;
  } catch(err) {
    throw err;
  }
}

exports.searchPost = async (tag, page, authToken) => {
  const userAgent = config.req.common.userAgent;
  const searchUrl = config.req.search.searchUrl;
  const searchParam = config.req.search.searchParam;

  const searchOptions = {
    method: 'GET',
    uri: searchUrl + encodeURI(tag) + searchParam + page,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    return JSON.parse(await rp(searchOptions));
  } catch(err) {
    throw err;
  }
}

exports.favPost = async (post_id, authToken) => {
  const userAgent = config.req.common.userAgent;
  const favUrl = config.req.fav.favUrl;
  const favParam = config.req.fav.favParam;

  const favOptions = {
    method: 'POST',
    uri: favUrl + post_id + favParam,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    console.log(await rp(favOptions));
  } catch(err) {
    throw err;
  }
}

exports.votePost = async (post_id, authToken) => {
  const userAgent = config.req.common.userAgent;
  const voteUrl = config.req.vote.voteUrl;
  const voteParam = config.req.vote.voteParam;

  const voteOptions = {
    method: 'DELETE',
    uri: voteUrl + post_id + voteParam,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    },
  };

  try {
    console.log(await rp(voteOptions));
  } catch(err) {
    throw err;
  }
}

exports.dlContent = async (file_path, file_url, referrer) => {
  const userAgent = config.req.common.userAgent;

  const dlOptions = {
    method: 'GET',
    uri: file_url,
    encoding: null,
    headers: { 
      'User-Agent': userAgent,
      'Referer': referrer
    }
  };

  try {
    fs.outputFileSync(file_path, await rp(dlOptions));
  } catch(err) {
    throw err;
  }
}
