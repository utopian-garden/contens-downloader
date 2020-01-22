chrome.contextMenus.create({
  title: "Tag",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    let xhr = new XMLHttpRequest();
    let url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tags = info.linkUrl.split('=');
    params = tags[1].split('+');
    text = decodeURI(params[0]);
    xhr.send(JSON.stringify({'table':'Tag', 'tag':text}));
  }
});

chrome.contextMenus.create({
  title: "Fav",
  contexts: ["link"],
  type: "normal",
  onclick: function (info) {
    let xhr = new XMLHttpRequest();
    let url = 'http://localhost:3000/addItem';
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", "application/json");
    tags = info.linkUrl.split('=');
    params = tags[1].split('+');
    text = decodeURI(params[0]);
    xhr.send(JSON.stringify({'table':'Fav', 'tag':text}));
  }
});
