import { connectTestDb, disconnectTestDb } from "./helpers/testDb";

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});
