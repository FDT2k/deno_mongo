import { cargoBuild } from "./build.ts";
import { init, MongoClient } from "./mod.ts";
import { assert, assertEquals, exists } from "./test.deps.ts";
import "./ts/tests/type-convert.test.ts";
import "./ts/tests/types-check.test.ts";
import { ObjectId } from "./ts/types.ts";

const { test, runTests } = Deno;
const dateNow = Date.now();

function getClient(): MongoClient {
  const client = new MongoClient();
  client.connectWithUri("mongodb://localhost:27017");
  return client;
}

test(async function testConnectWithUri() {
  const client = new MongoClient();
  client.connectWithUri("mongodb://localhost:27017");
  const names = await client.listDatabases();
  assert(names instanceof Array);
  assert(names.length > 0);
});

test(async function testConnectWithOptions() {
  const client = new MongoClient();
  client.connectWithOptions({
    hosts: ["localhost:27017"]
  });
  const names = await client.listDatabases();
  assert(names instanceof Array);
  assert(names.length > 0);
});

test(async function testListCollectionNames() {
  const db = getClient().database("local");
  const names = await db.listCollectionNames();
  assertEquals(names, ["startup_log"]);
});

test(async function testInsertOne() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const insertId: ObjectId = await users.insertOne({
    username: "user1",
    password: "pass1",
    date: new Date(dateNow)
  });

  assertEquals(Object.keys(insertId), ["$oid"]);

  const user1 = await users.findOne({
    _id: ObjectId(insertId.$oid)
  });

  assertEquals(user1, {
    _id: insertId,
    username: "user1",
    password: "pass1",
    date: new Date(dateNow)
  });
});

test(async function testFindOne() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const user1 = await users.findOne();
  assert(user1 instanceof Object);
  assertEquals(Object.keys(user1), ["_id", "username", "password", "date"]);

  const findNull = await users.findOne({ test: 1 });
  assertEquals(findNull, null);
});

test(async function testUpdateOne() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const result = await users.updateOne({}, { username: "USER1" });
  assertEquals(result, { matchedCount: 1, modifiedCount: 1, upsertedId: null });
});

test(async function testDeleteOne() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const deleteCount = await users.deleteOne({});
  assertEquals(deleteCount, 1);
});

test(async function testInsertMany() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const insertIds = await users.insertMany([
    {
      username: "many",
      password: "pass1"
    },
    {
      username: "many",
      password: "pass2"
    }
  ]);

  assertEquals(insertIds.length, 2);
});

test(async function testFind() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const findUsers = await users.find(
    { username: "many" },
    { skip: 1, limit: 1 }
  );
  assert(findUsers instanceof Array);
  assertEquals(findUsers.length, 1);

  const notFound = await users.find({ test: 1 });
  assertEquals(notFound, []);
});

test(async function testCount() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const count = await users.count({ username: "many" });
  assertEquals(count, 2);
});

test(async function testAggregation() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const docs = await users.aggregate([
    { $match: { username: "many" } },
    { $group: { _id: "$username", total: { $sum: 1 } } }
  ]);
  assertEquals(docs, [{ _id: "many", total: 2 }]);
});

test(async function testUpdateMany() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const result = await users.updateMany(
    { username: "many" },
    { $set: { username: "MANY" } }
  );
  assertEquals(result, { matchedCount: 2, modifiedCount: 2, upsertedId: null });
});

test(async function testDeleteMany() {
  const db = getClient().database("test");
  const users = db.collection("mongo_test_users");
  const deleteCount = await users.deleteMany({ username: "MANY" });
  assertEquals(deleteCount, 2);
});

// TODO mongdb_rust official library has not implemented this feature
// test(async function testCreateIndexes() {
//   const db = getClient().database("test");
//   const collection = db.collection("mongo_indexes");
//   const result = await collection.createIndexes([
//     { keys: { created_at: 1 }, options: { expireAfterSeconds: 10000 } }
//   ]);
//   console.log(result);
// });

if (await exists(".deno_plugins")) {
  await Deno.remove(".deno_plugins", { recursive: true });
}
await cargoBuild();
await init("file://./target/release");
await runTests({});
