// test
const addRequest = (addTab) => {
  let inputKey = document.getElementById('tag');

  const xhr = new XMLHttpRequest();
  xhr.open("POST", 'http://localhost:3000/addItem');
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({'table':addTab, 'tag':inputKey.value}));

  inputKey.value = "";
}

// test
document.getElementById('download').addEventListener('click', () => {
  addRequest('Download');
}, false);

// test
document.getElementById('favorite').addEventListener('click', () => {
  addRequest('Favorite');
}, false);
