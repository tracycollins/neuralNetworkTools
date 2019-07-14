
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

// const test_nn = require("./mms2_20190712_140136_1.json");
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

  // describe('#getNormalization()', function() {
  //   it('should get undefined normalization', function() {
  //     assert.equal(nnTools.getNormalization(), undefined);
  //   });
  // });
  
  // describe('#setNormalization()', function() {
  //   it('should get undefined network', function() {
  //     assert.equal(nnTools.setNormalization(maxNormObj.normalization), undefined);
  //   });
  // });
  
  // describe('#getNormalization()', function() {
  //   it('should get normalization', function() {
  //     assert.deepEqual(nnTools.getNormalization(), maxNormObj.normalization);
  //   });
  // });

  // describe('#getMaxInputHashMap()', function() {
  //   it('should get undefined result', function() {
  //     assert.equal(nnTools.getMaxInputHashMap(), undefined);
  //   });
  // });
  
  // describe('#setMaxInputHashMap()', function() {
  //   it('should get undefined result', function() {
  //     assert.equal(nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap), undefined);
  //   });
  // });
  
  // describe('#getMaxInputHashMap()', function() {
  //   it('should get maxInputHashMap', function() {
  //     assert.deepEqual(nnTools.getMaxInputHashMap(), maxNormObj.maxInputHashMap, "maxInputHashMap ERROR");
  //   });
  // });

  // describe('#getPrimaryNeuralNetwork()', function() {
  //   it('should get undefined network', function() {
  //     assert.equal(nnTools.getPrimaryNeuralNetwork(), undefined);
  //   });
  // });
  
  // describe('#setPrimaryNeuralNetwork()', function() {
  //   it('should set network, result is networkId', async function() {
  //     assert.equal(await nnTools.setPrimaryNeuralNetwork(test_nn), test_nn.networkId);
  //   });
  // });

  // describe('#getPrimaryNeuralNetwork()', function() {
  //   it('should get test network', function() {
  //     assert.equal(nnTools.getPrimaryNeuralNetwork().networkId, test_nn.networkId);
  //   });
  // });
 
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

	describe("#activate()", function() {

    it('should init networks', async function() {

    	const networkIdArray = [];

			try{

				const networksFolder = path.join(__dirname, "networks");

				fs.readdirSync(networksFolder).forEach(file => {

					if (file.endsWith(".json") && !file.includes("bestRuntimeNetwork")) {

						const nnId = file.replace(".json", "");

		      	console.log("NETWORK LOAD: " + file);

						const nn = require("./networks/" + nnId + ".json");

						networkIdArray.push(nnId);

		        (nnTools.loadNetwork({networkObj: nn})).should.be.fulfilled();
		      }
		      else{
		      	console.log("... SKIPPING NETWORK LOAD: " + file);
		      }

				});

				console.log("FOUND " + nnTools.getNumberNetworks() + " NETWORKS");


				const randomNnId = randomItem(networkIdArray);

        (nnTools.setPrimaryNeuralNetwork(randomNnId)).should.be.fulfilled();

        (nnTools.setMaxInputHashMap(maxNormObj.maxInputHashMap)).should.be.fulfilled();
        (nnTools.setNormalization(maxNormObj.normalization)).should.be.fulfilled();
			}
			catch(err){
			  if (err) { console.log("NNT | *** TEST ACTIVATE setPrimaryNeuralNetwork ERROR: " + err); }
			  assert.ifError(err);
			}
		});

		async.each(testUsersArray, function(user, cb){

	    it('should get network activate results', async function() {
	    	try{
	    		// let results;
	        // (results = await nnTools.activate({user: user, verbose: true})).should.be.fulfilled();
		      const results = await nnTools.activate({user: user, updateStats: true, verbose: false});

		      console.log("NNT | NN ACTIVATE RESULTS"
		      	// + " | NN: " + test_nn.networkId
		      	// + " | " + results.networkOutput[test_nn.networkId].output
		      	// + " | MATCH: " + results.networkOutput[test_nn.networkId].match
		      	+ " | @" + results.user.screenName
		      	+ " | CM: " + results.user.category + " CA: " + results.user.categoryAuto
		      	// + "\n" + jsonPrint(results.networkOutput)
		      );

		      should.equal(results.user.screenName, user.screenName);
		      // should.exist(results.networkOutput[test_nn.networkId].output);
		      // results.networkOutput[test_nn.networkId].output.should.have.length(3);

			    // const networkOutput = params.networkOutput; // array of networks
			    // const expectedOutput = params.expectedOutput;

		      const currentBestNetworkStats = await nnTools.updateNetworkStats({
		      	networkOutput: results.networkOutput, 
		      	expectedCategory: results.user.category
		      });

		      console.log("NNT | NN UPDATE STATS | BEST NETWORK"
		      	+ " | " + currentBestNetworkStats.networkId
		      	+ " | " + currentBestNetworkStats.inputsId
		      	+ " | RANK: " + currentBestNetworkStats.rank
		      	+ " | " + currentBestNetworkStats.match + "/" + currentBestNetworkStats.total
		      	+ " | MR: " + currentBestNetworkStats.matchRate.toFixed(2) + "%"
		      	+ " | MATCH FLAG: " + currentBestNetworkStats.matchFlag
		      	// + "\n" + jsonPrint(currentBestNetworkStats)
		      );

	        // statsObj.loadedNetworks[nnId] = {};
	        // statsObj.loadedNetworks[nnId].networkId = nnId;
	        // statsObj.loadedNetworks[nnId].inputsId = nn.inputsId;
	        // statsObj.loadedNetworks[nnId].numInputs = nn.numInputs;
	        // statsObj.loadedNetworks[nnId].output = [];
	        // statsObj.loadedNetworks[nnId].successRate = nn.successRate;
	        // statsObj.loadedNetworks[nnId].matchRate = nn.matchRate;
	        // statsObj.loadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
	        // statsObj.loadedNetworks[nnId].rank = Infinity;
	        // statsObj.loadedNetworks[nnId].total = 0;
	        // statsObj.loadedNetworks[nnId].match = 0;
	        // statsObj.loadedNetworks[nnId].mismatch = 0;
	        // statsObj.loadedNetworks[nnId].matchFlag = false;
	        // statsObj.loadedNetworks[nnId].left = 0;
	        // statsObj.loadedNetworks[nnId].neutral = 0;
	        // statsObj.loadedNetworks[nnId].right = 0;
	        // statsObj.loadedNetworks[nnId].positive = 0;
	        // statsObj.loadedNetworks[nnId].negative = 0;

		      should.exist(currentBestNetworkStats);
		      currentBestNetworkStats.matchRate.should.be.a.Number();

		      cb();
	    	}
	    	catch(err){
	        console.log("NNT | *** TEST ACTIVATE ERROR: " + err);
	        should.not.exist(err);
	        return cb(err);
	    	}
	    });

		}, function(err){
	    if (err) { console.log("NNT | *** TEST ACTIVATE ERROR: " + err); }
	    should.not.exist(err);

      console.log("NNT | TEST ACTIVATE END");
		});


	});

});
