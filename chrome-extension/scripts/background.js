// addItem リクエストの発行
const addRequest = (info, addTab) => {
  const tagKey = decodeURIComponent(info.linkUrl.split('=').pop().split('+').shift());

  fetch('http://localhost:3000/addItem', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': addTab,
      'tag': tagKey
    }),
  });
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
