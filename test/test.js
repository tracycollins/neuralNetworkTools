
const fs = require("fs");
const path = require("path");
const async = require("async");
const debug = require("debug");
const should = require("should");
const assert = require("assert");
const randomItem = require("random-item");

const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

const treeify = require("treeify");
const cp = require("child_process");

const tcuChildName = + "NNT_TEST_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;

const test_inputsObj = require("./test_inputsObj.json");

const test_user_tobi = require("./test_user_tobi.json");
const test_user_hector = require("./test_user_hector.json");

const testUsersArray = [];
testUsersArray.push(test_user_tobi);
testUsersArray.push(test_user_hector);

const NeuralNetworkTools = require("../index.js");
const nnTools = new NeuralNetworkTools("TEST");

let dbOptions = { 
	useNewUrlParser: true,
	keepAlive: 120,
	autoReconnect: true,
	autoIndex: false,
	reconnectTries: Number.MAX_VALUE,
	socketTimeoutMS: 90000,
	connectTimeoutMS: 0,
	poolSize: 100
};

const DEFAULT_INPUT_TYPES = [
	"emoji",
	"hashtags",
	"images",
	"media",
	"mentions",
	"locations",
	"places",
	"sentiment",
	"urls",
	"userMentions",
	// "squirrel",
	"words"
];

mongoose.connect("mongodb://localhost/test", dbOptions);

const db = mongoose.connection;

global.globalDbConnection = db;

const emojiModel = require("@threeceelabs/mongoose-twitter/models/emoji.server.model");
const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
const locationModel = require("@threeceelabs/mongoose-twitter/models/location.server.model");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");
const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

global.globalEmoji = global.globalDbConnection.model("Emoji", emojiModel.EmojiSchema);
global.globalHashtag = global.globalDbConnection.model("Hashtag", hashtagModel.HashtagSchema);
global.globalLocation = global.globalDbConnection.model("Location", locationModel.LocationSchema);
global.globalMedia = global.globalDbConnection.model("Media", mediaModel.MediaSchema);
global.globalNeuralNetwork = global.globalDbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
global.globalPlace = global.globalDbConnection.model("Place", placeModel.PlaceSchema);
global.globalTweet = global.globalDbConnection.model("Tweet", tweetModel.TweetSchema);
global.globalUrl = global.globalDbConnection.model("Url", urlModel.UrlSchema);
global.globalUser = global.globalDbConnection.model("User", userModel.UserSchema);
global.globalWord = global.globalDbConnection.model("Word", wordModel.WordSchema);

let NeuralNetwork = global.globalNeuralNetwork;
let Emoji = global.globalEmoji;
let Hashtag = global.globalHashtag;
let Location = global.globalLocation;
let Media = global.globalMedia;
let Place = global.globalPlace;
let Tweet = global.globalTweet;
let Url = global.globalUrl;
let User = global.globalUser;
let Word = global.globalWord;

const UserServerController = require("@threeceelabs/user-server-controller");
const userServerController = new UserServerController("WAS_TEST_USC");

const maxNormObj = require("./maxInputHashMap.json");

describe("mongoose", function() {

  beforeEach(async function() {
	  await User.deleteMany({}); // Delete all users
  });

  afterEach(async function() {
	  await User.deleteMany({}); // Delete all users
  });

  after(async function() {
	  if (db !== undefined) { db.close(); }
  });
 
  describe("users", function() {

    it("create and find 1 user", async function() {

		  let tobi = new User(test_user_tobi);

		  let savedUser0 = await tobi.save();

		  const res = await User.find({});

      res.should.have.length(1);
      res[0].should.have.property("name", "tobi");

      debug(res[0].name);
    });
    
    it("create and find 2 users", async function() {

		  let tobi = new User(test_user_tobi);
		  let hector = new User(test_user_hector);

		  let savedUser0 = await tobi.save();
		  let savedUser1 = await hector.save();

		  const res = await User.find({});

      res.should.have.length(2);
      res[0].should.have.property("name", "tobi");
      res[1].should.have.property("name", "hector");
    });
  });

  let currentBestNetworkStats = {};

	describe("#activate()", async function() {

  	const userArray = [];
  	const networkIdArray = [];

    // it('should init networks', async function() {

			try{

				const usersFolder = path.join(__dirname, "users");
				const networksFolder = path.join(__dirname, "networks");

				fs.readdirSync(usersFolder).forEach(file => {

					if (file.startsWith("user_") && file.endsWith(".json")) {
						const userId = file.replace(".json", "");
		      	console.log("USER LOAD: " + file);
						const user = require("./users/" + userId + ".json");
						userArray.push(user);
		      }
		      else{
		      	console.log("... SKIPPING USER LOAD: " + file);
		      }
				});

				console.log("FOUND " + userArray.length + " USERS IN " + usersFolder);

				fs.readdirSync(networksFolder).forEach(async function(file){

					if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

						const nnId = file.replace(".json", "");

		      	// console.log("NETWORK LOAD: " + file);

						const nn = require("./networks/" + nnId + ".json");

						networkIdArray.push(nnId);

						await nnTools.loadNetwork({networkObj: nn});

		        // (await nnTools.loadNetwork({networkObj: nn})).should.be.fulfilled();
		      }
		      else{
		      	console.log("... SKIPPING NETWORK LOAD: " + file);
		      }
				});

				console.log("FOUND " + nnTools.getNumberNetworks() + " NETWORKS IN " + networksFolder);

				const randomNnId = randomItem(networkIdArray);

				await nnTools.setPrimaryNeuralNetwork(randomNnId);
				await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap);
				await nnTools.setNormalization(maxNormObj.normalization);

		    // it('should init networks', async function() {

	     //    (await nnTools.setPrimaryNeuralNetwork(randomNnId)).should.be.fulfilled();
	     //    (await nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap)).should.be.fulfilled();
	     //    (await nnTools.setNormalization(maxNormObj.normalization)).should.be.fulfilled();
	     //  });

				async.eachSeries(userArray, async function(user){

					console.log("user @" + user.screenName + " | " + user.category);

		    	try{

			      const resultsActivate = await nnTools.activate({user: user, updateStats: true, verbose: false});
	          // resultsActivate.user,
	          // resultsActivate.networkOutput

			      console.log("NNT | NN ACTIVATE RESULTS"
			      	+ " | @" + resultsActivate.user.screenName
			      	+ " | CM: " + resultsActivate.user.category + " CA: " + resultsActivate.user.categoryAuto
			      );

			      // should.equal(resultsActivate.user.screenName, user.screenName);

			      currentBestNetworkStats = await nnTools.updateNetworkStats(resultsActivate);

			      console.log("NNT | NN UPDATE STATS | BEST NETWORK"
			      	+ " | " + currentBestNetworkStats.networkId
			      	+ " | " + currentBestNetworkStats.inputsId
			      	+ " | RANK: " + currentBestNetworkStats.rank
			      	+ " | " + currentBestNetworkStats.meta.match + "/" + currentBestNetworkStats.meta.total
			      	+ " | MR: " + currentBestNetworkStats.matchRate.toFixed(2) + "%"
			      	+ " | OUT: " + currentBestNetworkStats.meta.output
			      	+ " | MATCH: " + currentBestNetworkStats.meta.matchFlag
			      );

			      // console.log(currentBestNetworkStats);

			      return;
		    	}
		    	catch(err){
		        console.log("NNT | *** TEST ACTIVATE EACH ERROR: " + err);
		        should.not.exist(err);
		        return err;
		    	}

				}, async function(err){

			    if (err) { console.log("NNT | *** TEST ACTIVATE ERROR: " + err); }

		      try{
			      const title = "BEST NETWORK"
			      	+ " | " + currentBestNetworkStats.networkId
			      	+ " | " + currentBestNetworkStats.inputsId
			      	+ " | RANK: " + currentBestNetworkStats.rank
			      	+ " | " + currentBestNetworkStats.match + "/" + currentBestNetworkStats.total
			      	+ " | MR: " + currentBestNetworkStats.matchRate.toFixed(2) + "%"
			      	+ " | OUT: " + currentBestNetworkStats.output
			      	+ " | MATCH: " + currentBestNetworkStats.matchFlag;

						await nnTools.printNetworkResults();

				    // it('should update network stats', async function() {
				    //   should.exist(currentBestNetworkStats);
				    //   currentBestNetworkStats.matchRate.should.be.a.Number();
				    // });

		      }
		      catch(err){
		        console.log("NNT | *** TEST ACTIVATE ERROR: " + err);
		        should.not.exist(err);
		        return cb(err);
		      }

		      console.log("NNT | TEST ACTIVATE END");
				});
			}
			catch(err){
			  if (err) { console.log("NNT | *** TEST ACTIVATE setPrimaryNeuralNetwork ERROR: " + err); }
			  assert.ifError(err);
			}

		// });


	});
});
