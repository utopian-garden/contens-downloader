chrome.contextMenus.create({
  title: "Download",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    const xhr = new XMLHttpRequest();
    const url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tag = decodeURI(info.linkUrl.split('=').pop().split('+').shift());
    xhr.send(JSON.stringify({'table':'Download', 'tag':tag}));
  }
});

chrome.contextMenus.create({
  title: "Favorite",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    const xhr = new XMLHttpRequest();
    const url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tag = decodeURI(info.linkUrl.split('=').pop().split('+').shift());
    xhr.send(JSON.stringify({'table':'Favorite', 'tag':tag}));
  }
});
