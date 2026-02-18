# IoT Socket.IO Lab (S26)

This project is the in-class working repository derived from `iot-sio-starting`.  
Students should use this repo while building and iterating during the semester.

## Prerequisites

Install Node.js (version 18 or newer):

1. Go to [https://nodejs.org](https://nodejs.org).
2. Download and install the **LTS** version for your operating system.
3. Verify installation in a terminal:

```bash
node -v
npm -v
```

## Local Setup

1. Clone from the starter repository:

```bash
git clone https://github.com/trbll/iot-sio-s26.git
```

2. Move into the project folder:

```bash
cd iot-sio-s26
```

3. Install dependencies:

```bash
npm install
```

4. Start the app:

```bash
npm run dev
```

Or run the non-watch version:

```bash
npm start
```

5. Open your browser and visit:

[http://localhost:3000](http://localhost:3000)

The server uses `process.env.PORT` when deployed and falls back to port `3000` locally.

## Project Structure

- `server.js`: Express + HTTP server setup and Socket.IO connection handling.
- `public/index.html`: Frontend page used in class.
- `public/style.css`: UI styles.
- `public/script.js`: Client-side Socket.IO code and interaction logic.
