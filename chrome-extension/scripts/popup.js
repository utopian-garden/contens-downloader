// addItem の POST リクエスト
const addReq = async (addTab) => {
  let addKey = document.getElementById('tag');

  fetch('http://localhost:3000/addItem', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': addTab,
      'tag': addKey.value
    }),
  });

  addKey.value = "";
}

// checkDb の GET リクエストと結果表示
const chkReq = async () => {
  let getKey = document.getElementById('tag');
  let res;

  try {
    res = await fetch('http://localhost:3000/checkDb?tag=' + getKey.value, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch(err) {
    alert(err);
  }

  alert((await res.json()).table);
  getKey.value = "";
}

// refillQueue の POST リクエスト
const queRefill = async (refillTab) => {
  fetch('http://localhost:3000/refillQueue', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': refillTab
    }),
  });
}

// organizeFile の POST リクエスト
const fileOrganize = async () => {
  fetch('http://localhost:3000/organizeFile', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// tagAssign の POST リクエスト
const tagAssign = async () => {
  fetch('http://localhost:3000/assignTag', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// Download の addItem を実行するイベントリスナー
document.getElementById('download').addEventListener('click', () => {
  addReq('Download');
}, false);

// Favorite の addItem を実行するイベントリスナー
document.getElementById('favorite').addEventListener('click', () => {
  addReq('Favorite');
}, false);

// checkDb を実行するイベントリスナー
document.getElementById('check').addEventListener('click', () => {
  chkReq();
}, false);

// Download の refillQueue を実行するイベントリスナー
document.getElementById('dl-refill').addEventListener('click', () => {
  queRefill('Download');
}, false);

// Favorite の refillQueue を実行するイベントリスナー
document.getElementById('fav-refill').addEventListener('click', () => {
  queRefill('Favorite');
}, false);

// Ignore の refillQueue を実行するイベントリスナー
document.getElementById('ig-refill').addEventListener('click', () => {
  queRefill('Ignore');
}, false);

// Artist の refillQueue を実行するイベントリスナー
document.getElementById('art-refill').addEventListener('click', () => {
  queRefill('Artist');
}, false);

// Studio の refillQueue を実行するイベントリスナー
document.getElementById('stu-refill').addEventListener('click', () => {
  queRefill('Studio');
}, false);

// tagAssign を実行するイベントリスナー
document.getElementById('tag-assign').addEventListener('click', () => {
  tagAssign();
}, false);

// organizeFile を実行するイベントリスナー
document.getElementById('file-organize').addEventListener('click', () => {
  fileOrganize('Download');
}, false);
