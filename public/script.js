// Connect to the Socket.IO server. Because no URL is passed, it connects
// back to the same server that delivered this page.
// `socket` is this client's end of the two-way connection.
const socket = io();

// --- Sending events TO the server ---
// socket.emit(eventName, data?) sends a message to the server over the
// open WebSocket.  The first argument is a custom event name (a string you
// choose); the optional second argument is any JSON-serialisable payload.

function buttonPushed()
{
    console.log("Sending message to server: Button pushed");
    socket.emit('buttonPushed');
}

// Read the slider's current value from the DOM and send it to the server.
// document.getElementById() grabs the HTML element whose id="mood",
// and .value gives us the current position of the range input (0–100).
function moodChanged()
{
    var sliderValue = document.getElementById('mood').value;
    socket.emit('moodChanged', sliderValue);
    console.log("Sent message to server: Mood changed", sliderValue);
}

// Two-step pattern: update our OWN page immediately (so the user sees
// instant feedback), then emit the change so the server can relay it to
// every other connected client.
function backgroundColorChanged()
{
    var backgroundColor = document.getElementById('backgroundColor').value;
    // document.documentElement is the <html> element — changing its
    // background color affects the entire page.
    document.documentElement.style.backgroundColor = backgroundColor;
    socket.emit('backgroundColorChanged', backgroundColor);
    console.log("Sent message to server: Background color changed", backgroundColor);
}

// --- Receiving events FROM the server ---
// socket.on(eventName, callback) registers a listener.  Whenever the server
// sends an event with that name, the callback runs.  This is the other half
// of the real-time loop: the server pushes data and the client reacts.

socket.on('buttonPushed', () => 
{
    console.log("Received message from server: Button pushed");
    alert("You shouldn't have pressed that button!");
});

// When another client moves the slider, the server broadcasts the new value
// to us.  We update our local slider to match, keeping all clients in sync.
socket.on('moodChanged', (sliderValue) => {
    console.log("Received message from server: Mood changed", sliderValue);
    document.getElementById('mood').value = sliderValue;
});

// Same idea: another client (or the server on initial connect) tells us the
// background color — we apply it to our page so everybody sees the same thing.
socket.on('backgroundColorChanged', (backgroundColor) => {
    console.log("Received message from server: Background color changed", backgroundColor);
    document.documentElement.style.backgroundColor = backgroundColor;
});

