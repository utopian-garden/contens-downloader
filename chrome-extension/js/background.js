// addItem リクエストの発行
const addRequest = (info, addTab) => {
  const xhr = new XMLHttpRequest();
  const url = 'http://localhost:3000/addItem';
  xhr.open("POST", url);
  xhr.setRequestHeader("Content-Type", "application/json");
  const tagKey = decodeURI(info.linkUrl.split('=').pop().split('+').shift());
  xhr.send(JSON.stringify({'table':addTab, 'tag':tagKey}));
}

// コンテキストメニューの Download をクリックした場合
chrome.contextMenus.create({
  title: "Download",
  contexts: ["link"],
  type: "normal",
  onclick: info => {
    addRequest(info, 'Download');
  }
});

// コンテキストメニューの Favorite をクリックした場合
chrome.contextMenus.create({
  title: "Favorite",
  contexts: ["link"],
  type: "normal",
  onclick: info => {
    addRequest(info, 'Favorite');
  }
});
