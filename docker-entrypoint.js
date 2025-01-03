#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec, execSync } = require("child_process");

// Initialisiere Manager
function initializeManager() {
  console.log("Initializing manager...");
  const dockerHostName = (process.env["HOSTNAME"] || os.hostname()).toLowerCase();
  const networks = os.networkInterfaces();

  const [ipInfo] = Object.keys(networks)
      .filter((eth) => networks[eth].some((addr) => !addr.internal && addr.family === "IPv4"))
      .map((eth) => networks[eth])[0] || [{}];

  const data = {
    type: "list_page",
    items: [{ hostname: dockerHostName, ip: ipInfo?.address || "0.0.0.0" }],
  };

  saveData("global/servers/0", data);
  console.log("Manager initialized.");
}

function gracefulShutdown() {
  console.log("Received termination signal, shutting down gracefully...");
  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Pfad zur "Storage"-Datei
const storageFilePath = path.join(__dirname, "storage.json");

function saveData(key, data) {
  try {
    const storage = fs.existsSync(storageFilePath)
        ? JSON.parse(fs.readFileSync(storageFilePath, "utf8"))
        : {};

    storage[key] = data;

    fs.writeFileSync(storageFilePath, JSON.stringify(storage, null, 2), "utf8");
    console.log(`Record successfully saved: ${key}`);
  } catch (error) {
    console.error("Error saving data:", error.message);
  }
}

function getData(key) {
  try {
    if (fs.existsSync(storageFilePath)) {
      const storage = JSON.parse(fs.readFileSync(storageFilePath, "utf8"));
      return storage[key] || null;
    }
    return null;
  } catch (error) {
    console.error("Error retrieving data:", error.message);
    return null;
  }
}

if (fs.existsSync("./data/users")) {
  console.log("Docker Env already configured.");
  // require("../lib/main.js");
} else {
  console.log("cronicle-caprover init...");

  if (fs.existsSync("./logs/cronicled.pid")) fs.unlinkSync("./logs/cronicled.pid");

  if (!fs.existsSync("./data/users")) {
    exec("/opt/cronicle/bin/control.sh setup", (error, stdout, stderr) => {
      console.log("Storage init.");
      if (error || stderr) {
        console.log("Init storage failed");
        console.error(error.message || stderr);
        process.exit(1);
      }
      console.log(`stdout: ${stdout}`);
    });
  }

  if (!fs.existsSync("./data/plugins/caprover-plugin")) {
    console.log("Adding CapRover plugin...");
    try {
      execSync("/opt/cronicle/caprover/add-plugin.sh");
      console.log("CapRover plugin added successfully!");
    } catch (error) {
      console.error("Failed to add CapRover plugin:", error.message);
      process.exit(1);
    }
  } else {
    console.log("Found CapRover plugin...");
  }

  const dockerHostName = (process.env["HOSTNAME"] || process.env["HOST"] || os.hostname()).toLowerCase();
  const networks = os.networkInterfaces();

  const [ipInfo] = Object.keys(networks)
      .filter((eth) => networks[eth].some((addr) => !addr.internal && addr.family === "IPv4"))
      .map((eth) => networks[eth])[0] || [{}];

  const data = {
    type: "list_page",
    items: [{ hostname: dockerHostName, ip: ipInfo?.address || "0.0.0.0" }],
  };

  saveData("global/servers/0", data);

  const savedData = getData("global/servers/0");
  console.log("Record retrieved:", savedData);

  console.log("Docker Env Fixed.");
  // require("../lib/main.js");
}

initializeManager();

exec("manager", (error, stdout, stderr) => {
  if (error || stderr) {
    console.error(error.message || stderr);
    process.exit(1);
  }
  console.log(`stdout: ${stdout}`);
})