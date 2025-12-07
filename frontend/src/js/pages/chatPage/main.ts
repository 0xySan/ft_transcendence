// chat page entrypoint
export {};

import { seedDummyData } from './helpers.js';
import { initLayout } from './layout.js';
import { renderChat } from './chatRenderer.js';
import { renderUserList } from './userList.js';

initLayout();
seedDummyData();
renderUserList(renderChat);