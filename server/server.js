// imports ^w^
const express = require("express");
const WebSocket = require("ws");
const fs = require('fs');
const http = require("http");
const https = require('https');
const app = express();
const capp = express();
var path = require('path');
var { v4: uuidv4 } = require('uuid');

// ssl certificates for running https 
const serverConfig = {
  key: fs.readFileSync(__dirname + '/key.pem'),
  cert: fs.readFileSync(__dirname + '/cert.pem'),
};

// ports that the client can access
const HTTPS_PORT = 443;
const port = 26950;

// create a https server and provide accessible files
const server = https.createServer(serverConfig, app);

capp.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..') + '/docs/index.html');
});

capp.use(express.static('docs'))

const httpsServer = https.createServer(serverConfig, capp);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// redirect to https :/
http.createServer(function (req, res) {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80);


//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// store socket users and webrtc users
let users = new Map();

// create a schedule and fill it with the last saved JSON schedule if available 
let schedule = {};
try {
  schedule = JSON.parse(fs.readFileSync(__dirname + '/schedule.json', 'utf8'));
} catch (err) {
  saveSchedule();
}

// save the current schedule to schedule.json :3
function saveSchedule() {
  fs.writeFile(__dirname + '/schedule.json', JSON.stringify(schedule), function (err) {
    if (err) throw err;
    console.log('Saved!');
  });
}

// send to specific ws (websocket) connection
const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

// send to all websocket connections
const sendToAll = (clients, type, { id, name: userName }) => {
  Object.values(clients).forEach(client => {
    if (client.name !== userName) {
      client.send(
        JSON.stringify({
          type,
          user: { id, userName }
        })
      );
    }
  });
};

function initSchedule(year, month, week) {
  if (!schedule[year]) {
    schedule[year] = {}
  }
  if (!schedule[year][month]) {
    schedule[year][month] = {}
  }
  if (!schedule[year][month][week]) {
    schedule[year][month][week] = {}
  }
}

function addToWeeks(year, month, week) {
  initSchedule(year, month, week);
  var temparr = Object.values(schedule[year][month][week]);

  if (temparr.length > 0) {
    return Object.values(schedule[year][month][week]);
  } else {
    return [];
  }
}

// find specific week meetings in the saved schedule and return it
function findWeek(year, month, week) {
  var arr = [];

  var currentYears = [];
  var currentMonths = [];
  var currentWeeks = [];

  year = parseInt(year);
  month = parseInt(month);
  week = parseInt(week);

  var lastweek = 0;
  var tempMonth = month - 1;
  var tempYear = year;

  if (tempMonth < 1) {
    tempMonth = 12;
    tempYear = year - 1;
  }

  initSchedule(tempYear, tempMonth, lastweek);
  Object.keys(schedule[tempYear][tempMonth]).forEach(element => {
    if (element > lastweek) {
      lastweek = element;
    }
  });
  arr = arr.concat(addToWeeks(tempYear, tempMonth, lastweek));
  currentYears.push(tempYear);
  currentMonths.push(tempMonth);
  currentWeeks.push(lastweek);

  arr = arr.concat(addToWeeks(year, month, week));
  currentYears.push(year);
  currentMonths.push(month);
  currentWeeks.push(week);

  tempMonth = month + 1;
  tempYear = year;

  if (tempMonth + 1 > 12) {
    tempYear = year + 1;
    tempMonth = 1;
  }

  initSchedule(year, month, week-1);
  arr = arr.concat(addToWeeks(year, month, week-1));
  currentYears.push(year);
  currentMonths.push(month);
  currentWeeks.push(week-1);

  initSchedule(year, month, week+1);
  arr = arr.concat(addToWeeks(year, month, week+1));
  currentYears.push(year);
  currentMonths.push(month);
  currentWeeks.push(week+1);

  initSchedule(tempYear, tempMonth, 0);
  arr = arr.concat(addToWeeks(tempYear, tempMonth, 0));
  currentYears.push(tempYear);
  currentMonths.push(tempMonth);
  currentWeeks.push(0);

  console.log(arr);

  var returnMessage = {
    type: "week",
    year: currentYears,
    month: currentMonths,
    week: currentWeeks,
    data: arr
  }

  for (element of users.values()) {
    element.send(JSON.stringify(returnMessage));
  }

  // save the schedule to the JSON file
  saveSchedule();
}

// Structure and WebRTC Candidate code based on: https://blog.logrocket.com/get-a-basic-chat-application-working-with-webrtc/
// when the websocket server recieves a connection
wss.on("connection", ws => {

  ws.name = uuidv4();
  users.set(ws.name, ws);

  ws.on("message", msg => {

    // read the JSON data
    let data;

    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }

    const { type, name, offer, answer, candidate, sender } = data;
    // does different tasks based on message type
    switch (type) {
      case "getWeek":
        // initial request for the schedule
        findWeek(data.year, data.month, data.week);
        break;
      case "createTask":
        // create a new task and add it to the schedule
        console.log(schedule);
        console.log(data.data);

        var [year, month, week] = data.data.date.split("-");
        week = Math.floor(week / 7);
        month = parseInt(month);
        year = parseInt(year);
        initSchedule(year, month, week);

        var id = Math.floor(Math.random() * Math.floor(1000));

        if (schedule[year] && schedule[year][month] && schedule[year][month][week]) {
          while (schedule[year][month][week][id] != undefined) {
            id = Math.floor(Math.random() * Math.floor(1000));
          }
          schedule[year][month][week][id] = data.data;
          schedule[year][month][week][id].id = id;
        }

        console.log(schedule[year][month][week]);

        findWeek(year, month, week);
        break;
      case "editTask":
        // when a user asks to edit a meeing
        var [year, month, week] = data.data.date.split("-");
        week = Math.floor(week / 7);
        month = parseInt(month);

        if (schedule[year] && schedule[year][month] && schedule[year][month][week]) {
          schedule[year][month][week][id] = data.data;
        }
        findWeek(year, month, week);
        break;
      case "removeTask":
        // when user asks to remove a meeting
        var [year, month, week] = data.date.split("-");
        week = Math.floor(week / 7);
        month = parseInt(month);
        var id = data.id;

        if (schedule[year] && schedule[year][month] && schedule[year][month][week]) {
          console.log(schedule[year][month][week][id]);
          delete schedule[year][month][week][id];
        }
        findWeek(year, month, week);
        break;

      //when a user tries to login with webrtc
      case "login":
        //if username is available
        if (users[name]) {
          // not available
          sendTo(ws, {
            type: "login",
            success: false,
            message: "Username is unavailable"
          });
        } else {
          // create a new user for webrtc
          const id = uuidv4();
          const loggedIn = Object.values(
            users
          ).map(({ id, name: userName }) => ({ id, userName }));
          users[name] = ws;
          ws.name = name;
          ws.id = id;
          sendTo(ws, {
            type: "login",
            success: true,
            users: loggedIn
          });
          sendToAll(users, "updateUsers", ws);
        }
        break;
      case "offer":
        //Check if user to send offer to exists
        const offerRecipient = users[name];
        if (!!offerRecipient) {
          sendTo(offerRecipient, {
            type: "offer",
            offer,
            name: ws.name
          });
        } else {
          sendTo(ws, {
            type: "error",
            message: `User ${name} does not exist!`
          });
        }
        break;
      case "answer":
        //Check if user to send answer to exists
        const answerRecipient = users[name];
        if (!!answerRecipient) {
          sendTo(answerRecipient, {
            type: "answer",
            sender: sender,
            answer,
          });
        } else {
          sendTo(ws, {
            type: "error",
            message: `User ${name} or ${sender} does not exist!`
          });
        }
        break;
      case "candidate":
        //send candidate info to other client 
        const candidateRecipient = users[name];
        if (!!candidateRecipient) {
          sendTo(candidateRecipient, {
            type: "candidate",
            sender: sender,
            candidate: candidate
          });
        }
        break;
      case "leave":
        // when a user leaves webrtc
        sendToAll(users, "leave", ws);
        break;
      default:
        // if the type doesn't exist!
        console.log("oh no! That's not a valid request!");
        ws.send(JSON.stringify({ error: "oh no! That's not a valid request! /)m(\\" }))
        break;
    }

  });

  // when someone closes connection (closing or refreshing page)
  ws.on("close", function () {
    delete users[ws.name];
    sendToAll(users, "leave", ws);
  });

  // send welcome message!
  ws.send(
    JSON.stringify({
      type: "connect",
      message: "Woohoo! You're connected!"
    })
  );
});

//start our server
server.listen(port, () => {
  console.log(`Signalling Server running on port: ${port}`);
});