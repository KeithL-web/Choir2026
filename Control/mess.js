"use strict";
function Startup(name) {
const div1 = document.createElement('div');
div1.id = '_mess';
div1.style = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 99999; background-color: rgba(0,0,0,0.15);backdrop-filter: blur(1px);display: flex; align-items: center; justify-content: center;';
const innerDiv = document.createElement('div');
innerDiv.style = 'background-color: white; padding: 30px; border-radius: 8px; min-width: 200px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5);';
innerDiv.innerHTML = `Loading<br><span style='color:red;font-weight:bold;'>${name}</span><br>Please Wait..`;
div1.appendChild(innerDiv);
document.body.appendChild(div1);
}
function KillMessage() {
const div = document.getElementById('_mess');
if (div)
div.remove();
}
