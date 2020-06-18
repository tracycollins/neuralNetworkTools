const BINARY_MODE = false;
const LOG_SCALE_MODE = false;
const USER_PROFILE_ONLY_FLAG = true;
const MAX_LOAD_USERS = 100;

const MODULE_ID_PREFIX = "NNT";

const TOTAL_ITERATIONS = 20;

const DEFAULT_USER_PROFILE_ONLY_INPUTS_ID = "inputs_25250101_000000_255_profilecharcodes";
const c = DEFAULT_USER_PROFILE_ONLY_INPUTS_ID + ".json";

const ONE_SECOND = 1000;
const ONE_MINUTE = 60*ONE_SECOND;
const ONE_HOUR = 60*ONE_MINUTE;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const fsp = require('fs').promises;
const path = require("path");
const chalk = require("chalk");
const moment = require("moment");
const fs = require("fs");
const should = require("should");

const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.yellow;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const async = require("async");
const randomItem = require("random-item");
const _ = require("lodash");
const shuffle = require("shuffle-array");
const HashMap = require("hashmap").HashMap;
const yauzl = require("yauzl");
const brain = require("brain.js");

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const statsObj = {};
statsObj.users = {};
statsObj.users.zipHashMapHit = 0;
statsObj.users.zipHashMapMiss = 0;
statsObj.users.unzipped = 0;

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");

const configDefaultTestFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/test/testData");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const tcuChildName = Number("NNT_TEST_TCU");
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
const formatCategory = tcUtils.formatCategory;

const testNetworkFolder = path.join(configDefaultTestFolder, "networks");

// const test_user_tobi = tcUtils.loadFile({folder: userDataFolder, file: "user_10032112.json"});
// const test_user_hector = tcUtils.loadFile({folder: userDataFolder, file: "user_10069612.json"});

const testInputsFolder = path.join(configDefaultTestFolder, "inputs");

const trainingSetsFolder = configDefaultFolder + "/trainingSets";
const userArchiveFolder = configDefaultFolder + "/trainingSets/users";
const defaultInputsFolder = configDefaultFolder + "/inputs";
const userDataFolder = path.join(configDefaultFolder, "trainingSets/users/data");

const defaultUserArchiveFlagFile = "usersZipUploadComplete_test.json";
const trainingSetFile = "trainingSet_test.json";
const requiredTrainingSetFile = "requiredTrainingSet.txt";

const testUsersArray = [];
// testUsersArray.push(test_user_tobi);
// testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");

let trainingSetObj = {};
let testSetObj = {};

async function connectDb(){

  try {

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await global.wordAssoDb.connect(MODULE_ID_PREFIX + "_" + process.pid);

    db.on("error", async function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
      db.close();
    });

    db.on("close", async function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
    });

    db.on("disconnected", async function(){
      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    return db;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

function loadUsers(usersFolder){
  return new Promise(function(resolve, reject){

    const userArray = [];

    // const usersFileArray = await fsp.readdir(usersFolder);
    fsp.readdir(usersFolder)
    .then(function(dirFileArray){

      const fileArray = shuffle(dirFileArray);

      const usersFileArray = fileArray.slice(0,100);

      async.eachSeries(usersFileArray, function(file, cb){

        if (file.endsWith(".json")) {
          // const nodeId = file.replace(".json", "");
          console.log("USER LOAD: " + file);

          tcUtils.loadFile({folder: userDataFolder, file: file})
          .then(function(user){
            userArray.push(user);
            cb();
          })
          .catch(function(e){
            cb(e);
          });
        }
        else{
          console.log("... SKIPPING USER LOAD: " + file);
          cb();
        }

      }, function(err){
        if (err) { return reject(err); }
        console.log("FOUND " + userArray.length + " USERS IN " + usersFolder);
        resolve(userArray);
      });

    })
    .catch(function(err){
      return reject(err);
    });

  });
}

async function loadNetworksDb(){

  console.log("... LOADING DB NETWORKS");

  try{
    const networkIdArray = [];

    const nnDocArray = await global.wordAssoDb.NeuralNetwork.find({
      // binaryMode: true,
      successRate: {"$gt": 80}
      // "createdAt": {"$gt": new Date("2019-12-01T00:00:00.000Z")}
    }).limit(100);

    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED NETWORKS: " + nnDocArray.length));

    for(const nnDoc of nnDocArray){

      networkIdArray.push(nnDoc.networkId);

      const nn = nnDoc.toObject();

      nn.logScaleMode = (Math.random() > 0.5);
      if (nn.logScaleMode){
        nn.binaryMode = false;
        console.log(chalkAlert(MODULE_ID_PREFIX + " | LOG SCALE MODE | " + nn.networkId + " | LSM: " + nn.logScaleMode));
      }

      await nnTools.loadNetwork({networkObj: nn});
    }

    return networkIdArray;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD DB NETWORKS ERROR: " + err));
    throw err;
  }
}

function loadNetworks(networksFolder){
  return new Promise(function(resolve, reject){

    console.log("... LOADING FILE NETWORKS | " + testNetworkFolder);

    const networkIdArray = [];
    
    fsp.readdir(networksFolder)
    .then(function(nnFileArray){
      async.eachSeries(nnFileArray, function(file, cb){
        if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

          const nnId = file.replace(".json", "");

          tcUtils.loadFile({folder: testNetworkFolder, file: file})
          .then(function(nn){

            if (!nn || nn === undefined) {
              console.log(chalkError("NN NOT FOUND: " + file));
            }

            if (nn.networkTechnology !== "carrot"){
              console.log("... SKIPPING NETWORK LOAD (NOT CARROT): " + nn.networkId);
              return cb();
            }

            networkIdArray.push(nnId);

            nnTools.loadNetwork({networkObj: nn})
            .then(function(){
              cb();
            })
            .catch(function(err){
              console.log(jsonPrint(err));
              cb(err);
            });

          })
          .catch(function(e){
            cb(e);
          });

        }
        else{
          console.log("... SKIPPING NETWORK LOAD: " + file);
          cb();
        }
      }, async function(err){
        if (err) { return reject(err); }
        console.log("FOUND " + nnTools.getNumberNetworks() + " NETWORKS IN " + networksFolder);
        resolve(networkIdArray);
      });
    })
    .catch(function(err){
      return reject(err);
    });

  });
}

function activateUsers(params){

  return new Promise(function(resolve, reject){

    const userArray = [
      ...trainingSetUsersHashMap.left.values(),
      ...trainingSetUsersHashMap.right.values(),
      ...trainingSetUsersHashMap.neutral.values()
    ];

    async.eachSeries(userArray, function(user, cb){

      nnTools.activate({
        user: user, 
        // binaryMode: params.binaryMode, 
        // logScaleMode: params.logScaleMode, 
        convertDatumFlag: true,
        verbose: true
      })
      .then(function(noutObj){

        // noutObj = { user: user, networkOutput: networkOutput }

        nnTools.updateNetworkStats({
          user: noutObj.user, 
          networkOutput: noutObj.networkOutput,
          updateRuntimeMatchRate: true
        })
        .then(function(networkStats){

          // const title = "BEST | " + networkStats.networkId
          //   + " | PROFILE ONLY: " + USER_PROFILE_ONLY_FLAG 
          //   + " | BIN: " + binaryMode 
          //   + " | CAT M: " + networkStats.meta.category.charAt(0).toUpperCase()
          //   + " A: " + networkStats.meta.categoryAuto.charAt(0).toUpperCase()
          //   + " | IHR: " + noutObj.networkOutput[networkStats.networkId].inputHitRate.toFixed(3) + "%"
          //   + " | M/MM/TOT: " + networkStats.meta.match + "/" + networkStats.meta.mismatch + "/" + networkStats.meta.total
          //   + " | MR: " + networkStats.matchRate.toFixed(3) + "%"
          //   + " | MATCH: " + networkStats.meta.matchFlag
          //   + " | @" + noutObj.user.screenName;

          nnTools.printNetworkResults()
          .then(function(){
            cb();
          })
          .catch(function(e){
            cb(e);
          });

        })
        .catch(function(err){
          console.log("NNT | ERROR: " + err);
          cb();
          // return cb(err);
        });

      })
      .catch(async function(err){
        console.log("NN *** ACTIVATE ERROR: " + err);
        if (err.message.includes("ACTIVATE_UNDEFINED")){
          const errParts = err.message.split(":");
          const errNnId = errParts[1].trim();
          console.log("ERR NN ID: " + errNnId);
          await nnTools.deleteNetwork({networkId: errNnId});
          return cb();
        }
        else {
          return cb(err);
        }
      });
    }, function(err){
      if (err) { return reject(err); }
      resolve();
    });

  });
}

let existsInterval;

function waitFileExists(params){

  return new Promise(function(resolve, reject){

    clearInterval(existsInterval);

    const interval = params.interval || 5*ONE_MINUTE;
    const maxWaitTime = ONE_MINUTE;

    const endWaitTimeMoment = moment().add(maxWaitTime, "ms");

    let exists = fs.existsSync(params.path);

    if (exists) {

      console.log(chalkLog(MODULE_ID_PREFIX
        + " | FILE EXISTS"
        + " | NOW: " + tcUtils.getTimeStamp()
        + " | PATH: " + params.path
      ));

      return resolve();
    }

    console.log(chalkAlert(MODULE_ID_PREFIX
      + " | !!! FILE DOES NOT EXIST | START WAIT"
      + " | MAX WAIT TIME: " + tcUtils.msToTime(maxWaitTime)
      + " | NOW: " + tcUtils.getTimeStamp()
      + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
      + " | PATH: " + params.path
    ));

    existsInterval = setInterval(function(){

      exists = fs.existsSync(params.path);

      if (exists) {
        clearInterval(existsInterval);
        console.log(chalk.green(MODULE_ID_PREFIX
          + " | FILE EXISTS"
          + " | MAX WAIT TIME: " + tcUtils.msToTime(maxWaitTime)
          + " | NOW: " + tcUtils.getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
        return resolve();
      }
      else if (moment().isAfter(endWaitTimeMoment)){
        clearInterval(existsInterval);
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** WAIT FILE EXISTS EXPIRED"
          + " | MAX WAIT TIME: " + tcUtils.msToTime(maxWaitTime)
          + " | NOW: " + tcUtils.getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
        return reject(new Error("WAIT FILE EXISTS EXPIRED: " + tcUtils.msToTime(maxWaitTime)));
      }
      else{
        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | ... WAIT FILE EXISTS"
          + " | MAX WAIT TIME: " + tcUtils.msToTime(maxWaitTime)
          + " | NOW: " + tcUtils.getTimeStamp()
          + " | END WAIT TIME: " + endWaitTimeMoment.format(compactDateTimeFormat)
          + " | PATH: " + params.path
        ));
      }

    }, interval);

  });
}

let sizeInterval;

function fileSize(params){

  return new Promise(function(resolve, reject){

    clearInterval(sizeInterval);

    const interval = params.interval || 10*ONE_SECOND;

    console.log(chalkLog(MODULE_ID_PREFIX + " | WAIT FILE SIZE: " + params.path + " | EXPECTED SIZE: " + params.size));

    let stats;
    let size = 0;
    let prevSize = 0;

    let exists = fs.existsSync(params.path);

    if (exists) {

      try {
        stats = fs.statSync(params.path);
        size = stats.size;
        prevSize = stats.size;

        if (params.size && (size === params.size)) {
          console.log(chalkGreen(MODULE_ID_PREFIX + " | FILE SIZE EXPECTED | " + tcUtils.getTimeStamp()
            + " | EXISTS: " + exists
            + " | CUR: " + size
            + " | EXPECTED: " + params.size
            + " | " + params.path
          ));
          return resolve();
        }

        sizeInterval = setInterval(function(){

          console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE | " + tcUtils.getTimeStamp()
            + " | EXISTS: " + exists
            + " | CUR: " + size
            + " | PREV: " + prevSize
            + " | EXPECTED: " + params.size
            + " | " + params.path
          ));

          exists = fs.existsSync(params.path);

          if (exists) {
            fs.stat(params.path, function(err, stats){

              if (err) {
                return reject(err);
              }

              prevSize = size;
              size = stats.size;

              if ((size > 0) && ((params.size && (size === params.size)) || (size === prevSize))) {

                clearInterval(sizeInterval);

                console.log(chalkGreen(MODULE_ID_PREFIX + " | FILE SIZE STABLE | " + tcUtils.getTimeStamp()
                  + " | EXISTS: " + exists
                  + " | CUR: " + size
                  + " | PREV: " + prevSize
                  + " | EXPECTED: " + params.size
                  + " | " + params.path
                ));

                return resolve();
              }
            });
          }

        }, interval);

      }
      catch(err){
        return reject(err);
      }
    }
    else {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? FILE SIZE | NON-EXISTENT FILE | " + tcUtils.getTimeStamp()
        + " | EXISTS: " + exists
        + " | EXPECTED: " + params.size
        + " | " + params.path
      ));

      return reject(new Error("NON-EXISTENT FILE: " + params.path));
    }

  });
}

const trainingSetUsersHashMap = {};
trainingSetUsersHashMap.left = new HashMap();
trainingSetUsersHashMap.neutral = new HashMap();
trainingSetUsersHashMap.right = new HashMap();

function unzipUsersToArray(params){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UNZIP USERS TO TRAINING SET: " + params.path));

  return new Promise(function(resolve, reject) {

    try {

      trainingSetUsersHashMap.left.clear();
      trainingSetUsersHashMap.neutral.clear();
      trainingSetUsersHashMap.right.clear();

      let entryNumber = 0;

      statsObj.users.zipHashMapHit = 0;
      statsObj.users.zipHashMapMiss = 0;
      statsObj.users.unzipped = 0;

      yauzl.open(params.path, {lazyEntries: true}, function(err, zipfile) {

        if (err) {
          return reject(err);
        }

        zipfile.on("error", function(err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP ERROR: " + err));
          reject(err);
        });

        zipfile.on("close", function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP CLOSE"));
          resolve(true);
        });

        zipfile.on("end", function() {
          console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIP END"));
          resolve(true);
        });

        let hmHit = MODULE_ID_PREFIX + " | --> UNZIP";

        zipfile.on("entry", function(entry) {
          
          if ((/\/$/).test(entry.fileName)) { 
            zipfile.readEntry(); 
          } 
          else {
            zipfile.openReadStream(entry, function(err, readStream) {

              entryNumber += 1;
              
              if (err) {
                console.log(chalkError("TNN | *** UNZIP USERS ENTRY ERROR [" + entryNumber + "]: " + err));
                return reject(err);
              }

              let userString = "";

              readStream.on("end", async function() {

                try {
                  const userObj = JSON.parse(userString);

                  if (entry.fileName.includes("maxInputHashMap")) {

                    console.log(chalkLog(MODULE_ID_PREFIX + " | UNZIPPED MAX INPUT"));

                    // await nnTools.setMaxInputHashMap(userObj.maxInputHashMap);
                    await nnTools.setNormalization(userObj.normalization);

                    zipfile.readEntry();
                  }
                  else {

                    statsObj.users.unzipped += 1;

                    hmHit = MODULE_ID_PREFIX + " | UNZIP";

                    if ( trainingSetUsersHashMap.left.has(userObj.nodeId)
                      || trainingSetUsersHashMap.neutral.has(userObj.nodeId) 
                      || trainingSetUsersHashMap.right.has(userObj.nodeId)
                      ) 
                    {
                      hmHit = MODULE_ID_PREFIX + " | **> UNZIP";
                    }

                    if ((userObj.category === "left") || (userObj.category === "right") || (userObj.category === "neutral")) {

                      trainingSetUsersHashMap[userObj.category].set(userObj.nodeId, userObj);

                      if (((statsObj.users.unzipped % 100 === 0)) || (statsObj.users.unzipped % 1000 === 0)) {

                        console.log(chalkLog(hmHit
                          + " [" + statsObj.users.unzipped + "]"
                          + " USERS - L: " + trainingSetUsersHashMap.left.size
                          + " N: " + trainingSetUsersHashMap.neutral.size
                          + " R: " + trainingSetUsersHashMap.right.size
                          + " | " + userObj.nodeId
                          + " | @" + userObj.screenName
                          + " | " + userObj.name
                          + " | FLWRs: " + userObj.followersCount
                          + " | FRNDs: " + userObj.friendsCount
                          + " | FRNDs DB: " + userObj.friends.length
                          + " | CAT M: " + formatCategory(userObj.category) 
                          + " A: " + formatCategory(userObj.categoryAuto)
                        ));
                      }

                      zipfile.readEntry();

                    }
                    else{
                      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? UNCAT UNZIPPED USER"
                        + " [" + statsObj.users.unzipped + "]"
                        + " USERS - L: " + trainingSetUsersHashMap.left.size
                        + " N: " + trainingSetUsersHashMap.neutral.size
                        + " R: " + trainingSetUsersHashMap.right.size
                        + " | " + userObj.nodeId
                        + " | @" + userObj.screenName
                        + " | " + userObj.name
                        + " | FLWRs: " + userObj.followersCount
                        + " | FRNDs: " + userObj.friendsCount
                        + " | CAT M: " + formatCategory(userObj.category) 
                        + " A: " + formatCategory(userObj.categoryAuto)
                      ));                      

                      zipfile.readEntry();

                    }
                  }
                }
                catch (e){
                  console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP READ STREAM ERROR: " + err));
                  return reject(e);
                }
              });

              readStream.on("data",function(chunk){
                const part = chunk.toString();
                userString += part;
              });

              readStream.on("close", function(){
                console.log(chalkBlueBold(MODULE_ID_PREFIX + " | UNZIP STREAM CLOSED"));
                resolve();
              });

              readStream.on("error", function(err){
                console.log(chalkError(MODULE_ID_PREFIX + " | *** UNZIP READ STREAM ERROR EVENT: " + err));
                reject(err);
              });
            });
          }
        });

        zipfile.readEntry();

      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** USER ARCHIVE READ ERROR: " + err));
      return reject(new Error("USER ARCHIVE READ ERROR"));
    }

  });
}

function updateTrainingSet(){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

  return new Promise(function(resolve, reject) {

    try {

      trainingSetObj = {};
      trainingSetObj.meta = {};
      trainingSetObj.meta.numInputs = 0;
      trainingSetObj.meta.numOutputs = 3;
      trainingSetObj.meta.setSize = 0;
      trainingSetObj.data = [];

      testSetObj = {};
      testSetObj.meta = {};
      testSetObj.meta.numInputs = 0;
      testSetObj.meta.numOutputs = 3;
      testSetObj.meta.setSize = 0;
      testSetObj.data = [];

      async.eachSeries(["left", "neutral", "right"], function(category, cb){

        const trainingSetSize = parseInt(0.8 * trainingSetUsersHashMap[category].size);
        const testSetSize = parseInt(0.2 * trainingSetUsersHashMap[category].size);

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET | " + formatCategory(category)
          + " | SIZE: " + trainingSetSize
          + " | TEST SIZE: " + testSetSize
        ));

        trainingSetObj.data = trainingSetObj.data.concat(trainingSetUsersHashMap[category].values().slice(testSetSize));
        testSetObj.data = testSetObj.data.concat(trainingSetUsersHashMap[category].values().slice(0, testSetSize-1));

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UPDATE TRAINING SET ERROR: " + err));
          return reject(err);
        }

        trainingSetObj.data = _.shuffle(trainingSetObj.data);
        testSetObj.data = _.shuffle(testSetObj.data);

        trainingSetObj.meta.setSize = trainingSetObj.data.length;
        testSetObj.meta.setSize = testSetObj.data.length;

        if (nnTools.getMaxInputHashMap()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | maxInputHashMap"
            + "\n" + jsonPrint(Object.keys(nnTools.getMaxInputHashMap()))
          ));
        }

        if (nnTools.getNormalization()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | NORMALIZATION"
            + "\n" + jsonPrint(nnTools.getNormalization())
          ));
        }

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET"
          + " | SIZE: " + trainingSetObj.meta.setSize
          + " | TEST SIZE: " + testSetObj.meta.setSize
        ));

        resolve();

      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** updateTrainingSet ERROR:", err));
      reject(err);
    }

  });
}

// async function loadUsersArchive(params){

//   try {
//     const file = params.file;

//     params.path = (params.path !== undefined) ? params.path : params.folder + "/" + file;

//     console.log(chalkLog(MODULE_ID_PREFIX 
//       + " | LOADING USERS ARCHIVE"
//       + " | " + tcUtils.getTimeStamp() 
//       + "\n PATH:   " + params.path
//       + "\n FOLDER: " + params.folder
//       + "\n FILE:   " + file
//     ));

//     await waitFileExists(params);
//     await fileSize(params);
//     await unzipUsersToArray(params);
//     await updateTrainingSet();
//     return;
//   }
//   catch(err){
//     console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + tcUtils.getTimeStamp() + " | " + err));
//     throw err;
//   }
// }

async function loadUserDataFile(params){

  try {

    const userObj = await tcUtils.loadFile({folder: params.folder, file: params.file});

    if ((userObj.category !== "left") && (userObj.category !== "right") && (userObj.category !== "neutral")) {

      console.log(chalkAlert(MODULE_ID_PREFIX + " | ??? UNCAT LOADED USER"
        + " [" + statsObj.users.loaded + "]"
        + " USERS - L: " + trainingSetUsersHashMap.left.size
        + " N: " + trainingSetUsersHashMap.neutral.size
        + " R: " + trainingSetUsersHashMap.right.size
        + " | " + userObj.nodeId
        + " | @" + userObj.screenName
        + " | " + userObj.name
        + " | FLWRs: " + userObj.followersCount
        + " | FRNDs: " + userObj.friendsCount
        + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
      ));                      

      return;
    }

    trainingSetUsersHashMap[userObj.category].set(userObj.nodeId, userObj);

    statsObj.users.loaded += 1;

    console.log(chalkLog(MODULE_ID_PREFIX
      + " [" + statsObj.users.loaded + "]"
      + " USERS - L: " + trainingSetUsersHashMap.left.size
      + " N: " + trainingSetUsersHashMap.neutral.size
      + " R: " + trainingSetUsersHashMap.right.size
      + " | " + userObj.nodeId
      + " | @" + userObj.screenName
      + " | " + userObj.name
      + " | FLWRs: " + userObj.followersCount
      + " | FRNDs: " + userObj.friendsCount
      + " | FRNDs DB: " + userObj.friends.length
      + " | CAT M: " + userObj.category + " A: " + userObj.categoryAuto
    ));

    return;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** USER ARCHIVE READ ERROR: " + err));
    throw new Error("USER ARCHIVE READ ERROR");
  }
}

function loadUserDataFolders(params){

  return new Promise(function(resolve, reject){

    console.log(chalkNetwork(MODULE_ID_PREFIX + " | loadUserDataFolders | LOADING USER DATA FOLDERS"
      + " | " + params.folders.length + " FOLDERS"
      + "\n" + jsonPrint(params.folders)
    ));

    // let files = await tcUtils.listFolders({folders: params.folders});

    tcUtils.listFolders({folders: params.folders})
    .then(function(files){

      files = files.slice(0,MAX_LOAD_USERS);

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | loadUserDataFolders | FOUND " + files.length + " FILES IN USER DATA FOLDERS"));

      trainingSetUsersHashMap.left.clear();
      trainingSetUsersHashMap.neutral.clear();
      trainingSetUsersHashMap.right.clear();

      statsObj.users.loaded = 0;

      // for (const fileObj of files) {

      async.eachLimit(files, 10, async function(fileObj){

        try{
          if (fileObj.file.includes("conflicted copy")) {
            console.log(chalkInfo(MODULE_ID_PREFIX + " | loadUserDataFolders | XXX DELETING | " + fileObj.path));
            shell.rm(fileObj.path);
            return;
          }

          if (!fileObj.file.endsWith(".json")) {
            console.log(chalkInfo(MODULE_ID_PREFIX + " | loadUserDataFolders | --- SKIPPING | " + fileObj.file));
            return;
          }

          // if (verbose) {
            const fileNameArray = fileObj.file.split(".");
            const userNodeId = fileNameArray[0];
            console.log(chalkInfo(MODULE_ID_PREFIX + " | loadUserDataFolders | +++ USER FOUND"
              + " | " + fileObj.path
              + " | NID: " + userNodeId
            ));
          // }

          await loadUserDataFile(fileObj);

          return;
        }
        catch(err){
          return reject(err);
        }

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** loadUserDataFolders ERROR: " + err));
          return reject(err);
        }

        console.log(chalkBlue(MODULE_ID_PREFIX + " | loadUserDataFolders COMPLETE"));

        resolve();

      });

      return;

    })
    .catch(function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** loadUserDataFolders ERROR: " + err));
    });

  });
}

function dataSetPrep(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    const dataSetObj = params.dataSetObj;

    const binaryMode = params.binaryMode || false;;
    const logScaleMode = params.logScaleMode || false;
    const userProfileOnlyFlag = params.userProfileOnlyFlag || false;

    const dataSet = [];

    let dataConverted = 0;

    dataSetObj.meta.numInputs = params.numInputs;

    console.log(chalkBlue(MODULE_ID_PREFIX
      + " | DATA SET preppedOptions"
      + " | DATA LENGTH: " + dataSetObj.data.length
      + " | INPUTS: " + params.numInputs
      + " | USER PROF ONLY: " + userProfileOnlyFlag
      + " | BIN: " + binaryMode
      + " | LSM: " + logScaleMode
      + "\nDATA SET META\n" + jsonPrint(dataSetObj.meta)
    ));

    const shuffledData = _.shuffle(dataSetObj.data);

    let totalHits = 0;
    let totalMisses = 0;
    let totalInputHitRate = 0;

    async.eachSeries(shuffledData, function(user, cb){

      try {

        if ((!user.profileHistograms || user.profileHistograms === undefined || user.profileHistograms === {}) 
          && (!user.tweetHistograms || user.tweetHistograms === undefined || user.tweetHistograms === {})){
          console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" + user.screenName));
          return cb();
        }

        tcUtils.convertDatumOneNetwork({
          user: user,
          inputsId: params.inputsId,
          numInputs: params.numInputs,
          userProfileCharCodesOnlyFlag: params.userProfileCharCodesOnlyFlag,
          verbose: params.verbose
        }).
        then(function(results){

          if (results.emptyFlag) {
            return cb();
          }

          dataConverted += 1;

          if (results.datum.input.length !== params.numInputs) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | INPUT NUMBER MISMATCH" 
              + " | INPUTS NUM IN: " + params.numInputs
              + " | DATUM NUM IN: " + results.datum.input.length
            ));
            return cb(new Error("INPUT NUMBER MISMATCH"));
          }

          if (results.datum.output.length !== 3) { 
            console.log(chalkError(MODULE_ID_PREFIX
              + " | *** ERROR DATA SET PREP ERROR" 
              + " | OUTPUT NUMBER MISMATCH" 
              + " | OUTPUTS NUM IN: " + params.numOutputs
              + " | DATUM NUM IN: " + results.datum.output.length
            ));
            return cb(new Error("OUTPUT NUMBER MISMATCH"));
          }

          for(const inputValue of results.datum.input){
            if (typeof inputValue !== "number") {
              return cb(new Error("INPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | INPUT TYPE: " + typeof inputValue));
            }
            if (inputValue < 0) {
              return cb(new Error("INPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | INPUT: " + inputValue));
            }
            if (inputValue > 1) {
              return cb(new Error("INPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | INPUT: " + inputValue));
            }
          }

          for(const outputValue of results.datum.output){
            if (typeof outputValue !== "number") {
              return cb(new Error("OUTPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | OUTPUT TYPE: " + typeof outputValue));
            }
            if (outputValue < 0) {
              return cb(new Error("OUTPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
            if (outputValue > 1) {
              return cb(new Error("OUTPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | OUTPUT: " + outputValue));
            }
          }

          dataSet.push({
            user: results.user, 
            screenName: user.screenName, 
            name: results.datum.name, 
            input: results.datum.input, 
            output: results.datum.output,
            inputHits: results.inputHits,
            inputMisses: results.inputMisses,
            inputHitRate: results.inputHitRate
          });

          totalMisses += results.inputMisses;
          totalHits += results.inputHits;
          totalInputHitRate = 100*(totalHits/(totalHits+totalMisses));

          // if (dataConverted % 100 === 0){
            console.log(chalkLog(MODULE_ID_PREFIX 
              + " | HIT RATE: " + totalInputHitRate.toFixed(3) + "%"
              + " | DATA CONVERTED: " + dataConverted + "/" + dataSetObj.data.length
            ));
          // }

          cb();
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** ERROR convertDatumOneNetwork: " + err 
          ));
          cb(err);
        });

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR DATA SET PREP: " + err 
        ));
        return cb(err);
      }

    }, function(err){

      if (err) {
        return reject(err);
      }

      console.log(chalkBlue(MODULE_ID_PREFIX + " | DATA SET PREP COMPLETE | DATA SET LENGTH: " + dataSet.length));

      const stats = {totalHits: totalHits, totalMisses: totalMisses, totalInputHitRate: totalInputHitRate};
      resolve({dataSet: dataSet, stats: stats});

    });

  });
}

function updateTrainingSet(p){

  console.log(chalkBlue(MODULE_ID_PREFIX + " | UPDATE TRAINING SET"));

  const params = p || {};

  const equalCategoriesFlag = (params.equalCategoriesFlag !== undefined) ? params.equalCategoriesFlag : configuration.equalCategoriesFlag;

  return new Promise(function(resolve, reject) {

    try {

      trainingSetObj = {};
      trainingSetObj.meta = {};
      // trainingSetObj.meta.archiveId = statsObj.archiveFile;
      trainingSetObj.meta.numInputs = 0;
      trainingSetObj.meta.numOutputs = 3;
      trainingSetObj.meta.setSize = 0;
      trainingSetObj.data = [];

      testSetObj = {};
      testSetObj.meta = {};
      testSetObj.meta.numInputs = 0;
      testSetObj.meta.numOutputs = 3;
      testSetObj.meta.setSize = 0;
      testSetObj.data = [];

      const minCategorySize = Math.min(
        trainingSetUsersHashMap.left.size, 
        trainingSetUsersHashMap.neutral.size, 
        trainingSetUsersHashMap.right.size
      );

      async.eachSeries(["left", "neutral", "right"], function(category, cb){

        const categorySize = (equalCategoriesFlag) ? minCategorySize : trainingSetUsersHashMap[category].size;

        const trainingSetSize = parseInt((1 - configuration.testSetRatio) * categorySize);
        const testSetSize = parseInt(configuration.testSetRatio * categorySize);

        const shuffledTrainingSet = _.shuffle(trainingSetUsersHashMap[category].values());

        const trainingSetData = shuffledTrainingSet.slice(0, trainingSetSize);
        const testSetData = shuffledTrainingSet.slice(trainingSetSize, trainingSetSize+testSetSize);

        trainingSetObj.data = trainingSetObj.data.concat(trainingSetData);
        testSetObj.data = testSetObj.data.concat(testSetData);

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET | " + category.toUpperCase()
          + " | EQ CATEGORIES FLAG: " + equalCategoriesFlag
          + " | MIN CAT SIZE: " + minCategorySize
          + " | CAT SIZE: " + categorySize
          + " | TRAIN SIZE: " + trainingSetSize
          + " | TEST SIZE: " + testSetSize
          + " | TRAIN SET DATA SIZE: " + trainingSetObj.data.length
        ));

        cb();

      }, function(err){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** UPDATE TRAINING SET ERROR: " + err));
          return reject(err);
        }

        trainingSetObj.data = _.shuffle(trainingSetObj.data);
        testSetObj.data = _.shuffle(testSetObj.data);

        trainingSetObj.meta.setSize = trainingSetObj.data.length;
        testSetObj.meta.setSize = testSetObj.data.length;

        if (nnTools.getMaxInputHashMap()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | maxInputHashMap"
            + "\n" + jsonPrint(Object.keys(nnTools.getMaxInputHashMap()))
          ));
        }

        if (nnTools.getNormalization()) {
          console.log(chalkLog(MODULE_ID_PREFIX + " | NORMALIZATION"
            + "\n" + jsonPrint(nnTools.getNormalization())
          ));
        }

        console.log(chalkLog(MODULE_ID_PREFIX + " | TRAINING SET"
          + " | SIZE: " + trainingSetObj.meta.setSize
          + " | TEST SIZE: " + testSetObj.meta.setSize
        ));

        resolve();

      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** updateTrainingSet ERROR:", err));
      reject(err);
    }

  });
}

// function dataSetPrep(params, dataSetObj){

//   return new Promise(function(resolve, reject){

//     const userProfileCharCodesOnlyFlag = (params.userProfileCharCodesOnlyFlag !== undefined) ? params.userProfileCharCodesOnlyFlag : false;
//     const binaryMode = (params.binaryMode !== undefined) ? params.binaryMode : configuration.binaryMode;
//     const logScaleMode = (params.logScaleMode !== undefined) ? params.logScaleMode : configuration.logScaleMode;
//     const userProfileOnlyFlag = (params.userProfileOnlyFlag !== undefined) ? params.userProfileOnlyFlag : configuration.userProfileOnlyFlag;

//     const dataSet = [];

//     let dataConverted = 0;

//     const numCharInputs = configuration.userCharCountScreenName 
//       + configuration.userCharCountName 
//       + configuration.userCharCountDescription 
//       + configuration.userCharCountLocation;

//     if (userProfileCharCodesOnlyFlag){
//       dataSetObj.meta.numInputs = numCharInputs;
//       childNetworkObj.numInputs = numCharInputs;
//     }
//     else{
//       dataSetObj.meta.numInputs = childNetworkObj.numInputs;
//     }

//     console.log(chalkBlue(MODULE_ID_PREFIX
//       + " | DATA SET preppedOptions"
//       + " | DATA LENGTH: " + dataSetObj.data.length
//       + " | INPUTS: " + dataSetObj.meta.numInputs
//       + " | USER PROFILE ONLY: " + userProfileOnlyFlag
//       + " | BIN MODE: " + binaryMode
//       + " | LOG SCALE MODE: " + logScaleMode
//       + "\nDATA SET META\n" + jsonPrint(dataSetObj.meta)
//     ));

//     const shuffledData = _.shuffle(dataSetObj.data);

//     // async.eachSeries(shuffledData, async function(user){
//     async.eachLimit(shuffledData, 20, async function(user){

//       try {

//         if (!userProfileCharCodesOnlyFlag
//           && (!user.profileHistograms || user.profileHistograms === undefined || user.profileHistograms === {}) 
//           && (!user.tweetHistograms || user.tweetHistograms === undefined || user.tweetHistograms === {}))
//         {
//           console.log(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY USER HISTOGRAMS ... SKIPPING | @" + user.screenName));
//           return;
//         }

//         const results = await tcUtils.convertDatumOneNetwork({
//           primaryInputsFlag: true, 
//           user: user,
//           inputsId: params.inputsId,
//           userProfileCharCodesOnlyFlag: userProfileCharCodesOnlyFlag,
//           userProfileOnlyFlag: userProfileOnlyFlag,
//           binaryMode: binaryMode, 
//           logScaleMode: logScaleMode, 
//           verbose: params.verbose
//         });


//        if (results.emptyFlag) {
//           debug(chalkAlert(MODULE_ID_PREFIX + " | !!! EMPTY CONVERTED DATUM ... SKIPPING | @" + user.screenName));
//           return;
//         }

//         dataConverted += 1;

//         if (results.datum.input.length !== childNetworkObj.numInputs) { 
//           console.log(chalkError(MODULE_ID_PREFIX
//             + " | *** ERROR DATA SET PREP ERROR" 
//             + " | INPUT NUMBER MISMATCH" 
//             + " | INPUTS NUM IN: " + childNetworkObj.numInputs
//             + " | DATUM NUM IN: " + results.datum.input.length
//           ));
//           throw new Error("INPUT NUMBER MISMATCH");
//         }

//         if (results.datum.output.length !== 3) { 
//           console.log(chalkError(MODULE_ID_PREFIX
//             + " | *** ERROR DATA SET PREP ERROR" 
//             + " | OUTPUT NUMBER MISMATCH" 
//             + " | OUTPUTS NUM IN: " + childNetworkObj.numOutputs
//             + " | DATUM NUM IN: " + results.datum.output.length
//           ));
//           throw new Error("OUTPUT NUMBER MISMATCH");
//         }

//         for(const inputValue of results.datum.input){
//           if (typeof inputValue !== "number") {
//             console.log(chalkAlert("INPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | INPUT TYPE: " + typeof inputValue));
//             return;
//           }
//           if (inputValue < 0) {
//             console.log(chalkAlert("INPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | INPUT: " + inputValue));
//             return;
//           }
//           if (inputValue > 1) {
//             console.log(chalkAlert("INPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | INPUT: " + inputValue));
//             return;
//           }
//         }

//         for(const outputValue of results.datum.output){
//           if (typeof outputValue !== "number") {
//             console.log(chalkAlert("OUTPUT VALUE NOT TYPE NUMBER | @" + results.user.screenName + " | OUTPUT TYPE: " + typeof outputValue));
//             return;
//           }
//           if (outputValue < 0) {
//             console.log(chalkAlert("OUTPUT VALUE LESS THAN ZERO | @" + results.user.screenName + " | OUTPUT: " + outputValue));
//             return;
//           }
//           if (outputValue > 1) {
//             console.log(chalkAlert("OUTPUT VALUE GREATER THAN ONE | @" + results.user.screenName + " | OUTPUT: " + outputValue));
//             return;
//           }
//         }

//         dataSet.push({
//           user: results.user, 
//           screenName: user.screenName, 
//           name: results.datum.name, 
//           input: results.datum.input, 
//           output: results.datum.output,
//           inputHits: results.inputHits,
//           inputMisses: results.inputMisses,
//           inputHitRate: results.inputHitRate
//         });

//         if (configuration.verbose || (dataConverted % 1000 === 0) || configuration.testMode && (dataConverted % 100 === 0)){
//           console.log(chalkLog(MODULE_ID_PREFIX + " | DATA CONVERTED: " + dataConverted + "/" + dataSetObj.data.length));
//         }

//       }
//       catch(err){
//         console.log(chalkError(MODULE_ID_PREFIX
//           + " | *** ERROR DATA SET PREP: " + err 
//         ));
//         return reject(err);
//       }

//     }, function(err){

//       if (err) {
//         console.log(chalkError(MODULE_ID_PREFIX + " | *** DATA SET PREP ERROR: " + err));
//         return reject(err);
//       }

//       console.log(chalkBlue(MODULE_ID_PREFIX + " | DATA SET PREP COMPLETE | DATA SET LENGTH: " + dataSet.length));

//       resolve(dataSet);

//     });

//   });
// }

// async function main(){

//   await connectDb();

//   // console.log("LOAD " + userArchiveFolder + "/" + defaultUserArchiveFlagFile);

//   // const inputsObj = await tcUtils.loadFileRetry({folder: defaultInputsFolder, file: "inputs_20200316_090216_1547_profile_google_27497.json"});
//   // const inputsObj = await tcUtils.loadFileRetry({folder: defaultInputsFolder, file: DEFAULT_USER_PROFILE_ONLY_INPUTS_FILE});

//   // const archiveFlagObj = await tcUtils.loadFileRetry({folder: userArchiveFolder, file: defaultUserArchiveFlagFile});

//   // await loadUsersArchive({folder: userArchiveFolder, file: archiveFlagObj.file, size: archiveFlagObj.size});


//   await nnTools.setNormalization(maxNormObj.normalization);
//   await nnTools.setUserProfileOnlyFlag(false);

//   // const networkIdArray = await loadNetworks(testNetworkFolder);
//   const networkIdArray = await loadNetworksDb();

//   const randomNnId = randomItem(networkIdArray);

//   console.log("setPrimaryNeuralNetwork: " + randomNnId);

//   await nnTools.setPrimaryNeuralNetwork(randomNnId);

//   // await nnTools.loadInputs({ inputsObj: inputsObj});
//   // await nnTools.setPrimaryInputs(inputsObj.inputsId);

//   const totalIterations = TOTAL_ITERATIONS;

//   // await loadUserDataFolders({folders:[userDataFolder]});
//   // await updateTrainingSet();

//   // const preppedTrainingSet = await dataSetPrep(preppedSetsConfig, trainingSetObj);

//   // const scheduleQueue = [];
//   // const schedStartTime = moment().valueOf();

//   // const schedule = function(schedParams){

//   //   const elapsedInt = moment().valueOf() - schedStartTime;
//   //   const iterationRate = elapsedInt/(schedParams.iterations+1);
//   //   const timeToComplete = iterationRate*(totalIterations - (schedParams.iterations+1));

//   //   const sObj = {
//   //     networkTechnology: "neataptic",
//   //     binaryMode: false,
//   //     networkId: "nn_test",
//   //     numInputs: inputsObj.meta.numInputs,
//   //     inputsId: inputsObj.inputsId,
//   //     evolveStart: schedStartTime,
//   //     evolveElapsed: elapsedInt,
//   //     totalIterations: totalIterations,
//   //     iteration: schedParams.iterations+1,
//   //     iterationRate: iterationRate,
//   //     timeToComplete: timeToComplete,
//   //     error: schedParams.error.toFixed(5) || Infinity,
//   //     // fitness: schedParams.fitness.toFixed(5) || -Infinity
//   //   };

//   //   console.log(chalkLog(MODULE_ID_PREFIX 
//   //     + " | " + sObj.networkId 
//   //     + " | " + sObj.networkTechnology.slice(0,1).toUpperCase()
//   //     + " | " + sObj.networkId
//   //     + " | " + sObj.inputsId
//   //     + " | ERR " + sObj.error
//   //     // + " | FIT " + fitness
//   //     + " | R " + tcUtils.msToTime(sObj.evolveElapsed)
//   //     + " | ETC " + tcUtils.msToTime(sObj.timeToComplete) + " " + moment().add(sObj.timeToComplete).format(compactDateTimeFormat)
//   //     + " | " + (sObj.iterationRate/1000.0).toFixed(1) + " spi"
//   //     + " | I " + sObj.iteration + "/" + sObj.totalIterations
//   //   ));
//   // };

//   // const evolveOptions = {
//   //   error: 0.1,
//   //   learningRate: 0.1,
//   //   momentum: 0.1,
//   //   iterations: totalIterations,
//   //   schedule: schedule
//   // };

//   // const trainingResults = await nnTools.streamTrainNetwork({
//   //   options: evolveOptions,
//   //   network: network, 
//   //   trainingSet: preppedTrainingSetObj.dataSet
//   // });

//   // network = trainingResults.network;

//   // const preppedTestSetObj = await dataSetPrep({
//   //   inputsId: inputsObj.inputsId,
//   //   numInputs: inputsObj.meta.numInputs,
//   //   userProfileCharCodesOnlyFlag: inputsObj.meta.userProfileCharCodesOnlyFlag,
//   //   dataSetObj: testSetObj, 
//   //   userProfileOnlyFlag: false,
//   //   binaryMode: true
//   // });

//   // let successRate = 0;
//   // let numPassed = 0;

//   // for (let i=0; i < preppedTestSetObj.dataSet.length; i++){

//   //   const outputObj = network.run(preppedTestSetObj.dataSet[i].input);
//   //   const outputRaw = [];
//   //   outputRaw.push(outputObj["0"]);
//   //   outputRaw.push(outputObj["1"]);
//   //   outputRaw.push(outputObj["2"]);
//   //   // console.log("outputRaw\n" + jsonPrint(outputRaw));
//   //   const nnOutputIndex = await tcUtils.indexOfMax(outputRaw);
//   //   const expectedOutputIndex = await tcUtils.indexOfMax(preppedTestSetObj.dataSet[i].output);
//   //   const pass = (nnOutputIndex === expectedOutputIndex) ? "PASS" : "FAIL";

//   //   if (pass === "PASS") { numPassed++; }

//   //   successRate = 100*(numPassed/(i+1));

//   //   console.log("testSet [" + i + "]"
//   //     + " | SR: " + successRate.toFixed(3) + "%"
//   //     + " | " + pass
//   //     + " | CAT: " + formatCategory(preppedTestSetObj.dataSet[i].user.category)
//   //     + " | OUT: " + nnOutputIndex 
//   //     + " | EXP: " + expectedOutputIndex 
//   //     + " | @" + preppedTestSetObj.dataSet[i].user.screenName
//   //   );
//   // }



//   // const userArray = await loadUsers(userDataFolder);

//   // console.log("userArray.length: " + userArray.length);

//   // await activateUsers();

//   const cursor = await global.wordAssoDb.User
//     .find({categorized: true, friends: { $exists: true, $ne: [] }})
//     .lean()
//     .limit(100)
//     .cursor();

//   const bucket = {};
//   let count = 0;

//   await cursor.eachAsync(async function(user){
//     if (!user) {
//       cursor.close();
//     }

//     console.log("USER | " + printUser({user: user}));

//     const results = await tcUtils.updateGlobalHistograms({user: user, verbose: true});

//   });

//   const statsObj = await nnTools.getNetworkStats();
//   console.log("statsObj.bestNetwork\n" + jsonPrint(statsObj.bestNetwork));
//   console.log("statsObj.currentBestNetwork\n" + jsonPrint(statsObj.currentBestNetwork));

//   await nnTools.deleteAllNetworks();
  
//   return;
// }

async function main(){

  await connectDb();
  await nnTools.setUserProfileOnlyFlag(false);

  const networkIdArray = await loadNetworksDb();

  const randomNnId = randomItem(networkIdArray);

  console.log("setPrimaryNeuralNetwork: " + randomNnId);

  await nnTools.setPrimaryNeuralNetwork(randomNnId);

  const totalIterations = TOTAL_ITERATIONS;

  const cursor = await global.wordAssoDb.User
    .find({categorized: true, friends: { $exists: true, $ne: [] }})
    .lean()
    .limit(100)
    .cursor();

  await cursor.eachAsync(async function(user){
    if (!user) {
      cursor.close();
    }

    console.log("USER | " + tcUtils.userText({user: user}));

    const noutObj = await nnTools.activate({
      user: user, 
      // binaryMode: params.binaryMode, 
      // logScaleMode: params.logScaleMode, 
      convertDatumFlag: true,
      verbose: true
    });

    // const results = await tcUtils.updateGlobalHistograms({user: user, verbose: true});

  });

  // const statsObj = await nnTools.getNetworkStats();
  // console.log("statsObj.bestNetwork\n" + jsonPrint(statsObj.bestNetwork));
  // console.log("statsObj.currentBestNetwork\n" + jsonPrint(statsObj.currentBestNetwork));

  await nnTools.deleteAllNetworks();
  
  return;
}

main()
.then(function(){
  console.log("NNT | DONE");
  process.exit();
})
.catch(function(err){
  console.log("NNT | *** TEST ACTIVATE setPrimaryNeuralNetwork ERROR: " + err);
  process.exit();
});
