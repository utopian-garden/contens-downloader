chrome.contextMenus.create({
  title: "Tag",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    const xhr = new XMLHttpRequest();
    const url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tag = decodeURI(info.linkUrl.split('=').pop().split('+').shift());
    xhr.send(JSON.stringify({'table':'Tag', 'tag':tag}));
  }
});

chrome.contextMenus.create({
  title: "Fav",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    const xhr = new XMLHttpRequest();
    const url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tag = decodeURI(info.linkUrl.split('=').pop().split('+').shift());
    xhr.send(JSON.stringify({'table':'Fav', 'tag':tag}));
  }
});
