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
  let addKey = document.getElementById('tag');

  fetch('http://localhost:3000/refillQueue', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': refillTab
    }),
  });

  addKey.value = "";
}

// organizeFile の POST リクエスト
const fileOrganize = async (organizeTab) => {
  let addKey = document.getElementById('tag');

  fetch('http://localhost:3000/organizeFile', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': organizeTab
    }),
  });

  addKey.value = "";
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

// checkDb を実行するイベントリスナー
document.getElementById('dl-refill').addEventListener('click', () => {
  queRefill('Download');
}, false);

// checkDb を実行するイベントリスナー
document.getElementById('fav-refill').addEventListener('click', () => {
  queRefill('Favorite');
}, false);

// checkDb を実行するイベントリスナー
document.getElementById('file-organize').addEventListener('click', () => {
  fileOrganize('Download');
}, false);
