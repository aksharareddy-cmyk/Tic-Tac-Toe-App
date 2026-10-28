# Online Tic-Tac-Toe

A real-time two-player Tic-Tac-Toe game built with Node.js, Express, and Socket.IO.

## Features
- Create a game room
- Join using a 4-character room code
- Real-time multiplayer gameplay
- Turn-based move validation
- Winner and draw detection
- Restart round option
- Simple and responsive front-end

## Tech Stack
- Node.js
- Express
- Socket.IO
- HTML
- CSS
- JavaScript

## Project Structure

```text
online-tic-tac-toe/
├── public/
│   ├── app.js
│   ├── index.html
│   └── style.css
├── package.json
├── package-lock.json
├── server.js
└── README.md
```

## How to Run

1. Open PowerShell or a terminal.
2. Navigate to the project folder:

```bash
cd "C:\Users\yanal\Downloads\online-tic-tac-toe\online-tic-tac-toe"
```

3. Install dependencies:

```bash
npm install
```

4. Start the server:

```bash
node server.js
```

5. Open the app in your browser:

```text
http://localhost:3000
```

> If port 3000 is already in use, stop the other process and try again.

## Publish a Public Game on Render

This project includes a Render Blueprint (`render.yaml`) configured for the Node.js server, WebSocket connections, and `/health` health check.

1. Push this project to a GitHub repository.
2. In the Render Dashboard, choose **New → Blueprint** and connect this repository.
3. Review the `xo-arena` web service settings and choose **Apply**.
4. Wait for the deployment to finish, then open its `onrender.com` URL and share it with players.

Players can share an invite link or join with the four-character room code. The free instance may spin down while idle, so the first visit after inactivity can take a little longer. Rooms are stored in server memory; restarting or redeploying clears active rooms. Keep this service to one running instance.

## GitHub Repository

https://github.com/aksharareddy-cmyk/Tic-Tac-Toe-App

## Notes
- Run the server from the project folder, not the parent folder.
- If port 3000 is already in use, stop the current process and restart the app.
