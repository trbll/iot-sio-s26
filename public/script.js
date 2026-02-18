// Connect to the Socket.IO server. Because no URL is passed, it connects
// back to the same server that delivered this page.
// `socket` is this client's end of the two-way connection.
const socket = io();

function buttonPushed()
{
    alert("You shouldn't have pressed that button!");
}