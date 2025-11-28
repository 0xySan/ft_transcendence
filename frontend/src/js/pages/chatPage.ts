export {};

const users = [];

for (let i = 0; i < 100; i++)
{
    users[i] = 'user' + i
}

const listDiv = document.querySelector<HTMLDivElement>('.user-list');

if (listDiv) {
  users.forEach(name => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';

    const img = document.createElement('img');
    img.className = 'img_profile';
    img.src = '/assets/default_pfp.png'; // placeholder
    img.alt = '';

    const txt = document.createElement('p');
    txt.className = 'name_profile';
    txt.textContent = name;

    userItem.appendChild(img);
    userItem.appendChild(txt);

    userItem.addEventListener('click', () => {
      console.log('Clicked:', name);
    });

    listDiv.appendChild(userItem);
  });
}
