let xhr = new XMLHttpRequest();

// test
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

// test
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

  alert((await res.json()).tag);
  getKey.value = "";
}

// test
document.getElementById('download').addEventListener('click', () => {
  addReq('Download');
}, false);

// test
document.getElementById('favorite').addEventListener('click', () => {
  addReq('Favorite');
}, false);

// test
document.getElementById('check').addEventListener('click', () => {
  chkReq();
}, false);
