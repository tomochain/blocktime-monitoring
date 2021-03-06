const fs = require("fs");
const config = require("config");
const utils = require("./utils");
const masternodeName = require("./masternodes.json");
const web3 = require("./web3");
const { exec } = require("child_process");

const notiBot = require("noti_bot");

const THRESHOLD = config.get("blockTimeThreshold") || 60;

const CURRENT_BLOCK_FILENAME = "src/current.txt";

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

// previous: the previous block
// current: the current block
const getBlockTime = (previous, current) => {
  if (!previous || !current) {
    console.error(`Invalid block. previous: ${previous}. current: ${current}`);
    process.exit(1);
  }
  return current.timestamp - previous.timestamp;
};

const main = async () => {
  let current, currentBlock, previous, previousBlock, latest;
  try {
    latest = await web3.eth.getBlockNumber();
    try {
      current = await fs.readFileSync(CURRENT_BLOCK_FILENAME, "utf8");
    } catch (er) {
      current = latest;
    }
	if (!current) {
		if (!latest) {
			process.exit(1)
		}
		current = latest
	}

    while (true) {
      if (!current) {
	 console.error(`currentBlock is null`)
        process.exit(1)
      }
      console.log(`checking block ${current}`);
      latest = await web3.eth.getBlockNumber();
      if (!latest || current >= latest) {
        await sleep(2000);
        continue;
      }
      previous = current - 1;

      if (!currentBlock) {
        previousBlock = await web3.eth.getBlock(previous);
        currentBlock = await web3.eth.getBlock(current);
      } else {
        previousBlock = currentBlock;
        currentBlock = await web3.eth.getBlock(current);
      }
      if (!previous || !current || !previousBlock || !currentBlock) {
        await sleep(2000);
        continue;
      }

      let blockTime = getBlockTime(previousBlock, currentBlock);
      if (blockTime > THRESHOLD) {
        let author = await utils.getBlockAuthor(previousBlock);
        let msg = `Block https://tomoscan.io/block/${previous} took ${blockTime} seconds. Masternode: ${
          masternodeName[author] ? masternodeName[author] : author
        }`;
        console.log(msg);
        await notiBot.slack(
          msg,
          config.get("slack.token"),
          config.get("slack.target"),
          config.get("slack.botname"),
          config.get("slack.boticon")
        );

        //TODO: do something else to count all slow block
      }
	if (current && current > 1) {
      exec(`echo ${current} > ${CURRENT_BLOCK_FILENAME}`);
      current++;
	} else {
		process.exit(1)
	}
    }
  } catch (err) {
    // exec(`echo ${current} > ${CURRENT_BLOCK_FILENAME}`)
    console.error(`Crawler error ${err}`);
    process.exit(1)
  }
};
main();
