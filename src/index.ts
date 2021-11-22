import fs from "fs";
import Twitter, { UserV2TimelineParams, UserV2TimelineResult } from "twitter-api-v2";
import prompts from "prompts";

type TwitterUser = {
  id: string;
  username: string;
};

const options: prompts.PromptObject<any>[] = [
  {
    type: "text",
    name: "consumer_key",
    message: "Consumer Key",
    validate: (w: string) => w.length >= 1,
  },
  {
    type: "text",
    name: "consumer_secret",
    message: "Consumer Secret",
    validate: (w: string) => w.length >= 1,
  },
  {
    type: "password",
    name: "access_token",
    message: "Access Token",
    validate: (w: string) => w.length >= 1,
  },
  {
    type: "password",
    name: "access_token_secret",
    message: "Access Token Secret",
    validate: (w: string) => w.length >= 1,
  },
];

const createTwitterInstance = async (options: prompts.PromptObject<any>[]): Promise<[Twitter, string]> => {
  while (true) {
    const response = await prompts(options, {});

    if (!response.consumer_key || !response.consumer_secret || !response.access_token || !response.access_token_secret)
      break;

    const instance = new Twitter({
      appKey: response.consumer_key,
      appSecret: response.consumer_secret,
      accessToken: response.access_token,
      accessSecret: response.access_token_secret,
    });

    try {
      const id = response.access_token.split("-")[0];
      const verified = await instance.v2.user(id).then((w) => w.data);

      return [instance, verified.id];
    } catch (err) {
      console.error(err);
      console.log("try again");
    }
  }

  throw new Error("application exited");
};

const fetch = async (twitter: Twitter, verified: string): Promise<TwitterUser[]> => {
  const blocked: TwitterUser[] = [];
  const muted: TwitterUser[] = [];

  let blockingUsers: UserV2TimelineResult | undefined = undefined;

  do {
    const options: Partial<UserV2TimelineParams> = blockingUsers
      ? { pagination_token: blockingUsers.meta.next_token }
      : {};
    blockingUsers = await twitter.v2.userBlockingUsers(verified, options).then((w) => w.data);

    if (blockingUsers && blockingUsers.data.length > 0) {
      blocked.push(...blockingUsers.data.map((w) => ({ id: w.id, username: w.username })));
    }
  } while (blockingUsers && blockingUsers.meta.next_token);

  let mutingUsers: UserV2TimelineResult | undefined = undefined;

  do {
    const options: Partial<UserV2TimelineParams> = mutingUsers ? { pagination_token: mutingUsers.meta.next_token } : {};
    mutingUsers = await twitter.v2.userMutingUsers(verified, options).then((w) => w.data);

    if (mutingUsers && mutingUsers.data.length > 0) {
      muted.push(...mutingUsers.data.map((w) => ({ id: w.id, username: w.username })));
    }
  } while (mutingUsers && mutingUsers.meta.next_token);

  return [...blocked, ...muted];
};

const main = async () => {
  console.log("please input your Twitter account credentials for API access (v2)");

  const [instance, verified] = await createTwitterInstance(options);
  const users = await fetch(instance, verified);

  fs.writeFileSync("./nuisance-users.json", JSON.stringify(users));
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
